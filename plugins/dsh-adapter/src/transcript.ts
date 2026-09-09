import type { AgentEvent } from '../../codex-agent/src/events.js'

export type DshTranscriptEvent =
  | { readonly type: 'assistant/text-delta'; readonly sequence: number; readonly text: string }
  | { readonly type: 'assistant/reasoning'; readonly sequence: number; readonly text: string }
  | { readonly type: 'tool/update'; readonly sequence: number; readonly tool: Record<string, unknown> }
  | { readonly type: 'interaction/request'; readonly sequence: number; readonly request: Record<string, unknown> }
  | { readonly type: 'turn/state'; readonly sequence: number; readonly state: 'started' | 'completed' | 'failed' | 'interrupted' }
  | { readonly type: 'codex/unknown'; readonly sequence: number; readonly method: string; readonly data: Record<string, unknown> }

/** Projects protocol-independent agent events into DSH chat display events. */
export function toDshTranscriptEvent(event: AgentEvent): DshTranscriptEvent {
  const payload = event.payload
  if (event.type.includes('agent_message_delta') || event.type.includes('text_delta') || event.type.includes('output_text_delta')) {
    return { type: 'assistant/text-delta', sequence: event.sequence, text: text(payload) }
  }
  if (event.type.includes('reasoning')) return { type: 'assistant/reasoning', sequence: event.sequence, text: text(payload) }
  if (event.type.includes('approval') || event.type.includes('user_input') || event.type.includes('elicitation')) {
    return { type: 'interaction/request', sequence: event.sequence, request: payload }
  }
  if (event.type.includes('tool') || event.type.includes('command') || event.type.includes('file_change')) {
    return { type: 'tool/update', sequence: event.sequence, tool: payload }
  }
  if (event.type.includes('turn_started') || event.type.includes('turn_start')) return { type: 'turn/state', sequence: event.sequence, state: 'started' }
  if (event.type.includes('turn_completed') || event.type.includes('turn_end')) return { type: 'turn/state', sequence: event.sequence, state: 'completed' }
  if (event.type.includes('interrupt')) return { type: 'turn/state', sequence: event.sequence, state: 'interrupted' }
  if (event.type.includes('error') || event.type.includes('failed')) return { type: 'turn/state', sequence: event.sequence, state: 'failed' }
  return { type: 'codex/unknown', sequence: event.sequence, method: event.type, data: payload }
}

function text(payload: Record<string, unknown>): string {
  for (const key of ['text', 'delta', 'content']) if (typeof payload[key] === 'string') return payload[key]
  return ''
}
