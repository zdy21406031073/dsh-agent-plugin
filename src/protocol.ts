import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import { randomUUID } from 'node:crypto'

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type RpcMessage = { jsonrpc: '2.0'; id?: string | number; method?: string; params?: Json; result?: Json; error?: { code: number; message: string; data?: Json } }
export type RpcNotification = RpcMessage & { method: string; params?: Json }

/** Minimal JSON-RPC stdio transport for the Codex app-server. */
export class CodexAppServerClient {
  private readonly pending = new Map<string | number, { resolve: (v: Json) => void; reject: (e: Error) => void }>()
  private readonly process: ChildProcessWithoutNullStreams
  private readonly closePromise: Promise<void>
  private nextId = 1
  private readonly onNotificationHandler?: (message: RpcNotification) => void

  constructor(options: { command?: string; args?: string[]; cwd?: string; env?: NodeJS.ProcessEnv; onNotification?: (message: RpcNotification) => void } = {}) {
    this.onNotificationHandler = options.onNotification
    this.process = spawn(options.command ?? 'codex', options.args ?? ['app-server', '--stdio'], {
      cwd: options.cwd, env: { ...process.env, ...options.env }, stdio: ['pipe', 'pipe', 'pipe'],
    })
    const lines = createInterface({ input: this.process.stdout })
    lines.on('line', line => this.receive(line))
    this.closePromise = new Promise(resolve => this.process.once('close', () => { for (const p of this.pending.values()) p.reject(new Error('Codex app-server exited')); this.pending.clear(); resolve() }))
  }

  request(method: string, params?: Json): Promise<Json> {
    const id = this.nextId++
    const message: RpcMessage = { jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) }
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.process.stdin.write(`${JSON.stringify(message)}\n`) })
  }

  notify(method: string, params?: Json): void { this.process.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, ...(params === undefined ? {} : { params }) })}\n`) }
  async close(): Promise<void> { this.process.kill('SIGTERM'); await this.closePromise }
  static id(): string { return randomUUID() }

  private receive(line: string): void {
    let message: RpcMessage
    try { message = JSON.parse(line) as RpcMessage } catch { return }
    if (message.id !== undefined) {
      const p = this.pending.get(message.id); if (!p) return
      this.pending.delete(message.id)
      if (message.error) p.reject(new Error(`${message.error.code}: ${message.error.message}`)); else p.resolve(message.result ?? null)
      return
    }
    if (message.method) this.onNotificationHandler?.(message as RpcNotification)
  }
}
