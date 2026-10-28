/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-console -- intercept logging to verify secrets cannot escape */
const { test, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const crypto = require('node:crypto')
const ts = require('typescript')
const jwt = require('jsonwebtoken')
let calls = 0
let credentials = { accessKeyId: 'TESTACCESS', secretAccessKey: 'synthetic-secret', sessionToken: 'synthetic-session' }
const originalLoad = Module._load
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText, file)
Module._load = function (request, parent, isMain) {
  if (request === 'server-only') return {}
  if (request === '@aws-sdk/credential-provider-node') return { defaultProvider: () => async () => { calls++; return credentials } }
  if (request === '@/lib/config') return { PW_SALT: 'synthetic-jwt', USERS: { 'user@test': '' }, USER_IDS: { 'user@test': '1' } }
  if (request === 'next/headers') return { headers: async () => new Headers() }
  if (request.startsWith('@/')) request = path.resolve('src', request.slice(2))
  return originalLoad.call(this, request, parent, isMain)
}
const { apiGatewayFetch, createApiGatewayFetch, API_GATEWAY_IDS } = require('../src/lib/aws/api-gateway.ts')
const endpoint = 'https://milf80yd66.execute-api.eu-west-2.amazonaws.com/dev/costs/summary'
const originalFetch = global.fetch
after(() => { global.fetch = originalFetch })
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const hmac = (key, value) => crypto.createHmac('sha256', key).update(value).digest()

test('real signer preserves duplicate/empty query values and JSON bytes; independent signature verification', async () => {
  global.fetch = async (input, options) => {
    assert.equal(input, endpoint + '?month=2026-10&x=&x=a%20b')
    assert.equal(options.body, '{"amount":0,"text":"é"}')
    assert.equal(options.redirect, 'error')
    assert.equal(options.cache, 'no-store')
    const headers = options.headers
    assert.equal(headers['x-amz-security-token'], credentials.sessionToken)
    const authorization = headers.authorization
    const names = /SignedHeaders=([^,]+)/.exec(authorization)[1]
    const canonicalHeaders = names.split(';').map(n => n + ':' + headers[n].trim() + '\n').join('')
    const canonical = ['POST', '/dev/costs/summary', 'month=2026-10&x=&x=a%20b', canonicalHeaders, names, hash(options.body)].join('\n')
    const scope = /Credential=[^/]+\/([^,]+)/.exec(authorization)[1]
    const date = headers['x-amz-date']
    let key = hmac('AWS4' + credentials.secretAccessKey, date.slice(0, 8))
    for (const part of ['eu-west-2', 'execute-api', 'aws4_request']) key = hmac(key, part)
    const expected = hmac(key, ['AWS4-HMAC-SHA256', date, scope, hash(canonical)].join('\n')).toString('hex')
    assert.equal(/Signature=(.*)$/.exec(authorization)[1], expected)
    return Response.json({ preserved: true }, { status: 201 })
  }
  const response = await apiGatewayFetch(endpoint + '?month=2026-10&x=&x=a%20b', {
    method: 'POST', body: '{"amount":0,"text":"é"}', headers: { 'Content-Type': 'application/json' }
  })
  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), { preserved: true })
})

test('provider is consulted for each request so refreshed temporary credentials are used', async () => {
  const seen = []
  const signedFetch = createApiGatewayFetch(async () => ({ ...credentials, sessionToken: 'session-' + seen.length }))
  global.fetch = async (_url, options) => { seen.push(options.headers['x-amz-security-token']); return new Response('ok') }
  await signedFetch(endpoint)
  await signedFetch(endpoint)
  assert.deepEqual(seen, ['session-0', 'session-1'])
})

