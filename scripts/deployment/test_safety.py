"""Local fixture tests only. Never invoke CLI actions, crontab, PM2 or HTTP."""
import importlib.util
import os
import pathlib
import stat
import tempfile
import tarfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent

def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

root = load('deployment_root', 'root-state.py')
smoke = load('deployment_smoke', 'smoke-test.py')
importer = load('deployment_import', 'import-release.py')
ORIGINAL = '# keep\n5 3 * * * /unrelated\n0 4 1 * * curl http://localhost:3024/api/reports/generate\n'
ORIGINAL_LINE = ORIGINAL.splitlines()[-1]

class FakeCron:
    def __init__(self):
        self.text = ORIGINAL
        self.failure = None
    def read(self):
        return self.text
    def install(self, text):
        if self.failure == 'before':
            raise RuntimeError('Interrupted before cron install')
        self.text = text
        if self.failure == 'after':
            raise RuntimeError('Interrupted after cron install')

class DeploymentSafety(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = pathlib.Path(self.temp.name)
        self.cron = FakeCron()
        self.coordinator = root.Coordinator(self.directory, self.cron, os.getuid())
        self.coordinator.init('release1')

    def reload(self):
        self.coordinator = root.Coordinator(self.directory, self.cron, os.getuid())

    def active(self, release='release1'):
        self.coordinator.pause(release)
        self.coordinator.mark_switching(release)
        self.coordinator.ready(release, True)
        self.coordinator.activate(release)

    def test_private_snapshots_and_no_current_gate_change_during_preparation(self):
        self.assertIsNone(self.coordinator.current())
        self.assertEqual(self.cron.text, ORIGINAL)
        for file in (self.directory / 'release1').iterdir():
            self.assertEqual(stat.S_IMODE(file.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE((self.directory / 'release1').stat().st_mode), 0o700)

    def test_pause_recovers_before_and_after_cron_install(self):
        for point in ['before', 'after']:
            self.cron.text = ORIGINAL
            self.coordinator.phase('release1', 'prepared')
            self.cron.failure = point
            with self.assertRaises(RuntimeError):
                self.coordinator.pause('release1')
            self.reload()
            self.assertEqual(self.coordinator.state('release1')['phase'], 'pausing')
            self.assertFalse(self.coordinator.dispatch(lambda release: self.fail('Must not run report')))
            self.cron.failure = None
            self.coordinator.pause('release1')
            self.assertEqual(self.coordinator.state('release1')['phase'], 'paused')
            self.assertIn(root.DISPATCH, self.cron.text)

    def test_reboot_gate_stays_closed_until_confirmed_live_and_saved_pm2(self):
        self.coordinator.pause('release1')
        self.coordinator.mark_switching('release1')
        self.reload()
        self.assertFalse(self.coordinator.dispatch(lambda release: self.fail()))
        with self.assertRaises(ValueError):
            self.coordinator.ready('release1', False)
        with self.assertRaises(ValueError):
            self.coordinator.activate('release1')
        self.coordinator.ready('release1', True)
        self.reload()
        self.assertFalse(self.coordinator.dispatch(lambda release: self.fail()))
        self.coordinator.activate('release1')
        self.reload()
        selected = []
        self.assertTrue(self.coordinator.dispatch(selected.append))
        self.assertEqual(selected, ['release1'])

    def test_rollback_accepts_original_and_updated_cron_preserves_unrelated_edits(self):
        self.active()
        for selected in [ORIGINAL_LINE, root.DISPATCH]:
            self.cron.text = '9 9 * * * /new-unrelated\n' + ORIGINAL.replace(ORIGINAL_LINE, selected)
            self.coordinator.phase('release1', 'active')
            self.coordinator.begin_rollback('release1')
            with self.assertRaises(ValueError):
                self.coordinator.finish_rollback('release1', False)
            self.coordinator.finish_rollback('release1', True)
            self.assertIn('9 9 * * * /new-unrelated', self.cron.text)
            self.assertIn(ORIGINAL_LINE, self.cron.text)
            self.assertEqual(self.coordinator.state('release1')['phase'], 'rolled_back')
            self.coordinator.finish_rollback('release1', True)  # idempotent

    def test_unknown_edited_report_job_is_never_overwritten(self):
        self.active()
        self.cron.text = ORIGINAL.replace('0 4 1', '0 5 1')
        before = self.cron.text
        with self.assertRaises(ValueError):
            self.coordinator.begin_rollback('release1')
        self.assertEqual(before, self.cron.text)
        self.assertEqual(self.coordinator.state('release1')['phase'], 'rolling_back')
        self.assertFalse(self.coordinator.dispatch(lambda release: self.fail()))

    def test_resume_rollback_after_cron_restore_but_before_final_phase(self):
        self.active()
        self.coordinator.begin_rollback('release1')
        self.cron.failure = 'after'
        with self.assertRaises(RuntimeError):
            self.coordinator.finish_rollback('release1', True)
        self.reload()
        self.assertIn(ORIGINAL_LINE, self.cron.text)
        self.assertEqual(self.coordinator.state('release1')['phase'], 'restoring_scheduler')
        self.cron.failure = None
        self.coordinator.finish_rollback('release1', True)
        self.assertIsNone(self.coordinator.current())

    def test_previous_active_scheduler_and_credential_selection_restore_together(self):
        self.active()
        self.coordinator.init('release2')
        self.assertEqual(self.coordinator.current(), 'release1')
        self.coordinator.pause('release2')
        self.coordinator.begin_rollback('release2')
        self.coordinator.finish_rollback('release2', True)
        selected = []
        self.coordinator.dispatch(selected.append)
        self.assertEqual(selected, ['release1'])
        self.assertIn(root.DISPATCH, self.cron.text)

    def test_abort_before_any_activation_does_not_change_cron(self):
        self.coordinator.begin_rollback('release1')
        self.assertEqual(self.coordinator.state('release1')['phase'], 'aborted')
        self.assertEqual(self.cron.text, ORIGINAL)

    def test_permissions_and_symlinks_fail_closed(self):
        file = self.directory / 'unsafe'
        file.write_text('fixture')
        file.chmod(0o666)
        with self.assertRaises(ValueError):
            root.protected(file, os.getuid())
        link = self.directory / 'link'
        link.symlink_to(file)
        with self.assertRaises(ValueError):
            root.protected(link, os.getuid())
        with self.assertRaises(ValueError):
            root.protected(self.directory, os.getuid() + 1)
        with self.assertRaises(ValueError):
            root.atomic_write(link, b'never write', os.getuid())
        self.assertEqual(file.read_text(), 'fixture')

    def test_unrecognised_duplicate_and_missing_cron_states_refused(self):
        for text in [ORIGINAL + ORIGINAL, '# no report\n', ORIGINAL.replace('0 4 1', '1 4 1')]:
            with self.assertRaises(ValueError):
                root.update_report_job(text, ORIGINAL_LINE, root.DISPATCH)

    def test_managed_cron_without_previous_journal_cannot_initialize(self):
        self.cron.text = root.DISPATCH + '\n'
        with self.assertRaises(ValueError):
            self.coordinator.init('release2')
        self.assertFalse((self.directory / 'release2').exists())

    def test_import_budget_refuses_to_consume_live_disk_reserve(self):
        with self.assertRaises(ValueError):
            importer.disk_budget(importer.RESERVE + 100, 101)
        importer.disk_budget(importer.RESERVE + 101, 101)

    def test_import_rejects_traversal_external_links_and_special_files(self):
        for name in ['../escape', '/absolute', 'source/../../escape']:
            with self.assertRaises(ValueError):
                importer.inspect_members([tarfile.TarInfo(name)])
        ordinary = tarfile.TarInfo('source/file')
        link = tarfile.TarInfo('source/link')
        link.type = tarfile.SYMTYPE
        link.linkname = '/etc/passwd'
        with self.assertRaises(ValueError):
            importer.inspect_members([ordinary, link])
        special = tarfile.TarInfo('pipe')
        special.type = tarfile.FIFOTYPE
        with self.assertRaises(ValueError):
            importer.inspect_members([special])

    def test_import_allows_internal_npm_link_but_no_link_parent_traversal(self):
        ordinary = tarfile.TarInfo('node_modules/package/bin.js')
        ordinary.size = 100
        link = tarfile.TarInfo('node_modules/.bin/tool')
        link.type = tarfile.SYMTYPE
        link.linkname = '../package/bin.js'
        members, size = importer.inspect_members([ordinary, link])
        self.assertEqual(len(members), 2)
        self.assertEqual(size, 100)
        nested = tarfile.TarInfo('node_modules/.bin/tool/child')
        with self.assertRaises(ValueError):
            importer.inspect_members([ordinary, link, nested])

    def test_basic_smoke_policy_cannot_reach_services_even_when_guards_fail(self):
        for route, method in [('/api/login', 'POST'), ('/api/auth', 'POST'), ('/api/auth', 'DELETE'), ('/api/reports', 'GET')]:
            smoke.check_route(route, method, False, False)
        for route in ['/api/costs', '/api/reports/history', '/api/reports?month=2026-09', '/api/reports/generate?month=2026-09', '/reports/2026-09', '/api/reports/2026-09/pdf', '/api/ec2', '/api/ebs/delete', '/api/ai']:
            with self.assertRaises(ValueError):
                smoke.check_route(route, 'GET', False, False)

    def test_read_permission_does_not_grant_report_or_management_operations(self):
        smoke.check_route('/api/costs', 'GET', True, False)
        for route in ['/api/reports/generate?month=2026-09', '/api/reports/2026-09/pdf', '/reports/2026-09', '/api/ec2']:
            with self.assertRaises(ValueError):
                smoke.check_route(route, 'GET', True, False)
        smoke.check_route('/api/reports/generate?month=2026-09', 'GET', False, True)
        with self.assertRaises(ValueError):
            smoke.check_route('/api/ec2', 'POST', True, True)

if __name__ == '__main__':
    unittest.main()
