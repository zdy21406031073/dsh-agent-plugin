import { randomUUID } from 'node:crypto'
import { CodexSession, type ApprovalHandler, type SessionOptions } from './session.js'
import { CwdPolicy } from './cwd-policy.js'
import { MemoryEventStore, type EventStore } from './event-store.js'

export type SessionRecord = { readonly id: string; readonly session: CodexSession; readonly events: EventStore; readonly createdAt: number }

/** Owns Codex sessions and enforces a configured session limit. */
export class CodexSessionManager {
  private readonly sessions = new Map<string, SessionRecord>()

  constructor(private readonly cwdPolicy: CwdPolicy, private readonly maxSessions = 8, private readonly onRequest?: ApprovalHandler) {}

  create(options: SessionOptions): SessionRecord {
    if (this.sessions.size >= this.maxSessions) throw new Error('Session limit reached')
    const safeOptions = { ...options, cwd: this.cwdPolicy.resolve(options.cwd) }
    const events = new MemoryEventStore()
    const record = { id: randomUUID(), events, session: new CodexSession(safeOptions, event => { void events.append(event) }, this.onRequest), createdAt: Date.now() }
    this.sessions.set(record.id, record)
    return record
  }

  get(id: string): SessionRecord {
    const record = this.sessions.get(id)
    if (!record) throw new Error('Session not found')
    return record
  }

  async remove(id: string): Promise<void> {
    const record = this.get(id)
    this.sessions.delete(id)
    await record.session.close()
  }

  async close(): Promise<void> {
    const records = [...this.sessions.values()]
    this.sessions.clear()
    await Promise.all(records.map(record => record.session.close()))
  }
}
