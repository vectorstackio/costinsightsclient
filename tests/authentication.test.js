/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const jwt = require('jsonwebtoken')
process.env.MESSAGE_API_URL = 'https://mock.test'
const secret = 'test-only-signing-key-not-production'
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText, filename)
}
let serviceCalls = 0
const mocks = {
  'server-only': {},
  '@/lib/config': { PW_SALT: secret, USERS: { 'alice@test': 'unused', 'bob@test': 'unused' }, USER_IDS: { 'alice@test': 'alice', 'bob@test': 'bob' } },
  'next/headers': { headers: async () => new Headers() },
  '@/lib/ai/graph': { graph: { streamEvents: () => { serviceCalls++; return (async function* () {})() } } },
  '@/lib/ai/llm': { model: { invoke: async () => { serviceCalls++; return { content: 'Title' } } } },
  '@/lib/reports': { getOrCreateReport: async () => { serviceCalls++; return {} } },
  '@/lib/reports/pdf': { generatePdf: async () => { serviceCalls++; return new ArrayBuffer(0) } },
  '@/lib/s3/reports': { getReportPdf: async () => { serviceCalls++; return new Uint8Array() }, saveReportPdf: async () => { serviceCalls++ } },
  '@/lib/s3/getReports': { getReports: async () => { serviceCalls++; return [] } }
}
const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (Object.hasOwn(mocks, request)) return mocks[request]
  if (request.startsWith('@/')) request = path.resolve('src', request.slice(2))
  return originalLoad.call(this, request, parent, isMain)
}
const auth = require('../src/lib/auth/server.ts')
const sign = (id = 'alice@test', options = {}) => jwt.sign({ id }, secret, { expiresIn: '1h', ...options })
const request = (url, method = 'GET', token = sign(), body) => new Request('https://app.test' + url, {
  method, headers: token === null ? {} : { authorization: 'Bearer ' + token },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
})
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])
const routes = walk('src/app/api').filter(p => p.endsWith('/route.ts') && !/\/(auth|login)\/route.ts$/.test(p))
for (const filename of routes) {
  const route = require(path.resolve(filename))
  for (const method of ['GET', 'POST', 'PUT'].filter(m => route[m])) {
    for (const [name, token] of [['missing', null], ['invalid', 'bad'], ['expired', sign('alice@test', { expiresIn: -1 })], ['unknown user', sign('removed@test')]]) {
      test(`${method} ${filename}: rejects ${name} before any service call`, async () => {
        const originalFetch = global.fetch
        serviceCalls = 0
        global.fetch = async () => { serviceCalls++; throw new Error('Unexpected external request') }
        try {
          const response = await route[method](request('/' + filename.slice(8, -9), method, token), { params: Promise.resolve({ id: 'record', month: '2026-09' }) })
          assert.equal(response.status, 401)
          assert.equal(serviceCalls, 0)
        } finally { global.fetch = originalFetch }
      })
    }
  }
}
test('valid tokens preserve cost summary and drilldown contracts', async () => {
  const originalFetch = global.fetch
  let calls = 0
  global.fetch = async () => { calls++; return Response.json({ cost: 12 }) }
  try {
    for (const [file, method] of [['costs', 'GET'], ['costs/drilldown', 'POST']]) {
      const response = await require(`../src/app/api/${file}/route.ts`)[method](request('/api/' + file, method, sign(), method === 'POST' ? {} : undefined))
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { cost: 12 })
      assert.match(response.headers.get('cache-control'), /no-store/)
    }
    assert.equal(calls, 2)
  } finally { global.fetch = originalFetch }
})
test('JWT verification rejects wrong signature, algorithm and missing expiration', () => {
  for (const token of [jwt.sign({ id: 'alice@test' }, 'wrong'), sign('alice@test', { algorithm: 'HS384' }), jwt.sign({ id: 'alice@test' }, secret)]) {
    assert.throws(() => auth.verifyToken(token))
  }
})
test('cross-user requests and cross-site cookies are forbidden without upstream calls', async () => {
  const originalFetch = global.fetch
  let calls = 0
  global.fetch = async () => { calls++; throw new Error('Unexpected external request') }
  try {
    for (const [url, method, body] of [['/api/messages?userId=bob&conversationId=x', 'GET'], ['/api/conversations?userId=bob', 'GET'], ['/api/messages', 'POST', { userId: 'bob' }], ['/api/conversations/record', 'PUT', { userId: 'bob' }]]) {
      const filename = url.startsWith('/api/messages') ? 'messages' : method === 'PUT' ? 'conversations/[id]' : 'conversations'
      const res = await require(`../src/app/api/${filename}/route.ts`)[method](request(url, method, sign(), body))
      assert.equal(res.status, 403)
    }
    const req = new Request('https://app.test/api/costs', { headers: { cookie: auth.SESSION_COOKIE + '=' + sign(), origin: 'https://evil.test', 'sec-fetch-site': 'cross-site' } })
    assert.equal((await require('../src/app/api/costs/route.ts').GET(req)).status, 403)
    assert.equal(calls, 0)
  } finally { global.fetch = originalFetch }
})
test('conversation update checks stored ownership before writing', async () => {
  const originalFetch = global.fetch
  const methods = []
  global.fetch = async (_url, init) => { methods.push(init?.method ?? 'GET'); return Response.json({ records: [{ _id: 'record', userId: 'bob' }] }) }
  try {
    const response = await require('../src/app/api/conversations/[id]/route.ts').PUT(request('/api/conversations/record', 'PUT', sign(), { userId: 'alice' }), { params: Promise.resolve({ id: 'record' }) })
    assert.equal(response.status, 403)
    assert.deepEqual(methods, ['GET'])
  } finally { global.fetch = originalFetch }
})
test('internal calls require a session, forward caller JWT and refuse external targets', async () => {
  const originalFetch = global.fetch
  const previousBase = process.env.NEXT_PUBLIC_BASE_URL
  process.env.NEXT_PUBLIC_BASE_URL = 'https://app.test'
  let calls = 0
  global.fetch = async (url, init) => {
    calls++
    assert.equal(url.origin, 'https://app.test')
    assert.equal(init.redirect, 'error')
    assert.equal(init.headers.get('authorization'), 'Bearer ' + token)
    return Response.json({ ok: true })
  }
  const token = sign()
  try {
    await assert.rejects(auth.internalFetch('/api/costs'))
    const handler = auth.withAuth(async () => {
      await assert.rejects(auth.internalFetch('https://evil.test/api/costs'))
      return auth.internalFetch('/api/costs')
    })
    assert.equal((await handler(request('/api/ai', 'POST', token))).status, 200)
    assert.equal(calls, 1)
  } finally {
    global.fetch = originalFetch
    if (previousBase === undefined) delete process.env.NEXT_PUBLIC_BASE_URL
    else process.env.NEXT_PUBLIC_BASE_URL = previousBase
  }
})
test('pending AI actions are isolated by verified user', async () => {
  const store = require('../src/lib/ai/pendingActionStore.ts')
  const action = { tool: 'test' }
  const set = auth.withAuth(async () => { await store.setPendingAction(action); return Response.json({}) })
  const get = auth.withAuth(async () => Response.json(await store.getPendingAction()))
  await set(request('/api/ai', 'POST'))
  assert.deepEqual(await (await get(request('/api/ai', 'POST'))).json(), action)
  assert.equal(await (await get(request('/api/ai', 'POST', sign('bob@test')))).json(), null)
})
test('browser session uses HttpOnly SameSite cookie and supports logout', async () => {
  const route = require('../src/app/api/auth/route.ts')
  const response = await route.POST(request('/api/auth', 'POST', null, { token: sign() }))
  assert.equal(response.status, 200)
  const cookie = response.headers.get('set-cookie')
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /SameSite=strict/i)
  assert.match(cookie, /Secure/i)
  assert.equal(auth.sessionFromHeaders(new Headers({ cookie: cookie.split(';')[0] })).userId, 'alice')
  assert.match((await route.DELETE(request('/api/auth', 'DELETE'))).headers.get('set-cookie'), /Max-Age=0/i)
})

