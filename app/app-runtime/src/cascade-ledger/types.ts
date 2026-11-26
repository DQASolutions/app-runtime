// Từ vựng của cascade-ledger. Thuần TypeScript — không I/O, không phụ thuộc hạ tầng,
// KHÔNG một từ nào của miền nghiệp vụ (không "kế hoạch", không "chỉ tiêu nhân lực").
//
// ⭐ Nguyên tắc chi phối cả tệp: pack khai VAI, app giữ TỪ VỰNG. Không chỗ nào ở
//    đây được biết `PlanTarget` là gì — nó chỉ biết có một thực thể đóng vai `Target`.
//    Xem docs/cascade-ledger-design.md §D.

/** Bảy vai app phải bind + bốn vai pack tự cấp. */
export const ROLES = [
  'Unit', 'Mandate', 'Commitment', 'Target', 'Allocation', 'Actual', 'FundingLine',
] as const
export type Role = (typeof ROLES)[number]

// ── Thước đo (§C.4-bis) ─────────────────────────────────────────────────────

/**
 * Phép gộp của một thước.
 *
 * ⚠️ `ratio` KHÔNG phải "số có đơn vị %". Nó là lời khẳng định *phép cộng trên
 *    thước này vô nghĩa*. Ba mươi phần trăm cộng bốn mươi phần trăm không phải
 *    bảy mươi phần trăm, và không có ngữ cảnh nào làm nó đúng.
 */
export type Agg = 'sum' | 'snapshot' | 'ratio'

/**
 * Giao xuống theo kiểu nào.
 *
 * ⭐ `divide` TIÊU THỤ phần còn lại của cha; `replicate` thì KHÔNG — nó truyền
 *    một ràng buộc xuống mọi con. "600 người chia cho 12 tỉnh" là divide; "mọi
 *    tỉnh phải đạt ≥25%" là replicate. Trộn hai cái là chỗ hỏng đã ghi ở
 *    fit-log §M F1.
 */
export type Allocation = 'divide' | 'replicate'

/** Số đạt lấy ở đâu: đếm cạnh bằng chứng, hay do người ghi theo kỳ. */
export type Source = 'derived' | 'reported'

/**
 * Một thước. Đăng ký MỞ: tạo được lúc chạy bởi cấp GIAO, không khai trước trong
 * cấu hình — vì mục tiêu cấp trên đặt ra là động. Engine không chấm thước NÀO,
 * engine chấm thước có HÌNH DẠNG ĐÚNG không (§C.4-bis.2).
 */
export interface Measure {
  key: string
  unit: string
  agg: Agg
  allocation: Allocation
  source: Source
  /** Bắt buộc khi `source: derived` — tên các vai cạnh bằng chứng. Rỗng ⇒ chỉ tiêu chết. */
  evidence?: readonly string[]
  /** Văn bản đẻ ra thước này. Kernel đóng dấu provenance; đây là dẫn chiếu người đọc được. */
  sourceRef?: string
  /** Quy đổi từ thước khác — cách DUY NHẤT để đổi thước dọc trục (I10). */
  derivedFrom?: { from: string; factor: number; sourceRef: string }
}

// ── Bậc đo (§C.4.2) ─────────────────────────────────────────────────────────

/** Ba bậc, xếp từ mạnh xuống yếu. So sánh bằng `GRADE_RANK`. */
export type Grade = 'quantitative' | 'milestone' | 'narrative'
export const GRADE_RANK: Record<Grade, number> = { quantitative: 2, milestone: 1, narrative: 0 }

/**
 * Danh mục ĐÓNG: loại văn bản nào thì *đáng lẽ* đo được tới bậc nào.
 *
 * ⭐ Vì sao theo LOẠI chứ không theo từng bản: khai theo từng bản thì `narrative`
 *    thành cửa thoát ai cũng đi. Khai theo loại thì văn xuôi hợp pháp (quy chế
 *    phối hợp) không bị hỏi một câu nào, còn văn xuôi né việc phải có người ký tên.
 */
export interface DocTypeExpectation { expects: Grade }

