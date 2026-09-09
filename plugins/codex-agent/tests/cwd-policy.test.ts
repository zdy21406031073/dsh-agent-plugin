import test from 'node:test'
import assert from 'node:assert/strict'
import { CwdPolicy } from '../src/cwd-policy.js'

test('accepts roots and descendants but rejects traversal siblings', () => {
  const policy = new CwdPolicy(['/srv/work'])
  assert.equal(policy.resolve('/srv/work/project/../project'), '/srv/work/project')
  assert.throws(() => policy.resolve('/srv/work-other'), /outside allowed roots/)
  assert.throws(() => policy.resolve('relative'), /must be absolute/)
})
