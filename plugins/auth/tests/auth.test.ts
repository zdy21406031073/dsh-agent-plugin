import test from 'node:test'
import assert from 'node:assert/strict'
import { TokenAuthenticator } from '../src/auth.js'

test('accepts bearer token and rejects missing or invalid tokens', () => {
  const auth = new TokenAuthenticator({ token: 'secret-token' })
  assert.deepEqual(auth.authenticate({ authorization: 'Bearer secret-token' }), { ok: true })
  assert.deepEqual(auth.authenticate({ authorization: 'secret-toke' }), { ok: false, reason: 'invalid' })
  assert.deepEqual(auth.authenticate({}), { ok: false, reason: 'missing' })
})

test('does not accept a token with a different byte length', () => {
  const auth = new TokenAuthenticator({ token: 'abc' })
  assert.deepEqual(auth.authenticate({ authorization: 'Bearer abcd' }), { ok: false, reason: 'invalid' })
})
