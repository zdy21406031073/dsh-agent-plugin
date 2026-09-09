import type { Json, RpcRequestHandler } from './protocol.js'

export type ApprovalRequest = { readonly id: string | number; readonly method: string; readonly params?: Json }
export type ApprovalDecision = { readonly decision: 'approve' | 'reject'; readonly value?: Json }
export type ApprovalPresenter = (request: ApprovalRequest) => Promise<ApprovalDecision>

/** Serializes Codex approval requests and delegates the decision to the host UI. */
export class ApprovalController {
  private readonly pending = new Map<string | number, Promise<ApprovalDecision>>()

  constructor(private readonly present: ApprovalPresenter, private readonly timeoutMs = 5 * 60_000) {}

  handle: RpcRequestHandler = async request => {
    if (this.pending.has(request.id)) throw new Error('Duplicate approval request id')
    const decision = this.withTimeout(this.present(request), this.timeoutMs)
    this.pending.set(request.id, decision)
    try {
      const result = await decision
      if (result.decision === 'approve') return result.value ?? { approved: true }
      return result.value ?? { approved: false }
    } finally {
      this.pending.delete(request.id)
    }
  }

  get pendingCount(): number { return this.pending.size }

  private async withTimeout(task: Promise<ApprovalDecision>, timeoutMs: number): Promise<ApprovalDecision> {
    let timer: NodeJS.Timeout | undefined
    try {
      return await Promise.race([
        task,
        new Promise<ApprovalDecision>((_, reject) => { timer = setTimeout(() => reject(new Error('Approval timed out')), timeoutMs) }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}
