import type { RpcNotification } from './protocol.js'

export type AgentEvent = { eventId: string; sequence: number; type: string; payload: Record<string, unknown> }

/** Converts version-specific app-server notifications into DSH display events. */
export function normalizeNotification(notification: RpcNotification, sequence: number): AgentEvent {
  const params = (notification.params && typeof notification.params === 'object' && !Array.isArray(notification.params)) ? notification.params as Record<string, unknown> : {}
  const type = notification.method.replace(/^codex\//, '').replace(/[./]/g, '_')
  const eventId = typeof params.event_id === 'string' ? params.event_id : `${sequence}:${notification.method}`
  return { eventId, sequence, type, payload: params }
}
