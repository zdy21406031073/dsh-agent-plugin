import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export type SessionMetadata = {
  readonly id: string
  readonly threadId?: string
  readonly cwd: string
  readonly model?: string
  readonly status: string
  readonly createdAt: number
  readonly updatedAt: number
}

export interface SessionRepository {
  list(): Promise<readonly SessionMetadata[]>
  save(metadata: SessionMetadata): Promise<void>
  remove(id: string): Promise<void>
}

/** Atomic JSON metadata repository; Codex owns the durable conversation history. */
export class JsonSessionRepository implements SessionRepository {
  private writeChain: Promise<void> = Promise.resolve()
  constructor(private readonly file: string) {}

  async list(): Promise<readonly SessionMetadata[]> {
    try {
      const value: unknown = JSON.parse(await readFile(this.file, 'utf8'))
      if (!Array.isArray(value)) throw new Error('Session metadata must be an array')
      return value as SessionMetadata[]
    } catch (error) {
      if (isMissing(error)) return []
      throw error
    }
  }

  async save(metadata: SessionMetadata): Promise<void> {
    this.writeChain = this.writeChain.then(async () => this.writeValues(metadata))
    return this.writeChain
  }

  async remove(id: string): Promise<void> {
    this.writeChain = this.writeChain.then(async () => this.writeValues(undefined, id))
    return this.writeChain
  }

  private async writeValues(metadata?: SessionMetadata, removeId?: string): Promise<void> {
    const values = (await this.list()).filter(item => item.id !== removeId)
    if (metadata) {
      const index = values.findIndex(item => item.id === metadata.id)
      if (index < 0) values.push(metadata)
      else values[index] = metadata
    }
    await mkdir(dirname(this.file), { recursive: true })
    const temporary = `${this.file}.tmp`
    await writeFile(temporary, `${JSON.stringify(values)}\n`, { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, this.file)
  }
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}
