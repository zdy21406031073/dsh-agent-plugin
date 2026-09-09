import { timingSafeEqual } from 'node:crypto'

export type AuthConfig = { token: string; headerName?: string }
export type AuthResult = { ok: true } | { ok: false; reason: 'missing' | 'invalid' }

/** Validates a bearer token without exposing the configured secret in errors. */
export class TokenAuthenticator {
  private readonly token: Buffer
  readonly headerName: string

  constructor(config: AuthConfig) {
    if (!config.token) throw new Error('Authentication token must not be empty')
    this.token = Buffer.from(config.token, 'utf8')
    this.headerName = (config.headerName ?? 'authorization').toLowerCase()
  }

  authenticate(headers: Record<string, string | string[] | undefined>): AuthResult {
    const raw = headers[this.headerName]
    const value = Array.isArray(raw) ? raw[0] : raw
    if (!value) return { ok: false, reason: 'missing' }
    const supplied = value.replace(/^Bearer\s+/i, '')
    const bytes = Buffer.from(supplied, 'utf8')
    return bytes.length === this.token.length && timingSafeEqual(bytes, this.token)
      ? { ok: true }
      : { ok: false, reason: 'invalid' }
  }
}

/** Loads the single-user server token from the environment. */
export function authFromEnvironment(env: NodeJS.ProcessEnv = process.env): TokenAuthenticator {
  const token = env.DSH_CODEX_AUTH_TOKEN
  if (!token) throw new Error('DSH_CODEX_AUTH_TOKEN is required')
  return new TokenAuthenticator({ token })
}
