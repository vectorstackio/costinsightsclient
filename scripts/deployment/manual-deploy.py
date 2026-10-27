#!/usr/bin/python3
"""Install reviewed code root-owned; execute ONLY as ubuntu. Never import release code in Python."""
import datetime
import fcntl
import hashlib
import http.client
import io
import json
import os
from pathlib import Path, PurePosixPath
import pwd
import re
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import time
import uuid
from contextlib import contextmanager
from zoneinfo import ZoneInfo

APP = 'costinsightsclient'
LEGACY = Path('/home/ubuntu/node/develop/costinsightsclient')
BASE = Path('/home/ubuntu/costinsights-deploy-state')
RELEASES = BASE / 'releases'
NODE = '/home/ubuntu/.nvm/versions/node/v22.23.4/bin/node'
NPM = '/home/ubuntu/.nvm/versions/node/v22.23.4/bin/npm'
PM2 = '/home/ubuntu/.nvm/versions/node/v22.23.4/lib/node_modules/pm2/bin/pm2'
ORIGIN = 'https://aws.develop.thebrilliantclub.org'
ENVS = ('.env', '.env.local', '.env.production', '.env.production.local')
WRAPPER = Path('/usr/local/libexec/costinsights-report-job')
CRON = Path('/etc/cron.d/costinsightsclient-report')
CRON_TEXT = '# Managed costinsightsclient monthly report; host timezone Europe/London\n0 4 1 * * ubuntu /usr/local/libexec/costinsights-report-job --credential-file /home/ubuntu/costinsights-deploy-state/scheduler/report-job.curl.conf\n'
MAX_ARCHIVE = 128 * 1024**2
MIN_DISK = 8 * 1024**3
MIN_MEMORY = 2 * 1024**3
INSTALLED = '/usr/local/libexec/costinsights-deploy.py'
CRONTAB = '/usr/bin/crontab'
ROOT_BACKUPS = Path('/var/backups/costinsightsclient-scheduler')
LEGACY_CRON = '0 4 1 * * curl http://localhost:3024/api/reports/generate'
LEGACY_CRONS = (
    LEGACY_CRON,
    '0 4 1 * * wget -O - http://localhost:3024/api/reports/generate',
)


def private(path, directory=False):
    info = path.lstat()
    if info.st_uid != os.getuid() or info.st_mode & 0o077 or stat.S_ISLNK(info.st_mode):
        raise ValueError('Unsafe application-owned private path')
    if directory != stat.S_ISDIR(info.st_mode):
        raise ValueError('Unexpected private path type')
    if not directory and not stat.S_ISREG(info.st_mode):
        raise ValueError('Expected regular private file')


def protected(path):
    for item in (path, *path.parents):
        info = item.lstat()
        if info.st_uid != 0 or info.st_mode & 0o022 or stat.S_ISLNK(info.st_mode):
            raise ValueError('Expected protected root-owned installation')


def sync_directory(path):
    descriptor = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def write_json(path, value):
    temporary = path.with_name(path.name + '.pending-' + uuid.uuid4().hex)
    with open(temporary, 'x', opener=lambda p, flags: os.open(p, flags | os.O_NOFOLLOW, 0o600)) as stream:
        json.dump(value, stream)
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(path)
    sync_directory(path.parent)


def command(original):
    match = re.fullmatch(r'deploy ([0-9a-f]{40}) ([0-9a-f]{64})', original)
    if not match:
        raise ValueError('Only the fixed deployment command is allowed')
    return match.groups()


def extract_source(raw, destination):
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
        members = archive.getmembers()
        if len(members) > 20000 or sum(member.size for member in members) > 512 * 1024**2:
            raise ValueError('Oversized source archive')
        seen = set()
        for member in members:
            item = PurePosixPath(member.name)
            parts = item.parts
            if not parts or item.is_absolute() or '..' in parts or str(item) in seen:
                raise ValueError('Invalid archive path')
            seen.add(str(item))
            if not (member.isfile() or member.isdir()):
                raise ValueError('Source links and special files are forbidden')
            if any(part in ('.git', 'node_modules', '.next') or part.startswith('.env') for part in parts) or parts[:3] == ('src', 'lib', 'config'):
                raise ValueError('Source archive contains private/generated paths')
        for member in members:
            target = destination / member.name
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True, mode=0o700)
            else:
                target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                with open(target, 'xb', opener=lambda p, flags: os.open(p, flags | os.O_NOFOLLOW, 0o700 if member.mode & 0o111 else 0o600)) as stream:
                    shutil.copyfileobj(archive.extractfile(member), stream)
    if not (destination / 'package-lock.json').is_file():
        raise ValueError('Source lockfile missing')


