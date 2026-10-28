/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

test('synthetic preparation creates placeholders and refuses to replace private inputs', async () => {
  const { prepare } = await import('../scripts/ci/prepare.mjs')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-fixture-'))
  try {
    fs.mkdirSync(path.join(root, 'src'), { recursive: true })
    fs.writeFileSync(path.join(root, 'src/service.ts'), 'process.env.COST_API_URL')
    prepare(root)
    const config = fs.readFileSync(path.join(root, 'src/lib/config/index.ts'), 'utf8')
    const env = fs.readFileSync(path.join(root, '.env.local'), 'utf8')
    assert.match(config, /ci@example\.invalid/)
    assert.match(env, /NEXT_PUBLIC_BASE_URL=https:\/\/aws\.develop\.thebrilliantclub\.org/)
    assert.match(env, /COST_API_URL=https:\/\/services\.invalid/)
    assert.throws(() => prepare(root), /clean checkout/)
    assert.equal(fs.readFileSync(path.join(root, 'src/lib/config/index.ts'), 'utf8'), config)
    fs.rmSync(path.join(root, 'src/lib/config/index.ts'))
    assert.throws(() => prepare(root), /clean checkout/)
    assert.ok(!fs.existsSync(path.join(root, 'src/lib/config/index.ts')))
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test('build guard rejects production, AWS, OpenAI and loopback HTTP before network access', () => {
  execFileSync(process.execPath, ['--require', path.resolve('scripts/ci/build-network.js'), '-e', `
    const assert = require('node:assert/strict')
    for (const target of ['https://aws.develop.thebrilliantclub.org/api/reports/generate', 'https://s3.amazonaws.com', 'https://api.openai.com', 'http://127.0.0.1:3024', 'https://fonts.googleapis.com.attacker.invalid']) {
      assert.throws(() => fetch(target), /non-font/)
      assert.throws(() => require(target.startsWith('http:') ? 'node:http' : 'node:https').get(target), /non-font/)
    }
  `])
})

test('synthetic preparation recognises digits and preserves private-input restrictions', async () => {
  const { prepare } = await import('../scripts/ci/prepare.mjs')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-digits-fixture-'))
  const names = ['EC2_GET_ELASTIC_IPS_API_URL', 'EC2_RELEASE_ELASTIC_IP_API_URL',
    'EC2_ASSOCIATE_ELASTIC_IP_API_URL', 'EC2_ALLOCATE_ELASTIC_IP_API_URL', 'SERVICE_V2_API_URL']
  try {
    fs.mkdirSync(path.join(root, 'src/nested'), { recursive: true })
    fs.writeFileSync(path.join(root, 'src/nested/service.ts'), [
      ...names.map(name => `process.env.${name}`),
      'process.env.2INVALID_API_URL', 'process.env.EC2_API_URL_SUFFIX'
    ].join('\n'))
    prepare(root)
    const filename = path.join(root, '.env.local')
    const text = fs.readFileSync(filename, 'utf8')
    const env = Object.fromEntries(text.trim().split('\n').map(line => line.split('=')))
    for (const name of names) assert.equal(env[name], 'https://services.invalid')
    assert.equal(Object.hasOwn(env, '2INVALID_API_URL'), false)
    assert.equal(Object.hasOwn(env, 'EC2_API_URL'), false)
    assert.equal(env.AWS_EC2_METADATA_DISABLED, 'true')
    assert.equal(fs.statSync(filename).mode & 0o777, 0o600)
    assert.throws(() => prepare(root), /clean checkout/)
    assert.equal(fs.readFileSync(filename, 'utf8'), text)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})
