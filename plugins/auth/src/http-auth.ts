import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { LoginService } from './login-service.js'
import { checkOrigin } from './auth.js'

export type AuthHttpOptions = {
  login: LoginService
  allowedOrigins: readonly string[]
  secureCookies?: boolean
  maxBodyBytes?: number
}

/** Creates the small authentication surface shared by HTTP and WebSocket adapters. */
export function createAuthServer(options: AuthHttpOptions) {
  const maxBodyBytes = options.maxBodyBytes ?? 4096
  return createServer(async (request, response) => {
    try {
      const origin = header(request, 'origin')
      const originResult = checkOrigin(origin, options.allowedOrigins)
      if (!originResult.ok) return writeJson(response, 403, { ok: false })

      if (request.method === 'POST' && request.url === '/auth/login') {
        const body = await readBody(request, maxBodyBytes)
        const token = readToken(body)
        const result = options.login.login(token)
        if (result.setCookie) response.setHeader('Set-Cookie', result.setCookie)
        return writeJson(response, result.status, result.body)
      }
      if (request.method === 'POST' && request.url === '/auth/logout') {
        if (!options.login.authenticateCookie(header(request, 'cookie'))) return writeJson(response, 401, { ok: false })
        const result = options.login.logout(header(request, 'cookie'))
        response.setHeader('Set-Cookie', result.setCookie)
        response.writeHead(result.status).end()
        return
      }
      if (request.method === 'GET' && request.url === '/auth/session') {
        const valid = options.login.authenticateCookie(header(request, 'cookie'))
        return writeJson(response, valid ? 200 : 401, { ok: valid })
      }
      return writeJson(response, 404, { ok: false })
    } catch {
      return writeJson(response, 400, { ok: false })
    }
  })
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

async function readBody(request: IncomingMessage, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += bytes.length
    if (size > maxBytes) throw new Error('request body too large')
    chunks.push(bytes)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function writeJson(response: ServerResponse, status: number, body: object): void {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(body))
}
