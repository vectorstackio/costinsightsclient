#!/usr/bin/python3
"""Root-owned coordinator: only protected state, scoped cron edits and privilege drop.
Never reads/writes candidate files, runs Node, or executes an application-owned tool.
"""
import argparse
import fcntl
import json
import os
import pathlib
import re
import stat
import subprocess
import sys
import tempfile
import time

ROOT = pathlib.Path('/var/lib/costinsightsclient-deploy')
HELPER = '/usr/local/libexec/costinsightsclient-deploy.py'
WRAPPER = '/usr/local/libexec/costinsights-report-job'
DISPATCH = '0 4 1 * * /usr/bin/python3 -I -B ' + HELPER + ' dispatch --execute'
RELEASE_ID = re.compile(r'[A-Za-z0-9_-]{1,100}')


def relevant(line):
    return not line.lstrip().startswith('#') and bool(re.search(r'/api/reports/generate\b|costinsightsclient-deploy\.py\s+dispatch\b', line))


def original_job(cron):
    jobs = [line for line in cron.splitlines() if relevant(line)]
    if len(jobs) != 1 or not re.match(r'^\s*0\s+4\s+1\s+\*\s+\*\s+', jobs[0]):
        raise ValueError('Unrecognised report cron state')
    return jobs[0]


def update_report_job(current, original, desired):
    """Accept original OR managed entry; preserve every unrelated current line."""
    lines = current.splitlines(keepends=True)
    selected = [i for i, line in enumerate(lines) if relevant(line)]
    if len(selected) != 1:
        raise ValueError('Missing/duplicate/unknown report job; manual merge required')
    index = selected[0]
    actual = lines[index].rstrip('\r\n')
    if actual not in (original, DISPATCH):
        raise ValueError('Report job was edited; refuse overwrite')
    if actual == desired:
        return current
    ending = '\n' if lines[index].endswith('\n') else ''
    lines[index] = desired + ending
    return ''.join(lines)


def protected(path, uid=0, directory=False):
    info = path.lstat()
    if stat.S_ISLNK(info.st_mode) or info.st_uid != uid or info.st_mode & 0o022:
        raise ValueError('Untrusted protected path')
    if directory and not stat.S_ISDIR(info.st_mode):
        raise ValueError('Expected directory')
    return info


def atomic_write(path, data, uid=0):
    protected(path.parent, uid, True)
    if path.exists() or path.is_symlink():
        protected(path, uid)
    fd, temp = tempfile.mkstemp(prefix='.pending-', dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, path)
        directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


class Cron:
    def read(self):
        result = subprocess.run(['/usr/bin/crontab', '-l'], capture_output=True, check=True)
        return result.stdout.decode()

    def install(self, text):
        subprocess.run(['/usr/bin/crontab', '-'], input=text.encode(), capture_output=True, check=True)
        # Fixed Ubuntu root-cron path, never an application-controlled location.
        # Fail while the phase remains pending if persistence cannot be assured.
        for filename in ['/var/spool/cron/crontabs/root', '/var/spool/cron/crontabs']:
            fd = os.open(filename, os.O_RDONLY | os.O_NOFOLLOW)
            try:
                if os.fstat(fd).st_uid != 0:
                    raise ValueError('Unexpected cron spool owner')
                os.fsync(fd)
            finally:
                os.close(fd)


