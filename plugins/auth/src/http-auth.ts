import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { LoginService } from './login-service.js'
import { checkOrigin } from './auth.js'
import { FixedWindowRateLimiter } from './rate-limit.js'
import { createRequestGuard } from './request-guard.js'

export type AuthHttpOptions = {
  login: LoginService
  allowedOrigins: readonly string[]
  maxBodyBytes?: number
  loginLimiter?: FixedWindowRateLimiter
  bodyTimeoutMs?: number
}

/** Test/local convenience wrapper; hosts should mount createAuthHandler directly. */
export function createAuthServer(options: AuthHttpOptions) {
  return createServer(createAuthHandler(options))
}

/** Mountable auth routes; this plugin does not require a second listening port. */
export function createAuthHandler(options: AuthHttpOptions) {
  const maxBodyBytes = options.maxBodyBytes ?? 4096
  const bodyTimeoutMs = options.bodyTimeoutMs ?? 5000
  if (![maxBodyBytes, bodyTimeoutMs].every(value => Number.isSafeInteger(value) && value > 0)) throw new Error('Invalid HTTP limits')
  const limiter = options.loginLimiter ?? new FixedWindowRateLimiter()
  const guard = createRequestGuard(options.login, options.allowedOrigins)
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      if (request.method === 'POST' && request.url === '/auth/login') {
        if (!checkOrigin(header(request, 'origin'), options.allowedOrigins).ok) return writeJson(response, 403, { ok: false })
        // Deliberately ignore X-Forwarded-For. A loopback proxy shares a rate bucket.
        const limit = limiter.check(request.socket.remoteAddress ?? 'unknown')
        if (!limit.allowed) {
          response.setHeader('Retry-After', limit.retryAfterSeconds)
          return writeJson(response, 429, { ok: false })
        }
        if (header(request, 'content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
          return writeJson(response, 415, { ok: false })
        }
        const body = await readBody(request, maxBodyBytes, bodyTimeoutMs)
        const token = readToken(body)
        const result = options.login.login(token)
        if (result.setCookie) response.setHeader('Set-Cookie', result.setCookie)
        return writeJson(response, result.status, result.body)
      }
      const decision = guard(request)
      if (!decision.ok) return writeJson(response, decision.status, { ok: false })
      if (request.method === 'POST' && request.url === '/auth/logout') {
        const result = options.login.logout(header(request, 'cookie'))
        response.setHeader('Set-Cookie', result.setCookie)
        response.setHeader('Cache-Control', 'no-store')
        response.writeHead(result.status).end()
        return
      }
      if (request.method === 'GET' && request.url === '/auth/session') {
        const valid = options.login.authenticateCookie(header(request, 'cookie'))
        return writeJson(response, valid ? 200 : 401, { ok: valid })
      }
      return writeJson(response, 404, { ok: false })
    } catch (error) {
      if (!response.destroyed && !response.headersSent) {
        return writeJson(response, error instanceof BodyError ? error.status : 400, { ok: false })
      }
    }
  }
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name]
  return Array.isArray(value) ? value[0] : value
}

function readToken(body: string): string | undefined {
  try {
    const value: unknown = JSON.parse(body)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
    const token = (value as Record<string, unknown>).token
    return typeof token === 'string' ? token : undefined
  } catch { return undefined }
}

class BodyError extends Error {
  constructor(readonly status: 408 | 413) { super('Login body rejected') }
}

function readBody(request: IncomingMessage, maxBytes: number, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const cleanup = () => {
      clearTimeout(timer)
      request.off('data', onData).off('end', onEnd).off('error', onError).off('aborted', onAborted)
    }
    const fail = (error: Error) => {
      cleanup()
      request.resume()
      reject(error)
    }
    const onData = (chunk: Buffer) => {
      size += chunk.length
      if (size > maxBytes) return fail(new BodyError(413))
      chunks.push(chunk)
    }
    const onEnd = () => { cleanup(); resolve(Buffer.concat(chunks).toString('utf8')) }
    const onError = (error: Error) => fail(error)
    const onAborted = () => fail(new Error('Login request aborted'))
    const timer = setTimeout(() => fail(new BodyError(408)), timeoutMs)
    request.on('data', onData).once('end', onEnd).once('error', onError).once('aborted', onAborted)
  })
}

function writeJson(response: ServerResponse, status: number, body: object): void {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(JSON.stringify(body))
}
