import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createRequestGuard, type CookieVerifier } from '../../auth/src/request-guard.js'
import { CodexSessionManager } from './session-manager.js'

export type AgentHttpOptions = { sessions: CodexSessionManager; login: CookieVerifier; allowedOrigins: readonly string[]; maxBodyBytes?: number }

/** Exposes authenticated session commands and an SSE event stream for a DSH adapter. */
export function createAgentServer(options: AgentHttpOptions) {
  const maxBodyBytes = options.maxBodyBytes ?? 1_048_576
  const guard = createRequestGuard(options.login, options.allowedOrigins)
  return createServer(async (request, response) => {
    const decision = guard(request)
    if (!decision.ok) return json(response, decision.status, { ok: false })
    try {
      const url = new URL(request.url ?? '/', 'http://localhost')
      if (request.method === 'POST' && url.pathname === '/api/sessions') {
        const body = await readJson(request, maxBodyBytes)
        const record = options.sessions.create({
          cwd: stringField(body, 'cwd'),
          ...(optionalString(body, 'model') ? { model: optionalString(body, 'model') } : {}),
          ...(optionalString(body, 'approvalPolicy') ? { approvalPolicy: optionalString(body, 'approvalPolicy') } : {}),
          ...(optionalString(body, 'sandbox') ? { sandbox: optionalString(body, 'sandbox') } : {}),
        })
        if (typeof body.prompt === 'string' && body.prompt) await record.session.start(body.prompt)
        return json(response, 201, { id: record.id })
      }
      const match = /^\/api\/sessions\/([^/]+)$/.exec(url.pathname)
      if (match && request.method === 'POST') {
        const record = options.sessions.get(match[1])
        const body = await readJson(request, maxBodyBytes)
        if (url.searchParams.has('compact')) await record.session.compact()
        else if (url.searchParams.has('stop')) await record.session.stop()
        else await record.session.resume(record.session.threadId ?? '', stringField(body, 'prompt'))
        return json(response, 200, { ok: true })
      }
      const stream = /^\/api\/sessions\/([^/]+)\/events$/.exec(url.pathname)
      if (stream && request.method === 'GET') return sse(response, await options.sessions.get(stream[1]).events.after(Number(url.searchParams.get('after') ?? 0)))
      return json(response, 404, { ok: false })
    } catch { return json(response, 400, { ok: false }) }
  })
}

function stringField(value: Record<string, unknown>, key: string): string {
  const result = value[key]
  if (typeof result !== 'string' || !result) throw new Error(`Missing ${key}`)
  return result
}

function optionalString(value: Record<string, unknown>, key: string): string | undefined {
  return typeof value[key] === 'string' && value[key] ? value[key] as string : undefined
}

async function readJson(request: IncomingMessage, maxBytes: number): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk)
    size += bytes.length
    if (size > maxBytes) throw new Error('request body too large')
    chunks.push(bytes)
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('JSON object required')
  return value as Record<string, unknown>
}

function json(response: ServerResponse, status: number, body: object): void {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(body))
}

function sse(response: ServerResponse, events: readonly { sequence: number; type: string; payload: object }[]): void {
  response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
  for (const event of events) response.write(`id: ${event.sequence}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
  response.end()
}
