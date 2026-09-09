export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number }

/** Small in-memory fixed-window limiter for the single service login endpoint. */
export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, { startedAt: number; count: number }>()

  constructor(private readonly maxAttempts = 10, private readonly windowMs = 60_000, private readonly maxKeys = 1024) {
    if (![maxAttempts, windowMs, maxKeys].every(value => Number.isSafeInteger(value) && value > 0)) {
      throw new Error('Rate limits must be positive integers')
    }
  }

  check(key: string, now = Date.now()): RateLimitResult {
    for (const [id, window] of this.windows) {
      if (now - window.startedAt >= this.windowMs) this.windows.delete(id)
    }
    const current = this.windows.get(key)
    if (!current) {
      if (this.windows.size >= this.maxKeys) {
        return { allowed: false, retryAfterSeconds: Math.ceil(this.windowMs / 1000) }
      }
      this.windows.set(key, { startedAt: now, count: 1 })
      return { allowed: true, retryAfterSeconds: 0 }
    }
    if (current.count >= this.maxAttempts) return { allowed: false, retryAfterSeconds: Math.ceil((this.windowMs - (now - current.startedAt)) / 1000) }
    current.count += 1
    return { allowed: true, retryAfterSeconds: 0 }
  }
}
