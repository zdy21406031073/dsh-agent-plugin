#!/usr/bin/env node
import { cp, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..', '..')
const destination = resolve(process.env.DSH_CODEX_DEPLOY_DIR ?? resolve(root, '..', 'dsh-codex-release'))
await mkdir(resolve(destination, 'plugins'), { recursive: true })
await mkdir(resolve(destination, 'config'), { recursive: true })
for (const name of ['auth', 'codex-agent', 'dsh-adapter', 'provider-adapter']) {
  await cp(resolve(root, 'plugins', name), resolve(destination, 'plugins', name), { recursive: true, filter: source => !source.includes('/tests/') && !source.includes('/node_modules/') })
}
await cp(resolve(root, 'dsh-codex', 'bin'), resolve(destination, 'bin'), { recursive: true })
await cp(resolve(root, 'dsh-codex', 'config', 'profile.example.yml'), resolve(destination, 'config', 'profile.example.yml'))
console.log(`Built dsh-codex deployment at ${destination}`)
