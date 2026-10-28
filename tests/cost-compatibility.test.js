/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

// Compile application TS/TSX in memory; no generated files or additional test dependencies.
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8')
    module._compile(ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
    }).outputText, filename)
  }
}
const originalLoad = Module._load
let mocks = { '@/lib/aws/api-gateway': { apiGatewayFetch: (...args) => global.fetch(...args) }, 'server-only': {}, '@/lib/reports/auth': { withReportPageAccess: (_month, operation) => operation() }, '@/lib/auth/server': { withAuth: handler => handler } }
Module._load = function (request, parent, isMain) {
  if (Object.hasOwn(mocks, request)) return mocks[request]
  if (request.startsWith('@/')) request = path.resolve('src', request.slice(2))
  return originalLoad.call(this, request, parent, isMain)
}
const currency = (value) => `$${value.toFixed(2)}`
const reportMock = { formatCurrency: currency }
mocks['@/lib/reports'] = reportMock
const Insights = require('../src/components/dashboard/Insights.tsx').default
const Explorer = require('../src/components/insights/AnomalyExplorer.tsx').default
const Targets = require('../src/components/insights/InvestigationTargets.tsx').default
const { GET } = require('../src/app/api/costs/route.ts')
const base = { service: 'Test service', currentCost: 75, averageCost: 0, spikeAmount: 75, severity: 'high' }
const cases = [
  ['both', { spikePercent: 50, zScore: 4.47 }],
  ['percentage only', { spikePercent: 400 }],
  ['score only', { zScore: 4.47 }],
  ['neither', {}],
  ['zeros', { spikePercent: 0, zScore: 0 }]
]

for (const [name, statistics] of cases) {
  test(`dashboard and Insights render ${name} without inventing statistics`, () => {
    const anomalies = Object.freeze([Object.freeze({ ...base, ...statistics })])
    const props = { anomalies, drivers: [], currency: 'USD' }
    const dashboard = renderToStaticMarkup(React.createElement(Insights, props))
    const explorer = renderToStaticMarkup(React.createElement(Explorer, props))
    const targets = renderToStaticMarkup(React.createElement(Targets, props))
    for (const html of [dashboard, explorer, targets]) {
      assert.match(html, /HIGH/)
      assert.doesNotMatch(html, /undefined|NaN|z=\)|\+%/)
    }
    if (statistics.spikePercent !== undefined) {
      assert.ok(dashboard.includes(`Spike: ${statistics.spikePercent}%`))
      assert.ok(explorer.includes(`${statistics.spikePercent.toFixed(1)}% above average`))
    } else {
      assert.match(dashboard, /Spike percentage unavailable/)
      assert.match(explorer, /zero historical mean/)
    }
    if (statistics.zScore !== undefined) {
      assert.ok(dashboard.includes(`z=${statistics.zScore}`))
      assert.ok(explorer.includes(`Z-score: ${statistics.zScore.toFixed(2)}`))
      assert.ok(targets.includes(`${statistics.zScore.toFixed(2)} standard deviations`))
    } else {
      assert.doesNotMatch(dashboard, /z=/)
      assert.match(explorer, /constant baseline/)
      assert.match(targets, /constant baseline/)
    }
  })
}

test('anomaly explorer preserves backend order and does not mutate frozen input', () => {
  const anomalies = Object.freeze([
    Object.freeze({ ...base, service: 'First', spikePercent: 50, zScore: 2 }),
    Object.freeze({ ...base, service: 'Second', spikePercent: 60, zScore: 5 }),
    Object.freeze({ ...base, service: 'Third' })
  ])
  const html = renderToStaticMarkup(React.createElement(Explorer, { anomalies, currency: 'USD' }))
  assert.ok(html.indexOf('First') < html.indexOf('Second'))
  assert.ok(html.indexOf('Second') < html.indexOf('Third'))
  assert.deepEqual(anomalies.map(a => a.service), ['First', 'Second', 'Third'])
})

