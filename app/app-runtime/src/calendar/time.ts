// Số học thời gian — nguyên thuỷ duy nhất engine này dùng.
//
// ⛔ KHÔNG KÉO THƯ VIỆN NGÀY THÁNG VÀO. Gói này không có phụ thuộc nào, và giữ
//    được như thế là một tính chất chứ không phải một sự tình cờ: engine nằm
//    trong `engine/`, được nhiều app nhúng, và mỗi phụ thuộc là một phiên bản
//    phải đồng bộ ở mọi nơi nhúng nó.
//
// ⚠️ MÚI GIỜ: engine KHÔNG tự đoán. Mọi `Instant` mang múi giờ trong chuỗi, và
//    mọi phép so là phép so trên trục tuyệt đối. Việc đổi một mốc sang "8 giờ
//    sáng ở đâu" là việc của app — nó biết cơ quan ngồi ở đâu, engine không biết.

import type { CalDate, Instant, Interval, Weekday } from './types.js'

const ms = (t: Instant): number => {
  const n = Date.parse(t)
  if (Number.isNaN(n)) throw new Error(`Mốc thời gian không đọc được: ${JSON.stringify(t)}`)
  return n
}

/** `a` và `b` có chồng lên nhau không — nửa khoảng `[from, to)`. */
export const overlaps = (a: Interval, b: Interval): boolean =>
  ms(a.from) < ms(b.to) && ms(b.from) < ms(a.to)

/** Phần chồng nhau, hoặc `null` nếu rời nhau. */
export const intersect = (a: Interval, b: Interval): Interval | null => {
  if (!overlaps(a, b)) return null
  return {
    from: ms(a.from) >= ms(b.from) ? a.from : b.from,
    to: ms(a.to) <= ms(b.to) ? a.to : b.to,
  }
}

/** Khoảng có nằm trọn hoặc một phần trong cửa sổ không. */
export const within = (i: Interval, window: Interval): boolean => overlaps(i, window)

export const plusMinutes = (t: Instant, minutes: number): Instant =>
  new Date(ms(t) + minutes * 60_000).toISOString()

export const minutesBetween = (a: Instant, b: Instant): number => (ms(b) - ms(a)) / 60_000

/** Ngày dương lịch của một mốc, theo UTC. App muốn theo giờ địa phương thì tự quy đổi trước. */
export const dateOf = (t: Instant): CalDate => new Date(ms(t)).toISOString().slice(0, 10)

/** 1 = thứ hai … 7 = chủ nhật. ISO-8601, KHÔNG phải 0 = chủ nhật kiểu JavaScript. */
export const weekdayOf = (t: Instant | CalDate): Weekday => {
  const d = new Date(t.length === 10 ? `${t}T00:00:00Z` : t).getUTCDay()
  return (d === 0 ? 7 : d) as Weekday
}

/**
 * Mốc `YYYY-MM-DDThh:mm` cho một ngày và một giờ trong ngày.
 *
 * ⚠️ `at` là chuỗi `hh:mm` và được hiểu là GIỜ UTC. Đây là chỗ engine cố ý ngu:
 *    nó không biết cơ quan làm việc ở múi giờ nào. App khai `at: '00:30'` cho
 *    07:30 giờ Hà Nội, hoặc tự cộng bù trước khi truyền vào.
 */
export const atOn = (day: CalDate, at: string): Instant => {
  if (!/^\d{2}:\d{2}$/.test(at)) throw new Error(`Giờ trong ngày phải là hh:mm, nhận: ${at}`)
  return `${day}T${at}:00.000Z`
}

/** Danh sách ngày dương lịch trong cửa sổ, kể cả ngày đầu, không kể ngày cuối. */
export const daysIn = (window: Interval): CalDate[] => {
  const out: CalDate[] = []
  const end = ms(window.to)
  let cur = Date.parse(`${dateOf(window.from)}T00:00:00.000Z`)
  while (cur < end) {
    out.push(new Date(cur).toISOString().slice(0, 10))
    cur += 86_400_000
  }
  return out
}

/** Sắp xếp ổn định theo mốc bắt đầu, rồi theo mốc kết thúc. */
export const byStart = (a: Interval, b: Interval): number =>
  ms(a.from) - ms(b.from) || ms(a.to) - ms(b.to)
