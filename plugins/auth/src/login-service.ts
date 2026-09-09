import type { TokenAuthenticator } from './auth.js'
import { clearSessionCookie, readCookie, sessionCookie, SessionStore } from './session-store.js'

export type LoginResult = { status: 200 | 401; setCookie?: string; body: { ok: boolean } }

/** Coordinates token login and short-lived browser sessions. */
export class LoginService {
  constructor(private readonly authenticator: TokenAuthenticator, private readonly sessions = new SessionStore(), private readonly secureCookies = true) {}

  login(token: string | undefined, now?: number): LoginResult {
    const result = this.authenticator.authenticate({ authorization: token ? `Bearer ${token}` : undefined })
    if (!result.ok) return { status: 401, body: { ok: false } }
    return { status: 200, setCookie: sessionCookie(this.sessions.create(now), this.secureCookies), body: { ok: true } }
  }

  authenticateCookie(cookieHeader: string | undefined, now?: number): boolean {
    return this.sessions.validate(readCookie(cookieHeader), now)
  }

  logout(cookieHeader: string | undefined): { status: 204; setCookie: string } {
    const id = readCookie(cookieHeader)
    this.sessions.revoke(id)
    return { status: 204, setCookie: clearSessionCookie(this.secureCookies) }
  }
}
