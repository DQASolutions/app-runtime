// `LedgerStore` dựng trên cổng kho của kernel — KHÔNG dựng trên SQL thô.
//
// ⭐ SOI TRƯỚC KHI VIẾT, và soi ra hai điều:
//
//  ① `StorageAdapter` của kernel hướng THỰC THỂ *(insertInstance · updateInstance ·
//     queryInstances · queryEdges · withTransaction)*, không phải hướng bảng. Nên
//     tệp này nói bằng thực thể, và nhờ vậy chạy được trên MỌI adapter — bộ nhớ,
//     jsonb, bảng thật — chứ không riêng Postgres.
//
//  ② ⛔ Cổng ấy KHÔNG CÓ lệnh ghi có điều kiện. `updateInstance(id, patch)` ghi đè
//     vô điều kiện. Mà so-rồi-đặt là thứ `§C.2` dựa vào để chặn nguyên tử.
//
// ⚠️ KHÔNG GIẢ VỜ CÓ. Thiếu khả năng ấy thì `attach()` NÉM NGAY LÚC KHỞI ĐỘNG,
//    chứ không lặng lẽ tụt xuống "đọc rồi ghi" — vì lúc ấy mọi phép thử vẫn xanh
//    còn cái khe thì vẫn ở đó, và đó đúng là hình dạng lỗi ta đang đi chữa.
//
// 📌 Tiền lệ để đề nghị kernel: chính cổng ấy đã có `atomicDisableRule?` và
//    `insertRuleIfAbsent?` — hai thao tác nguyên tử được thêm vì cùng một lý do.
//    Đề nghị `Q4`: `compareAndSetInstance?(id, expected, patch, prov)`.

import { LedgerError, type AllocationRec, type AllocationState } from './types.js'
import type { LedgerStore, TargetRow, TargetState } from './store.js'
import type { Lens, AppRow } from './lens.js'

/** Chỉ đúng phần cổng kho mà gói này cần. Khai theo hình dạng để không phải phụ thuộc gói. */
export interface InstancePort {
  getInstance(id: string): Promise<{ id: string; data: Record<string, unknown> } | null>
  queryInstances(type: string, cond: unknown): Promise<Array<{ id: string; data: Record<string, unknown> }>>
  insertInstance(type: string, data: Record<string, unknown>, prov: unknown): Promise<{ id: string }>
  updateInstance(id: string, patch: Record<string, unknown>, prov: unknown): Promise<unknown>
  /** ⭐ Khả năng BẮT BUỘC với gói này — xem chú thích đầu tệp. */
  compareAndSetInstance?(
    id: string, expected: Record<string, unknown>, patch: Record<string, unknown>, prov: unknown,
  ): Promise<boolean>
}

export interface AttachOptions {
  targetType: string
  allocationType: string
  targetLens: Lens
  allocationLens: Lens
  /** Điều kiện lọc bản giao theo chỉ tiêu — app dựng, vì chỉ app biết cạnh của nó. */
  allocationsOf: (targetId: string) => unknown
  provenance: unknown
}

/**
 * Nối `LedgerStore` vào cổng kho. Ném ngay nếu adapter không so-rồi-đặt được.
 */
export function attach(port: InstancePort, o: AttachOptions): LedgerStore {
  if (typeof port.compareAndSetInstance !== 'function') {
    throw new LedgerError('BIND_INVALID',
      'Adapter không có `compareAndSetInstance` — sổ cái này KHÔNG chạy trên nó.\n'
      + 'Bảo toàn phải chặn nguyên tử; đọc-rồi-ghi để hở khe cho hai lệnh giao đồng thời.\n'
      + 'Xem docs/cascade-ledger-design.md §C.2, và đề nghị Q4 với nhóm kernel.')
  }
  const cas = port.compareAndSetInstance.bind(port)

  /**
   * ⭐ ID CỦA ENGINE KHÔNG NHẤT THIẾT LÀ ID CỦA KHO.
   *
   * Khi app ánh xạ vai ô `id` sang ô của mình *(`maLanGiao`)*, thì `g1` mà engine
   * cầm nằm trong MỘT Ô của bản ghi, còn kho tự sinh khoá riêng. Cập nhật thẳng
   * bằng `g1` là tìm một bản ghi không tồn tại.
   *
   * ⚠️ Lỗi này chỉ lộ khi chạy trên kho thật — bộ nhớ giả lập dùng chung một id
   *    nên mọi phép thử vẫn xanh. Ghi lại vì nó là hình dạng bẫy, không phải một
   *    lần gõ nhầm.
   */
  const storeId = async (kind: string, lens: Lens, id: string): Promise<string> => {
    const o = lens.field('id')
    // Không ánh xạ, hoặc ánh xạ vào chính `id`, thì id engine CHÍNH LÀ id kho —
    // không đi tra làm gì.
    if (!o || o === 'id') return id
    const rows = await port.queryInstances(kind, {
      op: 'compare', left: { kind: 'property', entity: kind, name: o },
      cmp: '=', right: { kind: 'literal', value: id },
    })
    if (rows.length === 0) {
      throw new LedgerError('BIND_INVALID', `Không tìm thấy ${kind} có ${o} = "${id}"`, id)
    }
    return rows[0].id
  }

  const readTarget = (i: { id: string; data: Record<string, unknown> }): TargetRow =>
    o.targetLens.readTarget({ ...i.data, id: i.id } as AppRow)

  return {
    async getTarget(id) {
      const i = await port.getInstance(id)
      return i ? readTarget(i) : undefined
    },

    async listAllocations(targetId) {
      const rows = await port.queryInstances(o.allocationType, o.allocationsOf(targetId))
      return rows.map((r) => o.allocationLens.readAllocation({ ...r.data, id: r.id } as AppRow))
    },

    // ⭐ Chỗ duy nhất trong gói cần tính nguyên tử. `expected` là phần còn lại ta
    //    đã đọc; ghi chỉ thành khi nó vẫn y nguyên.
    async compareAndSetRemaining(targetId, expected, next, state) {
      const patch: TargetRow = { remainingQty: next } as TargetRow
      if (state) (patch as { state?: TargetState }).state = state
      return cas(
        await storeId(o.targetType, o.targetLens, targetId),
        o.targetLens.writeTarget({ remainingQty: expected } as Partial<TargetRow>),
        o.targetLens.writeTarget(patch),
        o.provenance,
      )
    },

    async insertAllocation(a: AllocationRec) {
      await port.insertInstance(o.allocationType, o.allocationLens.writeAllocation(a), o.provenance)
    },

    async setAllocationState(id: string, state: AllocationState) {
      const saved = await storeId(o.allocationType, o.allocationLens, id)
      // Chỉ ghi ô trạng thái — không đụng số, không đụng chỗ nhận.
      const f = o.allocationLens.field('state')
      if (!f) return
      await port.updateInstance(saved, { [f]: o.allocationLens.toAppValue('state', state) }, o.provenance)
    },

    async setRevised(targetId, qty) {
      const saved = await storeId(o.targetType, o.targetLens, targetId)
      const patch = o.targetLens.writeTarget({ revisedQty: qty })
      if (Object.keys(patch).length === 0) return   // app không khai ô này → I3 đã tắt, không ghi bừa
      await port.updateInstance(saved, patch, o.provenance)
    },

    async markApproved(targetId, at) {
      const saved = await storeId(o.targetType, o.targetLens, targetId)
      const patch = o.targetLens.writeTarget({ approvedAt: at })
      if (Object.keys(patch).length === 0) return
      await port.updateInstance(saved, patch, o.provenance)
    },
  }
}
