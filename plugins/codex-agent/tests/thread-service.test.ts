import test from 'node:test'
import assert from 'node:assert/strict'
import { CodexThreadService } from '../src/thread-service.js'

test('lists and reads threads through the protocol port', async () => {
  const calls: string[] = []
  const service = new CodexThreadService({ request: (async (method: string) => {
    calls.push(method)
    return method === 'thread/list'
      ? { data: [{ id: 'thread-1', name: 'Demo', cwd: '/tmp', model: 'model-1' }], nextCursor: null }
      : { thread: { id: 'thread-1', name: 'Demo' } }
  }) as never })
  assert.deepEqual(await service.list({ limit: 10 }), { data: [{ id: 'thread-1', name: 'Demo', cwd: '/tmp', model: 'model-1' }], nextCursor: null })
  assert.deepEqual(await service.read('thread-1'), { id: 'thread-1', name: 'Demo' })
  assert.deepEqual(calls, ['thread/list', 'thread/read'])
})

test('rejects malformed thread responses', async () => {
  const service = new CodexThreadService({ request: async () => ({ data: [{}] }) })
  await assert.rejects(service.list(), /missing id/)
})
