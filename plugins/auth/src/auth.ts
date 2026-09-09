import { timingSafeEqual } from 'node:crypto'

export type AuthConfig = { token: string; headerName?: string }
export type AuthResult = { ok: true } | { ok: false; reason: 'missing' | 'invalid' }
export type OriginResult = { ok: true } | { ok: false; reason: 'missing' | 'invalid' }

/** Validates a bearer token without exposing the configured secret in errors. */
export class TokenAuthenticator {
  private readonly token: Buffer
  readonly headerName: string

  constructor(config: AuthConfig) {
    if (config.token.length < 32) throw new Error('Authentication token must be at least 32 characters')
    this.token = Buffer.from(config.token, 'utf8')
    this.headerName = (config.headerName ?? 'authorization').toLowerCase()
  }

  authenticate(headers: Record<string, string | string[] | undefined>): AuthResult {
    const raw = headers[this.headerName]
    const value = Array.isArray(raw) ? raw[0] : raw
    if (!value) return { ok: false, reason: 'missing' }
    if (!/^Bearer\s+\S+$/.test(value)) return { ok: false, reason: 'invalid' }
    const supplied = value.slice(value.search(/\s/) + 1).trim()
    const bytes = Buffer.from(supplied, 'utf8')
    return bytes.length === this.token.length && timingSafeEqual(bytes, this.token)
      ? { ok: true }
      : { ok: false, reason: 'invalid' }
  }
}

/** Validates an optional browser origin against the configured allow-list. */
export function checkOrigin(origin: string | undefined, allowedOrigins: readonly string[]): OriginResult {
  if (!origin) return { ok: false, reason: 'missing' }
  return allowedOrigins.includes(origin) ? { ok: true } : { ok: false, reason: 'invalid' }
}

/** Loads the single-user server token from the environment. */
export function authFromEnvironment(env: NodeJS.ProcessEnv = process.env): TokenAuthenticator {
  const token = env.DSH_CODEX_AUTH_TOKEN
  if (!token) throw new Error('DSH_CODEX_AUTH_TOKEN is required')
  return new TokenAuthenticator({ token })
}

/** Loads a non-empty origin allow-list from the environment. */
export function originsFromEnvironment(env: NodeJS.ProcessEnv = process.env): readonly string[] {
  const origins = (env.DSH_CODEX_ALLOWED_ORIGINS ?? '').split(',').map(origin => origin.trim()).filter(Boolean)
  if (origins.length === 0) throw new Error('DSH_CODEX_ALLOWED_ORIGINS is required')
  if (origins.includes('*')) throw new Error('Wildcard origins are not allowed')
  return origins
}
