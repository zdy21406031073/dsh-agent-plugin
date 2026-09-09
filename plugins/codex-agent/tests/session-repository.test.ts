import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JsonSessionRepository } from '../src/session-repository.js'

test('saves, replaces, lists, and removes metadata atomically', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-codex-'))
  const repository = new JsonSessionRepository(join(root, 'data', 'sessions.json'))
  const metadata = { id: 's1', cwd: '/tmp', status: 'idle', createdAt: 1, updatedAt: 1 }
  await repository.save(metadata)
  await repository.save({ ...metadata, status: 'completed', updatedAt: 2 })
  assert.deepEqual(await repository.list(), [{ ...metadata, status: 'completed', updatedAt: 2 }])
  await repository.remove('s1')
  assert.deepEqual(await repository.list(), [])
})
