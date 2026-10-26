#!/usr/bin/env node
// All candidate/configuration work is unprivileged. No root operations here.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

export const LIVE = '/home/ubuntu/node/develop/costinsightsclient'
export const ORIGIN = 'https://aws.develop.thebrilliantclub.org'
export const NODE = '/home/ubuntu/.nvm/versions/node/v22.23.4/bin/node'
export const PM2 = '/home/ubuntu/.nvm/versions/node/v22.23.4/lib/node_modules/pm2/bin/pm2'
export const PRODUCTION_HOST = 'ip-172-31-18-248'
export const ENV_FILES = ['.env', '.env.local', '.env.production', '.env.production.local']

export function assertUnprivileged(uid = process.getuid?.()) {
  if (uid === undefined || uid === 0) throw new Error('Run as the unprivileged application account')
}
export function assertIsolatedBuilder(host = os.hostname()) {
  if (host.split('.')[0] === PRODUCTION_HOST) throw new Error('Preparation/build is forbidden on the production host')
}
export function publicOrigin(source) {
  const lines = source.split('\n')
  const matches = lines.map((line, i) => /^\s*(?:export\s+)?NEXT_PUBLIC_BASE_URL\s*=/.test(line) ? i : -1).filter(i => i >= 0)
  if (matches.length > 1) throw new Error('Duplicate public origin setting; manual review required')
  if (matches.length) lines[matches[0]] = `NEXT_PUBLIC_BASE_URL=${ORIGIN}`
  else return source.trimEnd() + `\nNEXT_PUBLIC_BASE_URL=${ORIGIN}\n`
  return lines.join('\n')
}
function reportBinding(source) {
  // Loaded only during unprivileged prepare/accept after dependencies exist.
  // Parse, never evaluate, production configuration; comments are not bindings.
  const ts = createRequire(import.meta.url)('typescript')
  const ast = ts.createSourceFile('config.ts', source, ts.ScriptTarget.Latest, true)
  if (ast.parseDiagnostics.length) throw new Error('Invalid configuration syntax')
  const bindings = ast.statements.filter(ts.isVariableStatement).flatMap(statement => statement.declarationList.declarations.map(declaration => ({ statement, declaration })))
    .filter(({ declaration }) => declaration.name.getText(ast) === 'REPORT_JOB_TOKEN')
  if (!bindings.length) {
    let reference = false
    const visit = node => { if (ts.isIdentifier(node) && node.text === 'REPORT_JOB_TOKEN') reference = true; ts.forEachChild(node, visit) }
    visit(ast)
    if (reference) throw new Error('Nonstandard report binding')
    return null
  }
  if (bindings.length !== 1) throw new Error('Duplicate report binding')
  const { statement, declaration } = bindings[0]
  if (!statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) || !declaration.initializer || !ts.isStringLiteral(declaration.initializer)) throw new Error('Nonstandard report binding')
  return { value: declaration.initializer.text, start: declaration.initializer.getStart(ast), end: declaration.initializer.end }
}
export function configuredToken(source) {
  const value = reportBinding(source)?.value ?? ''
  if (value && (value.length < 32 || value.length > 256 || /[^A-Za-z0-9_-]/.test(value))) throw new Error('Invalid existing credential')
  return value
}
export function selectToken(source, allowNew, generate) {
  const existing = configuredToken(source)
  if (existing) return existing
  if (!allowNew) throw new Error('Separate credential-generation approval is required')
  const token = generate()
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('Invalid new credential')
  return token
}
export function reportConfiguration(source, token) {
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token)) throw new Error('Invalid report credential')
  const existing = configuredToken(source)
  if (existing && existing !== token) throw new Error('Existing ReportJob credential must be preserved')
  const binding = reportBinding(source)
  if (!binding) return source.trimEnd() + `\n\nexport const REPORT_JOB_TOKEN: string = '${token}'\n`
  return source.slice(0, binding.start) + `'${token}'` + source.slice(binding.end)
}
export function applicationDefinition(entry, cwd, candidate, runningNode, previousOrigin) {
  const old = entry.pm2_env
  if (old?.name !== 'costinsightsclient' || old.exec_mode !== 'fork_mode' || !previousOrigin) throw new Error('Unexpected PM2 definition')
  const preserved = {}
  for (const key of ['autorestart', 'watch', 'kill_timeout', 'max_memory_restart', 'node_args', 'restart_delay', 'exp_backoff_restart_delay', 'min_uptime', 'max_restarts', 'wait_ready', 'listen_timeout', 'merge_logs', 'log_date_format']) {
    if (old[key] !== undefined) preserved[key] = old[key]
  }
  return {
    ...preserved, name: 'costinsightsclient', cwd,
    script: candidate ? path.join(path.dirname(runningNode), 'npm') : old.pm_exec_path,
    interpreter: runningNode, args: old.args, exec_mode: 'fork', instances: 1,
    ...(old.pm_out_log_path ? { out_file: old.pm_out_log_path } : {}),
    ...(old.pm_err_log_path ? { error_file: old.pm_err_log_path } : {}),
    env: { ...old.env, NODE_ENV: candidate ? 'production' : old.env?.NODE_ENV || 'production', NEXT_PUBLIC_BASE_URL: candidate ? ORIGIN : previousOrigin }
  }
}
export function assertPrivate(filename, uid = process.getuid()) {
  const stat = fs.lstatSync(filename)
  if (stat.isSymbolicLink() || stat.uid !== uid || (stat.mode & 0o077) !== 0) throw new Error('Expected private application-owned path')
  return stat
}
export function privateWrite(filename, data) {
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 })
  assertPrivate(path.dirname(filename))
  fs.writeFileSync(filename, data, { flag: 'wx', mode: 0o600 })
}
export function copyPrivateTree(source, target) {
  const stat = fs.lstatSync(source)
  if (stat.isSymbolicLink()) throw new Error('Configuration symlinks require manual review')
  if (stat.isDirectory()) {
    if (fs.existsSync(target)) throw new Error('Target already exists')
    fs.mkdirSync(target, { recursive: true, mode: 0o700 })
    assertPrivate(target)
    for (const entry of fs.readdirSync(source)) copyPrivateTree(path.join(source, entry), path.join(target, entry))
  } else if (stat.isFile()) privateWrite(target, fs.readFileSync(source))
  else throw new Error('Unexpected configuration type')
}
export function atomicPrivateJson(filename, value) {
  const temp = filename + '.pending-' + crypto.randomUUID()
  privateWrite(temp, JSON.stringify(value))
  const fd = fs.openSync(temp, 'r')
  try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  fs.renameSync(temp, filename)
  const directory = fs.openSync(path.dirname(filename), 'r')
  try { fs.fsyncSync(directory) } finally { fs.closeSync(directory) }
}
export function verifyLiveSnapshot(captured, live = LIVE) {
  function compareTrees(left, right) {
    const a = fs.lstatSync(left)
    const b = fs.lstatSync(right)
    if (a.isSymbolicLink() || b.isSymbolicLink() || a.isDirectory() !== b.isDirectory()) throw new Error('Live configuration drift')
    if (a.isDirectory()) {
      const names = fs.readdirSync(left).sort()
      if (JSON.stringify(names) !== JSON.stringify(fs.readdirSync(right).sort())) throw new Error('Live configuration drift')
      for (const name of names) compareTrees(path.join(left, name), path.join(right, name))
    } else if (!a.isFile() || !b.isFile() || !fs.readFileSync(left).equals(fs.readFileSync(right))) throw new Error('Live configuration drift')
  }
  compareTrees(path.join(captured, 'config'), path.join(live, 'src/lib/config'))
  for (const name of ENV_FILES) {
    const source = path.join(captured, name)
    const current = path.join(live, name)
    if (fs.existsSync(source) !== fs.existsSync(current)) throw new Error('Live environment drift')
    if (fs.existsSync(source)) compareTrees(source, current)
  }
}
export function verifyAssets(candidate, token) {
  let files = 0
  function scan(directory) {
    const stat = fs.lstatSync(directory)
    if (stat.isSymbolicLink()) throw new Error('Public asset symlink')
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name)
      if (entry.isSymbolicLink()) throw new Error('Public asset symlink')
      if (entry.isDirectory()) scan(filename)
      else {
        files++
        const data = fs.readFileSync(filename)
        if ([token, JSON.stringify(token), Buffer.from(token).toString('base64')].some(value => data.includes(Buffer.from(value)))) throw new Error('Credential in public assets')
      }
    }
  }
  scan(path.join(candidate, '.next/static')); scan(path.join(candidate, 'public'))
  return files
}
function oldOrigin(entry, captured) {
  if (entry.pm2_env.env?.NEXT_PUBLIC_BASE_URL) return entry.pm2_env.env.NEXT_PUBLIC_BASE_URL
  for (const name of ['.env.production.local', '.env.local', '.env.production', '.env']) {
    if (!fs.existsSync(path.join(captured, name))) continue
    const value = /^\s*(?:export\s+)?NEXT_PUBLIC_BASE_URL\s*=\s*([^\r\n]*)/m.exec(fs.readFileSync(path.join(captured, name), 'utf8'))?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2')
    if (value && /^https?:\/\/[^\s$]+$/.test(value)) return value
  }
  throw new Error('Cannot determine exact previous origin')
}
function pm2List() {
  const pid = Number(fs.readFileSync('/home/ubuntu/.pm2/pm2.pid', 'utf8').trim())
  process.kill(pid, 0)
  if (!fs.existsSync('/home/ubuntu/.pm2/rpc.sock')) throw new Error('PM2 daemon unavailable')
  return JSON.parse(execFileSync(NODE, [PM2, 'jlist'], { env: { ...process.env, PM2_HOME: '/home/ubuntu/.pm2' }, stdio: ['ignore', 'pipe', 'pipe'] }))
}
export function capture(state) {
  if (fs.existsSync(state)) throw new Error('Use a fresh deployment ID')
  fs.mkdirSync(state, { recursive: true, mode: 0o700 }); assertPrivate(state)
  const captured = path.join(state, 'captured')
  fs.mkdirSync(captured, { mode: 0o700 })
  const entries = pm2List().filter(entry => entry.name === 'costinsightsclient')
  if (entries.length !== 1 || !entries[0].pid || entries[0].pm2_env.pm_cwd !== LIVE) throw new Error('Unexpected current deployment')
  const runningNode = fs.readlinkSync(`/proc/${entries[0].pid}/exe`)
  if (runningNode !== NODE) throw new Error('Runtime changed; review required')
  copyPrivateTree(path.join(LIVE, 'src/lib/config'), path.join(captured, 'config'))
  for (const name of ENV_FILES) {
    const source = path.join(LIVE, name)
    if (fs.existsSync(source)) {
      if (fs.lstatSync(source).isSymbolicLink()) throw new Error('Environment symlink')
      privateWrite(path.join(captured, name), fs.readFileSync(source))
    }
  }
  privateWrite(path.join(captured, 'pm2.json'), JSON.stringify(entries[0]))
  if (fs.existsSync('/home/ubuntu/.pm2/dump.pm2')) privateWrite(path.join(captured, 'dump.pm2.original'), fs.readFileSync('/home/ubuntu/.pm2/dump.pm2'))
  privateWrite(path.join(captured, 'runtime.json'), JSON.stringify({ node: runningNode, previousOrigin: oldOrigin(entries[0], captured) }))
}
export function prepareCandidate(captured, candidate, allowNew, generate = () => crypto.randomBytes(32).toString('base64url')) {
  assertPrivate(captured); assertPrivate(candidate)
  const original = fs.readFileSync(path.join(captured, 'config/index.ts'), 'utf8')
  const token = selectToken(original, allowNew, generate)
  const configDir = path.join(candidate, 'src/lib/config')
  copyPrivateTree(path.join(captured, 'config'), configDir)
  const configFile = path.join(configDir, 'index.ts')
  const fd = fs.openSync(configFile, fs.constants.O_WRONLY | fs.constants.O_TRUNC | fs.constants.O_NOFOLLOW)
  try { fs.writeFileSync(fd, reportConfiguration(original, token)) } finally { fs.closeSync(fd) }
  for (const name of ENV_FILES) {
    if (fs.existsSync(path.join(candidate, name))) throw new Error('Source includes environment files')
    if (fs.existsSync(path.join(captured, name))) privateWrite(path.join(candidate, name), publicOrigin(fs.readFileSync(path.join(captured, name), 'utf8')))
  }
  if (!fs.existsSync(path.join(candidate, '.env.production.local'))) privateWrite(path.join(candidate, '.env.production.local'), `NEXT_PUBLIC_BASE_URL=${ORIGIN}\n`)
  privateWrite(path.join(candidate, '.deployment/report-job.curl.conf'), `header = "Authorization: ReportJob ${token}"\n`)
}
export function acceptCandidate(captured, candidate, state) {
  assertPrivate(captured); assertPrivate(candidate); assertPrivate(state)
  verifyLiveSnapshot(captured)
  if (!fs.existsSync(path.join(candidate, '.next/BUILD_ID'))) throw new Error('Missing production build')
  assertPrivate(path.join(candidate, 'src/lib/config/index.ts'))
  assertPrivate(path.join(candidate, '.deployment/report-job.curl.conf'))
  const original = fs.readFileSync(path.join(captured, 'config/index.ts'), 'utf8')
  const configured = fs.readFileSync(path.join(candidate, 'src/lib/config/index.ts'), 'utf8')
  const token = configuredToken(configured)
  if (!token || configured !== reportConfiguration(original, token)) throw new Error('Ignored configuration changed unexpectedly')
  for (const name of ENV_FILES) {
    const expected = fs.existsSync(path.join(captured, name)) ? publicOrigin(fs.readFileSync(path.join(captured, name), 'utf8')) : name === '.env.production.local' ? `NEXT_PUBLIC_BASE_URL=${ORIGIN}\n` : null
    if (expected !== null) assertPrivate(path.join(candidate, name))
    if (expected === null ? fs.existsSync(path.join(candidate, name)) : fs.readFileSync(path.join(candidate, name), 'utf8') !== expected) throw new Error('Environment settings changed unexpectedly')
  }
  const curl = `header = "Authorization: ReportJob ${token}"\n`
  if (fs.readFileSync(path.join(candidate, '.deployment/report-job.curl.conf'), 'utf8') !== curl) throw new Error('Mismatched report credentials')
  verifyAssets(candidate, token)
  const entry = JSON.parse(fs.readFileSync(path.join(captured, 'pm2.json'), 'utf8'))
  const runtime = JSON.parse(fs.readFileSync(path.join(captured, 'runtime.json'), 'utf8'))
  privateWrite(path.join(state, 'report-job.curl.conf'), curl)
  for (const [name, cwd, selected] of [['candidate', candidate, true], ['rollback', LIVE, false]]) {
    privateWrite(path.join(state, `${name}.pm2.json`), JSON.stringify({ apps: [applicationDefinition(entry, cwd, selected, runtime.node, runtime.previousOrigin)] }))
  }
  privateWrite(path.join(state, 'accepted.json'), JSON.stringify({ candidate, previous: LIVE, build: fs.readFileSync(path.join(candidate, '.next/BUILD_ID'), 'utf8').trim() }))
}
export function main(args) {
  if (!args.includes('--execute')) { process.stdout.write('No actions taken; separate approval and --execute required.\n'); return }
  assertUnprivileged()
  const options = Object.fromEntries(args.filter(value => value.includes('=')).map(value => { const i = value.indexOf('='); return [value.slice(2, i), value.slice(i + 1)] }))
  if (args.includes('--capture')) {
    if (!/^\/home\/ubuntu\/costinsights-deploy-state\/[A-Za-z0-9_-]+$/.test(options.state ?? '')) throw new Error('Invalid state path')
    capture(options.state)
  } else if (args.includes('--prepare')) {
    assertIsolatedBuilder()
    prepareCandidate(options.captured, options.candidate, args.includes('--allow-new-report-token'))
  } else if (args.includes('--accept')) {
    if (!/^\/home\/ubuntu\/costinsights-deploy-state\/[A-Za-z0-9_-]+$/.test(options.state ?? '') || !/^\/home\/ubuntu\/costinsights-releases\/[A-Za-z0-9_-]+$/.test(options.candidate ?? '') || path.basename(options.state) !== path.basename(options.candidate)) throw new Error('Invalid production paths or mismatched deployment IDs')
    acceptCandidate(path.join(options.state, 'captured'), options.candidate, options.state)
  } else throw new Error('Choose capture, isolated prepare, or accept')
  process.stdout.write('Unprivileged preparation step completed; secrets suppressed. No live application or scheduler changed.\n')
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try { main(process.argv.slice(2)) } catch {
    process.stderr.write('Preparation failed; details suppressed. Keep snapshots and use a fresh candidate after review.\n'); process.exitCode = 1
  }
}
