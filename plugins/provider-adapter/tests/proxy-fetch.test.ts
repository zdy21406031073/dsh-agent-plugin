import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchThroughProxy } from '../src/proxy-fetch.js'

test('rejects non-http URLs before network access', async () => {
  await assert.rejects(fetchThroughProxy('file:///etc/passwd', { proxyUrl: 'http://proxy.invalid' }), /HTTP\(S\)/)
})

test('rejects invalid timeout configuration', async () => {
  await assert.rejects(fetchThroughProxy('https://example.com', { proxyUrl: 'http://proxy.invalid', timeoutMs: 0 }), /positive/)
})