for (const [name, statistics] of cases) {
  test(`report rendering handles ${name}`, async () => {
    const report = {
      period: { month: '2026-09', generatedAt: '2026-10-23T12:00:00Z' },
      metrics: { currentCost: 75, previousCost: 0, monthOverMonthChangePercent: 0, potentialSavings: 0 },
      metadata: { currency: 'USD' }, narratives: {}, findings: [], drivers: [],
      anomalies: [{ ...base, ...statistics }], savings: { totalPotential: 0, recommendationCount: 0 }
    }
    mocks['@/lib/reports'] = { ...reportMock, getReportByMonth: async () => report }
    mocks['next/image'] = () => null
    delete require.cache[require.resolve('../src/app/reports/[month]/page.tsx')]
    const Report = require('../src/app/reports/[month]/page.tsx').default
    try {
      const html = renderToStaticMarkup(await Report({ params: Promise.resolve({ month: '2026-09' }) }))
      assert.match(html, /Test service/)
      assert.doesNotMatch(html, /\(%\)|undefined|NaN/)
      if (statistics.spikePercent !== undefined) assert.ok(html.includes(`(${statistics.spikePercent}%)`))
      else assert.doesNotMatch(html, /\(.*?%\)/)
    } finally {
      mocks['@/lib/reports'] = reportMock
    }
  })
}

for (const status of [200, 400, 500]) {
  test(`summary proxy handles upstream HTTP ${status}`, async () => {
    const originalFetch = global.fetch
    const body = status === 200 ? { currentMonthCost: 75, anomalies: [{ ...base }] } : { error: 'upstream failure' }
    global.fetch = async () => Response.json(body, { status })
    try {
      const response = await GET()
      assert.equal(response.status, status)
      assert.deepEqual(await response.json(), status === 200 ? body : { error: 'Unable to load cost summary' })
    } finally {
      global.fetch = originalFetch
    }
  })
}

// Exercise the hook's state transitions without browser effects or network access.
for (const failure of [400, 500, 'network', 'json', false]) {
  test(`summary controller handles ${failure || 'success'} and pages display errors`, async () => {
    let cursor = 0
    const state = []
    const effects = []
    mocks.react = {
      ...React,
      useState: initial => {
        const index = cursor++
        if (!(index in state)) state[index] = initial
        return [state[index], value => { state[index] = value }]
      },
      useCallback: fn => fn,
      useMemo: fn => fn(),
      useRef: () => ({ current: null }),
      useEffect: fn => { effects.push(fn) }
    }
    const hookPath = require.resolve('../src/lib/hooks/useCostExplorerController.ts')
    delete require.cache[hookPath]
    const { useCostExplorerController } = require(hookPath)
    const originalFetch = global.fetch
    const summary = { currentMonthCost: 75, anomalies: [{ ...base }] }
    global.fetch = async () => {
      if (failure === 'network') throw new Error('offline')
      if (failure === 'json') return { ok: true, json: async () => { throw new Error('invalid JSON') } }
      return Response.json(failure ? { error: 'upstream failure' } : summary, { status: failure || 200 })
    }
    try {
      useCostExplorerController()
      effects[0]() // Only the summary effect; drilldown is outside this change.
      await new Promise(resolve => setImmediate(resolve))
      cursor = 0
      const result = useCostExplorerController()
      assert.equal(result.loadingSummary, false)
      assert.deepEqual(result.summary, failure ? null : summary)
      assert.equal(result.summaryError, failure ? 'Unable to load cost summary. Please try again later.' : null)
      if (failure) {
        mocks.react = { ...React, useState: initial => [initial, () => {}], useMemo: fn => fn() }
        mocks['@/lib/hooks/useCostExplorerController'] = { useCostExplorerController: () => result }
        mocks['@/lib/hooks/useAuth'] = { useAuth: () => {} }
        for (const page of ['dashboard', 'insights']) {
          cursor = 0
          const pagePath = require.resolve(`../src/app/${page}/page.tsx`)
          delete require.cache[pagePath]
          const Page = require(pagePath).default
          const html = renderToStaticMarkup(React.createElement(Page))
          assert.match(html, /role="alert"/)
          assert.match(html, /Unable to load cost summary/)
        }
      }
    } finally {
      global.fetch = originalFetch
      delete mocks.react
      delete mocks['@/lib/hooks/useCostExplorerController']
    }
  })
}