test('mock IAM boundary accepts a valid signature and denies unsigned, tampered, wrong-principal and wrong-stage requests', async () => {
  // Independent verifier for this harmless GET fixture, not a replacement for
  // the separately approved live API Gateway canary.
  const gateway = async (input, options) => {
    const h = options.headers ?? {}
    const a = h.authorization ?? ''
    const names = /SignedHeaders=([^,]+)/.exec(a)?.[1]
    const scope = /Credential=TESTACCESS\/([^,]+)/.exec(a)?.[1]
    if (input !== endpoint || !names || !scope || h['x-amz-security-token'] !== credentials.sessionToken) return new Response(null, { status: 403 })
    const canonical = ['GET', '/dev/costs/summary', '', names.split(';').map(n => n + ':' + h[n].trim() + '\n').join(''), names, hash(options.body ?? '')].join('\n')
    let key = hmac('AWS4' + credentials.secretAccessKey, h['x-amz-date'].slice(0, 8))
    for (const part of ['eu-west-2', 'execute-api', 'aws4_request']) key = hmac(key, part)
    const expected = hmac(key, ['AWS4-HMAC-SHA256', h['x-amz-date'], scope, hash(canonical)].join('\n')).toString('hex')
    return new Response(null, { status: /Signature=(.*)$/.exec(a)?.[1] === expected ? 200 : 403 })
  }
  assert.equal((await gateway(endpoint, { headers: {} })).status, 403)
  global.fetch = gateway
  assert.equal((await apiGatewayFetch(endpoint)).status, 200)
  assert.equal((await apiGatewayFetch(endpoint.replace('/dev/', '/'))).status, 403)
  assert.equal((await createApiGatewayFetch(async () => ({ ...credentials, accessKeyId: 'OTHERROLE' }))(endpoint)).status, 403)
  global.fetch = (input, options) => gateway(input, { ...options, body: 'tampered' })
  assert.equal((await apiGatewayFetch(endpoint)).status, 403)
})

test('static, expired and failed credentials fail closed without transport or secret-bearing errors', async () => {
  global.fetch = async () => { throw new Error('Transport must not run') }
  for (const provider of [async () => ({ ...credentials, sessionToken: undefined }), async () => ({ ...credentials, expiration: new Date(0) }), async () => { throw new Error(credentials.secretAccessKey) }]) {
    await assert.rejects(createApiGatewayFetch(provider)(endpoint), { message: 'API Gateway request failed' })
  }
})

test('destinations and inbound credential headers are rejected before obtaining AWS credentials', async () => {
  let reads = 0
  const run = createApiGatewayFetch(async () => { reads++; return credentials })
  for (const target of ['http://milf80yd66.execute-api.eu-west-2.amazonaws.com/x', endpoint.replace('milf80yd66', 'lzgz3me84j'), endpoint.replace('.com', '.com.attacker.test'), endpoint + '#fragment', endpoint.replace('https://', 'https://user:password@'), endpoint.replace('.com/', '.com:8443/')]) {
    await assert.rejects(run(target), /Invalid API Gateway destination/)
  }
  for (const name of ['Authorization', 'Cookie', 'Host', 'X-Amz-Security-Token', 'Proxy-Authorization']) await assert.rejects(run(endpoint, { headers: { [name]: 'private' } }), /Invalid API Gateway headers/)
  await assert.rejects(run(endpoint, { body: new URLSearchParams('x=y') }), /Invalid API Gateway body/)
  assert.equal(reads, 0)
})

test('all supported methods sign; upstream status/body and transport failures retain safe behaviour', async () => {
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    global.fetch = async (_url, options) => { assert.equal(options.method, method); return new Response('upstream error', { status: 403 }) }
    const response = await apiGatewayFetch(endpoint, { method })
    assert.equal(response.status, 403)
    assert.equal(await response.text(), 'upstream error')
  }
  global.fetch = async (_url, options) => { assert.equal(options.redirect, 'error'); throw new Error(credentials.sessionToken) }
  await assert.rejects(apiGatewayFetch(endpoint), { message: 'API Gateway request failed' })
})

test('real JWT wrapper rejects missing, invalid, expired and unknown users before signing; valid user reaches signed transport', async () => {
  process.env.COST_API_URL = endpoint.replace('/summary', '')
  const route = require('../src/app/api/costs/route.ts')
  const token = (id = 'user@test', expiresIn = '1h') => jwt.sign({ id }, 'synthetic-jwt', { expiresIn })
  let transports = 0
  global.fetch = async (_url, options) => {
    transports++
    assert.match(options.headers.authorization, /^AWS4-HMAC-SHA256 /)
    assert.ok(!options.headers.authorization.includes('Bearer'))
    return Response.json({ cost: 10 })
  }
  const before = calls
  for (const t of [null, 'invalid', token('user@test', -1), token('unknown@test')]) {
    const response = await route.GET(new Request('https://app.test/api/costs', { headers: t ? { Authorization: 'Bearer ' + t } : {} }))
    assert.equal(response.status, 401)
  }
  assert.equal(calls, before)
  assert.equal(transports, 0)
  const response = await route.GET(new Request('https://app.test/api/costs', { headers: { Authorization: 'Bearer ' + token() } }))
  assert.deepEqual(await response.json(), { cost: 10 })
  assert.doesNotMatch(JSON.stringify([...response.headers]) + JSON.stringify({ cost: 10 }), /TESTACCESS|synthetic-session|synthetic-secret/)
  assert.equal(transports, 1)
})

