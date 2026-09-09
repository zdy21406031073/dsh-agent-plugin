#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..', '..')
const required = ['DSH_CODEX_AUTH_TOKEN', 'DSH_CODEX_ALLOWED_ORIGINS', 'DSH_CODEX_ALLOWED_ROOTS']
const missing = required.filter(name => !process.env[name])
if (missing.length) {
  console.error(`Missing required runtime configuration: ${missing.join(', ')}`)
  process.exit(1)
}
const dsh = process.env.DSH_CODEX_DSH_BIN ?? 'dsh'
const profile = process.env.DSH_CODEX_PROFILE ?? resolve(root, 'config', 'profile.yml')
if (!existsSync(profile)) {
  console.error('DSH Codex profile is missing')
  process.exit(1)
}
const child = spawn(dsh, ['--profile', profile], {
  cwd: process.env.DSH_CODEX_WORKDIR ?? process.cwd(),
  stdio: 'inherit',
  env: { ...process.env, DSH_CODEX_PLUGIN_ROOT: root },
})
const stop = signal => child.kill(signal)
process.once('SIGINT', () => stop('SIGINT'))
process.once('SIGTERM', () => stop('SIGTERM'))
child.once('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
