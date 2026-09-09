import { createHash, randomBytes } from 'node:crypto'

type AuthSession = { readonly createdAt: number; lastSeenAt: number }

/** In-memory session store for the single-service deployment. */
export class SessionStore {
  private readonly sessions = new Map<string, AuthSession>()
  constructor(private readonly idleMs = 30 * 60_000, private readonly maxMs = 12 * 60 * 60_000, private readonly maxSessions = 128) {
    if (![idleMs, maxMs, maxSessions].every(value => Number.isSafeInteger(value) && value > 0)) {
      throw new Error('Session limits must be positive integers')
    }
  }

  create(now = Date.now()): string {
    for (const [key, session] of this.sessions) {
      if (this.expired(session, now)) this.sessions.delete(key)
    }
    if (this.sessions.size >= this.maxSessions) throw new Error('Authentication session capacity reached')
    const id = randomBytes(32).toString('base64url')
    this.sessions.set(hash(id), { createdAt: now, lastSeenAt: now })
    return id
  }

  validate(id: string | undefined, now = Date.now()): boolean {
    if (!id || !/^[A-Za-z0-9_-]{43}$/.test(id)) return false
    const key = hash(id)
    const session = this.sessions.get(key)
    if (!session || this.expired(session, now)) {
      if (session) this.sessions.delete(key)
      return false
    }
    session.lastSeenAt = now
    return true
  }

  private expired(session: AuthSession, now: number): boolean {
    return now - session.createdAt >= this.maxMs || now - session.lastSeenAt >= this.idleMs
  }

  revoke(id: string | undefined): void { if (id) this.sessions.delete(hash(id)) }
  clear(): void { this.sessions.clear() }
  get size(): number { return this.sessions.size }
}

export function sessionCookie(id: string, secure = true): string {
  return `dsh_codex_session=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`
}

export function clearSessionCookie(secure = true): string {
  return `dsh_codex_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`
}

export function readCookie(header: string | undefined, name = 'dsh_codex_session'): string | undefined {
  const matches = header?.split(';').map(item => item.trim()).filter(item => item.startsWith(`${name}=`)) ?? []
  if (matches.length !== 1) return undefined
  try {
    return decodeURIComponent(matches[0].slice(name.length + 1)) || undefined
  } catch {
    // A malformed browser cookie is unauthenticated, not an application error.
    return undefined
  }
}

function hash(value: string): string { return createHash('sha256').update(value, 'utf8').digest('hex') }
