import test from 'node:test'
import assert from 'node:assert/strict'
import { FixedWindowRateLimiter } from '../src/rate-limit.js'

test('limits repeated login attempts and resets the window', () => {
  const limiter = new FixedWindowRateLimiter(2, 100)
  assert.equal(limiter.check('client', 0).allowed, true)
  assert.equal(limiter.check('client', 1).allowed, true)
  assert.equal(limiter.check('client', 2).allowed, false)
  assert.equal(limiter.check('client', 101).allowed, true)
})
