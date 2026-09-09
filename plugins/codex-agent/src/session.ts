import { CodexAppServerClient, type Json, type RpcNotification, type RpcRequestHandler } from './protocol.js'
import { normalizeNotification, type AgentEvent } from './events.js'

export type SessionStatus = 'idle' | 'running' | 'waiting_approval' | 'completed' | 'failed'
export type SessionOptions = { cwd: string; model?: string; approvalPolicy?: string; sandbox?: string }
export type ApprovalHandler = RpcRequestHandler

/** Owns one Codex thread and exposes lifecycle operations without UI concerns. */
export class CodexSession {
  readonly client: CodexAppServerClient
  readonly events: AgentEvent[] = []
  status: SessionStatus = 'idle'
  threadId?: string
  turnId?: string
  private sequence = 0
  private activeTurn = false
  get cwd(): string { return this.options.cwd }
  get model(): string | undefined { return this.options.model }

  constructor(private readonly options: SessionOptions, onEvent?: (event: AgentEvent) => void, onRequest?: ApprovalHandler) {
    this.client = new CodexAppServerClient({ onNotification: (message: RpcNotification) => {
      const event = normalizeNotification(message, ++this.sequence)
      this.events.push(event)
      if (event.type.includes('turn_completed') || event.type.includes('turn_end') || event.type.includes('turn_failed') || event.type.includes('turn_aborted')) {
        this.activeTurn = false
        this.status = event.type.includes('failed') ? 'failed' : 'completed'
      }
      onEvent?.(event)
    }, onRequest })
  }

  async start(prompt: string): Promise<void> { if (this.status !== 'idle') throw new Error('Session is already started'); const result = await this.client.request('thread/start', { cwd: this.options.cwd, model: this.options.model ?? null, approvalPolicy: this.options.approvalPolicy ?? 'on-request', sandbox: this.options.sandbox ?? 'workspace-write' } as Json); this.threadId = readNestedString(result, ['thread', 'id']); await this.turn(prompt) }
  async resume(threadId: string, prompt: string): Promise<void> {
    if (this.threadId && this.threadId !== threadId) throw new Error('Thread id does not belong to this session')
    if (!this.threadId) {
      const result = await this.client.request('thread/resume', { threadId })
      this.threadId = readNestedString(result, ['thread', 'id'])
    }
    await this.turn(prompt)
  }
  /** Loads an existing Codex thread without starting a new turn. */
  async load(threadId: string): Promise<void> {
    if (this.threadId && this.threadId !== threadId) throw new Error('Thread id does not belong to this session')
    const result = await this.client.request('thread/resume', { threadId })
    this.threadId = readNestedString(result, ['thread', 'id'])
  }
  async steer(prompt: string): Promise<void> {
    if (!this.threadId || !this.turnId) throw new Error('Session has no active turn')
    if (!this.activeTurn) throw new Error('Session has no active turn')
    await this.client.request('turn/steer', { threadId: this.threadId, expectedTurnId: this.turnId, input: [{ type: 'text', text: prompt }] })
  }
  async compact(): Promise<Json> { if (!this.threadId) throw new Error('Session has not started'); return this.client.request('thread/compact/start', { threadId: this.threadId }) }
  async stop(): Promise<void> { if (this.threadId && this.turnId && this.activeTurn) await this.client.request('turn/interrupt', { threadId: this.threadId, turnId: this.turnId }); this.activeTurn = false; this.status = 'idle' }
  async close(): Promise<void> { await this.client.close() }

  private async turn(prompt: string): Promise<void> { if (!this.threadId) throw new Error('Session has not started'); if (this.activeTurn) throw new Error('Session already has an active turn'); this.activeTurn = true; this.status = 'running'; try { const result = await this.client.request('turn/start', { threadId: this.threadId, input: [{ type: 'text', text: prompt }] }); this.turnId = readNestedString(result, ['turn', 'id']) } catch (error) { this.activeTurn = false; this.status = 'failed'; throw error } }
}
function readNestedString(value: Json, path: readonly string[]): string {
  let current: Json = value
  for (const key of path) {
    if (typeof current !== 'object' || current === null || Array.isArray(current) || typeof current[key] !== 'object' && typeof current[key] !== 'string') throw new Error(`Codex response missing ${path.join('.')}`)
    current = current[key]
  }
  if (typeof current !== 'string') throw new Error(`Codex response missing ${path.join('.')}`)
  return current
}
