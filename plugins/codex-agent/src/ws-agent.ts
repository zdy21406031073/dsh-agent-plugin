import type { IncomingMessage } from 'node:http'
import type { WebSocket } from 'ws'
import { WebSocketServer } from 'ws'
import type { CookieVerifier } from '../../auth/src/request-guard.js'
import { createRequestGuard, guardUpgrade } from '../../auth/src/request-guard.js'
import type { CodexSessionManager } from './session-manager.js'

export type AgentWebSocketOptions = { sessions: CodexSessionManager; login: CookieVerifier; allowedOrigins: readonly string[] }

/** Creates a DSH WebServer upgrade handler for live, authenticated Codex events. */
export function createAgentUpgradeHandler(options: AgentWebSocketOptions) {
  const server = new WebSocketServer({ noServer: true })
  const guard = createRequestGuard(options.login, options.allowedOrigins)
  return guardUpgrade(guard, (request, socket, head) => {
    server.handleUpgrade(request, socket, head, client => attach(client, request, options.sessions))
  })
}

function attach(client: WebSocket, request: IncomingMessage, sessions: CodexSessionManager): void {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const sessionId = url.pathname === '/api/stream' ? url.searchParams.get('session') : null
  if (!sessionId) { client.close(1008, 'invalid stream'); return }
  let record
  try { record = sessions.get(sessionId) } catch { client.close(1008, 'session not found'); return }
  const unsubscribe = record.events.subscribe(event => {
    if (client.readyState === client.OPEN) client.send(JSON.stringify(event))
  })
  client.once('close', unsubscribe)
  client.once('error', unsubscribe)
}
