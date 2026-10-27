/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const { execFileSync } = require('node:child_process')
const path = require('node:path')

test('manual deployment safety fixtures (no production services)', () => {
  execFileSync('python3', ['-I', '-B', path.resolve('scripts/deployment/manual-deploy.test.py')], { stdio: 'pipe' })
})
