#!/usr/bin/env node
import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const required = ['DSH_CODEX_AUTH_TOKEN', 'DSH_CODEX_ALLOWED_ORIGINS']
if (!process.env.DSH_CODEX_ALLOWED_ROOT && !process.env.DSH_CODEX_ALLOWED_ROOTS) required.push('DSH_CODEX_ALLOWED_ROOTS')
const missing = required.filter(name => !process.env[name])
if (missing.length) {
  console.error(`Missing required runtime configuration: ${missing.join(', ')}`)
  process.exitCode = 1
}
if (process.env.DSH_CODEX_AUTH_TOKEN && process.env.DSH_CODEX_AUTH_TOKEN.length < 32) {
  console.error('DSH_CODEX_AUTH_TOKEN must contain at least 32 characters')
  process.exitCode = 1
}
if (process.env.DSH_CODEX_ALLOWED_ORIGINS?.split(',').some(origin => origin.trim() === '*')) {
  console.error('Wildcard origins are not allowed')
  process.exitCode = 1
}
if (process.env.DSH_CODEX_ALLOWED_ROOT) {
  try { await access(process.env.DSH_CODEX_ALLOWED_ROOT, constants.R_OK) }
  catch { console.error('DSH_CODEX_ALLOWED_ROOT is not readable'); process.exitCode = 1 }
}
if (process.env.DSH_CODEX_ALLOWED_ROOTS) {
  for (const root of process.env.DSH_CODEX_ALLOWED_ROOTS.split(',').map(value => value.trim()).filter(Boolean)) {
    try { await access(root, constants.R_OK) }
    catch { console.error('One configured allowed root is not readable'); process.exitCode = 1 }
  }
}
for (const [name, command] of [['DSH_CODEX_DSH_BIN', process.env.DSH_CODEX_DSH_BIN ?? 'dsh'], ['DSH_CODEX_CODEX_BIN', process.env.DSH_CODEX_CODEX_BIN ?? 'codex']]) {
  try { await exec(command, ['--version'], { timeout: 5000, maxBuffer: 4096 }) }
  catch { console.error(`${name} command is unavailable`); process.exitCode = 1 }
}
if (!process.exitCode) console.log('dsh-codex configuration checks passed')
