import { authFromEnvironment, originsFromEnvironment } from '../plugins/auth/src/auth.js'
import { LoginService } from '../plugins/auth/src/login-service.js'
import { CwdPolicy } from '../plugins/codex-agent/src/cwd-policy.js'
import { CodexSessionManager } from '../plugins/codex-agent/src/session-manager.js'
import { JsonSessionRepository } from '../plugins/codex-agent/src/session-repository.js'

export type DshCodexRuntime = {
  readonly login: LoginService
  readonly sessions: CodexSessionManager
  readonly allowedOrigins: readonly string[]
  close(): Promise<void>
}

/** Composes the independent plugins without starting a second HTTP listener. */
export function createRuntime(env: NodeJS.ProcessEnv = process.env): DshCodexRuntime {
  const roots = (env.DSH_CODEX_ALLOWED_ROOTS ?? env.DSH_CODEX_ALLOWED_ROOT ?? '').split(',').map(value => value.trim()).filter(Boolean)
  if (!roots.length) throw new Error('DSH_CODEX_ALLOWED_ROOTS is required')
  const dataRoot = env.DSH_CODEX_DATA_ROOT ?? './dsh-codex/data'
  const repository = new JsonSessionRepository(`${dataRoot}/sessions.json`)
  const sessions = new CodexSessionManager(new CwdPolicy(roots), { maxSessions: parsePositive(env.DSH_CODEX_MAX_SESSIONS, 8), repository })
  const login = new LoginService(authFromEnvironment(env))
  const allowedOrigins = originsFromEnvironment(env)
  return { login, sessions, allowedOrigins, close: () => sessions.close() }
}

function parsePositive(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const result = Number(value)
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error('DSH_CODEX_MAX_SESSIONS must be a positive integer')
  return result
}
