import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eventLogPath, JsonlEventStore } from '../src/jsonl-event-store.js'

test('persists ordered events and replays from a cursor', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-codex-'))
  const store = new JsonlEventStore(eventLogPath(root, 'session-a'))
  await Promise.all([1, 2, 3].map(sequence => store.append({ eventId: String(sequence), sequence, type: 'text_delta', payload: {} })))
  assert.deepEqual((await store.after(1)).map(event => event.sequence), [2, 3])
  assert.equal((await readFile(eventLogPath(root, 'session-a'), 'utf8')).trim().split('\n').length, 3)
})