def copy_private(source, target):
    if source.is_symlink():
        raise ValueError('Configuration symlinks require manual review')
    if source.is_dir():
        target.mkdir(mode=0o700)
        for child in source.iterdir():
            copy_private(child, target / child.name)
    elif source.is_file():
        with open(target, 'xb', opener=lambda p, flags: os.open(p, flags | os.O_NOFOLLOW, 0o600)) as stream:
            stream.write(source.read_bytes())
    else:
        raise ValueError('Unexpected configuration type')


def copy_configuration(source, target):
    copy_private(source / 'src/lib/config', target / 'src/lib/config')
    for name in ENVS:
        if (source / name).exists():
            copy_private(source / name, target / name)
    # Only change this public value in the highest-priority production env file.
    filename = target / '.env.production.local'
    text = filename.read_text() if filename.exists() else ''
    pattern = r'^\s*(?:export\s+)?NEXT_PUBLIC_BASE_URL\s*=.*$'
    if len(re.findall(pattern, text, re.M)) > 1:
        raise ValueError('Duplicate public origin requires manual review')
    if re.search(pattern, text, re.M):
        text = re.sub(pattern, 'NEXT_PUBLIC_BASE_URL=' + ORIGIN, text, flags=re.M)
    else:
        text = text.rstrip() + '\nNEXT_PUBLIC_BASE_URL=' + ORIGIN + '\n'
    filename.write_text(text)
    filename.chmod(0o600)


def preflight(disk_free, memory_available):
    if disk_free < MIN_DISK or memory_available < MIN_MEMORY:
        raise ValueError('Insufficient disk or memory headroom; no application changes made')


def cron_plan(text):
    """Remove one explicitly approved legacy job; never rewrite unrelated lines."""
    lines = text.splitlines(keepends=True)
    legacy = [line for line in lines if line.strip() in LEGACY_CRONS]
    suspicious = [line for line in lines if not line.lstrip().startswith('#')
                  and any(word in line for word in ('/api/reports/generate', 'costinsights-report-job', 'costinsightsclient-report'))
                  and line.strip() not in LEGACY_CRONS]
    if len(legacy) > 1 or suspicious:
        raise ValueError('Unexpected scheduled report entries require manual review')
    return ''.join(line for line in lines if line.strip() not in LEGACY_CRONS), len(legacy)


def root_cron():
    result = subprocess.run([CRONTAB, '-u', 'root', '-l'], env={'PATH': '/usr/bin:/bin', 'LC_ALL': 'C'},
                            capture_output=True, check=False, timeout=10)
    if result.returncode == 1 and result.stderr.strip() == b'no crontab for root':
        return ''
    if result.returncode:
        raise ValueError('Cannot inspect root crontab')
    return result.stdout.decode()


def install_root_cron(text):
    subprocess.run([CRONTAB, '-u', 'root', '-'], input=text.encode(),
                   env={'PATH': '/usr/bin:/bin', 'LC_ALL': 'C'}, capture_output=True, check=True, timeout=10)


def system_cron_conflicts():
    # Inspect only system cron text, never follow referenced scripts or run jobs.
    files = [Path('/etc/crontab'), *Path('/etc/cron.d').iterdir()]
    for filename in files:
        if filename == CRON or not filename.is_file():
            continue
        for line in filename.read_text().splitlines():
            if not line.lstrip().startswith('#') and any(word in line for word in ('/api/reports/generate', 'costinsights-report-job', 'costinsightsclient-report')):
                raise ValueError('Other system report schedules require manual review')


def scheduler_status():
    original = root_cron()
    _, count = cron_plan(original)
    system_cron_conflicts()
    exists = CRON.exists() or CRON.is_symlink()
    if exists:
        protected(CRON)
        if CRON.read_text() != CRON_TEXT:
            raise ValueError('Unexpected managed cron changes')
    return {'root_sha256': hashlib.sha256(original.encode()).hexdigest(),
            'legacy_count': count, 'managed': exists}


