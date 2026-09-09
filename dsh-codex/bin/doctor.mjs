#!/usr/bin/env node
import { access } from 'node:fs/promises'
import { constants } from 'node:fs'

const required = ['DSH_CODEX_AUTH_TOKEN', 'DSH_CODEX_ALLOWED_ORIGINS', 'DSH_CODEX_ALLOWED_ROOT']
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
if (!process.exitCode) console.log('dsh-codex configuration checks passed')
