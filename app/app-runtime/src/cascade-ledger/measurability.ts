// Đo được — §C.4. Ba điều kiện (I8) và lời khai theo LOẠI (I9).
//
// ⭐ BÀI TOÁN KHÔNG PHẢI "ÉP ĐO". Luật có thật đẻ ra văn bản không đo được: quy
//    chế phối hợp là văn kiện — hiệu lực chứ không tiến độ. Ép đo là bắt cán bộ
//    bịa chỉ tiêu. Bài toán là: làm cho đo được là đường dễ đi nhất, và làm cho
//    KHÔNG-ĐO-ĐƯỢC KHÔNG THỂ IM LẶNG.

import {
  type DocTypeExpectation, type Grade, type MeasurabilityDecl, type Measure,
  type TargetRec, type Violation, GRADE_RANK,
} from './types.js'

/**
 * I8 — "đo được" có BA điều kiện, không phải một. Khai một con số chưa phải là
 * đo được.
 *
 * ⛔ Thiếu điều kiện ② là bệnh nguy hiểm nhất: chỉ tiêu khai đủ số, đếm-từ-cạnh,
 *    mà không loại bản ghi nào trỏ về nó được. Nó nằm ở 0 mãi mãi và trông y hệt
 *    "đã đo, chưa đạt gì" — cán bộ đi tìm việc chưa làm mà không có việc nào.
 */
export function checkTargetMeasurable(
  t: TargetRec, m: Measure | undefined, boundEvidence: ReadonlySet<string>,
): Violation[] {
  const v: Violation[] = []
  // ① có thước
  if (!m) {
    v.push({ code: 'MEASURE_UNKNOWN', subject: t.id, message: `Chỉ tiêu trỏ vào thước "${t.measureKey}" chưa đăng ký` })
    return v
  }
  // ② có đường lấy số
  if (m.source === 'derived') {
    const reachable = (m.evidence ?? []).filter((e) => boundEvidence.has(e))
    if (reachable.length === 0) {
      v.push({
        code: 'DEAD_TARGET', subject: t.id,
        message: `Chỉ tiêu đo bằng cách đếm bản ghi, nhưng không loại bản ghi nào được nối vào nó `
          + `(thước "${m.key}" cần: ${(m.evidence ?? []).join(', ') || 'chưa nêu'}). Số đạt sẽ mãi bằng 0.`,
      })
    }
  }
  // ③ có mốc chốt
  if (!t.periodKey && !t.dueDate) {
    v.push({
      code: 'DEAD_TARGET', subject: t.id,
      message: 'Chỉ tiêu không thuộc kỳ nào và không có hạn — không có lúc nào để chốt xem đạt hay chưa',
    })
  }
  return v
}

/**
 * I9 — bậc đo khai theo LOẠI văn bản.
 *
 * ⭐ Khai đúng loại thì KHÔNG MA SÁT: một quy chế phối hợp khai `narrative` không
 *    bị hỏi một câu nào. Chỉ bản khai THẤP HƠN loại của nó mới phải có lý do,
 *    người duyệt và hạn xem lại. Nhờ vậy văn xuôi hợp pháp đi thẳng, còn văn xuôi
 *    né việc phải có người ký tên.
 */
export function checkDeclaration(
  subjectId: string, docType: string, decl: MeasurabilityDecl | undefined,
  catalogue: Readonly<Record<string, DocTypeExpectation>>,
): Violation[] {
  const expected = catalogue[docType]
  if (!expected) {
    return [{ code: 'NOT_MEASURABLE', subject: subjectId,
      message: `Loại "${docType}" chưa có trong danh mục bậc đo — danh mục loại văn bản là ĐÓNG, phải khai trước` }]
  }
  if (!decl) {
    return [{ code: 'NOT_MEASURABLE', subject: subjectId,
      message: `Chưa khai bậc đo. Loại "${docType}" đáng lẽ đạt bậc "${expected.expects}"` }]
  }
  if (GRADE_RANK[decl.grade] >= GRADE_RANK[expected.expects]) return []

  // Khai thấp hơn loại → ngoại lệ, phải đủ ba thứ.
  const missing: string[] = []
  if (!decl.reason?.trim()) missing.push('lý do')
  if (!decl.approvedBy?.trim()) missing.push('người duyệt')
  if (!decl.reviewBy?.trim()) missing.push('hạn xem lại')
  if (!missing.length) return []
  return [{ code: 'NOT_MEASURABLE', subject: subjectId,
    message: `Khai bậc "${decl.grade}" thấp hơn bậc "${expected.expects}" của loại "${docType}" — `
      + `ngoại lệ này thiếu: ${missing.join(', ')}` }]
}

