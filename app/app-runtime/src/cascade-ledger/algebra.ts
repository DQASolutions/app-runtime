// Đại số đại lượng — §C.0. Hàm thuần, không đọc kho.
//
// ⚠️ VÌ SAO TÁCH RA HÀM THUẦN: guard chặn phải chạy TRONG giao dịch ghi, mà
//    tầng ghi cố ý không có hàm đọc kho. Nên phép tính phải nhận dữ liệu vào
//    tay chứ không tự đi lấy. Đây cũng là điều kiện để `remaining` trừ được
//    nguyên tử — xem `plan(...)` ở dưới.

import type { ActualRec } from './store.js'
import {
  type AllocationRec, type Basis, type Measure, type TargetRec,
  COUNTED_STATES, LedgerError,
} from './types.js'

const counted = (a: AllocationRec) => COUNTED_STATES.includes(a.state)

/** Nền có hiệu lực. `basis` KHÔNG có mặc định — bắt buộc gọi phải nói ra. */
export function effectiveQty(t: TargetRec, basis: Basis): number {
  if (basis !== 'baseline' && basis !== 'revised') {
    throw new LedgerError('NO_BASIS',
      'Phải khai đọc trên nền nào: `baseline` (số giao ban đầu) hay `revised` (số sau điều chỉnh)', t.id)
  }
  if (basis === 'baseline') return t.baselineQty ?? 0
  return t.revisedQty ?? t.baselineQty ?? 0
}

/** Tổng đã giao xuống — bản `RETURNED` KHÔNG tính. */
export function allocatedQty(allocations: readonly AllocationRec[]): number {
  return allocations.filter(counted).reduce((s, a) => s + a.qty, 0)
}

/**
 * Phần còn lại.
 *
 * ⭐ Trả `null` khi thước là `replicate` — và đó KHÔNG phải 0. Một ràng buộc
 *    truyền xuống không tiêu thụ gì cả, nên "còn lại bao nhiêu" là câu hỏi
 *    không có nghĩa. Hiện 0 lên màn hình là nói dối rằng đã chia hết.
 */
export function remainingQty(
  t: TargetRec, m: Measure, allocations: readonly AllocationRec[], basis: Basis,
): number | null {
  if (m.allocation === 'replicate') return null
  return effectiveQty(t, basis) - allocatedQty(allocations)
}

export interface AllocationPlan {
  /** Giá trị `remainingQty` phải ghi xuống sau khi giao — trừ trong CÙNG giao dịch. */
  nextRemaining: number | null
  delta: number
}

/**
 * Tính trước một lần giao, và chặn nếu vượt.
 *
 * ⭐ TRẢ VỀ SỐ PHẢI GHI, KHÔNG CHỈ TRẢ ĐÚNG/SAI. Đó là chỗ khác nhau giữa
 *    "kiểm rồi mới ghi" và "chặn nguyên tử": bên gọi lấy `nextRemaining` ghi
 *    thẳng trong cùng giao dịch, cùng với việc tạo bản giao. Cơ sở dữ liệu giữ
 *    `CHECK (remaining_qty >= 0)` làm hàng rào cuối.
 */
export function plan(
  t: TargetRec, m: Measure, allocations: readonly AllocationRec[], qty: number,
  basis: Basis, opts: { allowOverAllocation?: boolean } = {},
): AllocationPlan {
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new LedgerError('OVER_DELEGATED', 'Số giao phải là một số dương', t.id)
  }
  if (m.allocation === 'replicate') {
    // Truyền ràng buộc: không đụng tới phần còn lại, và `qty` phải đúng bằng số của cha.
    if (qty !== effectiveQty(t, basis)) {
      throw new LedgerError('REPLICATE_NOT_DIVIDED',
        `Thước "${m.key}" truyền xuống nguyên vẹn (${effectiveQty(t, basis)} ${m.unit}), không chia nhỏ`, t.id)
    }
    return { nextRemaining: null, delta: 0 }
  }
  const rem = effectiveQty(t, basis) - allocatedQty(allocations)
  const next = rem - qty
  if (next < 0 && !opts.allowOverAllocation) {
    throw new LedgerError('OVER_DELEGATED',
      `Chia quá số được giao: còn ${rem} ${m.unit}, đang chia ${qty} ${m.unit}`, t.id)
  }
  return { nextRemaining: next, delta: -qty }
}

