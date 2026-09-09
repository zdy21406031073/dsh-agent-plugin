import test from 'node:test'
import assert from 'node:assert/strict'
import { TokenAuthenticator } from '../src/auth.js'
import { LoginService } from '../src/login-service.js'

test('login issues a cookie and logout revokes it', () => {
  const token = 'abcdefghijklmnopqrstuvwxyz123456'
  const service = new LoginService(new TokenAuthenticator({ token }), undefined, false)
  const login = service.login(token, 0)
  assert.equal(login.status, 200)
  const cookie = login.setCookie as string
  assert.equal(service.authenticateCookie(cookie, 1), true)
  const logout = service.logout(cookie)
  assert.equal(logout.status, 204)
  assert.equal(service.authenticateCookie(cookie, 2), false)
})

test('invalid credentials do not issue a cookie', () => {
  const service = new LoginService(new TokenAuthenticator({ token: 'abcdefghijklmnopqrstuvwxyz123456' }))
  assert.deepEqual(service.login('wrong'), { status: 401, body: { ok: false } })
})
