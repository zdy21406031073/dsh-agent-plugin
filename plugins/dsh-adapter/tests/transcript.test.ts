import test from 'node:test'
import assert from 'node:assert/strict'
import { toDshTranscriptEvent } from '../src/transcript.js'

test('projects known Codex events and preserves unknown events for diagnostics', () => {
  assert.deepEqual(toDshTranscriptEvent({ eventId: 'a', sequence: 1, type: 'thread_agent_message_delta', payload: { delta: 'hi' } }), { type: 'assistant/text-delta', sequence: 1, text: 'hi' })
  assert.equal(toDshTranscriptEvent({ eventId: 'b', sequence: 2, type: 'new_future_event', payload: { value: 1 } }).type, 'codex/unknown')
})