def migrate_scheduler(expected, read=root_cron, install=install_root_cron):
    """Root-only CLI uses protected paths; injected adapters are for fixtures only."""
    if not re.fullmatch('[0-9a-f]{64}', expected):
        raise ValueError('Expected reviewed root-crontab digest')
    original = read()
    if hashlib.sha256(original.encode()).hexdigest() != expected:
        raise ValueError('Root cron changed; nothing overwritten')
    replacement, _ = cron_plan(original)
    system_cron_conflicts()
    if CRON.exists() or CRON.is_symlink():
        protected(CRON)
        if CRON.read_text() != CRON_TEXT:
            raise ValueError('Unexpected managed cron changes')
    protected(WRAPPER)
    if Path('/etc/localtime').resolve() != Path('/usr/share/zoneinfo/Europe/London'):
        raise ValueError('Host scheduler timezone must be Europe/London')
    ROOT_BACKUPS.mkdir(mode=0o700, exist_ok=True)
    protected(ROOT_BACKUPS)
    # Keep every reviewed original, including unrelated entries, without printing it.
    backup = ROOT_BACKUPS / (expected + '.crontab')
    if not backup.exists():
        with open(backup, 'x', opener=lambda p, flags: os.open(p, flags | os.O_NOFOLLOW, 0o600)) as stream:
            stream.write(original)
            stream.flush()
            os.fsync(stream.fileno())
    # Ensure the original snapshot survives power loss BEFORE removing a cron job.
    sync_directory(ROOT_BACKUPS)
    sync_directory(ROOT_BACKUPS.parent)
    if read() != original:
        raise ValueError('Concurrent root cron edit; nothing overwritten')
    # Remove legacy first: an interrupted migration can leave a gap, never a duplicate.
    if replacement != original:
        install(replacement)
    if read() != replacement:
        raise ValueError('Unexpected root cron state; stop for manual reconciliation')
    if not CRON.exists():
        temp = CRON.with_name('.costinsightsclient-report-' + uuid.uuid4().hex)
        try:
            with open(temp, 'x', opener=lambda p, flags: os.open(p, flags | os.O_NOFOLLOW, 0o644)) as stream:
                stream.write(CRON_TEXT)
                stream.flush()
                os.fsync(stream.fileno())
            os.chmod(temp, 0o644)
            # Atomic no-clobber publication; never replace an administrator's file.
            os.link(temp, CRON)
        finally:
            temp.unlink(missing_ok=True)
    protected(CRON)
    if CRON.read_text() != CRON_TEXT or read() != replacement:
        raise ValueError('Scheduler changed during migration; manual reconciliation required')
    sync_directory(CRON.parent)