test('credential-bearing transport failures are absent from route logs and responses', async () => {
  const previous = console.error
  const logged = []
  console.error = (...args) => logged.push(args.map(String).join(' '))
  global.fetch = async () => { throw new Error(credentials.secretAccessKey + credentials.sessionToken) }
  try {
    const token = jwt.sign({ id: 'user@test' }, 'synthetic-jwt', { expiresIn: '1h' })
    const response = await require('../src/app/api/costs/route.ts').GET(new Request('https://app.test/api/costs', { headers: { Authorization: 'Bearer ' + token } }))
    const body = await response.text()
    assert.doesNotMatch(body + logged.join(' '), /synthetic-secret|synthetic-session|TESTACCESS|AWS4-HMAC/)
    assert.ok(response.status >= 400)
  } finally { console.error = previous }
})

test('concurrent signing keeps each temporary credential session separate', async () => {
  let next = 0
  const run = createApiGatewayFetch(async () => {
    const id = next++
    await Promise.resolve()
    return { ...credentials, accessKeyId: 'ACCESS' + id, sessionToken: 'SESSION' + id }
  })
  const seen = new Set()
  global.fetch = async (_url, options) => {
    const id = /Credential=ACCESS(\d+)\//.exec(options.headers.authorization)[1]
    assert.equal(options.headers['x-amz-security-token'], 'SESSION' + id)
    seen.add(id)
    return Response.json({ ok: true })
  }
  await Promise.all(Array.from({ length: 10 }, () => run(endpoint)))
  assert.equal(seen.size, 10)
})

test('policy and proposed commands are confined to approved routes and preserve ungranted duplicate routes', () => {
  const inventory = require('../docs/aws-iam/verified-inventory.json').apis
  assert.deepEqual([...API_GATEWAY_IDS].sort(), inventory.map(a => a.id).sort())
  const policy = require('../docs/aws-iam/proposed-invoke-policy.json')
  const callers = require('../docs/aws-iam/callers.json').routes
  const elasticIps = callers.filter(r => r.caller.startsWith('/api/ec2/elasticips'))
  assert.equal(elasticIps.length, 4)
  for (const route of elasticIps) {
    assert.equal(route.productionEvidence.source, 'user-reported')
    assert.equal(route.productionEvidence.reportedCommit, 'fbbb863')
    assert.equal(route.productionEvidence.currentEnvironmentIndependentlyVerified, false)
    assert.equal(route.productionEvidence.sigv4ReadinessVerified, false)
    assert.equal(route.productionEvidence.grantStatus, 'pending-independent-production-verification')
  }
  const statement = policy.Statement[0]
  assert.equal(statement.Action, 'execute-api:Invoke')
  assert.deepEqual(statement.Resource, callers.map(r => `arn:aws:execute-api:eu-west-2:625490134717:${r.api}/${r.stage}/${r.method}${r.path}`))
  for (const r of callers) {
    assert.ok(!JSON.stringify(r).includes('*'))
    const api = inventory.find(a => a.id === r.api)
    assert.ok(api.stages.some(s => s.name === r.stage))
    assert.ok(api.routes.some(x => x.route === r.method + ' ' + r.path))
  }
  assert.ok(!statement.Resource.some(s => s.includes('j4ozdfaq1b') && s.endsWith('/POST/resize')))
  assert.ok(!statement.Resource.some(s => s.includes('p6p323otkc') || /\/GET\/(data|costs)$/.test(s)))
  const commands = fs.readFileSync('docs/aws-iam/gateway-commands.txt', 'utf8').split('\n').filter(s => s.startsWith('aws '))
  assert.equal(commands.length, inventory.reduce((n, a) => n + a.routes.length, 0))
  for (const line of commands) {
    assert.match(line, /apigatewayv2 update-route .*--authorization-type AWS_IAM$/)
    assert.ok(API_GATEWAY_IDS.includes(/--api-id '([^']+)'/.exec(line)[1]))
    assert.doesNotMatch(line, /integration|delete|create|lambda/)
  }
})
