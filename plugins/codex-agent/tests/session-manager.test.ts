import test from 'node:test'
import assert from 'node:assert/strict'
import { CwdPolicy } from '../src/cwd-policy.js'
import { CodexSessionManager } from '../src/session-manager.js'
import type { SessionMetadata, SessionRepository } from '../src/session-repository.js'

function repository() {
  const values = new Map<string, SessionMetadata>()
  const repo: SessionRepository = {
    list: async () => [...values.values()],
    save: async metadata => { values.set(metadata.id, metadata) },
    remove: async id => { values.delete(id) },
  }
  return { repo, values }
}

test('persists metadata and removes the owned session on shutdown', async () => {
  const state = repository()
  let closed = false
  const manager = new CodexSessionManager(new CwdPolicy(['/tmp']), {
    repository: state.repo,
    createSession: options => ({
      cwd: options.cwd, model: options.model, status: 'idle', threadId: undefined,
      load: async () => undefined,
      start: async () => undefined, resume: async () => undefined, steer: async () => undefined,
      compact: async () => null, stop: async () => undefined, close: async () => { closed = true },
    }),
  })
  const record = await manager.create({ cwd: '/tmp' })
  assert.equal(state.values.size, 1)
  await manager.remove(record.id)
  assert.equal(closed, true)
  assert.equal(state.values.size, 0)
})

test('does not retain a process when initial metadata persistence fails', async () => {
  let constructed = false
  const manager = new CodexSessionManager(new CwdPolicy(['/tmp']), {
    repository: { list: async () => [], save: async () => { throw new Error('disk failure') }, remove: async () => undefined },
    createSession: () => { constructed = true; throw new Error('must not construct') },
  })
  await assert.rejects(manager.create({ cwd: '/tmp' }), /disk failure/)
  assert.equal(constructed, false)
})
