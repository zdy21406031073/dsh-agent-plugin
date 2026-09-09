import { classifyEvent, type AgentEvent } from '../../codex-agent/src/events.js'
import type { DshTranscriptEvent } from './transcript.js'
import { toDshTranscriptEvent } from './transcript.js'

export type EventProjectionState = { readonly seen: ReadonlySet<string>; readonly events: readonly DshTranscriptEvent[] }

/** Applies ordered, idempotent events to a DSH transcript projection. */
export function projectEvent(state: EventProjectionState, event: AgentEvent): EventProjectionState {
  if (state.seen.has(event.eventId)) return state
  const projected = toDshTranscriptEvent(event)
  return { seen: new Set([...state.seen, event.eventId]), events: [...state.events, projected] }
}

/** Projects a replay window while retaining unknown events for diagnostics. */
export function projectEvents(events: readonly AgentEvent[]): EventProjectionState {
  return events.reduce(projectEvent, { seen: new Set<string>(), events: [] })
}

export { classifyEvent }
