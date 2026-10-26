/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const preparation = import('../scripts/deployment/prepare-release.mjs')
const switching = import('../scripts/deployment/switch-release.mjs')
const token = 'test_only_' + 'A'.repeat(33)

test('candidate credential selection preserves existing tokens and never generates without explicit approval', async () => {
  const { selectToken, reportConfiguration } = await preparation
  const before = 'import \'server-only\'\nexport const PW_SALT = \'fixture-secret\'\nexport const USERS = { user: \'fixture-password\' }\nexport const REPORT_JOB_TOKEN: string = \'\'\n'
  let generated = 0
  const generate = () => { generated++; return token }
  assert.throws(() => selectToken(before, false, generate))
  assert.equal(generated, 0)
  assert.equal(selectToken(before, true, generate), token)
  const configured = reportConfiguration(before, token)
  assert.equal(selectToken(configured, true, generate), token)
  assert.equal(generated, 1)
  const longer = reportConfiguration(before, 'B'.repeat(64))
  assert.equal(selectToken(longer, false, generate), 'B'.repeat(64))
  assert.throws(() => reportConfiguration(configured, 'B'.repeat(43)))
  const commented = '/*\nexport const REPORT_JOB_TOKEN = \'\'\n*/\nexport const PW_SALT = \'fixture-secret\'\n'
  assert.equal(selectToken(commented, true, generate), token)
  assert.ok(reportConfiguration(commented, token).startsWith(commented.trimEnd()))
  assert.equal(configured, before.replace('REPORT_JOB_TOKEN: string = \'\'', 'REPORT_JOB_TOKEN: string = \'' + token + '\''))
})
test('root and production-host build/preparation are refused', async () => {
  const { assertUnprivileged, assertIsolatedBuilder, PRODUCTION_HOST } = await preparation
  assert.throws(() => assertUnprivileged(0))
  assertUnprivileged(1000)
  assert.throws(() => assertIsolatedBuilder(PRODUCTION_HOST))
  assert.throws(() => assertIsolatedBuilder(PRODUCTION_HOST + '.internal'))
  assertIsolatedBuilder('approved-disposable-builder')
})
test('origin edit preserves AWS settings and refuses ambiguous values', async () => {
  const { publicOrigin, ORIGIN } = await preparation
  const before = 'AWS_TEST=\'unchanged\'\nNEXT_PUBLIC_BASE_URL=\'http://localhost:3024\'\n'
  assert.equal(publicOrigin(before), 'AWS_TEST=\'unchanged\'\nNEXT_PUBLIC_BASE_URL=' + ORIGIN + '\n')
  assert.throws(() => publicOrigin('NEXT_PUBLIC_BASE_URL=a\nNEXT_PUBLIC_BASE_URL=b'))
})
test('private filesystem operations reject unsafe permissions and symlinks', async () => {
  const { assertPrivate, copyPrivateTree } = await preparation
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'deployment-fixture-'))
  try {
    const source = path.join(directory, 'source')
    fs.writeFileSync(source, 'fixture', { mode: 0o666 })
    fs.chmodSync(source, 0o666)
    assert.throws(() => assertPrivate(source))
    const link = path.join(directory, 'link')
    fs.symlinkSync(source, link)
    assert.throws(() => copyPrivateTree(link, path.join(directory, 'target')))
    assert.equal(fs.readFileSync(source, 'utf8'), 'fixture')
  } finally { fs.rmSync(directory, { recursive: true }) }
})
test('production credential/environment drift aborts before activation without disclosing values', async () => {
  const { verifyLiveSnapshot } = await preparation
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'deployment-drift-fixture-'))
  try {
    const captured = path.join(directory, 'captured')
    const live = path.join(directory, 'live')
    fs.mkdirSync(path.join(captured, 'config'), { recursive: true })
    fs.mkdirSync(path.join(live, 'src/lib/config'), { recursive: true })
    for (const file of [path.join(captured, 'config/index.ts'), path.join(live, 'src/lib/config/index.ts')]) fs.writeFileSync(file, 'fixture-secret')
    verifyLiveSnapshot(captured, live)
    fs.writeFileSync(path.join(live, 'src/lib/config/index.ts'), 'changed-fixture-secret')
    assert.throws(() => verifyLiveSnapshot(captured, live), error => !error.message.includes('fixture-secret'))
    fs.writeFileSync(path.join(live, 'src/lib/config/index.ts'), 'fixture-secret')
    fs.writeFileSync(path.join(live, '.env.local'), 'fixture-env')
    assert.throws(() => verifyLiveSnapshot(captured, live))
  } finally { fs.rmSync(directory, { recursive: true }) }
})
test('PM2 definitions preserve environment, node options and exact rollback origin', async () => {
  const { applicationDefinition, LIVE, NODE, ORIGIN } = await preparation
  const entry = { pm2_env: { name: 'costinsightsclient', pm_cwd: LIVE, exec_mode: 'fork_mode', pm_exec_path: '/old/npm', args: ['start'], node_args: ['--max-old-space-size=1024'], restart_delay: 2000, env: { AWS_TEST: 'preserve' } } }
  const candidate = applicationDefinition(entry, '/candidate', true, NODE, 'http://localhost:3024')
  const rollback = applicationDefinition(entry, LIVE, false, NODE, 'http://localhost:3024')
  assert.equal(candidate.env.AWS_TEST, 'preserve')
  assert.equal(candidate.env.NEXT_PUBLIC_BASE_URL, ORIGIN)
  assert.equal(rollback.env.NEXT_PUBLIC_BASE_URL, 'http://localhost:3024')
  assert.deepEqual(candidate.node_args, entry.pm2_env.node_args)
  assert.equal(rollback.restart_delay, 2000)
})
for (const fault of ['select', 'save', 'saved', null]) {
  test('switch/persist recovery journal handles ' + (fault || 'success'), async () => {
    const { switchAndPersist } = await switching
    const events = []
    const definition = { apps: [{ name: 'costinsightsclient', cwd: '/candidate', env: { NEXT_PUBLIC_BASE_URL: 'https://app.test' } }] }
    const adapter = {
      select: async () => { events.push('selected'); if (fault === 'select') throw new Error('fixture interruption') },
      live: async () => ({ pm2_env: { pm_cwd: '/candidate', status: 'online', NEXT_PUBLIC_BASE_URL: 'https://app.test' } }),
      save: async () => { events.push('saved'); if (fault === 'save') throw new Error('fixture interruption') },
      saved: async () => { if (fault === 'saved') throw new Error('fixture interruption'); return { pm_cwd: '/candidate', NEXT_PUBLIC_BASE_URL: 'https://app.test' } }
    }
    const operation = switchAndPersist(adapter, definition, async value => events.push(value.phase))
    if (fault) { await assert.rejects(operation); assert.ok(!events.includes('persisted')) }
    else { await operation; assert.deepEqual(events, ['switching', 'selected', 'saved', 'persisted']) }
    assert.equal(events[0], 'switching')
  })
}
test('Python coordinator and smoke policy fixture tests pass without production commands', () => {
  const result = execFileSync('python3', ['-I', '-B', 'scripts/deployment/test_safety.py'], { stdio: ['ignore', 'pipe', 'pipe'] })
  assert.equal(result.length, 0)
})
