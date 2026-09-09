import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'

/** Only this session-verification operation is exposed to protected services. */
export interface CookieVerifier {
  authenticateCookie(cookie: string | undefined): boolean
}

export type RequestDecision = { ok: true } | { ok: false; status: 401 | 403 }

/**
 * Shared cookie/Origin policy. Writes and upgrades require Origin; a same-origin
 * browser GET may omit it, but must still carry the configured Host and cookie.
 * Forwarded headers never select a trusted origin.
 */
export function createRequestGuard(verifier: CookieVerifier, allowedOrigins: readonly string[]) {
  const origins = new Set(allowedOrigins.map(origin => {
    const parsed = new URL(origin)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
      throw new Error('Expected an exact HTTP(S) origin')
    }
    return origin
  }))
  if (!origins.size) throw new Error('At least one allowed origin is required')
  const hosts = new Set([...origins].map(origin => new URL(origin).host))

  return (request: Pick<IncomingMessage, 'headers' | 'method'>, upgrade = false): RequestDecision => {
    const origin = request.headers.origin
    const read = !upgrade && (request.method === 'GET' || request.method === 'HEAD')
    const allowed = origin !== undefined
      ? origins.has(origin)
      : read && hosts.has(request.headers.host ?? '') && request.headers['sec-fetch-site'] !== 'cross-site'
    if (!allowed) return { ok: false, status: 403 }
    if (!verifier.authenticateCookie(request.headers.cookie)) return { ok: false, status: 401 }
    return { ok: true }
  }
}

export type RequestGuard = ReturnType<typeof createRequestGuard>

/**
 * Runs before a WebSocket implementation accepts its handshake. No application
 * bytes are consumed here; successful upgrades retain the original head buffer.
 */
export function guardUpgrade(
  guard: RequestGuard,
  accept: (request: IncomingMessage, socket: Duplex, head: Buffer) => void,
) {
  return (request: IncomingMessage, socket: Duplex, head: Buffer): void => {
    const result = guard(request, true)
    if (!result.ok) {
      const reason = result.status === 401 ? 'Unauthorized' : 'Forbidden'
      socket.end(`HTTP/1.1 ${result.status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
      return
    }
    accept(request, socket, head)
  }
}
