/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const jwt = require('jsonwebtoken')
const secret = 'test-only-hardening-signing-key'
const users = Object.fromEntries(['alice', 'bob', 'carol', 'dave'].map(name => [name + '@test', name + '-test-password']))
const ids = Object.fromEntries(Object.keys(users).map((email, i) => [email, 'user-' + i]))
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText, filename)
}
const mocks = {
  'server-only': {},
  '@/lib/config': { PW_SALT: secret, USERS: users, USER_IDS: ids },
  'next/headers': { headers: async () => new Headers() }
}
const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (Object.hasOwn(mocks, request)) return mocks[request]
  if (request.startsWith('@/')) request = path.resolve('src', request.slice(2))
  return originalLoad.call(this, request, parent, isMain)
}
process.env.NEXT_PUBLIC_BASE_URL = 'https://app.test'
const auth = require('../src/lib/auth/server.ts')
const sessionRoute = require('../src/app/api/auth/route.ts')
const loginRoute = require('../src/app/api/login/route.ts')
const token = jwt.sign({ id: 'alice@test' }, secret, { expiresIn: '1h' })
const cookie = auth.SESSION_COOKIE + '=' + token
const makeRequest = (method, headers = {}, url = 'http://127.0.0.1:3024/api/ec2', body) => new Request(url, {
  method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) })
})

