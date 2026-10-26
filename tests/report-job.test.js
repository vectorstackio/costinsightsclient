/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { AsyncLocalStorage } = require('node:async_hooks')
const ts = require('typescript')
const jwt = require('jsonwebtoken')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const secret = 'test-user-signing-key'
const jobToken = 'test_only_report_job_credential_0123456789_ABCDEF'
const configuration = { PW_SALT: secret, USERS: { 'user@test': 'unused' }, USER_IDS: { 'user@test': 'user' }, REPORT_JOB_TOKEN: jobToken }
const incomingHeaders = new AsyncLocalStorage()
const objects = new Map()
let serviceCalls = 0
let launched = 0
let closed = 0
let printed = 0
let navigationMode = 'success'
const forwarded = []
const summary = { currentMonthCost: 10, previousMonthCost: 5, monthOverMonthChangePercent: 100, byService: [], byServiceComparison: [], topCostIncreaseDrivers: [], anomalies: [], trend: [], topRecommendations: [], potentialSavings: 0, recommendationCount: 0 }
class GetObjectCommand { constructor(input) { this.input = input } }
class PutObjectCommand { constructor(input) { this.input = input } }
class ListObjectsV2Command { constructor(input) { this.input = input } }
class S3Client {
  async send(command) {
    serviceCalls++
    assert.ok(!JSON.stringify(command.input).includes(jobToken))
    const key = command.input.Key
    if (command instanceof PutObjectCommand) { objects.set(key, command.input.Body); return {} }
    if (!objects.has(key)) throw Object.assign(new Error('Missing object'), { name: 'NoSuchKey' })
    const data = objects.get(key)
    return { Body: { transformToString: async () => data, transformToByteArray: async () => data } }
  }
}
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText, filename)
}
const mocks = {
  'server-only': {},
  '@/lib/config': configuration,
  'next/headers': { headers: async () => new Headers(incomingHeaders.getStore() ?? {}) },
  'next/image': { __esModule: true, default: props => React.createElement('img', props) },
  '@aws-sdk/client-s3': { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command },
  '@/lib/ai/graph': { graph: { streamEvents: () => { serviceCalls++; throw new Error('Unexpected AI call') } } },
  '@/lib/ai/llm': { model: { invoke: () => { serviceCalls++; throw new Error('Unexpected AI call') } } }
}
const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (Object.hasOwn(mocks, request)) return mocks[request]
  if (request.startsWith('@/')) request = path.resolve('src', request.slice(2))
  return originalLoad.call(this, request, parent, isMain)
}
process.env.NEXT_PUBLIC_BASE_URL = 'https://app.test'
process.env.COST_API_URL = 'https://cost.mock'
const reportAuth = require('../src/lib/reports/auth.ts')
const generalAuth = require('../src/lib/auth/server.ts')
const reports = require('../src/lib/reports/index.ts')
const s3Reports = require('../src/lib/s3/reports.ts')
const generateRoute = require('../src/app/api/reports/generate/route.ts')
const dataRoute = require('../src/app/api/reports/route.ts')
const pageRoute = require('../src/app/reports/[month]/page.tsx').default
const { proxy } = require('../src/proxy.ts')
const month = '2026-09'
const authorization = 'ReportJob ' + jobToken
const userToken = jwt.sign({ id: 'user@test' }, secret, { expiresIn: '1h' })
const req = (url = '/api/reports/generate?month=' + month, value = authorization, method = 'GET', extras = {}) => new Request('https://app.test' + url, {
  method, headers: { ...(value === null ? {} : { authorization: value }), ...extras }
})
const runHeaders = (request, operation) => incomingHeaders.run(request.headers, operation)

