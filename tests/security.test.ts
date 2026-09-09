import test from 'node:test'
import assert from 'node:assert/strict'
import { TokenAuthenticator, checkOrigin, originsFromEnvironment } from '../src/auth.js'
import { authenticateRequest } from '../src/security.js'

const token = 'abcdefghijklmnopqrstuvwxyz123456'

test('requires a strong token and exact bearer syntax', () => {
  assert.throws(() => new TokenAuthenticator({ token: 'short' }))
  const auth = new TokenAuthenticator({ token })
  assert.deepEqual(auth.authenticate({ authorization: token }), { ok: false, reason: 'invalid' })
  assert.deepEqual(auth.authenticate({ authorization: `Bearer ${token}` }), { ok: true })
  assert.deepEqual(auth.authenticate({ authorization: `Bearer ${token} extra` }), { ok: false, reason: 'invalid' })
})

test('requires an explicitly allowed origin', () => {
  assert.deepEqual(checkOrigin(undefined, ['http://localhost:3000']), { ok: false, reason: 'missing' })
  assert.deepEqual(checkOrigin('http://evil.test', ['http://localhost:3000']), { ok: false, reason: 'invalid' })
  assert.deepEqual(authenticateRequest(new TokenAuthenticator({ token }), {
    origin: 'http://localhost:3000',
    authorization: `Bearer ${token}`,
  }, ['http://localhost:3000']), { ok: true })
})

test('rejects wildcard and missing origin configuration', () => {
  assert.throws(() => originsFromEnvironment({}))
  assert.throws(() => originsFromEnvironment({ DSH_CODEX_ALLOWED_ORIGINS: '*' }))
  assert.deepEqual(originsFromEnvironment({ DSH_CODEX_ALLOWED_ORIGINS: 'http://a, http://b' }), ['http://a', 'http://b'])
})
