import { randomUUID } from 'node:crypto'
import { CodexSession, type ApprovalHandler, type SessionOptions } from './session.js'
import { CwdPolicy } from './cwd-policy.js'
import { MemoryEventStore, type EventStore } from './event-store.js'
import type { AgentEvent } from './events.js'
import type { SessionMetadata, SessionRepository } from './session-repository.js'

/** Operations owned by the manager; the process adapter and deterministic tests implement this port. */
export type ManagedSession = Pick<CodexSession,
  'cwd' | 'model' | 'threadId' | 'status' | 'start' | 'load' | 'resume' | 'steer' | 'compact' | 'stop' | 'close'>
export type SessionRecord = { readonly id: string; readonly session: ManagedSession; readonly events: EventStore; readonly createdAt: number }
export type SessionManagerOptions = {
  maxSessions?: number
  onRequest?: ApprovalHandler
  repository?: SessionRepository
  createSession?: (options: SessionOptions, onEvent: (event: AgentEvent) => void, onRequest?: ApprovalHandler) => ManagedSession
  createEventStore?: (id: string) => EventStore
}

type OwnedSession = {
  record: SessionRecord
  writes: Promise<void>
  failure?: Error
  closing: boolean
  closeProcess?: Promise<void>
}

/** Owns process cleanup and ordered persistence. No rejected write is detached from its owner. */
export class CodexSessionManager {
  private readonly sessions = new Map<string, OwnedSession>()
  private readonly creating = new Set<Promise<SessionRecord>>()
  private readonly maxSessions: number
  private closed = false
  private closing?: Promise<void>

  constructor(private readonly cwdPolicy: CwdPolicy, private readonly options: SessionManagerOptions = {}) {
    this.maxSessions = options.maxSessions ?? 8
    if (!Number.isSafeInteger(this.maxSessions) || this.maxSessions < 1) throw new Error('Session limit must be a positive integer')
  }

  /** Reserve capacity before async persistence; do not launch a process if the initial write fails. */
  create(options: SessionOptions): Promise<SessionRecord> {
    if (this.closed) return Promise.reject(new Error('Session manager is closed'))
    if (this.sessions.size + this.creating.size >= this.maxSessions) return Promise.reject(new Error('Session limit reached'))
    const task = this.createOwned(options)
    this.creating.add(task)
    void task.then(() => this.creating.delete(task), () => this.creating.delete(task))
    return task
  }

  private async createOwned(options: SessionOptions): Promise<SessionRecord> {
    const safeOptions = { ...options, cwd: this.cwdPolicy.resolve(options.cwd) }
    const id = randomUUID()
    const createdAt = Date.now()
    await this.options.repository?.save({ id, cwd: safeOptions.cwd, model: safeOptions.model, status: 'idle', createdAt, updatedAt: createdAt })
    let session: ManagedSession | undefined
    try {
      if (this.closed) throw new Error('Session manager is closed')
      const events = this.options.createEventStore?.(id) ?? new MemoryEventStore()
      let owned: OwnedSession | undefined
      // Process notifications arrive after construction; a synchronous factory callback is a programming error.
      const onEvent = (event: AgentEvent) => {
        if (!owned) throw new Error('Session factory emitted before construction finished')
        if (owned.closing || owned.failure) return
        const snapshot = this.metadata(owned.record)
        const copy = structuredClone(event)
        this.enqueue(owned, async () => {
          await events.append(copy)
          await this.options.repository?.save(snapshot)
        })
      }
      session = this.options.createSession
        ? this.options.createSession(safeOptions, onEvent, this.options.onRequest)
        : new CodexSession(safeOptions, onEvent, this.options.onRequest)
      const record = Object.freeze({ id, events, session, createdAt })
      owned = { record, writes: Promise.resolve(), closing: false }
      this.sessions.set(id, owned)
      return record
    } catch (error) {
      await session?.close()
      await this.options.repository?.remove(id)
      throw error
    }
  }

  get(id: string): SessionRecord {
    const owned = this.sessions.get(id)
    if (!owned) throw new Error('Session not found')
    if (owned.failure) throw owned.failure
    if (owned.closing || this.closed) throw new Error('Session is closing')
    return owned.record
  }

