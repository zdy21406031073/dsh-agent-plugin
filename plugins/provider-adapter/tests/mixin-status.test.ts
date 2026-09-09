import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectMixin } from '../src/mixin-status.js'

test('reports unavailable Mixin without exposing process errors', async () => {
  assert.deepEqual(await inspectMixin('dsh-codex-command-that-does-not-exist'), {
    available: false,
    error: 'Codex Mixin is unavailable or its diagnostic command failed',
  })
})