test('direct report generation rejects missing sessions before AWS, S3, AI or browser launch', async () => {
  const filename = require.resolve('../src/lib/reports/index.ts')
  delete require.cache[filename]
  const reports = require(filename)
  const pdf = require('../src/lib/reports/pdf/index.ts')
  const originalFetch = global.fetch
  serviceCalls = 0
  global.fetch = async () => { serviceCalls++; throw new Error('Unexpected service call') }
  try {
    await assert.rejects(reports.getOrCreateReport('2026-09'))
    await assert.rejects(reports.getReportByMonth('2026-09'))
    await assert.rejects(reports.generateNarrative({}))
    await assert.rejects(pdf.generatePdf('2026-09'))
    assert.equal(serviceCalls, 0)
  } finally { global.fetch = originalFetch }
})

test('authorized AI stream and title generation remain available', async () => {
  serviceCalls = 0
  const response = await require('../src/app/api/ai/route.ts').POST(request('/api/ai', 'POST', sign(), { question: 'costs', messages: [] }))
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /event-stream/)
  await response.text()
  const title = await require('../src/app/api/conversations/title/route.ts').POST(request('/api/conversations/title', 'POST', sign(), { question: 'costs' }))
  assert.deepEqual(await title.json(), { title: 'Title' })
  assert.equal(serviceCalls, 2)
})

