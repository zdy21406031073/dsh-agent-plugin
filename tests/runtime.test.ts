import test from 'node:test'
import assert from 'node:assert/strict'
import { createRuntime } from '../src/runtime.js'

test('composes runtime from explicit environment configuration', async () => {
  const runtime = createRuntime({
    DSH_CODEX_AUTH_TOKEN: 'abcdefghijklmnopqrstuvwxyz123456',
    DSH_CODEX_ALLOWED_ORIGINS: 'http://localhost:3000',
    DSH_CODEX_ALLOWED_ROOTS: '/tmp',
    DSH_CODEX_MAX_SESSIONS: '2',
  })
  try { assert.deepEqual(runtime.allowedOrigins, ['http://localhost:3000']) }
  finally { await runtime.close() }
})

test('fails before composing when required roots are absent', () => {
  assert.throws(() => createRuntime({ DSH_CODEX_AUTH_TOKEN: 'abcdefghijklmnopqrstuvwxyz123456' }), /ALLOWED_ROOTS/)
})
