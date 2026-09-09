import test from 'node:test'
import assert from 'node:assert/strict'
import { request } from 'node:http'
import { TokenAuthenticator } from '../src/auth.js'
import { createAuthServer } from '../src/http-auth.js'
import { LoginService } from '../src/login-service.js'

const token = 'abcdefghijklmnopqrstuvwxyz123456'

function call(port: number, path: string, method: string, body?: object, cookie?: string) {
  return new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }>((resolve, reject) => {
    const req = request({ port, path, method, headers: { origin: 'http://localhost:3000', ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) } }, response => {
      const chunks: Buffer[] = []
      response.on('data', chunk => chunks.push(Buffer.from(chunk)))
      response.on('end', () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks).toString() }))
    })
    req.on('error', reject)
    if (body) req.end(JSON.stringify(body)); else req.end()
  })
}

test('protects login, session and logout with origin and cookie policy', async () => {
  const server = createAuthServer({ login: new LoginService(new TokenAuthenticator({ token }), undefined, false), allowedOrigins: ['http://localhost:3000'] })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  try {
    const login = await call(port, '/auth/login', 'POST', { token })
    assert.equal(login.status, 200)
    const cookie = String(login.headers['set-cookie']).split(';')[0]
    assert.equal((await call(port, '/auth/session', 'GET', undefined, cookie)).status, 200)
    assert.equal((await call(port, '/auth/logout', 'POST', undefined, cookie)).status, 204)
    assert.equal((await call(port, '/auth/session', 'GET', undefined, cookie)).status, 401)
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})
