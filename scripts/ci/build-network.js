/* eslint-disable @typescript-eslint/no-require-imports */
// Build-time guard: allow font downloads, reject application/service HTTP calls.
// No request headers, URLs, or credential values are included in failures.
const http = require('node:http')
const https = require('node:https')
const { syncBuiltinESMExports } = require('node:module')
function check(input, options) {
  let url
  if (typeof input === 'string' || input instanceof URL) url = new URL(input)
  else {
    const settings = input || options || {}
    url = new URL(`${settings.protocol || 'https:'}//${settings.hostname || settings.host || 'localhost'}`)
  }
  if (url.protocol !== 'https:' || !['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) {
    throw new Error('CI build blocked a non-font HTTP request')
  }
}
for (const client of [http, https]) {
  const request = client.request
  client.request = function (...args) { check(args[0], args[1]); return request.apply(this, args) }
  client.get = function (...args) { const req = client.request(...args); req.end(); return req }
}
const fetch = globalThis.fetch
globalThis.fetch = function (input, options) { check(input instanceof Request ? input.url : input); return fetch(input, options) }
syncBuiltinESMExports()