/** Lời khai bậc đo trên một bản ghi cụ thể. */
export interface MeasurabilityDecl {
  grade: Grade
  /** Bắt buộc khi khai THẤP HƠN loại của nó. */
  reason?: string
  approvedBy?: string
  /** Hạn xem lại — miễn đo là giấy phép có thời hạn, không phải trạng thái vĩnh viễn. */
  reviewBy?: string
}

// ── Đại lượng (§C.0) ────────────────────────────────────────────────────────

export type AllocationState = 'DELEGATED' | 'ACCEPTED' | 'DONE' | 'RETURNED'
/** Ba trạng thái tính vào tổng đã giao; `RETURNED` cộng ngược. */
export const COUNTED_STATES: readonly AllocationState[] = ['DELEGATED', 'ACCEPTED', 'DONE']

export interface AllocationRec {
  id: string
  targetId: string
  toUnitId: string
  qty: number
  state: AllocationState
}

export interface TargetRec {
  id: string
  measureKey: string
  /** Số nhận từ trên, đóng băng lúc duyệt. */
  baselineQty: number | null
  /** Số sau điều chỉnh giữa kỳ; `null` khi chưa điều chỉnh. */
  revisedQty?: number | null
  /** Rỗng ⟺ chỉ tiêu tự phát. Cách chứng minh "tự phát": xem `checkDerivation`. */
  fulfilsAllocationId?: string | null
  /**
   * ⚠️ CỬA THOÁT KHAI TAY, KHÔNG PHẢI CÁCH CHÍNH. Bỏ trống được nếu app truyền
   *    `mandateId` và tập mệnh lệnh-do-giao-mà-có cho `checkDerivation` — nguồn
   *    gốc suy từ đồ thị đáng tin hơn một ô ai đó tick.
   *
   * ⛔ ĐỪNG BIND Ô NÀY VÀO MỘT Ô CÙNG TÊN CỦA APP MÀ CHƯA ĐỌC NGHĨA. Câu hỏi ở
   *    đây là "chỉ tiêu này TỪ ĐÂU RA" — nhìn LÊN. App rất hay có một ô tên y
   *    hệt trả lời "ai THỰC HIỆN nó" — nhìn XUỐNG. Hai câu độc lập: một chỉ
   *    tiêu nhận từ trên vẫn có thể chia tiếp xuống dưới. Đo ở app tham chiếu
   *    5/9/2026: bind nhầm hai ô ấy làm 28 chỉ tiêu bị kết là mồ côi, oan hết.
   */
  selfExecuted?: boolean
  /** Mệnh lệnh chủ của chỉ tiêu — để `checkDerivation` suy được nguồn gốc. */
  mandateId?: string | null
  periodKey?: string | null
  dueDate?: string | null
}

/** Nền đọc. KHÔNG có mặc định — không hỏi được "đạt bao nhiêu" mà không nói "so với nền nào". */
export type Basis = 'baseline' | 'revised'

// ── Lỗi ─────────────────────────────────────────────────────────────────────

export const CODES = [
  'MEASURE_SHAPE',        // thước khai sai hình dạng
  'MEASURE_UNKNOWN',      // chỉ tiêu trỏ vào thước chưa đăng ký
  'DEAD_TARGET',          // derived mà không có đường lấy số
  'OVER_DELEGATED',       // giao quá phần còn lại
  'REPLICATE_NOT_DIVIDED',// thước replicate mà đem chia
  'MEASURE_DRIFT',        // thước con khác thước cha, không có quy đổi
  'ORPHAN_TARGET',        // không tự phát mà cũng không nối về lần giao nào
  'NO_BASIS',             // đọc mà không khai nền
  'NOT_MEASURABLE',       // khai thấp hơn loại mà thiếu lý do/người duyệt/hạn
  'BIND_INVALID',         // khai bind sai
  'OVER_COMMITTED',       // cắt giữa kỳ xuống dưới phần đã chia
  'DOUBLE_COUNTED',       // một bằng chứng nối vào nhiều chỉ tiêu
  'LEDGER_DRIFT',         // cột phần còn lại lệch với tổng dòng giao
] as const
export type Code = (typeof CODES)[number]

export interface Violation { code: Code; subject: string; message: string }

export class LedgerError extends Error {
  constructor(readonly code: Code, message: string, readonly subject = '') {
    super(message)
    this.name = 'LedgerError'
  }
}