const rejectedOrigins = [
  ['missing evidence', {}],
  ['opaque origin', { origin: 'null' }],
  ['foreign origin', { origin: 'https://evil.test' }],
  ['same-site sibling', { origin: 'https://sibling.app.test', 'sec-fetch-site': 'same-site' }],
  ['HTTP downgrade', { origin: 'http://app.test' }],
  ['foreign port', { origin: 'https://app.test:8443' }],
  ['malformed origin', { origin: 'https://app.test/path' }],
  ['cross-site metadata with valid origin', { origin: 'https://app.test', 'sec-fetch-site': 'cross-site' }],
  ['direct navigation is not write evidence', { 'sec-fetch-site': 'none' }],
  ['spoofed proxy headers', { origin: 'https://evil.test', 'x-forwarded-host': 'evil.test', 'x-forwarded-proto': 'https', host: 'evil.test' }]
]
for (const [name, headers] of rejectedOrigins) {
  test('cookie writes reject ' + name + ' before any handler or service call', async () => {
    let calls = 0
    const handler = auth.withAuth(async () => { calls++; return Response.json({}) })
    for (const method of ['POST', 'PUT', 'DELETE']) {
      assert.equal((await handler(makeRequest(method, { cookie, ...headers }))).status, 403)
    }
    assert.equal(calls, 0)
  })
}
for (const headers of [{ origin: 'https://app.test' }, { 'sec-fetch-site': 'same-origin' }]) {
  test('cookie writes work through Nginx HTTP upstream with ' + Object.keys(headers)[0], async () => {
    const handler = auth.withAuth(async () => Response.json({ success: true }))
    assert.equal((await handler(makeRequest('POST', { cookie, ...headers }))).status, 200)
  })
}
test('forwarded and Host headers cannot override the configured trusted origin', async () => {
  const handler = auth.withAuth(async () => Response.json({}))
  const res = await handler(makeRequest('POST', { cookie, origin: 'https://app.test', host: 'internal:3024', 'x-forwarded-host': 'evil.test', 'x-forwarded-proto': 'http' }))
  assert.equal(res.status, 200)
})
test('missing or invalid public origin fails closed in production', () => {
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    for (const base of [undefined, 'invalid', 'http://app.test', 'https://user:pass@app.test', 'file:///tmp/report']) {
      if (base === undefined) delete process.env.NEXT_PUBLIC_BASE_URL
      else process.env.NEXT_PUBLIC_BASE_URL = base
      assert.equal(auth.sameOrigin(makeRequest('POST', { origin: 'https://app.test' })), false)
    }
  } finally {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://app.test'
    if (previous === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previous
  }
})
test('verified Bearer writes remain available without browser metadata or with foreign origin', async () => {
  const handler = auth.withAuth(async () => Response.json({}))
  for (const headers of [{}, { origin: 'https://integration.test', 'sec-fetch-site': 'cross-site' }]) {
    assert.equal((await handler(makeRequest('POST', { cookie, authorization: 'Bearer ' + token, ...headers }))).status, 200)
  }
  for (const invalid of ['bad', jwt.sign({ id: 'alice@test' }, secret, { expiresIn: -1 })]) {
    assert.equal((await handler(makeRequest('POST', { cookie, authorization: 'Bearer ' + invalid }))).status, 401)
  }
})
test('state-changing report GET requires cookie origin evidence even with encoded paths', async () => {
  let calls = 0
  const handler = auth.withAuth(async () => { calls++; return Response.json({}) }, { stateChanging: true })
  assert.equal((await handler(makeRequest('GET', { cookie }, 'https://app.test/api/reports/%67enerate'))).status, 403)
  assert.equal(calls, 0)
  assert.equal((await handler(makeRequest('GET', { cookie, 'sec-fetch-site': 'same-origin' }))).status, 200)
})
test('same-origin cookie reads and direct PDF navigation remain available', async () => {
  const handler = auth.withAuth(async () => Response.json({}))
  assert.equal((await handler(makeRequest('GET', { cookie, 'sec-fetch-site': 'none' }))).status, 200)
})
test('session establishment and logout enforce CSRF and do not echo the JWT', async () => {
  for (const [, headers] of rejectedOrigins) {
    assert.equal((await sessionRoute.POST(makeRequest('POST', headers, undefined, { token }))).status, 403)
    assert.equal((await sessionRoute.DELETE(makeRequest('DELETE', { cookie, ...headers }))).status, 403)
  }
  const res = await sessionRoute.POST(makeRequest('POST', { origin: 'https://app.test' }, undefined, { token }))
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { success: true })
  assert.match(res.headers.get('set-cookie'), /HttpOnly/i)
  assert.match(res.headers.get('set-cookie'), /SameSite=strict/i)
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.equal((await sessionRoute.POST(makeRequest('POST', { authorization: 'Bearer ' + token }, undefined, { token }))).status, 200)
  const logout = await sessionRoute.DELETE(makeRequest('DELETE', { cookie, origin: 'https://app.test' }))
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/i)
})
for (const email of Object.keys(users)) {
  test('configured fixture user can login, establish session and perform AWS writes: ' + ids[email], async () => {
    const response = await loginRoute.POST(makeRequest('POST', {}, undefined, { email, password: users[email] }))
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(data.userId, ids[email])
    const payload = jwt.verify(data.token, secret, { algorithms: ['HS256'] })
    assert.equal(payload.id, email)
    assert.equal(payload.exp - payload.iat, 365.25 * 24 * 60 * 60)
    const established = await sessionRoute.POST(makeRequest('POST', { origin: 'https://app.test' }, undefined, { token: data.token }))
    assert.equal(established.status, 200)
    const sessionCookie = established.headers.get('set-cookie').split(';')[0]
    const originalFetch = global.fetch
    let calls = 0
    global.fetch = async () => { calls++; return Response.json({ success: true }) }
    try {
      const ec2 = require('../src/app/api/ec2/route.ts')
      const write = await ec2.POST(makeRequest('POST', { cookie: sessionCookie, origin: 'https://app.test' }, undefined, { action: 'stop', instanceId: 'test-instance' }))
      assert.equal(write.status, 200)
      assert.equal(calls, 1)
    } finally { global.fetch = originalFetch }
  })
}
test('browser login helper works without a token in the session response', async () => {
  const originalFetch = global.fetch
  const previousStorage = global.sessionStorage
  const stored = new Map()
  const calls = []
  global.sessionStorage = { setItem: (key, value) => stored.set(key, value) }
  global.fetch = async (url, options) => {
    calls.push(url)
    return url === '/api/login'
      ? Response.json({ success: true, token, userId: 'user-0' })
      : sessionRoute.POST(makeRequest('POST', { origin: 'https://app.test' }, undefined, JSON.parse(options.body)))
  }
  try {
    const browserAuth = require('../src/lib/auth/index.ts')
    assert.deepEqual(await browserAuth.login('alice@test', users['alice@test']), { success: true })
    assert.deepEqual(calls, ['/api/login', '/api/auth'])
    assert.equal(stored.get(browserAuth.AUTH_TOKEN_NAME), token)
    assert.equal(stored.get(browserAuth.USER_ID_NAME), 'user-0')
  } finally { global.fetch = originalFetch; global.sessionStorage = previousStorage }
})

