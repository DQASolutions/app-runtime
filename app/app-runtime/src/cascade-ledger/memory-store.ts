// Kho trong bộ nhớ — bản tham chiếu, và là bộ đo tính đúng của tầng Action.
//
// ⭐ CÓ MỘT MÓC "CHEN NGANG" (`onBeforeWrite`) CỐ Ý. Không có nó thì không phép
//    thử nào chứng minh được rằng chặn là NGUYÊN TỬ — chạy tuần tự thì mọi cách
//    hiện thực đều xanh, kể cả cách để hở khe. Móc này cho phép dựng lại đúng
//    tình huống hai cán bộ bấm nút cùng lúc, một cách xác định, không cần đua thật.

import type { AllocationRec, AllocationState } from './types.js'
import type { ActualRec, LedgerStore, TargetRow, TargetState } from './store.js'

export class MemoryStore implements LedgerStore {
  readonly targets = new Map<string, TargetRow>()
  readonly allocations = new Map<string, AllocationRec>()
  /** Gọi ngay TRƯỚC mỗi lần so-rồi-đặt — chỗ để phép thử chen một lệnh ghi khác vào. */
  onBeforeWrite?: (targetId: string) => Promise<void> | void

  constructor(targets: TargetRow[] = [], allocations: AllocationRec[] = []) {
    for (const t of targets) this.targets.set(t.id, { ...t })
    for (const a of allocations) this.allocations.set(a.id, { ...a })
  }

  /** Số đã báo — bản tham chiếu cho lối `reported`. Thêm 5/9/2026 cùng `listActuals`. */
  readonly actuals: ActualRec[] = []

  async getTarget(id: string) { const t = this.targets.get(id); return t ? { ...t } : undefined }

  async insertActual(a: ActualRec) { this.actuals.push({ ...a }) }

  /* ⭐ Trả theo ĐÚNG THỨ TỰ GHI. `reportedTotal` lấy bản cuối của mỗi kỳ, nên
     thứ tự không phải chuyện tuỳ tiện — một adapter trả lộn xộn là cộng ra số
     của bản cũ. Nói ra ở đây để bản tham chiếu cũng là bản mô tả hợp đồng. */
  async listActuals(targetId: string, periodKey?: string) {
    return this.actuals
      .filter((a) => a.targetId === targetId && (periodKey === undefined || a.periodKey === periodKey))
      .map((a) => ({ ...a }))
  }

  async listAllocations(targetId: string) {
    return [...this.allocations.values()].filter((a) => a.targetId === targetId).map((a) => ({ ...a }))
  }

  async compareAndSetRemaining(
    targetId: string, expected: number | null, next: number | null, state?: TargetState,
  ) {
    await this.onBeforeWrite?.(targetId)
    const t = this.targets.get(targetId)
    if (!t) return false
    // `!==` là đúng ở đây: cả hai đầu đều là `number | null`, và `null !== null`
    // là false — tức thước `replicate` so sánh được bình thường.
    if (t.remainingQty !== expected) return false
    t.remainingQty = next
    if (state) t.state = state
    return true
  }

  async insertAllocation(a: AllocationRec) { this.allocations.set(a.id, { ...a }) }

  async setAllocationState(id: string, state: AllocationState) {
    const a = this.allocations.get(id)
    if (a) a.state = state
  }

  async setRevised(targetId: string, qty: number) {
    const t = this.targets.get(targetId)
    if (t) t.revisedQty = qty
  }

  async markApproved(targetId: string, at: string) {
    const t = this.targets.get(targetId)
    if (t) { t.approvedAt = at; if (t.state === 'DRAFT') t.state = 'OK' }
  }
}
