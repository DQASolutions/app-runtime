// Từ vựng của @dqa-ai-solutions/app-runtime/calendar. Thuần TypeScript — không I/O, không phụ thuộc hạ tầng,
// KHÔNG một từ nào của miền nghiệp vụ (không "huấn luyện", không "trực ban").
//
// ⭐ Nguyên tắc chi phối cả tệp — GIỐNG cascade-ledger, khác chỗ đo:
//    pack khai VAI, app giữ TỪ VỰNG. Không chỗ nào ở đây được biết `TrainingEvent`
//    là gì; nó chỉ biết có một thực thể đóng vai `Source`.
//
// ⛔ VÀ ĐÂY LÀ CHỖ PHÂN BIỆT VỚI cascade-ledger, phải nói ngay từ dòng đầu:
//
//      cascade-ledger dùng `Period` — một cái SỔ. Có đóng, có restatement,
//      một `Actual` thuộc ĐÚNG MỘT kỳ.
//      calendar dùng `Instant` và `Interval` — một cái THƯỚC. Không đóng,
//      không restate; tuần của một cuộc họp SUY RA từ ngày, không ai gán.
//
//    Hai engine không chia sẻ khái niệm nào ngoài `date`. Ép chung `Period` là
//    bắt engine này nhập engine kia chỉ để lấy một khái niệm nó không dùng.

/** Mốc thời gian tuyệt đối, ISO 8601 với múi giờ. Engine không tự đoán múi giờ. */
export type Instant = string

/** Ngày dương lịch, `YYYY-MM-DD`. Dùng cho việc cả ngày và cho lịch ngày nghỉ. */
export type CalDate = string

/**
 * Một khoảng thời gian. `to` là mốc ĐÓNG NỬA KHOẢNG — `[from, to)`.
 *
 * ⚠️ Nửa khoảng, không phải khoảng đóng. Ca trực 16:00 hôm nay tới 16:00 hôm
 *    sau, và ca kế tiếp bắt đầu đúng 16:00 — nếu `to` đóng thì hai ca chồng
 *    nhau đúng một mốc và bộ dò đụng độ kêu mỗi ngày một lần, mãi mãi.
 */
export interface Interval {
  from: Instant
  to: Instant
}

/** Vai app phải bind. `Source` là vai MỞ — bind bao nhiêu thực thể cũng được. */
export const ROLES = ['Source', 'Roster', 'Shift', 'Entry'] as const
export type Role = (typeof ROLES)[number]

/**
 * Việc này từ đâu ra. Quyết định ai được sửa giờ của nó.
 *
 * ⭐ `projected` KHÔNG SỬA ĐƯỢC TRÊN LỊCH — bất biến C1. Muốn dời một đợt huấn
 *    luyện thì sửa ở hồ sơ đợt huấn luyện. Cho sửa trên lịch là mở đường cho
 *    ngày có hai chỗ ở, và hai chỗ ấy sẽ lệch.
 */
export type Origin = 'projected' | 'owned'

/**
 * Một ô trên lưới thời gian. Đây là thứ duy nhất engine sinh ra.
 *
 * ⚠️ KHÔNG PHẢI MỘT BẢN GHI ĐỂ LƯU. Nó là kết quả của một phép chiếu, dựng lại
 *    được bất cứ lúc nào từ hồ sơ gốc. App có thể vật chất hoá nó vào một bảng
 *    chiếu cho nhanh — như `work_item` — nhưng bảng ấy là bộ nhớ đệm, không phải
 *    sự thật.
 */
export interface Occurrence {
  /** Ổn định giữa hai lần chiếu: `${sourceRole}:${sourceId}:${seq}`. */
  id: string
  origin: Origin
  /** Vai của hồ sơ gốc — `Source`, `Shift`, hay `Entry`. */
  sourceRole: Role
  sourceId: string
  /** Lần thứ mấy của một luật lặp. `0` cho việc không lặp. */
  seq: number
  interval: Interval
  allDay: boolean
  title: string
  /** Nhóm để lọc và tô màu. App tự đặt tên nhóm; engine không biết nghĩa. */
  kind: string
  /** Vai chịu trách nhiệm. Luôn có — bất biến C4. */
  ownerRole: string
  /** Người cụ thể, nếu giải được. `null` là *chưa giải được*, không phải *không ai*. */
  ownerPerson: string | null
  /** Chặng của hồ sơ gốc lúc chiếu — để màn hình nói được vì sao nó ở đây. */
  state: string | null
}

/**
 * Luật lặp. Cố ý HẸP — chỉ ba kiểu, đủ cho chế độ làm việc của một cơ quan.
 *
 * ⛔ KHÔNG DỰNG LẠI RFC 5545. Lịch của một cơ quan hành chính không cần
 *    "thứ Ba thứ hai của tháng, trừ tháng có tuần thứ năm". Mở rộng bừa là rước
 *    một bộ phân tích chuỗi vào một engine đang không có phụ thuộc nào.
 */
export type Recurrence =
  | { every: 'day'; at: string; minutes: number }
  | { every: 'week'; weekday: Weekday; at: string; minutes: number }
  /** Luân phiên: mỗi lượt một người trong danh sách, lượt dài `minutes`. */
  | { every: 'rotation'; startAt: Instant; minutes: number }

/** 1 = thứ hai … 7 = chủ nhật. ISO-8601, không phải 0 = chủ nhật kiểu JS. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

/**
 * Một hồ sơ đã đọc ra khỏi kho, ở dạng engine hiểu. App tự nạp; engine không
 * chạm vào kho.
 */
export interface SourceRecord {
  id: string
  /** Tên thực thể của APP — engine chỉ dùng nó để tra khai báo và dựng `id`. */
  entity: string
  /** Giá trị các ô, theo TÊN Ô CỦA APP. */
  fields: Record<string, unknown>
}

/** Người giữ một vai ở một phạm vi. App cấp; engine không tự biết. */
export interface Holder {
  role: string
  scopeId: string | null
  person: string
}

/**
 * Đụng độ: một người ở hai chỗ cùng lúc.
 *
 * ⭐ ENGINE NÊU RA, KHÔNG CHẶN. Đời thật có đụng độ — người quản lý tự quyết bỏ
 *    cái nào. Chặn là máy giành quyền của người; im lặng là để họ lỡ cả hai.
 */
export interface Conflict {
  person: string
  a: Occurrence
  b: Occurrence
  overlap: Interval
}
