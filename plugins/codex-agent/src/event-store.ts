import type { AgentEvent } from './events.js'

export interface EventStore {
  append(event: AgentEvent): Promise<void>
  after(sequence: number): Promise<readonly AgentEvent[]>
  subscribe(listener: (event: AgentEvent) => void): () => void
}

/** Bounded in-memory event store used by the adapter until DSH persistence is wired. */
export class MemoryEventStore implements EventStore {
  private readonly values: AgentEvent[] = []
  private readonly listeners = new Set<(event: AgentEvent) => void>()

  constructor(private readonly limit = 10_000) {}

  async append(event: AgentEvent): Promise<void> {
    this.values.push(event)
    if (this.values.length > this.limit) this.values.splice(0, this.values.length - this.limit)
    for (const listener of this.listeners) listener(event)
  }

  async after(sequence: number): Promise<readonly AgentEvent[]> {
    return this.values.filter(event => event.sequence > sequence)
  }

  subscribe(listener: (event: AgentEvent) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
}
