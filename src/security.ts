import type { AuthResult, OriginResult, TokenAuthenticator } from './auth.js'

export type AuthHeaders = Record<string, string | string[] | undefined>
export type RequestAuthResult = AuthResult | OriginResult

/** Applies the same authentication policy to HTTP and WebSocket handshakes. */
export function authenticateRequest(
  authenticator: TokenAuthenticator,
  headers: AuthHeaders,
  allowedOrigins: readonly string[],
): RequestAuthResult {
  const origin = Array.isArray(headers.origin) ? headers.origin[0] : headers.origin
  if (!origin || !allowedOrigins.includes(origin)) return { ok: false, reason: origin ? 'invalid' : 'missing' }
  return authenticator.authenticate(headers)
}