mocks.puppeteer = { __esModule: true, default: { launch: async () => {
  launched++
  let listener
  let target
  const frame = {}
  let html = ''
  const page = {
    mainFrame: () => frame,
    setRequestInterception: async () => {},
    on: (_event, callback) => { listener = callback },
    url: () => navigationMode === 'redirect' ? 'https://app.test/login' : target,
    goto: async url => {
      target = url
      if (navigationMode === 'timeout') throw new Error('Timeout containing ' + jobToken)
      for (const item of [
        { url, main: true },
        { url: 'https://app.test/_next/static/app.js' },
        { url: 'https://external.test/image.png' },
        { url, iframe: true }
      ]) {
        listener({ headers: () => ({ Authorization: authorization, cookie: 'private' }), url: () => item.url,
          isNavigationRequest: () => Boolean(item.main || item.iframe), frame: () => item.iframe ? {} : frame,
          redirectChain: () => [], abort: async () => {},
          continue: async ({ headers }) => { forwarded.push({ ...item, headers }) }
        })
      }
      const headers = forwarded.at(-4).headers
      assert.equal(proxy(req('/reports/' + month, headers.authorization)).status, 200)
      const element = await incomingHeaders.run(headers, () => pageRoute({ params: Promise.resolve({ month }) }))
      html = renderToStaticMarkup(element)
      assert.ok(!html.includes(jobToken))
      return { ok: () => navigationMode !== 'status', url: () => page.url(), headers: () => ({ 'content-type': 'text/html' }), request: () => ({ redirectChain: () => [] }) }
    },
    $eval: async () => navigationMode === 'marker' ? '2026-08' : /data-cost-report-month="([^"]+)"/.exec(html)?.[1],
    pdf: async () => { printed++; return new Uint8Array([1, 2, 3]) }
  }
  return { newPage: async () => page, close: async () => { closed++ } }
} } }
const originalFetch = global.fetch
const mockFetch = async (input, options = {}) => {
  const url = new URL(String(input))
  if (url.origin === 'https://app.test') {
    assert.equal(url.pathname, '/api/reports')
    assert.equal(options.method, 'GET')
    assert.equal(options.redirect, 'error')
    const request = new Request(url, options)
    return runHeaders(request, () => dataRoute.GET(request))
  }
  serviceCalls++
  assert.ok(!JSON.stringify(options).includes(jobToken))
  if (url.origin === 'https://cost.mock') return Response.json(summary)
  if (url.origin === 'https://api.openai.com') return Response.json({ choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test', driversNarrative: '', anomalyNarrative: '', recommendationsNarrative: '', rootCauseNarrative: '' }) } }] })
  throw new Error('Unexpected external destination')
}

for (const value of [null, '', 'ReportJob', 'ReportJob short', 'ReportJob ' + 'x'.repeat(40), 'ReportJob ' + jobToken + ',extra', 'Bearer ' + jobToken]) {
  test('rejects absent/malformed/incorrect credential before any services: ' + (value === null ? 'missing' : String(value).split(' ')[0]), async () => {
    const before = serviceCalls
    const response = await generateRoute.GET(req(undefined, value))
    assert.equal(response.status, 401)
    assert.equal(serviceCalls, before)
    assert.ok(!(await response.text()).includes(jobToken))
  })
}
for (const configured of [undefined, '', 'short', ' '.repeat(40)]) {
  test('fails closed with missing or invalid configuration', async () => {
    configuration.REPORT_JOB_TOKEN = configured
    try { assert.equal((await generateRoute.GET(req())).status, 401) }
    finally { configuration.REPORT_JOB_TOKEN = jobToken }
  })
}
for (const url of ['/api/reports', '/api/reports?month=2026-13', '/api/reports?month=2026-09%0A', '/api/reports?month=../login', '/api/reports?month=2026-09&month=2026-08', '/api/reports?month=2026-09&token=x']) {
  test('machine data route rejects invalid month/query: ' + url, async () => {
    const before = serviceCalls
    assert.equal((await dataRoute.GET(req(url))).status, 400)
    assert.equal(serviceCalls, before)
  })
}
for (const method of ['HEAD', 'POST', 'PUT', 'DELETE']) {
  test('report machine wrapper rejects method ' + method, async () => {
    assert.equal((await generateRoute.GET(req(undefined, authorization, method))).status, 403)
  })
}
test('valid credential follows actual report generation, S3, page data loading and PDF chain without disclosure', async () => {
  objects.clear(); forwarded.length = 0
  const before = printed
  global.fetch = mockFetch
  try {
    const request = req()
    const response = await runHeaders(request, () => generateRoute.GET(request))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { message: 'Report generated', month, key: 'reports/aws-cost-' + month + '.pdf' })
    assert.match(response.headers.get('cache-control'), /private, no-store/)
    assert.ok(!JSON.stringify([...response.headers]).includes(jobToken))
    assert.ok(objects.has('reports/' + month + '.json'))
    assert.deepEqual([...objects.get('reports/aws-cost-' + month + '.pdf')], [1, 2, 3])
    assert.equal(printed, before + 1)
    assert.equal(forwarded[0].headers.authorization, authorization)
    for (const asset of forwarded.slice(1)) assert.equal(asset.headers.authorization, undefined)
    assert.equal(launched, closed)
  } finally { global.fetch = originalFetch }
})
for (const mode of ['redirect', 'timeout', 'status', 'marker']) {
  test('PDF ' + mode + ' fails closed without printing, storing PDF or exposing errors', async () => {
    objects.delete('reports/aws-cost-' + month + '.pdf')
    navigationMode = mode
    const before = printed
    global.fetch = mockFetch
    try {
      const response = await generateRoute.GET(req())
      assert.equal(response.status, 500)
      assert.deepEqual(await response.json(), { success: false, error: 'Report generation failed' })
      assert.equal(printed, before)
      assert.equal(objects.has('reports/aws-cost-' + month + '.pdf'), false)
      assert.equal(launched, closed)
    } finally { global.fetch = originalFetch; navigationMode = 'success' }
  })
}
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])
for (const filename of walk('src/app/api').filter(p => p.endsWith('/route.ts') && !['src/app/api/reports/route.ts', 'src/app/api/reports/generate/route.ts'].includes(p))) {
  const route = require(path.resolve(filename))
  for (const method of ['GET', 'POST', 'PUT', 'DELETE'].filter(m => route[m])) {
    test('ReportJob cannot authorize ' + method + ' ' + filename, async () => {
      const before = serviceCalls
      const request = req('/' + filename.slice(8, -9), authorization, method)
      const response = await runHeaders(request, () => route[method](request, { params: Promise.resolve({ month, id: 'record' }) }))
      assert.ok([401, 403].includes(response.status))
      assert.equal(serviceCalls, before)
    })
  }
}
for (const [url, method, extras] of [
  ['/reports/' + month, 'HEAD', {}], ['/reports/' + month, 'POST', {}], ['/reports', 'GET', {}],
  ['/reports/2026-13', 'GET', {}], ['/reports/' + month + '?token=x', 'GET', {}],
  ['/reports/' + month, 'GET', { rsc: '1' }], ['/reports/' + month, 'GET', { 'next-router-prefetch': '1' }]
]) {
  test('page proxy restricts machine to exact GET document: ' + method + ' ' + url, () => {
    assert.equal(proxy(req(url, authorization, method, extras)).status, 403)
  })
}
test('page verifies credentials, month and sanitizes failures', async () => {
  for (const value of ['ReportJob ' + 'x'.repeat(40), 'ReportJob short']) {
    await assert.rejects(incomingHeaders.run({ authorization: value }, () => reportAuth.withReportPageAccess(month, async () => {})), /Unable to load authenticated report/)
  }
  await assert.rejects(incomingHeaders.run({ authorization }, () => reportAuth.withReportPageAccess('2026-13', async () => {})))
  await assert.rejects(incomingHeaders.run({ authorization }, () => reportAuth.withReportPageAccess(month, async () => { throw new Error(jobToken) })), error => !error.message.includes(jobToken))
})
test('report request context enforces month/key scope, never grants general session and clears after use', async () => {
  const handler = reportAuth.withReportAuth(async () => {
    assert.equal((await reportAuth.requireReportAccess(month)).authorization, authorization)
    await assert.rejects(reportAuth.requireReportAccess('2026-08'))
    await assert.rejects(reports.getOrCreateReport('2026-08'))
    await assert.rejects(reports.generateNarrative({}, '2026-08'))
    await assert.rejects(generalAuth.requireSession())
    await assert.rejects(generalAuth.internalFetch('/api/ec2'))
    await assert.rejects(s3Reports.getReportPdf('reports/aws-cost-2026-08.pdf'))
    await assert.rejects(s3Reports.saveReportPdf('other/key.pdf', new Uint8Array()))
    await assert.rejects(s3Reports.saveReportPdf('reports/aws-cost-' + month + '.pdf\n', new Uint8Array()))
    await assert.rejects(require('../src/lib/s3/getReports.ts').getReports())
    return Response.json({ success: true })
  }, '/api/reports/generate')
  assert.equal((await handler(req())).status, 200)
  await assert.rejects(reportAuth.requireReportAccess(month))
})
test('concurrent report requests retain independent months and no credential context survives rejection', async () => {
  const handler = reportAuth.withReportAuth(async request => {
    const requested = new URL(request.url).searchParams.get('month')
    await new Promise(resolve => setImmediate(resolve))
    assert.equal((await reportAuth.requireReportAccess(requested)).month, requested)
    await assert.rejects(reportAuth.requireReportAccess(requested === month ? '2026-08' : month))
    return Response.json({})
  }, '/api/reports')
  const results = await Promise.all([month, '2026-08'].map(m => handler(req('/api/reports?month=' + m))))
  assert.ok(results.every(r => r.status === 200))
  await assert.rejects(reportAuth.requireReportAccess(month))
})
test('credential rotation invalidates an active report context and page error', async () => {
  const handler = reportAuth.withReportAuth(async () => {
    configuration.REPORT_JOB_TOKEN = ''
    await assert.rejects(reportAuth.requireReportAccess(month))
    return Response.json({})
  }, '/api/reports/generate')
  try { assert.equal((await handler(req())).status, 200) }
  finally { configuration.REPORT_JOB_TOKEN = jobToken }
})
test('ordinary user Bearer and cookie CSRF behaviour remains unchanged on report endpoints', async () => {
  global.fetch = mockFetch
  objects.set('reports/aws-cost-' + month + '.pdf', new Uint8Array([1]))
  try {
    assert.equal((await generateRoute.GET(req(undefined, 'Bearer ' + userToken))).status, 200)
    const cookie = generalAuth.SESSION_COOKIE + '=' + userToken
    assert.equal((await generateRoute.GET(req(undefined, null, 'GET', { cookie }))).status, 403)
    assert.equal((await generateRoute.GET(req(undefined, null, 'GET', { cookie, origin: 'https://app.test' }))).status, 200)
    assert.equal((await generateRoute.GET(req(undefined, null, 'GET', { cookie, origin: 'https://evil.test' }))).status, 403)
    assert.equal((await generateRoute.GET(req(undefined, 'ReportJob bad', 'GET', { cookie, origin: 'https://app.test' }))).status, 401)
    const html = await incomingHeaders.run({ authorization: 'Bearer ' + userToken }, async () => renderToStaticMarkup(await pageRoute({ params: Promise.resolve({ month }) })))
    assert.ok(html.includes('data-cost-report-month="' + month + '"'))
    assert.ok(!html.includes(jobToken))
  } finally { global.fetch = originalFetch }
})
test('general auth and client dependency boundary never import ReportJob support', () => {
  assert.ok(!fs.readFileSync('src/lib/auth/server.ts', 'utf8').includes('ReportJob'))
})

