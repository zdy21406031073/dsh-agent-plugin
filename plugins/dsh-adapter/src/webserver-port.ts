import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'

export type HttpHandler = (request: IncomingMessage, response: ServerResponse) => void | Promise<void>
export type UpgradeHandler = (request: IncomingMessage, socket: Duplex, head: Buffer) => void | Promise<void>

/** Structural subset of DSH WebServer used by this adapter. */
export interface WebServerPort {
  register(route: { kind: 'exact' | 'prefix'; path: string; handler: HttpHandler }): () => void
  registerUpgrade(route: { path: string; handler: UpgradeHandler }): () => void
}
