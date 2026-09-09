import { ProxyAgent, fetch } from 'undici'

export type ProxySettings = { readonly proxyUrl: string; readonly timeoutMs?: number }

/** Performs server-side HTTP(S) fetches through the configured proxy. */
export async function fetchThroughProxy(url: string, settings: ProxySettings, signal?: AbortSignal): Promise<{ status: number; headers: Headers; body: string }> {
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP(S) URLs are supported')
  const timeout = settings.timeoutMs ?? 30_000
  if (!Number.isSafeInteger(timeout) || timeout <= 0) throw new Error('Proxy timeout must be positive')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const response = await fetch(parsed, { dispatcher: new ProxyAgent(settings.proxyUrl), signal: controller.signal })
    return { status: response.status, headers: response.headers, body: await response.text() }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
