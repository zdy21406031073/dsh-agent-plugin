import type { Json } from './protocol.js'
import { CodexAppServerClient } from './protocol.js'

export type ThreadSummary = { readonly id: string; readonly name?: string; readonly cwd?: string; readonly model?: string }
export type ThreadPage = { readonly data: readonly ThreadSummary[]; readonly nextCursor?: string | null }

/** Read-only Codex thread operations kept separate from active session control. */
export class CodexThreadService {
  constructor(private readonly client: Pick<CodexAppServerClient, 'request'>) {}

  async list(options: { cwd?: string; cursor?: string; limit?: number; searchTerm?: string } = {}): Promise<ThreadPage> {
    const result = await this.client.request('thread/list', {
      cwd: options.cwd ?? null,
      cursor: options.cursor ?? null,
      limit: options.limit ?? null,
      searchTerm: options.searchTerm ?? null,
    } as Json)
    return parsePage(result)
  }

  async read(threadId: string): Promise<ThreadSummary> {
    const result = await this.client.request('thread/read', { threadId })
    const thread = objectField(result, 'thread')
    return {
      id: stringField(thread, 'id'),
      ...(optionalString(thread, 'name') ? { name: optionalString(thread, 'name') } : {}),
      ...(optionalString(thread, 'cwd') ? { cwd: optionalString(thread, 'cwd') } : {}),
      ...(optionalString(thread, 'model') ? { model: optionalString(thread, 'model') } : {}),
    }
  }
}

function parsePage(value: Json): ThreadPage {
  const object = asObject(value)
  if (!Array.isArray(object.data)) throw new Error('Codex response missing data')
  const data = object.data.map(item => {
    const thread = asObject(item)
    return { id: stringField(thread, 'id'), ...(optionalString(thread, 'name') ? { name: optionalString(thread, 'name') } : {}), ...(optionalString(thread, 'cwd') ? { cwd: optionalString(thread, 'cwd') } : {}), ...(optionalString(thread, 'model') ? { model: optionalString(thread, 'model') } : {}) }
  })
  return { data, ...(typeof object.nextCursor === 'string' || object.nextCursor === null ? { nextCursor: object.nextCursor } : {}) }
}
function asObject(value: Json): Record<string, Json> { if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Codex response must be an object'); return value as Record<string, Json> }
function objectField(value: Json, key: string): Record<string, Json> { return asObject(asObject(value)[key]) }
function stringField(value: Record<string, Json>, key: string): string { if (typeof value[key] !== 'string' || !value[key]) throw new Error(`Codex response missing ${key}`); return value[key] }
function optionalString(value: Record<string, Json>, key: string): string | undefined { return typeof value[key] === 'string' && value[key] ? value[key] : undefined }
