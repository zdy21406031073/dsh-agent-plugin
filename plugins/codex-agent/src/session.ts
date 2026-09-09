import { CodexAppServerClient, type Json, type RpcNotification } from './protocol.js'
import { normalizeNotification, type AgentEvent } from './events.js'

export type SessionStatus = 'idle' | 'running' | 'waiting_approval' | 'completed' | 'failed'
export type SessionOptions = { cwd: string; model?: string; approvalPolicy?: string; sandbox?: string }

/** Owns one Codex thread and exposes lifecycle operations without UI concerns. */
export class CodexSession {
  readonly client: CodexAppServerClient
  readonly events: AgentEvent[] = []
  status: SessionStatus = 'idle'
  threadId?: string
  private sequence = 0
  private activeTurn = false

  constructor(private readonly options: SessionOptions, onEvent?: (event: AgentEvent) => void) {
    this.client = new CodexAppServerClient({ onNotification: (message: RpcNotification) => { const event = normalizeNotification(message, ++this.sequence); this.events.push(event); onEvent?.(event) } })
  }

  async start(prompt: string): Promise<void> { if (this.status !== 'idle') throw new Error('Session is already started'); const result = await this.client.request('thread/start', { cwd: this.options.cwd, model: this.options.model ?? null, approvalPolicy: this.options.approvalPolicy ?? 'on-request', sandbox: this.options.sandbox ?? 'workspace-write' } as Json); this.threadId = readString(result, 'threadId'); await this.turn(prompt) }
  async resume(threadId: string, prompt: string): Promise<void> { if (this.threadId && this.threadId !== threadId) throw new Error('Thread id does not belong to this session'); this.threadId = threadId; await this.turn(prompt) }
  async compact(): Promise<Json> { if (!this.threadId) throw new Error('Session has not started'); return this.client.request('thread/compact', { threadId: this.threadId }) }
  async stop(): Promise<void> { if (this.threadId && this.activeTurn) await this.client.request('turn/interrupt', { threadId: this.threadId }); this.activeTurn = false; this.status = 'idle' }
  async close(): Promise<void> { await this.client.close() }

  private async turn(prompt: string): Promise<void> { if (!this.threadId) throw new Error('Session has not started'); if (this.activeTurn) throw new Error('Session already has an active turn'); this.activeTurn = true; this.status = 'running'; try { await this.client.request('turn/start', { threadId: this.threadId, input: [{ type: 'text', text: prompt }] }); this.status = 'completed' } catch (error) { this.status = 'failed'; throw error } finally { this.activeTurn = false } }
}
function readString(value: Json, key: string): string { if (typeof value === 'object' && value !== null && !Array.isArray(value) && typeof value[key] === 'string') return value[key] as string; throw new Error(`Codex response missing ${key}`) }