class Coordinator:
    # uid is injectable solely for local fixture tests. CLI always requires root.
    def __init__(self, root, cron, uid=0):
        self.root, self.cron, self.uid = pathlib.Path(root), cron, uid
        protected(self.root, uid, True)

    def write_json(self, path, value):
        atomic_write(path, json.dumps(value).encode(), self.uid)

    def load_json(self, path):
        protected(path, self.uid)
        return json.loads(path.read_bytes())

    def directory(self, release):
        if not RELEASE_ID.fullmatch(release or ''):
            raise ValueError('Invalid release ID')
        result = self.root / release
        protected(result, self.uid, True)
        return result

    def state(self, release):
        return self.load_json(self.directory(release) / 'state.json')

    def current(self):
        file = self.root / 'current.json'
        return self.load_json(file).get('release') if file.exists() else None

    def phase(self, release, name):
        value = self.state(release)
        value['phase'] = name
        self.write_json(self.directory(release) / 'state.json', value)
        self.write_json(self.root / 'current.json', {'release': release})

    def init(self, release, legacy_files=()):
        if not RELEASE_ID.fullmatch(release or '') or (self.root / release).exists():
            raise ValueError('Fresh release ID required')
        previous = self.current()
        if previous and self.state(previous)['phase'] != 'active':
            raise ValueError('Recover the interrupted deployment first')
        original = self.cron.read()
        line = original_job(original)
        if (line == DISPATCH) != bool(previous):
            raise ValueError('Managed cron and previous journal disagree')
        directory = self.root / release
        directory.mkdir(mode=0o700)
        atomic_write(directory / 'root.crontab.original', original.encode(), self.uid)
        # Existing legacy scheduler files remain untouched; keep private copies.
        for filename, backup in legacy_files:
            file = pathlib.Path(filename)
            if self.uid == 0 and (file.exists() or file.is_symlink()):
                info = protected(file)
                atomic_write(directory / backup, file.read_bytes())
                self.write_json(directory / (backup + '.metadata'), {'mode': stat.S_IMODE(info.st_mode), 'uid': info.st_uid, 'gid': info.st_gid})
        self.write_json(directory / 'state.json', {'release': release, 'phase': 'prepared', 'original_job': line, 'previous_release': previous})
        # Do not change the current scheduler gate during preparation.

    def change_cron(self, release, desired):
        current = self.cron.read()
        proposed = update_report_job(current, self.state(release)['original_job'], desired)
        if proposed != current:
            if self.cron.read() != current:
                raise ValueError('Cron changed during inspection; retry after review')
            self.cron.install(proposed)

    def pause(self, release):
        if self.state(release)['phase'] not in ('prepared', 'pausing', 'paused'):
            raise ValueError('Unexpected phase')
        self.phase(release, 'pausing')  # durable intent BEFORE cron mutation
        self.change_cron(release, DISPATCH)
        self.phase(release, 'paused')

    def mark_switching(self, release):
        if self.state(release)['phase'] not in ('paused', 'switching'):
            raise ValueError('Unexpected phase')
        self.phase(release, 'switching')

    def ready(self, release, confirmed):
        if not confirmed or self.state(release)['phase'] not in ('switching', 'ready'):
            raise ValueError('Confirm live AND saved PM2 state first')
        self.phase(release, 'ready')

    def activate(self, release):
        if self.state(release)['phase'] not in ('ready', 'active'):
            raise ValueError('Unexpected phase')
        if original_job(self.cron.read()) != DISPATCH:
            raise ValueError('Managed cron entry missing or modified')
        self.phase(release, 'active')

    def begin_rollback(self, release):
        value = self.state(release)
        if value['phase'] == 'prepared':
            value['phase'] = 'aborted'
            self.write_json(self.directory(release) / 'state.json', value)
            return
        if value['phase'] not in ('pausing', 'paused', 'switching', 'ready', 'active', 'rolling_back'):
            raise ValueError('Unexpected phase')
        self.phase(release, 'rolling_back')
        self.change_cron(release, DISPATCH)

    def finish_rollback(self, release, confirmed):
        value = self.state(release)
        if value['phase'] == 'rolled_back':
            return
        if not confirmed or value['phase'] not in ('rolling_back', 'restoring_scheduler'):
            raise ValueError('Confirm restored live AND saved PM2 state first')
        self.phase(release, 'restoring_scheduler')
        self.change_cron(release, value['original_job'])
        # Old application is already persisted before the original job can run.
        self.write_json(self.root / 'current.json', {'release': value['previous_release']})
        value['phase'] = 'rolled_back'
        self.write_json(self.directory(release) / 'state.json', value)

    def dispatch(self, run):
        release = self.current()
        if not release or self.state(release)['phase'] != 'active':
            # Durable evidence; do not silently miss a monthly occurrence.
            self.write_json(self.root / ('deferred-' + str(time.time_ns()) + '.json'), {'release': release, 'utc_epoch': time.time(), 'reason': 'deployment gate paused; operator reconciliation required'})
            return False
        run(release)
        return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['init', 'pause', 'switching', 'ready', 'activate', 'rollback', 'finish-rollback', 'status', 'dispatch'])
    parser.add_argument('--release')
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--confirmed-pm2-persisted', action='store_true')
    args = parser.parse_args()
    if not args.execute:
        print('No actions taken; explicit approval and --execute required.')
        return
    if os.geteuid() != 0:
        raise ValueError('Protected root coordinator required')
    # Root code/interpreter and their ancestry must not be application-writable.
    for file in [pathlib.Path(__file__).resolve(), pathlib.Path(sys.executable).resolve()]:
        protected(file)
        for parent in file.parents:
            protected(parent, directory=True)
    ROOT.mkdir(mode=0o700, exist_ok=True)
    protected(ROOT, directory=True)
    if stat.S_IMODE(ROOT.stat().st_mode) != 0o700:
        raise ValueError('Coordinator state directory must be mode 0700')
    lock = os.open(ROOT / 'coordinator.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        coordinator = Coordinator(ROOT, Cron())
        if args.action == 'dispatch':
            protected(pathlib.Path(WRAPPER))
            def run(release):
                # Only the root-owned OS privilege-drop tool executes as root.
                # Bash, curl and response parsing execute as ubuntu, never root.
                subprocess.run(['/usr/sbin/runuser', '-u', 'ubuntu', '--', WRAPPER,
                                '--credential-file', '/home/ubuntu/costinsights-deploy-state/' + release + '/report-job.curl.conf'], check=True, capture_output=True, env={'PATH': '/usr/sbin:/usr/bin:/bin', 'LANG': 'C.UTF-8'})
            if not coordinator.dispatch(run):
                raise ValueError('Scheduler paused; reconcile the deferred occurrence')
        elif args.action == 'status':
            value = coordinator.state(args.release)
            print(json.dumps({'release': value['release'], 'phase': value['phase']}))
            return
        else:
            actions = {
                'init': lambda: coordinator.init(args.release, [('/usr/local/sbin/costinsights-report-job', 'legacy-wrapper'), ('/etc/costinsightsclient/report-job.curl.conf', 'legacy-credential')]), 'pause': lambda: coordinator.pause(args.release),
                'switching': lambda: coordinator.mark_switching(args.release), 'ready': lambda: coordinator.ready(args.release, args.confirmed_pm2_persisted),
                'activate': lambda: coordinator.activate(args.release), 'rollback': lambda: coordinator.begin_rollback(args.release),
                'finish-rollback': lambda: coordinator.finish_rollback(args.release, args.confirmed_pm2_persisted)
            }
            actions[args.action]()
        print('Protected deployment step completed; no credentials printed.')
    finally:
        os.close(lock)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Coordinator stopped safely; inspect the protected phase and current cron before recovery. Details suppressed.', file=sys.stderr)
        sys.exit(1)
