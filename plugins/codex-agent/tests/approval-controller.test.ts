import test from 'node:test'
import assert from 'node:assert/strict'
import { ApprovalController } from '../src/approval-controller.js'

test('presents approval requests and removes them after decision', async () => {
  const controller = new ApprovalController(async request => {
    assert.equal(request.method, 'exec_approval')
    return { decision: 'approve', value: { approved: true } }
  })
  assert.deepEqual(await controller.handle({ jsonrpc: '2.0', id: 1, method: 'exec_approval' }), { approved: true })
  assert.equal(controller.pendingCount, 0)
})

test('times out an unanswered approval', async () => {
  const controller = new ApprovalController(() => new Promise(() => undefined), 5)
  await assert.rejects(async () => await controller.handle({ jsonrpc: '2.0', id: 1, method: 'approval' }), /timed out/)
  assert.equal(controller.pendingCount, 0)
})