@contextmanager
def deployment_locks():
    with open(BASE / 'deploy.lock', 'a', opener=lambda p, flags: os.open(p, flags | os.O_NOFOLLOW, 0o600)) as deployment, open(BASE / 'report.lock', 'a', opener=lambda p, flags: os.open(p, flags | os.O_NOFOLLOW, 0o600)) as reporting:
        private(BASE / 'deploy.lock')
        private(BASE / 'report.lock')
        fcntl.flock(deployment, fcntl.LOCK_EX | fcntl.LOCK_NB)
        fcntl.flock(reporting, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def scheduler_ready():
    status = json.loads(call(['/usr/bin/sudo', '-n', '/usr/bin/python3', '-I', '-B', INSTALLED, '--scheduler-status']))
    if status.get('legacy_count') != 0 or status.get('managed') is not True:
        raise ValueError('Legacy scheduler must be migrated before activation')
    protected(CRON)
    protected(WRAPPER)
    if CRON.read_text() != CRON_TEXT:
        raise ValueError('Authenticated scheduler setup is required before deployment')
    if Path('/etc/localtime').resolve() != Path('/usr/share/zoneinfo/Europe/London'):
        raise ValueError('Scheduler timezone requires operator review')
    credential = BASE / 'scheduler/report-job.curl.conf'
    private(credential.parent, True)
    private(credential)
    match = re.fullmatch(r'header = "Authorization: ReportJob ([A-Za-z0-9_-]{32,256})"\n', credential.read_text())
    if not match:
        raise ValueError('Invalid scheduler credential file')
    return hashlib.sha256(match[1].encode()).hexdigest()


def runtime_env():
    return {'HOME': '/home/ubuntu', 'USER': 'ubuntu', 'LOGNAME': 'ubuntu', 'LANG': 'C.UTF-8',
            'PATH': str(Path(NODE).parent) + ':/usr/bin:/bin', 'PM2_HOME': '/home/ubuntu/.pm2'}


def call(args, cwd=None, env=None, log=None, timeout=60, tolerate=False):
    result = subprocess.run(args, cwd=cwd, env=env or runtime_env(), stdin=subprocess.DEVNULL,
                            stdout=log or subprocess.PIPE, stderr=log or subprocess.PIPE,
                            timeout=timeout, check=False)
    if result.returncode and not tolerate:
        raise RuntimeError('Deployment subprocess failed; output retained privately')
    return result.stdout


def selected():
    entries = json.loads(call([NODE, PM2, 'jlist']))
    matches = [entry for entry in entries if entry.get('name') == APP]
    if len(matches) != 1:
        raise ValueError('Expected one existing PM2 application')
    return matches[0]


def allowed_release(value):
    item = Path(value)
    return item == LEGACY or (item.parent == RELEASES and re.fullmatch(r'[0-9a-f]{40}-[0-9T]+', item.name) is not None)


def definition(entry, cwd, candidate=False):
    old = entry['pm2_env']
    if old.get('name') != APP or old.get('exec_mode') != 'fork_mode' or not allowed_release(old.get('pm_cwd', '')):
        raise ValueError('Unexpected live PM2 configuration')
    env = dict(old.get('env', {}))
    # PM2 can also hold explicit variables outside its nested env object.
    for key, value in old.items():
        if re.fullmatch(r'[A-Z][A-Z0-9_]*', key) and isinstance(value, (str, int, float)):
            env[key] = str(value)
    if candidate:
        env.update(NODE_ENV='production', NEXT_PUBLIC_BASE_URL=ORIGIN)
    result = {key: old[key] for key in ('autorestart', 'kill_timeout', 'max_memory_restart', 'node_args', 'restart_delay', 'exp_backoff_restart_delay', 'min_uptime', 'max_restarts', 'listen_timeout', 'merge_logs', 'log_date_format') if key in old}
    result.update(name=APP, cwd=str(cwd), script=NPM if candidate else old['pm_exec_path'],
                  interpreter=NODE, args=['start'] if candidate else old.get('args', []),
                  exec_mode='fork', instances=1, env=env, watch=False)
    for old_key, key in (('pm_out_log_path', 'out_file'), ('pm_err_log_path', 'error_file')):
        if old.get(old_key):
            result[key] = old[old_key]
    return {'apps': [result]}


def probe(path, expected, headers=None):
    # Fixed loopback transport, no proxies, redirects, cookies or service data.
    if path not in ('/api/reports', '/api/auth'):
        raise ValueError('Service-reaching health check forbidden')
    connection = http.client.HTTPConnection('127.0.0.1', 3024, timeout=5)
    try:
        connection.request('GET', path, headers=headers or {})
        response = connection.getresponse()
        body = response.read(16384)
        if response.status != expected:
            raise ValueError('Authentication health check failed')
        return json.loads(body)
    finally:
        connection.close()


def health():
    # No month => even an accidentally unguarded reports handler returns 400
    # before AWS/OpenAI/S3. Never probe generation, costs or infrastructure routes.
    for headers in ({}, {'Authorization': 'Bearer invalid-ci-health-token'}, {'Authorization': 'ReportJob invalid-ci-health-token'}):
        body = probe('/api/reports', 401, headers)
        if body.get('success') is not False:
            raise ValueError('Unexpected authentication response')


def select_application(filename):
    # Deleting only this process guarantees cwd/env changes take effect in fork mode.
    call([NODE, PM2, 'delete', APP], tolerate=True)
    call([NODE, PM2, 'start', str(filename), '--only', APP])


def wait_online(defn, check_auth=True):
    expected = defn['apps'][0]
    for attempt in range(30):
        try:
            current = selected()['pm2_env']
            if current['pm_cwd'] != expected['cwd'] or current['status'] != 'online':
                raise ValueError('Application has not started')
            if expected['env'].get('NEXT_PUBLIC_BASE_URL') and current.get('NEXT_PUBLIC_BASE_URL') != expected['env']['NEXT_PUBLIC_BASE_URL']:
                raise ValueError('Unexpected runtime origin')
            if check_auth:
                health()
            else:
                # Initial Bitbucket application lacks the new guards; require only
                # its side-effect-free no-month contract for startup on rollback.
                try:
                    probe('/api/reports', 401)
                except ValueError:
                    probe('/api/reports', 400)
            return
        except (OSError, ValueError, KeyError, RuntimeError, json.JSONDecodeError):
            if attempt == 29:
                raise RuntimeError('Startup/health verification failed') from None
            time.sleep(2)


def persist(defn):
    call([NODE, PM2, 'save'])
    dump = Path('/home/ubuntu/.pm2/dump.pm2')
    entries = json.loads(dump.read_text())
    matches = [entry for entry in entries if entry.get('name') == APP]
    if len(matches) != 1 or matches[0].get('pm_cwd') != defn['apps'][0]['cwd']:
        raise ValueError('Saved PM2 state does not match')
    expected_origin = defn['apps'][0]['env'].get('NEXT_PUBLIC_BASE_URL')
    if expected_origin and matches[0].get('env', {}).get('NEXT_PUBLIC_BASE_URL', matches[0].get('NEXT_PUBLIC_BASE_URL')) != expected_origin:
        raise ValueError('Saved PM2 origin does not match')
    for item in (dump, dump.parent):
        fd = os.open(item, os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)


def activate(new, previous, select, wait, save):
    try:
        select(new)
        wait(new, True)
        save(new)
    except BaseException:
        try:
            select(previous)
            wait(previous, False)
            save(previous)
        except BaseException:
            raise RuntimeError('Activation and automatic rollback failed; use the private rollback backup') from None
        raise RuntimeError('Activation failed; previous application restored and saved') from None


def token_hash(candidate):
    # Existing parser handles TypeScript without evaluating private configuration.
    program = "import fs from 'node:fs'; import crypto from 'node:crypto'; import {configuredToken} from './scripts/deployment/prepare-release.mjs'; const value=configuredToken(fs.readFileSync('src/lib/config/index.ts','utf8')); if(!value)process.exit(1); process.stdout.write(crypto.createHash('sha256').update(value).digest('hex'))"
    return call([NODE, '--input-type=module', '-e', program], cwd=candidate).decode()


def provision_report_job():
    """Explicit local administrator action; never available through the SSH key."""
    folder = BASE / 'scheduler'
    folder.mkdir(mode=0o700, exist_ok=True)
    private(folder, True)
    credential = folder / 'report-job.curl.conf'
    if credential.exists() or credential.is_symlink():
        private(credential)
    source = LEGACY / 'src/lib/config/index.ts'
    if source.is_symlink():
        raise ValueError('Configuration symlink requires review')
    original = source.read_bytes()
    # Parse TypeScript, never evaluate the ignored credentials. Raw values stay
    # inside this captured pipe and private files; no argv, environment or logs.
    program = r"""
import fs from 'node:fs'; import crypto from 'node:crypto'; import {createRequire} from 'node:module';
const ts = createRequire(process.cwd() + '/package.json')('typescript');
const text = fs.readFileSync('src/lib/config/index.ts', 'utf8');
const ast = ts.createSourceFile('config.ts', text, ts.ScriptTarget.Latest, true);
if(ast.parseDiagnostics.length) throw Error('Invalid syntax');
const found = ast.statements.filter(ts.isVariableStatement).flatMap(s => s.declarationList.declarations.map(d => ({s,d}))).filter(({d}) => d.name.getText(ast) === 'REPORT_JOB_TOKEN');
if(found.length > 1) throw Error('Duplicate binding');
let value = ''; let binding;
if(found.length) {
  binding = found[0];
  if(!binding.s.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || !binding.d.initializer || !ts.isStringLiteral(binding.d.initializer)) throw Error('Unsupported binding');
  value = binding.d.initializer.text;
} else {
  let referenced = false; const visit = n => { if(ts.isIdentifier(n) && n.text === 'REPORT_JOB_TOKEN') referenced = true; ts.forEachChild(n, visit) }; visit(ast);
  if(referenced) throw Error('Unsupported binding');
}
const filename = process.argv[1];
if(fs.existsSync(filename)) {
  const existing = /^header = "Authorization: ReportJob ([A-Za-z0-9_-]{32,256})"\n$/.exec(fs.readFileSync(filename, 'utf8'));
  if(!existing || (value && value !== existing[1])) throw Error('Credential mismatch');
  value ||= existing[1];
}
value ||= crypto.randomBytes(32).toString('base64url');
if(!/^[A-Za-z0-9_-]{32,256}$/.test(value)) throw Error('Invalid credential');
const config = binding ? text.slice(0, binding.d.initializer.getStart(ast)) + JSON.stringify(value) + text.slice(binding.d.initializer.end) : text.trimEnd() + '\nexport const REPORT_JOB_TOKEN: string = ' + JSON.stringify(value) + '\n';
process.stdout.write(JSON.stringify({config, header: 'header = "Authorization: ReportJob ' + value + '"\n'}));
"""
    generated = json.loads(call([NODE, '--input-type=module', '-e', program, str(credential)], cwd=LEGACY))
    backup = folder / 'config.before.ts'
    if not backup.exists():
        copy_private(source, backup)
    if not credential.exists():
        with open(credential, 'x', opener=lambda p, flags: os.open(p, flags | os.O_NOFOLLOW, 0o600)) as stream:
            stream.write(generated['header'])
            stream.flush()
            os.fsync(stream.fileno())
    sync_directory(folder)
    sync_directory(folder.parent)
    if source.read_bytes() != original:
        raise ValueError('Configuration changed; stop and reconcile')
    if generated['config'].encode() != original:
        temporary = source.with_name('.report-job-' + uuid.uuid4().hex)
        with open(temporary, 'x', opener=lambda p, flags: os.open(p, flags | os.O_NOFOLLOW, 0o600)) as stream:
            stream.write(generated['config'])
            stream.flush()
            os.fsync(stream.fileno())
        temporary.replace(source)
        sync_directory(source.parent)
    print('ReportJob credential prepared locally; existing users and JWT settings preserved')


def deploy(commit, digest, raw):
    now = datetime.datetime.now(ZoneInfo('Europe/London'))
    if now.day == 1 and 3 <= now.hour <= 5:
        raise ValueError('Deployment is blocked around the monthly report window')
    scheduler_hash = scheduler_ready()
    preflight(shutil.disk_usage(BASE).free, int(re.search(r'^MemAvailable:\s+(\d+)', Path('/proc/meminfo').read_text(), re.M)[1]) * 1024)
    if len(raw) > MAX_ARCHIVE or hashlib.sha256(raw).hexdigest() != digest:
        raise ValueError('Invalid source archive digest/size')
    entry = selected()
    old_cwd = Path(entry['pm2_env']['pm_cwd'])
    if not entry.get('pid') or Path(f'/proc/{entry["pid"]}/exe').resolve() != Path(NODE):
        raise ValueError('Live Node runtime requires review')
    previous = definition(entry, old_cwd)
    release = RELEASES / (commit + '-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%f'))
    release.mkdir(mode=0o700)
    extract_source(raw, release)
    copy_configuration(old_cwd, release)
    # Back up matching original configuration without modifying the Bitbucket checkout.
    backup = BASE / 'backups' / release.name
    backup.mkdir(mode=0o700)
    copy_private(old_cwd / 'src/lib/config', backup / 'config')
    for name in ENVS:
        if (old_cwd / name).exists():
            copy_private(old_cwd / name, backup / name)
    write_json(backup / 'previous.json', previous)
    candidate = definition(entry, release, True)
    write_json(backup / 'candidate.json', candidate)
    build_env = runtime_env()
    build_env.update({key: str(value) for key, value in candidate['apps'][0]['env'].items() if value is not None})
    build_env.update(runtime_env(), NODE_ENV='production', NEXT_PUBLIC_BASE_URL=ORIGIN,
                     NEXT_TELEMETRY_DISABLED='1', HUSKY='0', PUPPETEER_SKIP_DOWNLOAD='true', NODE_OPTIONS='--max-old-space-size=1536')
    with open(backup / 'build.log', 'xb', opener=lambda p, flags: os.open(p, flags | os.O_NOFOLLOW, 0o600)) as log:
        call([NPM, 'ci', '--include=dev', '--ignore-scripts', '--no-audit', '--no-fund'], release, build_env, log, 900)
        if token_hash(release) != scheduler_hash:
            raise ValueError('ReportJob credential does not match scheduler; application unchanged')
        # Explicit browser preparation is necessary because install scripts are disabled.
        call([NPM, 'exec', '--no', '--', 'puppeteer', 'browsers', 'install', 'chrome'], release,
             {key: value for key, value in build_env.items() if key != 'PUPPETEER_SKIP_DOWNLOAD'}, log, 600)
        build_only = {**build_env, 'NODE_OPTIONS': build_env['NODE_OPTIONS'] + ' --require=' + str(release / 'scripts/ci/build-network.js')}
        call([NPM, 'run', 'build'], release, build_only, log, 900)
    if not (release / '.next/BUILD_ID').is_file():
        raise ValueError('Build output missing')
    # Scheduler lock and deployment lock remain held across the switch and rollback.
    if scheduler_ready() != scheduler_hash or token_hash(release) != scheduler_hash:
        raise ValueError('Scheduler changed during preparation')
    write_json(BASE / 'rollback.json', {'backup': str(backup)})
    select = lambda value: select_application(backup / ('candidate.json' if value is candidate else 'previous.json'))
    activate(candidate, previous, select, wait_online, persist)
    print('Deployment succeeded; previous release and private rollback backup retained', flush=True)


