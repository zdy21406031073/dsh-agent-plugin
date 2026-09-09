import type { LoginService } from '../../auth/src/login-service.js'
import { createAuthHandler } from '../../auth/src/http-auth.js'
import { createAgentHandler } from '../../codex-agent/src/http-agent.js'
import { CodexSessionManager } from '../../codex-agent/src/session-manager.js'
import type { WebServerPort } from './webserver-port.js'
import { createAgentUpgradeHandler } from '../../codex-agent/src/ws-agent.js'

export type DshCodexMountOptions = {
  webServer: WebServerPort
  login: LoginService
  sessions: CodexSessionManager
  allowedOrigins: readonly string[]
}

/** Mounts auth and Codex routes into DSH's existing web server without opening another listener. */
export function mountDshCodex(options: DshCodexMountOptions): () => void {
  const authHandler = createAuthHandler({ login: options.login, allowedOrigins: options.allowedOrigins })
  const agentHandler = createAgentHandler({ login: options.login, sessions: options.sessions, allowedOrigins: options.allowedOrigins })
  const agentUpgradeHandler = createAgentUpgradeHandler({ login: options.login, sessions: options.sessions, allowedOrigins: options.allowedOrigins })
  const disposers = [
    options.webServer.register({ kind: 'exact', path: '/auth/login', handler: authHandler }),
    options.webServer.register({ kind: 'exact', path: '/auth/logout', handler: authHandler }),
    options.webServer.register({ kind: 'exact', path: '/auth/session', handler: authHandler }),
    options.webServer.register({ kind: 'prefix', path: '/api', handler: agentHandler }),
    options.webServer.registerUpgrade({ path: '/api/stream', handler: agentUpgradeHandler }),
  ]
  return () => { for (const dispose of disposers.reverse()) dispose() }
}