export type Conversion = 'converted' | 'passthrough' | 'downgraded' | 'ok'

/**
 * ⭐ Nơi VĂN XUÔI BIẾN THÀNH SỐ — §C.4.6.
 *
 * Trục dọc có giá trị nhất ở chỗ này: một chỉ thị "tăng cường công tác…" là
 * văn xuôi, và cấp dưới đáp lại PHẢI biến nó thành người, đợt, mốc. Hàm này
 * chấm xem việc ấy có xảy ra không — và vì nó ra một con số nên chính nó có
 * thể thành một chỉ tiêu.
 */
export function classifyConversion(mandate: Grade, commitment: Grade): Conversion {
  if (mandate === 'narrative' && commitment === 'narrative') return 'passthrough'
  if (mandate === 'narrative') return 'converted'
  if (GRADE_RANK[commitment] < GRADE_RANK[mandate]) return 'downgraded'
  return 'ok'
}

export interface MeasurabilityReport {
  measurable: number
  narrative: number
  /** Số lần cấp này nhận văn xuôi và trả lại văn xuôi — không thêm gì đo được. */
  passthrough: number
  /** Trên giao số mà dưới không nhận số. */
  downgraded: number
  exceptions: Array<{ subject: string; grade: Grade; approvedBy?: string; reviewBy?: string }>
  /** Ngoại lệ đã quá hạn xem lại — miễn đo là giấy phép có thời hạn. */
  expired: string[]
}

export interface WorkItem {
  subject: string
  reason: string
  /** Câu cán bộ đọc được, nói rõ phải làm gì. */
  todo: string
  dueAt: string
}

/**
 * ⭐ Miễn đo là GIẤY PHÉP CÓ THỜI HẠN, không phải một trạng thái vĩnh viễn.
 *
 * Tới hạn thì hồ sơ quay lại hàng việc. Không có bước này thì "chưa đo được" chỉ
 * tích lại, và sau vài năm không ai còn nhớ vì sao một bản kế hoạch được miễn.
 *
 * ⚠️ Hàm thuần, trả về việc. Đặt lịch chạy là của app *(`@dqa-ai-solutions/agent-os`)* —
 *    pack không tự mọc một bộ hẹn giờ thứ hai.
 */
export function overdueExemptions(
  rows: ReadonlyArray<{ subject: string; decl?: MeasurabilityDecl }>, asOf: string,
): WorkItem[] {
  return rows
    .filter((r) => r.decl?.reviewBy && r.decl.reviewBy < asOf && r.decl.grade === 'narrative')
    .map((r) => ({
      subject: r.subject,
      reason: r.decl!.reason ?? '',
      todo: 'Hết hạn miễn đo — bổ sung chỉ tiêu hoặc mốc, hoặc xin gia hạn có người duyệt',
      dueAt: r.decl!.reviewBy!,
    }))
}

export function report(
  rows: ReadonlyArray<{ subject: string; mandate?: Grade; commitment: Grade; decl?: MeasurabilityDecl }>,
  asOf: string,
): MeasurabilityReport {
  const r: MeasurabilityReport = {
    measurable: 0, narrative: 0, passthrough: 0, downgraded: 0, exceptions: [], expired: [],
  }
  for (const row of rows) {
    if (row.commitment === 'narrative') r.narrative++
    else r.measurable++
    if (row.mandate) {
      const c = classifyConversion(row.mandate, row.commitment)
      if (c === 'passthrough') r.passthrough++
      if (c === 'downgraded') r.downgraded++
    }
    if (row.decl?.reason) {
      r.exceptions.push({
        subject: row.subject, grade: row.decl.grade,
        approvedBy: row.decl.approvedBy, reviewBy: row.decl.reviewBy,
      })
      if (row.decl.reviewBy && row.decl.reviewBy < asOf) r.expired.push(row.subject)
    }
  }
  return r
}
