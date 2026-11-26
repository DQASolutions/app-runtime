// Tiền bám chỉ tiêu — I6. Phần DÒ, không phải phần chặn.
//
// ⚠️ KHÔNG dựng lại bộ gộp. Kernel đã có `RULE_KINDS.AGGREGATE` với
//    `groupBy · sum · cmp · threshold`; luật "tổng chi của một chỉ tiêu vượt
//    ngưỡng" khai bằng dữ liệu ở đó. Tệp này chỉ giữ phần kernel KHÔNG có: nối
//    dòng tiền về chỉ tiêu, và đọc chênh lệch trên cùng một nền.

import type { Violation } from './types.js'

export interface FundingRec {
  id: string
  /** `null` = dòng tiền chưa nối về chỉ tiêu nào — đúng chỗ I6 kêu. */
  targetId: string | null
  proposed: number | null
  approved: number | null
}

export interface FundingSummary {
  targetId: string
  proposed: number
  approved: number
  /** Được duyệt trừ đề xuất. Âm là bị cắt. */
  variance: number
  lines: number
}

export function fundingSummary(targetId: string, lines: readonly FundingRec[]): FundingSummary {
  const mine = lines.filter((l) => l.targetId === targetId)
  const proposed = mine.reduce((s, l) => s + (l.proposed ?? 0), 0)
  const approved = mine.reduce((s, l) => s + (l.approved ?? 0), 0)
  return { targetId, proposed, approved, variance: approved - proposed, lines: mine.length }
}

/**
 * I6 — mọi dòng tiền phải trỏ về một chỉ tiêu.
 *
 * ⚠️ Có miền miễn trừ hợp lệ: một dự toán năm gộp MỌI nhiệm vụ thì tự nó là kế
 *    hoạch, không có chỉ tiêu riêng để trỏ về. Nên `exempt` là danh sách khai
 *    rõ, không phải một cửa mở sẵn.
 */
export function checkFundingLinked(
  lines: readonly FundingRec[], exempt: ReadonlySet<string> = new Set(),
): Violation[] {
  return lines
    .filter((l) => l.targetId === null && !exempt.has(l.id))
    .map((l) => ({ code: 'ORPHAN_TARGET' as const, subject: l.id,
      message: 'Dòng chi chưa nối về chỉ tiêu nào — không trả lời được "tiền này chi cho việc nào trên giao"' }))
}
