#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { assertUnprivileged, assertPrivate, atomicPrivateJson, verifyLiveSnapshot, NODE, PM2 } from './prepare-release.mjs'

export async function switchAndPersist(adapter, definition, journal) {
  const app = definition.apps?.[0]
  if (definition.apps.length !== 1 || app.name !== 'costinsightsclient') throw new Error('Unexpected application')
  await journal({ phase: 'switching', cwd: app.cwd })
  await adapter.select(definition)
  const live = await adapter.live()
  if (live.pm2_env.pm_cwd !== app.cwd || live.pm2_env.status !== 'online' || live.pm2_env.NEXT_PUBLIC_BASE_URL !== app.env.NEXT_PUBLIC_BASE_URL) throw new Error('Live PM2 definition does not match')
  await adapter.save()
  const saved = await adapter.saved()
  if (saved.pm_cwd !== app.cwd || saved.NEXT_PUBLIC_BASE_URL !== app.env.NEXT_PUBLIC_BASE_URL) throw new Error('Saved PM2 definition does not match')
  await journal({ phase: 'persisted', cwd: app.cwd })
}
async function main(args) {
  if (!args.includes('--execute')) { process.stdout.write('No PM2 actions taken. Approval and --execute required.\n'); return }
  assertUnprivileged()
  const state = args.find(value => value.startsWith('--state='))?.slice(8)
  if (!/^\/home\/ubuntu\/costinsights-deploy-state\/[A-Za-z0-9_-]+$/.test(state ?? '')) throw new Error('Invalid state path')
  assertPrivate(state)
  const rollback = args.includes('--rollback')
  if (!rollback) verifyLiveSnapshot(path.join(state, 'captured'))
  const filename = path.join(state, rollback ? 'rollback.pm2.json' : 'candidate.pm2.json')
  assertPrivate(filename)
  const definition = JSON.parse(fs.readFileSync(filename, 'utf8'))
  const call = (...values) => execFileSync(NODE, [PM2, ...values], { env: { ...process.env, PM2_HOME: '/home/ubuntu/.pm2' }, stdio: ['ignore', 'pipe', 'pipe'] })
  const selectOne = entries => { const selected = entries.filter(entry => (entry.name ?? entry.pm2_env?.name) === 'costinsightsclient'); if (selected.length !== 1) throw new Error('Unexpected PM2 state'); return selected[0] }
  await switchAndPersist({
    select: async () => { call('startOrReload', filename, '--only', 'costinsightsclient', '--update-env') },
    live: async () => selectOne(JSON.parse(call('jlist'))),
    save: async () => {
      call('save')
      // Do not open the scheduler gate based solely on a dirty page-cache write.
      for (const filename of ['/home/ubuntu/.pm2/dump.pm2', '/home/ubuntu/.pm2']) {
        const fd = fs.openSync(filename, 'r')
        try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
      }
    },
    saved: async () => selectOne(JSON.parse(fs.readFileSync('/home/ubuntu/.pm2/dump.pm2', 'utf8')))
  }, definition, value => atomicPrivateJson(path.join(state, rollback ? 'rollback-progress.json' : 'switch-progress.json'), value))
  process.stdout.write('Selected application is online and matching PM2 state is persisted. Scheduler remains controlled by the root phase gate.\n')
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main(process.argv.slice(2)).catch(() => { process.stderr.write('Switch/persistence failed; scheduler must remain paused. Inspect live and saved state before resuming.\n'); process.exitCode = 1 })
}
