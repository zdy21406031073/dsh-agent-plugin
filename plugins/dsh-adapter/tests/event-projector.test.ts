import test from 'node:test'
import assert from 'node:assert/strict'
import { projectEvent, projectEvents } from '../src/event-projector.js'

test('deduplicates replayed events by event id', () => {
  const event = { eventId: 'same', sequence: 1, type: 'agent_message_delta', payload: { delta: 'x' } }
  const state = projectEvents([event, event])
  assert.equal(state.events.length, 1)
  assert.equal(projectEvent(state, event), state)
})
