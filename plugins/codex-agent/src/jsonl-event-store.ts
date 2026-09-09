import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { AgentEvent } from './events.js'
import type { EventStore } from './event-store.js'

/** Durable append-only event store for one Codex session. */
export class JsonlEventStore implements EventStore {
  private writeChain: Promise<void> = Promise.resolve()
  private readonly listeners = new Set<(event: AgentEvent) => void>()

  constructor(private readonly file: string, private readonly maxReplay = 10_000) {}

  append(event: AgentEvent): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(dirname(this.file), { recursive: true })
      await appendFile(this.file, `${JSON.stringify(event)}\n`, 'utf8')
      for (const listener of this.listeners) listener(event)
    })
    return this.writeChain
  }

  async after(sequence: number): Promise<readonly AgentEvent[]> {
    let content: string
    try { content = await readFile(this.file, 'utf8') } catch (error) {
      if (isMissingFile(error)) return []
      throw error
    }
    const events = content.split('\n').filter(Boolean).map(line => JSON.parse(line) as AgentEvent)
    return events.filter(event => event.sequence > sequence).slice(-this.maxReplay)
  }

  subscribe(listener: (event: AgentEvent) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
}

/** Builds the default per-session event log path without accepting path fragments from clients. */
export function eventLogPath(root: string, sessionId: string): string {
  return join(root, 'sessions', `${sessionId}.jsonl`)
}

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}
