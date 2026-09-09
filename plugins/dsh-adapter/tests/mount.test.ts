import test from 'node:test'
import assert from 'node:assert/strict'
import { mountDshCodex } from '../src/mount.js'

test('registers disjoint auth and agent routes and disposes them', () => {
  const routes: string[] = []
  const webServer = {
    register(route: { path: string }) {
      routes.push(route.path)
      return () => { routes.splice(routes.indexOf(route.path), 1) }
    },
    registerUpgrade(route: { path: string }) {
      routes.push(route.path)
      return () => { routes.splice(routes.indexOf(route.path), 1) }
    },
  }
  const login = { authenticateCookie: () => true } as never
  const sessions = {} as never
  const dispose = mountDshCodex({ webServer, login, sessions, allowedOrigins: ['http://localhost:3000'] })
  assert.deepEqual(routes, ['/auth/login', '/auth/logout', '/auth/session', '/api', '/api/stream'])
  dispose()
  assert.deepEqual(routes, [])
})
