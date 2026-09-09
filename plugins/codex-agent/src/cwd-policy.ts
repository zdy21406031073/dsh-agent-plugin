import { isAbsolute, relative, resolve } from 'node:path'

/** Restricts Codex workspaces to configured filesystem roots. */
export class CwdPolicy {
  private readonly roots: readonly string[]

  constructor(allowedRoots: readonly string[]) {
    if (allowedRoots.length === 0) throw new Error('At least one allowed cwd root is required')
    this.roots = allowedRoots.map(root => resolve(root))
  }

  resolve(requested: string): string {
    if (!isAbsolute(requested)) throw new Error('Codex cwd must be absolute')
    const candidate = resolve(requested)
    if (!this.roots.some(root => isWithin(root, candidate))) throw new Error('Codex cwd is outside allowed roots')
    return candidate
  }
}

function isWithin(root: string, candidate: string): boolean {
  const remainder = relative(root, candidate)
  return remainder === '' || (!remainder.startsWith('..') && !isAbsolute(remainder))
}