test('machine forwarding rejects remote HTTP and embedded credentials, allowing HTTPS or loopback only', async () => {
  const previous = process.env.NEXT_PUBLIC_BASE_URL
  try {
    for (const base of ['http://external.test', 'https://name:password@app.test', 'file:///tmp/report']) {
      process.env.NEXT_PUBLIC_BASE_URL = base
      assert.throws(() => reportAuth.reportApplicationUrl(authorization))
    }
    for (const base of ['https://app.test', 'http://localhost:3024', 'http://127.0.0.1:3024', 'http://[::1]:3024']) {
      process.env.NEXT_PUBLIC_BASE_URL = base
      assert.equal(reportAuth.reportApplicationUrl(authorization).origin, new URL(base).origin)
    }
  } finally { process.env.NEXT_PUBLIC_BASE_URL = previous }
})
test('generation without a month uses the previous calendar month and keeps errors credential-free', async () => {
  const handler = reportAuth.withReportAuth(async () => {
    const previous = require('../src/lib/date/index.ts').getPreviousMonthYYYYMM()
    assert.equal((await reportAuth.requireReportAccess(previous)).month, previous)
    throw new Error(jobToken)
  }, '/api/reports/generate')
  const response = await handler(req('/api/reports/generate'))
  assert.equal(response.status, 500)
  assert.ok(!(await response.text()).includes(jobToken))
  await assert.rejects(reportAuth.requireReportAccess(month))
})
test('machine wrapper rejects wrong path without executing, and ignores credentials in query/cookie storage', async () => {
  let calls = 0
  const handler = reportAuth.withReportAuth(async () => { calls++; return Response.json({}) }, '/api/reports')
  assert.equal((await handler(req('/api/costs?month=' + month))).status, 403)
  assert.equal((await handler(req('/api/reports?month=' + month + '&token=' + jobToken, null))).status, 401)
  assert.equal((await handler(req('/api/reports?month=' + month, null, 'GET', { cookie: generalAuth.SESSION_COOKIE + '=' + jobToken }))).status, 401)
  assert.equal(calls, 0)
})
test('report page needs authenticated access even when its callback has no data loading', async () => {
  let calls = 0
  await assert.rejects(incomingHeaders.run({}, () => reportAuth.withReportPageAccess(month, async () => { calls++ })))
  assert.equal(calls, 0)
  const response = proxy(req('/reports/' + month))
  assert.match(response.headers.get('cache-control'), /private, no-store/)
  assert.ok(!JSON.stringify([...response.headers]).includes(jobToken))
})
