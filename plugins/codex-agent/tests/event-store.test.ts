import test from 'node:test'
import assert from 'node:assert/strict'
import { MemoryEventStore } from '../src/event-store.js'

test('replays events after a cursor and bounds memory', async () => {
  const store = new MemoryEventStore(2)
  for (const sequence of [1, 2, 3]) await store.append({ eventId: String(sequence), sequence, type: 'event', payload: {} })
  assert.deepEqual((await store.after(1)).map(event => event.sequence), [2, 3])
})