test('PDF generation forwards JWT only to the application origin and closes its browser', async () => {
  let intercept
  let closed = false
  let launched = false
  const page = {
    setRequestInterception: async () => {},
    on: (_event, callback) => { intercept = callback },
    goto: async () => {
      for (const origin of ['https://app.test', 'https://external.test']) {
        let forwarded
        intercept({
          headers: () => ({ authorization: 'Bearer inherited' }),
          url: () => origin + '/reports/2026-09',
          continue: async options => { forwarded = options.headers.authorization }
        })
        assert.equal(forwarded, origin === 'https://app.test' ? 'Bearer ' + token : undefined)
      }
      return { ok: () => true }
    },
    pdf: async () => new Uint8Array([1, 2, 3])
  }
  mocks.puppeteer = { __esModule: true, default: { launch: async () => {
    launched = true
    return { newPage: async () => page, close: async () => { closed = true } }
  } } }
  const previousBase = process.env.NEXT_PUBLIC_BASE_URL
  process.env.NEXT_PUBLIC_BASE_URL = 'https://app.test'
  const token = sign()
  try {
    const { generatePdf } = require('../src/lib/reports/pdf/index.ts')
    const handler = auth.withAuth(async () => {
      const pdf = await generatePdf('2026-09')
      assert.deepEqual([...new Uint8Array(pdf)], [1, 2, 3])
      return Response.json({})
    })
    assert.equal((await handler(request('/api/reports/generate', 'GET', token))).status, 200)
    assert.ok(launched)
    assert.ok(closed)
  } finally {
    delete mocks.puppeteer
    if (previousBase === undefined) delete process.env.NEXT_PUBLIC_BASE_URL
    else process.env.NEXT_PUBLIC_BASE_URL = previousBase
  }
})

test('direct S3 helpers require authentication before sending commands', async () => {
  let commands = 0
  mocks['@aws-sdk/client-s3'] = {
    S3Client: class { async send() { commands++; throw new Error('Unexpected AWS request') } },
    ListObjectsV2Command: class {}, GetObjectCommand: class {}, PutObjectCommand: class {}
  }
  try {
    const history = require('../src/lib/s3/getReports.ts')
    const reports = require('../src/lib/s3/reports.ts')
    const upload = require('../src/lib/s3/uploadPdf.ts')
    await assert.rejects(history.getReports())
    await assert.rejects(reports.getReportJson('2026-09'))
    await assert.rejects(reports.getReportPdf('reports/test.pdf'))
    await assert.rejects(reports.saveReportJson('2026-09', {}))
    await assert.rejects(reports.saveReportPdf('reports/test.pdf', new Uint8Array()))
    await assert.rejects(upload.uploadPdfToS3(new Uint8Array(), 'reports/test.pdf'))
    assert.equal(commands, 0)
  } finally { delete mocks['@aws-sdk/client-s3'] }
})

test('encoded API paths cannot skip user ownership checks', async () => {
  const originalFetch = global.fetch
  let calls = 0
  global.fetch = async () => { calls++; throw new Error('Unexpected upstream request') }
  try {
    const response = await require('../src/app/api/messages/route.ts').GET(request('/api/%6dessages?userId=bob&conversationId=x'))
    assert.equal(response.status, 403)
    assert.equal(calls, 0)
  } finally { global.fetch = originalFetch }
})
