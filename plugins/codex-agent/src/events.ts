import type { RpcNotification } from './protocol.js'

export type AgentEvent = { eventId: string; sequence: number; type: string; payload: Record<string, unknown> }

/** Converts version-specific app-server notifications into DSH display events. */
export function normalizeNotification(notification: RpcNotification, sequence: number): AgentEvent {
  const params = (notification.params && typeof notification.params === 'object' && !Array.isArray(notification.params)) ? notification.params as Record<string, unknown> : {}
  const type = notification.method.replace(/^codex\//, '').replace(/[./]/g, '_')
  const eventId = typeof params.event_id === 'string' ? params.event_id : `${sequence}:${notification.method}`
  return { eventId, sequence, type, payload: params }
}

/** Stable classifications used by the DSH adapter without hiding the raw method. */
export type AgentEventKind =
  | 'thread'
  | 'turn'
  | 'assistant'
  | 'reasoning'
  | 'tool'
  | 'approval'
  | 'usage'
  | 'error'
  | 'unknown'

export function classifyEvent(event: AgentEvent): AgentEventKind {
  const type = event.type.toLowerCase()
  if (type.includes('error') || type.includes('failed')) return 'error'
  if (type.includes('approval') || type.includes('permissions_request') || type.includes('elicitation')) return 'approval'
  if (type.includes('usage') || type.includes('token')) return 'usage'
  if (type.includes('reasoning')) return 'reasoning'
  if (type.includes('agent_message') || type.includes('assistant') || type.includes('output_text')) return 'assistant'
  if (type.includes('tool') || type.includes('command') || type.includes('file_change') || type.includes('mcp')) return 'tool'
  if (type.includes('turn')) return 'turn'
  if (type.includes('thread')) return 'thread'
  return 'unknown'
}