async function runPdf(overrides = {}) {
  let intercept
  let closed = false
  let printed = 0
  const forwarded = []
  const frame = {}
  const target = 'https://app.test/reports/2026-09'
  const page = {
    mainFrame: () => frame,
    url: () => overrides.pageUrl ?? target,
    setRequestInterception: async () => {},
    on: (_event, callback) => { intercept = callback },
    $eval: async () => {
      if (overrides.missingMarker) throw new Error('Missing report marker')
      return overrides.month ?? '2026-09'
    },
    goto: async (url, options) => {
      assert.equal(url, target)
      assert.equal(options.timeout, 30000)
      if (overrides.navigationError) throw new Error('Navigation timeout')
      for (const item of overrides.requests ?? [{ url: target, main: true }]) {
        const req = {
          headers: () => ({ Authorization: 'Bearer inherited', cookie: 'private', 'proxy-authorization': 'private' }),
          url: () => item.url,
          isNavigationRequest: () => Boolean(item.main || item.iframe),
          frame: () => item.iframe ? {} : frame,
          redirectChain: () => item.redirect ? [{}] : [],
          abort: async () => { forwarded.push({ url: item.url, aborted: true }) },
          continue: async ({ headers }) => {
            if (overrides.continueError) throw new Error('Request failed')
            forwarded.push({ url: item.url, headers })
          }
        }
        intercept(req)
        await new Promise(resolve => setImmediate(resolve))
      }
      return overrides.noResponse ? null : {
        ok: () => !overrides.badStatus,
        url: () => overrides.responseUrl ?? target,
        headers: () => ({ 'content-type': overrides.contentType ?? 'text/html; charset=utf-8' }),
        request: () => ({ redirectChain: () => overrides.redirect ? [{}] : [] })
      }
    },
    pdf: async () => { printed++; return new Uint8Array([1, 2, 3]) }
  }
  mocks.puppeteer = { __esModule: true, default: { launch: async () => ({ newPage: async () => page, close: async () => { closed = true } }) } }
  try {
    const { generatePdf } = require('../src/lib/reports/pdf/index.ts')
    const handler = auth.withAuth(async () => new Response(await generatePdf(overrides.inputMonth ?? '2026-09')))
    const operation = handler(makeRequest('GET', { authorization: 'Bearer ' + token }))
    if (overrides.reject) {
      await assert.rejects(operation)
      assert.equal(printed, 0)
    } else {
      assert.deepEqual([...new Uint8Array(await (await operation).arrayBuffer())], [1, 2, 3])
      assert.equal(printed, 1)
    }
    assert.equal(closed, overrides.inputMonth === undefined)
    return forwarded
  } finally { delete mocks.puppeteer }
}
for (const [name, overrides] of [
  ['authentication redirect', { responseUrl: 'https://app.test/login', pageUrl: 'https://app.test/login' }],
  ['external redirect', { responseUrl: 'https://evil.test/login' }],
  ['redirect back to report URL', { redirect: true }],
  ['HTTP failure', { badStatus: true }],
  ['no navigation response', { noResponse: true }],
  ['navigation timeout', { navigationError: true }],
  ['non-HTML response', { contentType: 'application/json' }],
  ['200 login/error page without report marker', { missingMarker: true }],
  ['wrong successful report month', { month: '2026-08' }],
  ['interception failure', { continueError: true }],
  ['path traversal month', { inputMonth: '../login' }],
  ['invalid month', { inputMonth: '2026-13' }],
  ['main-frame navigation to login', { requests: [{ url: 'https://app.test/login', main: true }] }],
  ['same-origin redirect request', { requests: [{ url: 'https://app.test/reports/2026-09', main: true, redirect: true }] }]
]) {
  test('PDF rejects ' + name + ' before printing and closes the browser', async () => runPdf({ ...overrides, reject: true }))
}
test('PDF forwards token only to exact main report document, stripping credentials from all assets/iframes', async () => {
  const target = 'https://app.test/reports/2026-09'
  const forwarded = await runPdf({ requests: [
    { url: target, main: true },
    { url: 'https://app.test/_next/static/app.js' },
    { url: 'https://external.test/image.png' },
    { url: target, iframe: true }
  ] })
  assert.equal(forwarded[0].headers.authorization, 'Bearer ' + token)
  for (const request of forwarded.slice(1)) assert.deepEqual(request.headers, {})
  assert.equal(forwarded[0].headers.cookie, undefined)
})

test('Nginx HTTP upstream still establishes Secure cookies in production', async () => {
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    const response = await sessionRoute.POST(makeRequest('POST', { origin: 'https://app.test' }, undefined, { token }))
    assert.equal(response.status, 200)
    assert.match(response.headers.get('set-cookie'), /; Secure/i)
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previous
  }
})
test('invalid credentials and expired session tokens preserve rejection behaviour', async () => {
  assert.equal((await loginRoute.POST(makeRequest('POST', {}, undefined, { email: 'alice@test', password: 'wrong' }))).status, 401)
  for (const candidate of [undefined, 'bad', jwt.sign({ id: 'alice@test' }, secret, { expiresIn: -1 })]) {
    const response = await sessionRoute.POST(makeRequest('POST', { origin: 'https://app.test' }, undefined, { token: candidate }))
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('set-cookie'), null)
  }
})
test('existing useAuth hook accepts success-only session responses', async () => {
  const originalFetch = global.fetch
  const previousStorage = global.sessionStorage
  let checked
  mocks.react = { useEffect: effect => effect() }
  global.sessionStorage = { getItem: () => token }
  global.fetch = async (_url, options) => sessionRoute.POST(makeRequest('POST', { origin: 'https://app.test' }, undefined, JSON.parse(options.body)))
  try {
    require('../src/lib/hooks/useAuth.ts').useAuth(forbidden => { checked = forbidden })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(checked, false)
  } finally {
    delete mocks.react
    global.fetch = originalFetch
    global.sessionStorage = previousStorage
  }
})
