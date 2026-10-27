"""Mock-only tests. Never invoke SSH, PM2, cron or application endpoints."""
import importlib.util
import io
import json
import os
import hashlib
import datetime
from contextlib import contextmanager
from pathlib import Path
import tarfile
import tempfile
import shutil
import unittest
from unittest.mock import patch


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


d = load('manual_deploy', 'manual-deploy.py')
gate = load('ci_gate', 'ci-gate.py')
SHA = 'a' * 40
APPROVED_CRON_FORMS = (
    '0 4 1 * * curl http://localhost:3024/api/reports/generate',
    '0 4 1 * * wget -O - http://localhost:3024/api/reports/generate',
)


def archive(name='package-lock.json', link=False):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w') as stream:
        item = tarfile.TarInfo(name)
        if link:
            item.type = tarfile.SYMTYPE
            item.linkname = '/tmp/outside'
            stream.addfile(item)
        else:
            item.size = 2
            stream.addfile(item, io.BytesIO(b'{}'))
    return output.getvalue()


class DeploymentTests(unittest.TestCase):
    @contextmanager
    def migration_fixture(self, text):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            state = {'text': text, 'writes': []}
            def install(value):
                state['text'] = value
                state['writes'].append(value)
            original_resolve = Path.resolve
            def resolve(item, *args, **kwargs):
                return Path('/usr/share/zoneinfo/Europe/London') if str(item) == '/etc/localtime' else original_resolve(item, *args, **kwargs)
            with patch.object(d, 'CRON', base / 'cron'), patch.object(d, 'ROOT_BACKUPS', base / 'backups'), patch.object(d, 'protected'), patch.object(d, 'system_cron_conflicts'), patch.object(Path, 'resolve', resolve):
                yield state, lambda: state['text'], install, base

    def test_ci_requires_exact_repository_master_push_and_success(self):
        run = dict(head_sha=SHA, head_branch='master', event='push', status='completed', conclusion='success',
                   path='.github/workflows/ci.yml', repository={'full_name': 'vectorstackio/costinsightsclient'})
        self.assertTrue(gate.eligible({'workflow_runs': [run]}, SHA))
        for key, value in [('head_sha', 'b' * 40), ('head_branch', 'develop'), ('event', 'pull_request'),
                           ('status', 'in_progress'), ('conclusion', 'failure'), ('path', '.github/workflows/other.yml'),
                           ('repository', {'full_name': 'other/repository'})]:
            with self.subTest(key=key):
                self.assertFalse(gate.eligible({'workflow_runs': [{**run, key: value}]}, SHA))
        self.assertFalse(gate.eligible({'workflow_runs': []}, SHA))
        self.assertFalse(gate.eligible({'workflow_runs': [run]}, ';anything'))

    def test_forced_command_rejects_shell_inputs_and_remote_rollback(self):
        self.assertEqual(d.command('deploy ' + SHA + ' ' + 'b' * 64), (SHA, 'b' * 64))
        for command in ['rollback', '--rollback', 'deploy master x', 'deploy ' + SHA + ' ' + 'b' * 64 + '; id', 'env', 'deploy\n' + SHA]:
            with self.subTest(command=command):
                with self.assertRaises(ValueError):
                    d.command(command)

    def test_archive_rejects_private_paths_traversal_links_and_special_files(self):
        for name, link in [('../outside', False), ('/tmp/outside', False), ('src/lib/config/index.ts', False),
                           ('.env.local', False), ('.git/config', False), ('public/link', True), ('node_modules/file', False)]:
            with tempfile.TemporaryDirectory() as root, self.subTest(name=name):
                with self.assertRaises(ValueError):
                    d.extract_source(archive(name, link), Path(root))
                self.assertEqual(list(Path(root).iterdir()), [])
        with tempfile.TemporaryDirectory() as root:
            d.extract_source(archive(), Path(root))
            self.assertEqual((Path(root) / 'package-lock.json').read_text(), '{}')

    def test_configuration_preserved_except_public_origin(self):
        with tempfile.TemporaryDirectory() as root:
            source, target = Path(root) / 'old', Path(root) / 'new'
            for base in (source, target):
                (base / 'src/lib').mkdir(parents=True)
            (source / 'src/lib/config').mkdir()
            config = "export const PW_SALT = 'fixture'; export const USERS = {}"
            (source / 'src/lib/config/index.ts').write_text(config)
            (source / '.env.local').write_text('AWS_SETTING=fixture\nNEXT_PUBLIC_BASE_URL=http://localhost:3024\n')
            (source / '.env.production.local').write_text('OTHER_SETTING=preserve\nNEXT_PUBLIC_BASE_URL=http://localhost:3024\n')
            d.copy_configuration(source, target)
            self.assertEqual((source / 'src/lib/config/index.ts').read_text(), config)
            self.assertEqual((target / 'src/lib/config/index.ts').read_text(), config)
            self.assertEqual((source / '.env.local').read_bytes(), (target / '.env.local').read_bytes())
            self.assertEqual((target / '.env.production.local').read_text(), 'OTHER_SETTING=preserve\nNEXT_PUBLIC_BASE_URL=' + d.ORIGIN + '\n')
            self.assertEqual((target / '.env.local').stat().st_mode & 0o777, 0o600)

    def test_low_resources_fail_before_work(self):
        d.preflight(d.MIN_DISK, d.MIN_MEMORY)
        for disk, memory in [(0, d.MIN_MEMORY), (d.MIN_DISK, 0)]:
            with self.assertRaises(ValueError):
                d.preflight(disk, memory)

    def test_scheduler_missing_or_malformed_fails_closed(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            (base / 'scheduler').mkdir(mode=0o700)
            credential = base / 'scheduler/report-job.curl.conf'
            credential.write_text('header = "Authorization: ReportJob ' + 'a' * 43 + '"\n')
            credential.chmod(0o600)
            cron = base / 'cron'
            cron.write_text(d.CRON_TEXT)
            original_resolve = Path.resolve
            def resolve(item, *args, **kwargs):
                return Path('/usr/share/zoneinfo/Europe/London') if str(item) == '/etc/localtime' else original_resolve(item, *args, **kwargs)
            with patch.object(d, 'BASE', base), patch.object(d, 'CRON', cron), patch.object(d, 'protected'), patch.object(d, 'call', return_value=b'{"legacy_count":0,"managed":true}'), patch.object(Path, 'resolve', resolve):
                self.assertEqual(len(d.scheduler_ready()), 64)
                credential.chmod(0o644)
                with self.assertRaises(ValueError):
                    d.scheduler_ready()
                credential.chmod(0o600)
                cron.write_text('0 4 1 * * curl http://localhost:3024/api/reports/generate\n')
                with self.assertRaises(ValueError):
                    d.scheduler_ready()

    def test_activation_restores_old_on_select_health_or_save_failure(self):
        for failure in ('select', 'health', 'save', None):
            events = []
            def action(stage):
                def run(value, *unused):
                    events.append((stage, value))
                    if value == 'new' and stage == failure:
                        raise RuntimeError('fixture')
                return run
            if failure:
                with self.assertRaisesRegex(RuntimeError, 'previous application restored'):
                    d.activate('new', 'old', action('select'), action('health'), action('save'))
                self.assertEqual(events[-3:], [('select', 'old'), ('health', 'old'), ('save', 'old')])
            else:
                d.activate('new', 'old', action('select'), action('health'), action('save'))
                self.assertEqual(events, [('select', 'new'), ('health', 'new'), ('save', 'new')])

    def test_failed_rollback_reports_manual_recovery(self):
        def fail(*args):
            raise RuntimeError('private details')
        with self.assertRaisesRegex(RuntimeError, 'automatic rollback failed') as caught:
            d.activate('new', 'old', fail, fail, fail)
        self.assertNotIn('private details', str(caught.exception))

    def test_definition_preserves_runtime_and_only_targets_application(self):
        entry = {'pm2_env': {'name': d.APP, 'exec_mode': 'fork_mode', 'pm_cwd': str(d.LEGACY),
                            'pm_exec_path': '/existing/npm', 'args': ['start'], 'env': {'AWS_SETTING': 'fixture'},
                            'NEXT_PUBLIC_BASE_URL': 'http://localhost:3024', 'restart_delay': 1000}}
        candidate = d.definition(entry, d.RELEASES / (SHA + '-20260101T000000'), True)['apps'][0]
        previous = d.definition(entry, d.LEGACY)['apps'][0]
        self.assertEqual(candidate['env']['AWS_SETTING'], 'fixture')
        self.assertEqual(candidate['env']['NEXT_PUBLIC_BASE_URL'], d.ORIGIN)
        self.assertEqual(previous['env']['NEXT_PUBLIC_BASE_URL'], 'http://localhost:3024')
        self.assertEqual(previous['script'], '/existing/npm')
        self.assertEqual(candidate['name'], d.APP)
        self.assertEqual(candidate['restart_delay'], 1000)

    def test_health_is_service_free_and_checks_all_rejections(self):
        with patch.object(d, 'probe', return_value={'success': False}) as probe:
            d.health()
            self.assertEqual(probe.call_count, 3)
            self.assertTrue(all(call.args[:2] == ('/api/reports', 401) for call in probe.call_args_list))
        with self.assertRaises(ValueError):
            d.probe('/api/reports/generate', 200)

    def test_atomic_backup_and_private_path_permissions(self):
        with tempfile.TemporaryDirectory() as root:
            filename = Path(root) / 'backup.json'
            d.write_json(filename, {'apps': []})
            d.private(filename)
            self.assertEqual(json.loads(filename.read_text()), {'apps': []})
            filename.chmod(0o644)
            with self.assertRaises(ValueError):
                d.private(filename)

    def test_cron_migration_preserves_unrelated_entries_and_is_repeatable(self):
        unrelated = '# private unrelated settings\n5 3 * * * /unrelated\n'
        for command in APPROVED_CRON_FORMS:
            original = unrelated + command + '\n'
            with self.subTest(command=command), self.migration_fixture(original) as (state, read, install, base):
                self.assertEqual(d.cron_plan(original), (unrelated, 1))
                digest = hashlib.sha256(original.encode()).hexdigest()
                d.migrate_scheduler(digest, read, install)
                self.assertEqual(state['text'], unrelated)
                self.assertEqual((base / 'cron').read_text(), d.CRON_TEXT)
                self.assertEqual((base / 'backups' / (digest + '.crontab')).read_text(), original)
                d.migrate_scheduler(hashlib.sha256(unrelated.encode()).hexdigest(), read, install)
                self.assertEqual(state['writes'], [unrelated])

    def test_cron_rejects_duplicate_and_mixed_approved_jobs(self):
        for first in APPROVED_CRON_FORMS:
            for second in APPROVED_CRON_FORMS:
                original = first + '\n' + second + '\n'
                with self.subTest(first=first, second=second), self.migration_fixture(original) as (state, read, install, base):
                    with self.assertRaises(ValueError):
                        d.migrate_scheduler(hashlib.sha256(original.encode()).hexdigest(), read, install)
                    self.assertEqual(state['text'], original)
                    self.assertEqual(state['writes'], [])
                    self.assertFalse((base / 'cron').exists())

    def test_cron_rejects_altered_urls_arguments_and_shell_commands(self):
        for command in APPROVED_CRON_FORMS:
            variants = [
                command.replace('http:', 'https:'),
                command.replace('localhost', '127.0.0.1'),
                command.replace(':3024', ':3025'),
                command + '?month=2026-01',
                command + ' --quiet',
                command + ' > /dev/null',
                command + '; /unrelated',
                command + ' && /unrelated',
                command.replace('0 4 1', '0 5 1'),
                command.replace('wget -O -', 'wget -qO-') if 'wget' in command else command.replace('curl ', '/usr/bin/curl '),
            ]
            for variant in variants:
                original = '# preserve\n5 3 * * * /unrelated\n' + variant + '\n'
                with self.subTest(variant=variant), self.migration_fixture(original) as (state, read, install, base):
                    with self.assertRaises(ValueError):
                        d.migrate_scheduler(hashlib.sha256(original.encode()).hexdigest(), read, install)
                    self.assertEqual(state['text'], original)
                    self.assertEqual(state['writes'], [])
                    self.assertFalse((base / 'cron').exists())

    def test_cron_unknown_changes_duplicates_and_stale_digest_never_overwritten(self):
        for text in [d.LEGACY_CRON + '\n' + d.LEGACY_CRON + '\n',
                     '0 4 1 * * curl -s http://localhost:3024/api/reports/generate\n']:
            with self.migration_fixture(text) as (state, read, install, _):
                with self.assertRaises(ValueError):
                    d.migrate_scheduler(hashlib.sha256(text.encode()).hexdigest(), read, install)
                self.assertEqual(state['writes'], [])
        with self.migration_fixture(d.LEGACY_CRON + '\n') as (state, read, install, base):
            with self.assertRaises(ValueError):
                d.migrate_scheduler('0' * 64, read, install)
            (base / 'cron').write_text('unexpected administrator change')
            with self.assertRaises(ValueError):
                d.migrate_scheduler(hashlib.sha256(state['text'].encode()).hexdigest(), read, install)
            self.assertEqual(state['writes'], [])

    def test_cron_interruption_after_removal_recovers_without_duplicate_job(self):
        for command in APPROVED_CRON_FORMS:
            original = '5 3 * * * /unrelated\n' + command + '\n'
            with self.subTest(command=command), self.migration_fixture(original) as (state, read, install, base):
                def interrupted(value):
                    install(value)
                    raise KeyboardInterrupt()
                with self.assertRaises(KeyboardInterrupt):
                    d.migrate_scheduler(hashlib.sha256(original.encode()).hexdigest(), read, interrupted)
                self.assertFalse((base / 'cron').exists())
                self.assertEqual(state['text'], '5 3 * * * /unrelated\n')
                d.migrate_scheduler(hashlib.sha256(state['text'].encode()).hexdigest(), read, install)
                self.assertEqual((base / 'cron').read_text(), d.CRON_TEXT)
                self.assertEqual(len(state['writes']), 1)
                d.migrate_scheduler(hashlib.sha256(state['text'].encode()).hexdigest(), read, install)
                self.assertEqual(len(state['writes']), 1)

    def test_cron_concurrent_edit_is_preserved(self):
        original = d.LEGACY_CRON + '\n'
        with self.migration_fixture(original) as (state, _, install, _):
            reads = iter([original, original + '# concurrent edit\n'])
            with self.assertRaises(ValueError):
                d.migrate_scheduler(hashlib.sha256(original.encode()).hexdigest(), lambda: next(reads), install)
            self.assertEqual(state['writes'], [])

    def test_deployment_and_report_locks_exclude_concurrent_operations(self):
        with tempfile.TemporaryDirectory() as root, patch.object(d, 'BASE', Path(root)):
            with d.deployment_locks():
                with self.assertRaises(BlockingIOError):
                    with d.deployment_locks():
                        self.fail('overlap')
            with open(Path(root) / 'report.lock', 'a') as reporting:
                d.fcntl.flock(reporting, d.fcntl.LOCK_EX | d.fcntl.LOCK_NB)
                with self.assertRaises(BlockingIOError):
                    with d.deployment_locks():
                        self.fail('report overlap')
            with d.deployment_locks():
                pass

    def test_new_private_files_reject_symlinks_and_preserve_destination(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            source = base / 'source'
            source.write_text('fixture')
            target = base / 'target'
            target.symlink_to(source)
            with self.assertRaises(FileExistsError):
                d.copy_private(source, target)
            self.assertEqual(source.read_text(), 'fixture')
            with patch.object(d, 'BASE', base):
                (base / 'deploy.lock').symlink_to(source)
                with self.assertRaises(OSError):
                    with d.deployment_locks():
                        self.fail('symlink lock')

    def test_pm2_commands_switch_only_the_named_application(self):
        with patch.object(d, 'call') as call:
            d.select_application(Path('/private/candidate.json'))
            self.assertEqual(call.call_args_list[0].args[0], [d.NODE, d.PM2, 'delete', d.APP])
            self.assertEqual(call.call_args_list[1].args[0], [d.NODE, d.PM2, 'start', '/private/candidate.json', '--only', d.APP])

    def test_interruption_during_switch_restores_previous_and_persists(self):
        events = []
        def select(value):
            events.append(('select', value))
            if value == 'new':
                raise KeyboardInterrupt()
        with self.assertRaisesRegex(RuntimeError, 'previous application restored'):
            d.activate('new', 'old', select, lambda value, _: events.append(('wait', value)), lambda value: events.append(('save', value)))
        self.assertEqual(events[-3:], [('select', 'old'), ('wait', 'old'), ('save', 'old')])

    def test_interrupted_activation_can_use_persisted_manual_rollback(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            backup = base / 'backups' / 'attempt'
            backup.mkdir(parents=True, mode=0o700)
            previous = {'apps': [{'name': d.APP, 'cwd': str(d.LEGACY)}]}
            d.write_json(backup / 'previous.json', previous)
            d.write_json(base / 'rollback.json', {'backup': str(backup)})
            with patch.object(d, 'BASE', base), patch.object(d, 'select_application') as select, patch.object(d, 'wait_online') as wait, patch.object(d, 'persist') as persist:
                d.rollback()
                select.assert_called_once_with(backup / 'previous.json')
                wait.assert_called_once_with(previous, False)
                persist.assert_called_once_with(previous)

    def pre_switch_failure(self, failure):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            legacy = base / 'legacy'
            (legacy / 'src/lib/config').mkdir(parents=True)
            original = 'fixture private config'
            (legacy / 'src/lib/config/index.ts').write_text(original)
            releases = base / 'releases'
            releases.mkdir()
            (base / 'backups').mkdir()
            entry = {'pid': 123, 'pm2_env': {'name': d.APP, 'exec_mode': 'fork_mode', 'pm_cwd': str(legacy), 'pm_exec_path': '/old/npm', 'env': {}}}
            original_resolve = Path.resolve
            def resolve(item, *args, **kwargs):
                return Path(d.NODE) if str(item) == '/proc/123/exe' else original_resolve(item, *args, **kwargs)
            def extract(_, release):
                (release / 'src/lib').mkdir(parents=True)
            def fail_build(args, *unused):
                if failure == 'install' or args == [d.NPM, 'run', 'build']:
                    raise RuntimeError('mock build failure')
                return b''
            class Clock(datetime.datetime):
                @classmethod
                def now(cls, tz=None):
                    return cls(2026, 10, 2, 12, tzinfo=tz)
            with patch.object(d, 'BASE', base), patch.object(d, 'RELEASES', releases), patch.object(d, 'LEGACY', legacy), patch.object(d, 'scheduler_ready', return_value='hash'), patch.object(d, 'preflight'), patch.object(d, 'selected', return_value=entry), patch.object(Path, 'resolve', resolve), patch.object(d, 'extract_source', side_effect=extract), patch.object(d, 'call', side_effect=fail_build), patch.object(d, 'token_hash', return_value='other' if failure == 'credential' else 'hash'), patch.object(d, 'activate') as activate, patch.object(d.datetime, 'datetime', Clock):
                raw = b'fixture'
                with self.assertRaises((RuntimeError, ValueError)):
                    d.deploy(SHA, hashlib.sha256(raw).hexdigest(), raw)
                activate.assert_not_called()
                self.assertFalse((base / 'rollback.json').exists())
                self.assertEqual((legacy / 'src/lib/config/index.ts').read_text(), original)

    def test_failed_build_never_switches_pm2_and_preserves_legacy_checkout(self):
        for failure in ('install', 'build'):
            with self.subTest(failure=failure):
                self.pre_switch_failure(failure)

    def test_scheduler_rejects_unmigrated_legacy_even_when_new_job_exists(self):
        with patch.object(d, 'call', return_value=b'{"legacy_count":1,"managed":true}'):
            with self.assertRaisesRegex(ValueError, 'Legacy scheduler'):
                d.scheduler_ready()

    def test_provisioning_preserves_existing_credentials_and_is_restartable(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            legacy = base / 'legacy'
            (legacy / 'src/lib/config').mkdir(parents=True)
            (legacy / 'package.json').write_text('{}')
            (legacy / 'node_modules').symlink_to(Path(__file__).resolve().parents[2] / 'node_modules', target_is_directory=True)
            source = legacy / 'src/lib/config/index.ts'
            prefix = "export const PW_SALT = 'synthetic-jwt';\nexport const USERS = {'fixture':'fixture'};\n"
            token = 'A' * 43
            original = prefix + "export const REPORT_JOB_TOKEN: string = '" + token + "'\n"
            source.write_text(original)
            with patch.object(d, 'BASE', base), patch.object(d, 'LEGACY', legacy), patch.object(d, 'NODE', shutil.which('node')):
                d.provision_report_job()
                credential = base / 'scheduler/report-job.curl.conf'
                self.assertEqual(credential.read_text(), 'header = "Authorization: ReportJob ' + token + '"\n')
                self.assertTrue(source.read_text().startswith(prefix))
                self.assertEqual((base / 'scheduler/config.before.ts').read_text(), original)
                # Simulate interrupted provisioning: header written, config still empty.
                source.write_text(prefix + "export const REPORT_JOB_TOKEN = ''\n")
                d.provision_report_job()
                self.assertIn(token, source.read_text())
                self.assertEqual(credential.stat().st_mode & 0o777, 0o600)
                before = source.read_text()
                credential.write_text('header = "Authorization: ReportJob ' + 'B' * 43 + '"\n')
                with self.assertRaises(RuntimeError):
                    d.provision_report_job()
                self.assertEqual(source.read_text(), before)

    def test_credential_mismatch_after_install_never_activates(self):
        self.pre_switch_failure('credential')


if __name__ == '__main__':
    unittest.main()