  /** Persist the post-command thread id/status and await all earlier event writes. */
  async sync(record: SessionRecord): Promise<void> {
    const owned = this.sessions.get(record.id)
    if (!owned || owned.record !== record || owned.closing) throw new Error('Session not owned by this manager')
    const snapshot = this.metadata(record)
    this.enqueue(owned, async () => { await this.options.repository?.save(snapshot) })
    await this.flush(record.id)
  }

  /** Rehydrates persisted sessions by loading their Codex threads without starting turns. */
  async restore(): Promise<readonly SessionRecord[]> {
    const metadata = await this.options.repository?.list() ?? []
    const restored: SessionRecord[] = []
    for (const item of metadata) {
      if (!item.threadId) continue
      if (this.sessions.has(item.id)) continue
      if (this.sessions.size >= this.maxSessions) break
      const events = this.options.createEventStore?.(item.id) ?? new MemoryEventStore()
      let owned: OwnedSession | undefined
      const onEvent = (event: AgentEvent) => {
        if (!owned || owned.closing || owned.failure) return
        const copy = structuredClone(event)
        const current = owned
        this.enqueue(current, async () => { await events.append(copy); await this.options.repository?.save(this.metadata(current.record)) })
      }
      const session = this.options.createSession
        ? this.options.createSession({ cwd: this.cwdPolicy.resolve(item.cwd), model: item.model }, onEvent, this.options.onRequest)
        : new CodexSession({ cwd: this.cwdPolicy.resolve(item.cwd), model: item.model }, onEvent, this.options.onRequest)
      try {
        await session.load(item.threadId)
        const record = Object.freeze({ id: item.id, events, session, createdAt: item.createdAt })
        owned = { record, writes: Promise.resolve(), closing: false }
        this.sessions.set(item.id, owned)
        restored.push(record)
      } catch (error) {
        await session.close()
        throw error
      }
    }
    return restored
  }

  /** Wait for accepted writes, propagating any storage failure without leaking its payload. */
  async flush(id: string): Promise<void> {
    const owned = this.sessions.get(id)
    if (!owned) throw new Error('Session not found')
    await owned.writes
    if (owned.failure) throw owned.failure
  }

  private metadata(record: SessionRecord): SessionMetadata {
    return { id: record.id, threadId: record.session.threadId, cwd: record.session.cwd,
      model: record.session.model, status: record.session.status, createdAt: record.createdAt, updatedAt: Date.now() }
  }

  private enqueue(owned: OwnedSession, write: () => Promise<void>): void {
    owned.writes = owned.writes.then(async () => {
      if (owned.failure) return
      try { await write() }
      catch {
        owned.failure = new Error('Session persistence failed')
        // Do not keep running a tool-capable process after losing its event record.
        await this.stopProcess(owned).catch(() => { /* The storage failure remains the public diagnostic. */ })
      }
    })
  }

  private stopProcess(owned: OwnedSession): Promise<void> {
    owned.closeProcess ??= Promise.resolve().then(() => owned.record.session.close())
    return owned.closeProcess
  }

  async remove(id: string): Promise<void> {
    const owned = this.sessions.get(id)
    if (!owned) throw new Error('Session not found')
    owned.closing = true
    await this.disposeOwned(owned)
    await this.options.repository?.remove(id)
    this.sessions.delete(id)
  }

  private async disposeOwned(owned: OwnedSession): Promise<void> {
    const results = await Promise.allSettled([this.stopProcess(owned), owned.writes])
    if (owned.failure) throw owned.failure
    if (results.some(result => result.status === 'rejected')) throw new Error('Session shutdown failed')
  }

  /** Idempotent shutdown waits for pending creations, every process, and all queued writes. */
  close(): Promise<void> {
    this.closed = true
    this.closing ??= (async () => {
      await Promise.allSettled([...this.creating])
      for (const owned of this.sessions.values()) owned.closing = true
      const results = await Promise.allSettled([...this.sessions.values()].map(owned => this.disposeOwned(owned)))
      this.sessions.clear()
      if (results.some(result => result.status === 'rejected')) throw new Error('Session shutdown failed')
    })()
    return this.closing
  }
}
