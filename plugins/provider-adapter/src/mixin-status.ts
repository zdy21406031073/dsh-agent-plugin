import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

export type MixinStatus = { readonly available: boolean; readonly version?: string; readonly summary?: string; readonly error?: string }

/** Reads Codex Mixin state through its CLI without importing or bundling its implementation. */
export async function inspectMixin(command = 'codex-mixin', timeoutMs = 5000): Promise<MixinStatus> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('Mixin timeout must be positive')
  try {
    const version = (await exec(command, ['--version'], { timeout: timeoutMs, maxBuffer: 16_384 })).stdout.trim()
    const info = (await exec(command, ['--no-tui', 'info'], { timeout: timeoutMs, maxBuffer: 64_000 })).stdout
    return { available: true, version: redact(info.includes(version) ? version : version), summary: redact(info) }
  } catch (error) {
    return { available: false, error: 'Codex Mixin is unavailable or its diagnostic command failed' }
  }
}

function redact(value: string): string {
  return value
    .replace(/(authorization|api[-_ ]?key|token|password|secret)(\s*[:=]\s*)\S+/gi, '$1$2[redacted]')
    .replace(/https?:\/\/[^/\s:@]+:[^/\s@]+@/gi, 'https://[redacted]@')
    .slice(0, 16_384)
}
