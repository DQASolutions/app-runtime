// Đề xuất chỉ tiêu — cơ chế làm cho ĐO ĐƯỢC là đường dễ đi nhất. §C.4.5.
//
// ⭐ Người ta viết văn xuôi vì NGHĨ RA CON SỐ là việc nặng. Nên engine không bắt
//    nghĩ — nó đưa lại con số mà cấp ấy VỐN ĐÃ NỢ.
//
//    Nguồn mạnh nhất là lần giao vừa nhận: thước, số, hạn đều kế thừa nguyên vẹn,
//    nên lập chỉ tiêu từ việc NHẬP LIỆU thành việc XÁC NHẬN. Đó cũng là lần thứ
//    hai cạnh `fulfils` trả cổ tức — dựng nó để chấm I2, nhưng chính nó làm
//    được việc này.
//
// ⚠️ KHÔNG GHI GÌ. Hàm này thuần: trả về ứng viên, người quyết định nhận hay bỏ.
//    Máy đề xuất một chỉ tiêu là giúp việc; máy tự đặt chỉ tiêu là giành quyền.

import type { Measure } from './types.js'

export type Origin = 'allocation' | 'previous' | 'parameter'

export interface Candidate {
  measureKey: string
  baselineQty: number
  dueDate?: string | null
  periodKey?: string | null
  origin: Origin
  /** Có khi đến từ một lần giao — điền sẵn để nối `fulfils`, đóng I2 ngay. */
  fulfilsAllocationId?: string
  /** Câu người dùng đọc được: con số này ở đâu ra. */
  because: string
  /** Ứng viên từ lần giao là ĐỦ — bấm nhận, không phải gõ gì. */
  complete: boolean
}

export interface ProposeInput {
  /** Lần giao cấp trên vừa giao cho cấp này. */
  received?: ReadonlyArray<{ allocationId: string; measureKey: string; qty: number; dueDate?: string | null }>
  /** Chỉ tiêu chu kỳ trước của chính cấp này. */
  previous?: ReadonlyArray<{ measureKey: string; baselineQty: number | null; achievedQty?: number | null }>
  /** Định mức trong danh mục tham số, đã lọc theo ngày hiệu lực. */
  parameters?: ReadonlyArray<{ measureKey: string; qty: number; sourceRef: string }>
  periodKey?: string | null
  measures?: ReadonlyMap<string, Measure>
}

const RANK: Record<Origin, number> = { allocation: 3, previous: 2, parameter: 1 }

/**
 * Trả về ứng viên, mỗi thước một cái, nguồn mạnh nhất thắng.
 *
 * Thứ tự ưu tiên không tuỳ tiện: lần giao là NGHĨA VỤ, chu kỳ trước là THÓI QUEN,
 * tham số là MẶC ĐỊNH. Nghĩa vụ luôn thắng thói quen.
 */
export function proposeTargets(input: ProposeInput): Candidate[] {
  const best = new Map<string, Candidate>()
  const put = (c: Candidate) => {
    const old = best.get(c.measureKey)
    if (!old || RANK[c.origin] > RANK[old.origin]) best.set(c.measureKey, c)
  }

  for (const a of input.received ?? []) {
    put({
      measureKey: a.measureKey, baselineQty: a.qty, dueDate: a.dueDate ?? null,
      periodKey: input.periodKey ?? null, origin: 'allocation', fulfilsAllocationId: a.allocationId,
      because: `Cấp trên vừa giao ${a.qty} — nhận nguyên số này`, complete: true,
    })
  }

  for (const p of input.previous ?? []) {
    if (p.baselineQty === null) continue
    put({
      measureKey: p.measureKey, baselineQty: p.baselineQty, periodKey: input.periodKey ?? null,
      origin: 'previous',
      because: p.achievedQty === null || p.achievedQty === undefined
        ? `Chu kỳ trước đặt ${p.baselineQty}`
        : `Chu kỳ trước đặt ${p.baselineQty}, đạt ${p.achievedQty}`,
      complete: false,
    })
  }

  for (const p of input.parameters ?? []) {
    put({
      measureKey: p.measureKey, baselineQty: p.qty, periodKey: input.periodKey ?? null,
      origin: 'parameter', because: `Định mức theo ${p.sourceRef}`, complete: false,
    })
  }

  // ⛔ Thước `replicate` không chia được, nên ứng viên của nó phải giữ NGUYÊN số
  //    của cấp trên — không lấy số chu kỳ trước hay định mức đè lên.
  for (const [key, c] of best) {
    if (input.measures?.get(key)?.allocation === 'replicate' && c.origin !== 'allocation') {
      best.delete(key)
    }
  }
  return [...best.values()]
}
