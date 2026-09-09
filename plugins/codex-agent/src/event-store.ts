import type { AgentEvent } from './events.js'

export interface EventStore {
  append(event: AgentEvent): Promise<void>
  after(sequence: number): Promise<readonly AgentEvent[]>
}

/** Bounded in-memory event store used by the adapter until DSH persistence is wired. */
export class MemoryEventStore implements EventStore {
  private readonly values: AgentEvent[] = []

  constructor(private readonly limit = 10_000) {}

  async append(event: AgentEvent): Promise<void> {
    this.values.push(event)
    if (this.values.length > this.limit) this.values.splice(0, this.values.length - this.limit)
  }

  async after(sequence: number): Promise<readonly AgentEvent[]> {
    return this.values.filter(event => event.sequence > sequence)
  }
}
