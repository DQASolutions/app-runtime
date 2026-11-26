// Đăng ký thước — MỞ, nhưng có hình dạng. §C.4-bis.
//
// ⭐ CÂU HỎI ĐÃ ĐẺ RA TỆP NÀY: "cấp trên tạo mục tiêu cho cấp dưới là động hoàn
//    toàn, vậy đứng ở engine kiểm được gì?"
//
//    Trả lời: engine KHÔNG kiểm thước NÀO — nó kiểm thước có HÌNH DẠNG ĐÚNG
//    không. Một chỉ tiêu chưa ai nghĩ ra bao giờ vẫn bị bắt nếu khai sai hình
//    dạng, vì ba phép chấm dưới đây không cần biết một chữ nào của miền.

import { type Measure, type Violation, LedgerError } from './types.js'

const AGG = new Set(['sum', 'snapshot', 'ratio'])
const ALLOC = new Set(['divide', 'replicate'])
const SOURCE = new Set(['derived', 'reported'])

/**
 * Chấm hình dạng một thước. Trả về danh sách vi phạm — rỗng là đạt.
 *
 * Tách khỏi `defineMeasure` để bộ kiểm lúc khởi động chấm được CẢ RỔ thước và
 * báo hết một lượt, thay vì ném ở cái sai đầu tiên rồi bắt người sửa từng cái.
 */
export function checkMeasureShape(m: Measure): Violation[] {
  const v: Violation[] = []
  const bad = (message: string) => v.push({ code: 'MEASURE_SHAPE', subject: m.key, message })

  if (!m.key?.trim()) bad('Thước phải có khoá')
  if (!m.unit?.trim()) bad('Thước phải có đơn vị đo — không có đơn vị thì con số không nói được gì')
  if (!AGG.has(m.agg)) bad(`Phép gộp "${m.agg}" không có trong: sum · snapshot · ratio`)
  if (!ALLOC.has(m.allocation)) bad(`Kiểu giao "${m.allocation}" không có trong: divide · replicate`)
  if (!SOURCE.has(m.source)) bad(`Nguồn số "${m.source}" không có trong: derived · reported`)

  // ⛔ Tổ hợp vô nghĩa ①: chia một tỷ lệ.
  //    25% chia cho 12 tỉnh KHÔNG thành 2%. Một tỷ lệ giao xuống là RÀNG BUỘC
  //    mọi cấp phải đạt, nên nó chỉ đi được bằng `replicate`.
  if (m.agg === 'ratio' && m.allocation === 'divide') {
    bad('Thước tỷ lệ không chia xuống được — phải là `replicate`, vì mọi cấp cùng phải đạt')
  }

  // ⛔ Tổ hợp vô nghĩa ②: chỉ tiêu chết.
  //    `derived` mà không nêu loại bản ghi nào làm bằng chứng thì con số ấy
  //    KHÔNG BAO GIỜ lấy được — nó nằm ở 0 mãi mãi và trông y hệt "đã đo, chưa
  //    đạt gì". Bắt ở đây, không phải cuối kỳ.
  if (m.source === 'derived' && !(m.evidence?.length)) {
    v.push({
      code: 'DEAD_TARGET', subject: m.key,
      message: 'Thước đếm-từ-cạnh phải nêu ít nhất một loại bản ghi làm bằng chứng, '
        + 'nếu không thì số đạt không bao giờ lấy được',
    })
  }

  // Quy đổi phải nói rõ đổi từ đâu và bằng bao nhiêu — I10.
  if (m.derivedFrom) {
    const d = m.derivedFrom
    if (!d.from?.trim()) bad('Quy đổi phải nêu thước nguồn')
    if (!Number.isFinite(d.factor) || d.factor <= 0) bad('Hệ số quy đổi phải là số dương')
    if (!d.sourceRef?.trim()) bad('Quy đổi phải có căn cứ — đổi thước không căn cứ là làm hỏng phép gộp lên')
  }
  return v
}

/**
 * Chỗ cất thước. App hiện thực bằng thực thể của mình.
 *
 * ⭐ VÌ SAO PHẢI CÓ. Cả thiết kế dựa trên "thước truyền xuống cùng với số": Bộ
 *    định nghĩa một thước mới năm nay, và ba cấp dưới nhận nó như dữ liệu. Nếu
 *    sổ thước chỉ nằm trong bộ nhớ thì khởi động lại là mất — và mọi chỉ tiêu
 *    đang trỏ vào nó thành mồ côi mà không ai báo.
 */
export interface MeasurePort {
  saveMeasure(m: Measure): Promise<void>
  loadMeasures(): Promise<Measure[]>
}

/** Sổ thước. Chỉ-thêm: một thước đã dùng thì không sửa được, chỉ định nghĩa thước mới. */
export class MeasureRegistry {
  private readonly byKey = new Map<string, Measure>()

  /**
   * Cửa DUY NHẤT đẻ ra một thước. Ném ngay ở cái sai đầu tiên — đây là đường ghi,
   * khác với `checkMeasureShape` dùng cho bộ kiểm lúc khởi động.
   */
  define(m: Measure): Measure {
    const v = checkMeasureShape(m)
    if (v.length) throw new LedgerError(v[0].code, v[0].message, m.key)
    const old = this.byKey.get(m.key)
    if (old && JSON.stringify(old) !== JSON.stringify(m)) {
      throw new LedgerError('MEASURE_SHAPE',
        `Thước "${m.key}" đã có với hình dạng khác. Sửa một thước đang dùng là làm đổi ý nghĩa `
        + 'của mọi con số đã ghi theo nó — hãy định nghĩa một thước mới.', m.key)
    }
    this.byKey.set(m.key, m)
    return m
  }

  get(key: string): Measure | undefined { return this.byKey.get(key) }

  require(key: string): Measure {
    const m = this.byKey.get(key)
    if (!m) throw new LedgerError('MEASURE_UNKNOWN', `Chưa đăng ký thước "${key}"`, key)
    return m
  }

  keys(): string[] { return [...this.byKey.keys()] }

  /** Nạp lại nguyên sổ từ kho — dùng lúc khởi động. */
  static async load(port: MeasurePort): Promise<MeasureRegistry> {
    const reg = new MeasureRegistry()
    for (const m of await port.loadMeasures()) reg.define(m)
    return reg
  }

  /**
   * Cửa duy nhất đẻ ra một thước và GHI NÓ XUỐNG. Ghi trước, nhận vào sổ sau —
   * ghi hỏng thì sổ trong bộ nhớ không được phép nói là đã có.
   */
  async defineAndSave(port: MeasurePort, m: Measure): Promise<Measure> {
    const v = checkMeasureShape(m)
    if (v.length) throw new LedgerError(v[0].code, v[0].message, m.key)
    await port.saveMeasure(m)
    return this.define(m)
  }

  /**
   * Hai thước có cùng đo một thứ không — dùng cho I10.
   * Bằng nhau, hoặc con quy đổi từ cha bằng một phép có căn cứ.
   */
  commensurable(childKey: string, parentKey: string): boolean {
    if (childKey === parentKey) return true
    return this.byKey.get(childKey)?.derivedFrom?.from === parentKey
  }
}
