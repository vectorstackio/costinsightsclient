/* eslint-disable @typescript-eslint/no-require-imports */
const { test, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const originalKey = process.env.OPENAI_API_KEY
process.env.OPENAI_API_KEY = 'synthetic-test-key'
const originalFetch = global.fetch
after(() => {
  global.fetch = originalFetch
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = originalKey
})
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText, file)
const mocks = {
  'server-only': {},
  '@/lib/reports/auth': { requireReportAccess: async () => {} },
  '@/lib/s3/reports': {},
  '@/lib/insights': {}
}
const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (Object.hasOwn(mocks, request)) return mocks[request]
  if (request.startsWith('@/')) request = path.resolve('src', request.slice(2))
  return originalLoad.call(this, request, parent, isMain)
}

test('installed LangChain SDK omits temperature for the configured gpt-5-mini model', () => {
  global.fetch = async () => { throw new Error('Unexpected network request') }
  const { model } = require('../src/lib/ai/llm/index.ts')
  const parameters = JSON.parse(JSON.stringify(model.invocationParams({})))
  assert.equal(parameters.model, 'gpt-5-mini')
  assert.equal(Object.hasOwn(parameters, 'temperature'), false)
})

test('report narrative request omits temperature and preserves model, JSON format and response contract', async () => {
  const narrative = {
    executiveSummary: 'Summary', driversNarrative: 'Drivers', anomalyNarrative: 'Anomalies',
    recommendationsNarrative: 'Recommendations', rootCauseNarrative: 'Root cause'
  }
  let calls = 0
  global.fetch = async (url, options) => {
    calls++
    assert.equal(url, 'https://api.openai.com/v1/chat/completions')
    const body = JSON.parse(options.body)
    assert.equal(body.model, 'gpt-5-mini')
    assert.equal(Object.hasOwn(body, 'temperature'), false)
    assert.deepEqual(body.response_format, { type: 'json_object' })
    assert.equal(body.messages.length, 2)
    return Response.json({ choices: [{ message: { content: JSON.stringify(narrative) } }] })
  }
  const { generateNarrative } = require('../src/lib/reports/index.ts')
  assert.deepEqual(await generateNarrative({ currency: 'USD' }, '2026-10'), narrative)
  assert.equal(calls, 1)
})
