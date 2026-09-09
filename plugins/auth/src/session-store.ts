import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export type AuthSession = { readonly idHash: string; readonly createdAt: number; lastSeenAt: number }

/** In-memory session store for the single-service deployment. */
export class SessionStore {
  private readonly sessions = new Map<string, AuthSession>()
  constructor(private readonly idleMs = 30 * 60_000, private readonly maxMs = 12 * 60 * 60_000) {}

  create(now = Date.now()): string {
    const id = randomBytes(32).toString('base64url')
    this.sessions.set(hash(id), { idHash: hash(id), createdAt: now, lastSeenAt: now })
    return id
  }

  validate(id: string | undefined, now = Date.now()): boolean {
    if (!id) return false
    const key = hash(id)
    const session = this.sessions.get(key)
    if (!session || now - session.createdAt > this.maxMs || now - session.lastSeenAt > this.idleMs) {
      if (session) this.sessions.delete(key)
      return false
    }
    session.lastSeenAt = now
    return timingSafeEqual(Buffer.from(session.idHash), Buffer.from(key))
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
  const value = header?.split(';').map(item => item.trim()).find(item => item.startsWith(`${name}=`))?.slice(name.length + 1)
  return value ? decodeURIComponent(value) : undefined
}

function hash(value: string): string { return createHash('sha256').update(value, 'utf8').digest('hex') }
