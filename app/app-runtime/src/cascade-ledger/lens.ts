// Thấu kính — chỗ DUY NHẤT trong gói này biết ô của app tên gì. §M.
//
// ⭐ Bỏ tệp này đi thì `allocate()` buộc phải biết `assignedQty` là gì, và lúc
//    ấy engine chỉ dùng được cho đúng một app.
//
// ⚠️ Engine mù với ba mươi ô khác của app KHÔNG PHẢI vì có hàng rào chặn — mà
//    vì không có dòng nào ở đây đọc chúng. Đó là lý do app thêm ô mới bao nhiêu
//    cũng không bao giờ làm engine gãy.

import type { RoleLens } from './contract.js'
import type { TargetRec, AllocationRec, AllocationState } from './types.js'
import type { ActualRec, TargetRow, TargetState } from './store.js'

/** Một hàng thô đọc từ kho của app. Engine không biết nó có bao nhiêu khoá. */
export type AppRow = Record<string, unknown>

const num = (v: unknown): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v)

export class Lens {
  /** Bảng tra ngược, dựng một lần lúc khởi động: giá trị app → giá trị engine. */
  private readonly back = new Map<string, Map<string, string>>()

  constructor(private readonly map: RoleLens) {
    for (const [slot, pairs] of Object.entries(map.values ?? {})) {
      const m = new Map<string, string>()
      for (const [engineValue, appValue] of Object.entries(pairs)) {
        for (const v of Array.isArray(appValue) ? appValue : [appValue]) m.set(v, engineValue)
      }
      this.back.set(slot, m)
    }
  }

  /** Tên ô của app cho một vai ô. */
  field(slot: string): string | undefined { return this.map.fields[slot] }

  /** app → engine. Không khai ánh xạ giá trị thì để nguyên. */
  toEngineValue(slot: string, v: unknown): string {
    const s = String(v ?? '')
    return this.back.get(slot)?.get(s) ?? s
  }

  /**
   * engine → app. Nhiều-về-một thì lấy giá trị ĐẦU danh sách.
   *
   * ⚠️ Ghi bằng giá trị không chuẩn tắc là đọc lên sẽ ra một trạng thái khác —
   *    nên chỉ có đúng một giá trị được phép ghi cho mỗi trạng thái engine.
   */
  toAppValue(slot: string, v: unknown): unknown {
    const pair = this.map.values?.[slot]?.[String(v)]
    if (pair === undefined) return v
    return Array.isArray(pair) ? pair[0] : pair
  }

  // ── Target ────────────────────────────────────────────────────────────────

  readTarget(row: AppRow): TargetRow {
    const f = this.map.fields
    return {
      id: String(row[f.id ?? 'id']),
      measureKey: String(row[f.measure] ?? ''),
      baselineQty: num(row[f.baselineQty]),
      revisedQty: f.revisedQty ? num(row[f.revisedQty]) : null,
      remainingQty: f.remainingQty ? num(row[f.remainingQty]) : null,
      state: (f.state ? this.toEngineValue('state', row[f.state]) : 'OK') as TargetState,
      periodKey: f.period ? (row[f.period] as string) ?? null : null,
      dueDate: f.dueDate ? (row[f.dueDate] as string) ?? null : null,
      selfExecuted: f.selfExecuted
        ? this.toEngineValue('selfExecuted', row[f.selfExecuted]) === 'yes'
        : undefined,
      fulfilsAllocationId: f.fulfils ? (row[f.fulfils] as string) ?? null : null,
      approvedAt: f.approvedAt ? (row[f.approvedAt] as string) ?? null : null,
    }
    // row.provinceCode, row.priorityLevel, row.ownerRole… KHÔNG được đọc.
  }

  /** Chỉ những ô engine thật sự muốn ghi — không đụng gì khác trên hàng. */
  writeTarget(patch: Partial<TargetRow>): AppRow {
    const out: AppRow = {}
    for (const [slot, v] of Object.entries(patch)) {
      const key = this.map.fields[slot === 'measureKey' ? 'measure' : slot]
      if (!key) continue          // vai ô app không khai → engine không ghi
      out[key] = slot === 'state' || slot === 'selfExecuted' ? this.toAppValue(slot, v) : v
    }
    return out
  }

  // ── Allocation ────────────────────────────────────────────────────────────

  readAllocation(row: AppRow): AllocationRec {
    const f = this.map.fields
    return {
      id: String(row[f.id ?? 'id']),
      targetId: String(row[f.target ?? 'targetId'] ?? ''),
      toUnitId: String(row[f.toUnit ?? 'toUnitId'] ?? ''),
      qty: Number(row[f.qty] ?? 0),
      state: this.toEngineValue('state', row[f.state]) as AllocationState,
    }
  }

  writeAllocation(a: AllocationRec): AppRow {
    const f = this.map.fields
    const out: AppRow = { [f.id ?? 'id']: a.id, [f.qty]: a.qty, [f.state]: this.toAppValue('state', a.state) }
    if (f.target) out[f.target] = a.targetId
    if (f.toUnit) out[f.toUnit] = a.toUnitId
    return out
  }

  // ── Actual ────────────────────────────────────────────────────────────────
  //
  // ⭐ Thêm 5/9/2026 cùng `SLOTS.Actual`. Không có hai hàm này thì app khai được
  //    vai `Actual` mà vẫn phải tự dịch tên ô — tức là vẫn giữ một bản sao của
  //    thấu kính, đúng thứ tệp này sinh ra để bỏ.

  readActual(row: AppRow): ActualRec {
    const f = this.map.fields
    return {
      id: String(row[f.id ?? 'id']),
      targetId: String(row[f.target ?? 'targetId'] ?? ''),
      unitId: String(row[f.unit ?? 'unitId'] ?? ''),
      periodKey: String(row[f.period ?? 'periodKey'] ?? ''),
      qty: Number(row[f.qty] ?? 0),
      evidenceRef: String(row[f.evidenceRef] ?? ''),
    }
  }

  writeActual(a: ActualRec): AppRow {
    const f = this.map.fields
    const out: AppRow = {
      [f.id ?? 'id']: a.id,
      [f.qty]: a.qty,
      [f.evidenceRef]: a.evidenceRef,
    }
    if (f.target) out[f.target] = a.targetId
    if (f.unit) out[f.unit] = a.unitId
    if (f.period) out[f.period] = a.periodKey
    return out
  }
}

/** Bộ thấu kính của cả app, một cái cho mỗi vai. */
export type LensSet = Partial<Record<string, Lens>>