/** Trả lại một bản đã giao — cộng ngược, cùng giao dịch với việc trả. */
export function planReturn(
  t: TargetRec, m: Measure, allocations: readonly AllocationRec[], a: AllocationRec, basis: Basis,
): AllocationPlan {
  if (m.allocation === 'replicate') return { nextRemaining: null, delta: 0 }
  if (a.state === 'RETURNED') return { nextRemaining: remainingQty(t, m, allocations, basis), delta: 0 }
  const rem = effectiveQty(t, basis) - allocatedQty(allocations)
  return { nextRemaining: rem + a.qty, delta: a.qty }
}

export interface RevisePlan { nextRemaining: number | null; overCommitted: boolean }

/**
 * Điều chỉnh chỉ tiêu giữa kỳ — §C.5.
 *
 * ⚠️ KHÔNG ném khi nền mới thấp hơn phần đã chia. Cắt chỉ tiêu giữa năm là lệnh
 *    của cấp trên; từ chối là làm cán bộ không thi hành được. Engine đặt cờ
 *    `overCommitted` để phần âm HIỆN RA như một việc phải xử — thu hồi của ai
 *    là quyết định của người, không phải phép chia của máy.
 */
export function planRevise(
  t: TargetRec, m: Measure, allocations: readonly AllocationRec[], newQty: number,
): RevisePlan {
  if (!Number.isFinite(newQty) || newQty < 0) {
    throw new LedgerError('OVER_COMMITTED', 'Số điều chỉnh phải là số không âm', t.id)
  }
  if (m.allocation === 'replicate') return { nextRemaining: null, overCommitted: false }
  const next = newQty - allocatedQty(allocations)
  return { nextRemaining: next, overCommitted: next < 0 }
}

export interface Rollup { achieved: number | null; note?: string }

/**
 * Tổng số đã báo của một chỉ tiêu — vế `ownEvidence` cho thước `reported`.
 *
 * ⭐ MỘT KỲ MỘT SỐ. Báo hai lần cho cùng một kỳ mà bản cũ chưa bị thay là đọc
 *    hai lần; app chặn ở cổng ghi, còn ở đây pack lấy bản CUỐI của mỗi kỳ để
 *    một sổ lỡ có hai bản vẫn không cộng đôi. Thứ tự trong mảng là thứ tự app
 *    trả về, nên app trả theo thời gian ghi.
 *
 * ⛔ Thước `derived` KHÔNG đi qua đây — số của nó đếm từ cạnh, và pack không
 *    biết cạnh nào. Gọi nhầm thì ném, chứ không lặng lẽ trả 0.
 */
export function reportedTotal(m: Measure, actuals: readonly ActualRec[]): number {
  if (m.source !== 'reported') {
    throw new LedgerError('DEAD_TARGET',
      `Thước "${m.key}" đếm từ bản ghi thật — không cộng từ số báo được`, m.key)
  }
  const latestOfPeriod = new Map<string, number>()
  for (const a of actuals) latestOfPeriod.set(a.periodKey, a.qty)
  let total = 0
  for (const q of latestOfPeriod.values()) total += q
  return total
}

/**
 * Gộp số đạt: bằng chứng nối THẲNG vào chỉ tiêu này, cộng số đạt của các chỉ
 * tiêu con — I7, không đếm lại bằng chứng của cấp dưới.
 *
 * ⛔ Trả `null` cho thước `ratio`: cộng tỷ lệ là bịa ra một phép cộng không có
 *    nghĩa. Trả `null` chứ không trả 0 — hai thứ khác hẳn nhau trên màn hình.
 */
export function rollup(m: Measure, ownEvidence: number, childAchieved: readonly (number | null)[]): Rollup {
  if (m.agg === 'ratio') {
    return { achieved: null, note: 'Thước tỷ lệ không gộp được — đọc từng cấp một' }
  }
  const kids = childAchieved.filter((n): n is number => n !== null)
  if (m.agg === 'snapshot') {
    // Số cuối kỳ: cộng ngang giữa các đơn vị được, nhưng KHÔNG cộng dồn qua kỳ.
    return { achieved: ownEvidence + kids.reduce((s, n) => s + n, 0), note: 'Số cuối kỳ — không cộng dồn qua các kỳ' }
  }
  return { achieved: ownEvidence + kids.reduce((s, n) => s + n, 0) }
}
