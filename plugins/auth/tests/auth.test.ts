import test from 'node:test'
import assert from 'node:assert/strict'
import { TokenAuthenticator } from '../src/auth.js'

test('accepts bearer token and rejects missing or invalid tokens', () => {
  const token = 'abcdefghijklmnopqrstuvwxyz123456'
  const auth = new TokenAuthenticator({ token })
  assert.deepEqual(auth.authenticate({ authorization: `Bearer ${token}` }), { ok: true })
  assert.deepEqual(auth.authenticate({ authorization: 'secret-toke' }), { ok: false, reason: 'invalid' })
  assert.deepEqual(auth.authenticate({}), { ok: false, reason: 'missing' })
})

test('does not accept a token with a different byte length', () => {
  const auth = new TokenAuthenticator({ token: 'abcdefghijklmnopqrstuvwxyz123456' })
  assert.deepEqual(auth.authenticate({ authorization: 'Bearer abcd' }), { ok: false, reason: 'invalid' })
})