def rollback():
    private(BASE / 'rollback.json')
    backup = Path(json.loads((BASE / 'rollback.json').read_text())['backup'])
    if backup.parent != BASE / 'backups':
        raise ValueError('Invalid rollback backup')
    private(backup, True)
    private(backup / 'previous.json')
    previous = json.loads((backup / 'previous.json').read_text())
    if len(previous['apps']) != 1 or previous['apps'][0]['name'] != APP or not allowed_release(previous['apps'][0]['cwd']):
        raise ValueError('Unexpected rollback target')
    select_application(backup / 'previous.json')
    wait_online(previous, False)
    persist(previous)
    print('Previous application restored and saved; scheduler unchanged', flush=True)


def main():
    os.umask(0o077)
    if os.getuid() == 0:
        protected(Path(__file__).absolute())
        if os.environ.get('SSH_ORIGINAL_COMMAND') is not None:
            raise ValueError('No root SSH deployment')
        if sys.argv[1:] == ['--scheduler-status']:
            print(json.dumps(scheduler_status()))
            return
        if len(sys.argv) == 3 and sys.argv[1] == '--migrate-scheduler':
            # All cooperating administrators must use this lock for scheduler edits.
            with open('/run/costinsightsclient-scheduler.lock', 'a', opener=lambda p, flags: os.open(p, flags | os.O_NOFOLLOW, 0o600)) as lock:
                protected(Path('/run/costinsightsclient-scheduler.lock'))
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                migrate_scheduler(sys.argv[2])
            print('Authenticated scheduler installed; no reports invoked')
            return
        raise ValueError('Root may only inspect or migrate the scheduler')
    if os.getuid() != pwd.getpwnam('ubuntu').pw_uid or os.getuid() == 0:
        raise ValueError('Run only as the unprivileged ubuntu application account')
    protected(Path(__file__).resolve())
    private(BASE, True)
    for folder in (RELEASES, BASE / 'backups'):
        folder.mkdir(mode=0o700, exist_ok=True)
        private(folder, True)
    if call([NODE, '--version']).decode().strip() != 'v22.23.4':
        raise ValueError('Node.js 22.23.4 required')
    # Never let PM2 CLI silently start a different daemon or restore other apps.
    os.kill(int(Path('/home/ubuntu/.pm2/pm2.pid').read_text().strip()), 0)
    if not Path('/home/ubuntu/.pm2/rpc.sock').exists():
        raise ValueError('Existing PM2 daemon required')
    original = os.environ.get('SSH_ORIGINAL_COMMAND')
    if original is None and sys.argv[1:] == ['--provision-report-job']:
        with deployment_locks():
            provision_report_job()
        return
    local_rollback = original is None and sys.argv[1:] == ['--rollback']
    if not local_rollback:
        if sys.argv[1:]:
            raise ValueError('Unexpected arguments')
        commit, digest = command(original or '')
    signal.signal(signal.SIGHUP, signal.SIG_IGN)
    with deployment_locks():
        if local_rollback:
            rollback()
        else:
            raw = sys.stdin.buffer.read(MAX_ARCHIVE + 1)
            deploy(commit, digest, raw)


if __name__ == '__main__':
    try:
        main()
    except BaseException:
        # Never emit exceptions, child output, private settings or request headers.
        print('Deployment did not complete. Inspect private backup/build logs and PM2 state; rollback may be required.', file=sys.stderr)
        sys.exit(1)
