import test from 'node:test'
import assert from 'node:assert/strict'
import { clearSessionCookie, readCookie, sessionCookie, SessionStore } from '../src/session-store.js'

test('stores only hashed session ids and expires idle sessions', () => {
  const store = new SessionStore(10, 100)
  const id = store.create(0)
  assert.equal(store.size, 1)
  assert.equal(store.validate(id, 9), true)
  assert.equal(store.validate(id, 18), true)
  assert.equal(store.validate(id, 29), false)
  assert.equal(store.size, 0)
})

test('creates strict httpOnly cookies and parses them', () => {
  const cookie = sessionCookie('opaque', true)
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /Secure/)
  assert.match(cookie, /SameSite=Strict/)
  assert.equal(readCookie(cookie), 'opaque')
  assert.match(clearSessionCookie(), /Max-Age=0/)
})
