// Nở luật lặp ra thành từng lượt — trong một cửa sổ có biên.
//
// ⛔ BIÊN LÀ BẮT BUỘC, KHÔNG PHẢI TUỲ CHỌN — bất biến C6. Một luật "hằng ngày
//    07:30" không có biên là một vòng lặp vô hạn, và nó sẽ chạy vào đúng ngày
//    ai đó mở lịch với cửa sổ để trống.
//
// ⚠️ NGÀY NGHỈ DO APP QUYẾT — bất biến C7. Engine không biết thứ bảy có làm việc
//    không, không biết Tết rơi vào ngày nào. Nó nhận một hàm `isWorkingDay` và
//    dùng; không có hàm thì coi mọi ngày đều làm việc, và nói ra điều đó.

import type { CalDate, Instant, Interval, Recurrence, Weekday } from './types.js'
import { atOn, daysIn, plusMinutes, weekdayOf } from './time.js'

/** Lịch ngày làm việc của app. Không truyền thì mọi ngày đều là ngày làm việc. */
export type WorkingDays = (day: CalDate) => boolean

export interface Slot {
  seq: number
  interval: Interval
}

/**
 * Nở một luật lặp trong cửa sổ.
 *
 * ⭐ `seq` đếm từ 0 và ĐẾM CẢ LƯỢT BỊ NGÀY NGHỈ LOẠI. Nếu bỏ ngày nghỉ rồi mới
 *    đánh số thì hai lần gọi với hai cửa sổ khác nhau ra hai bộ số khác nhau, và
 *    `Occurrence.id` mất tính ổn định — màn hình sẽ nhấp nháy mỗi lần cuộn.
 */
export const expand = (
  rule: Recurrence, window: Interval, isWorkingDay?: WorkingDays,
): Slot[] => {
  const out: Slot[] = []
  const keep = (day: CalDate): boolean => (isWorkingDay ? isWorkingDay(day) : true)

  if (rule.every === 'day') {
    daysIn(window).forEach((day, i) => {
      if (!keep(day)) return
      const from = atOn(day, rule.at)
      out.push({ seq: i, interval: { from, to: plusMinutes(from, rule.minutes) } })
    })
    return out
  }

  if (rule.every === 'week') {
    let seq = 0
    for (const day of daysIn(window)) {
      if (weekdayOf(day) !== (rule.weekday as Weekday)) continue
      const i = seq++
      if (!keep(day)) continue
      const from = atOn(day, rule.at)
      out.push({ seq: i, interval: { from, to: plusMinutes(from, rule.minutes) } })
    }
    return out
  }

  /*
    Luân phiên: lượt dài `minutes`, nối đuôi nhau từ `startAt`.

    ⚠️ KHÔNG BỎ LƯỢT VÀO NGÀY NGHỈ. Ca trực tồn tại CHÍNH VÌ có ngày nghỉ — bỏ
       lượt cuối tuần là bỏ đúng lúc cần người trực nhất. Đây là chỗ luật lặp
       thứ ba khác hẳn hai luật trên, và khác có chủ ý.
  */
  let cur: Instant = rule.startAt
  let seq = 0
  const guard = 10_000
  while (cur < window.to && seq < guard) {
    const next = plusMinutes(cur, rule.minutes)
    if (next > window.from) out.push({ seq, interval: { from: cur, to: next } })
    cur = next
    seq++
  }
  if (seq >= guard) {
    throw new Error(
      'Luật luân phiên nở quá 10.000 lượt trong cửa sổ — cửa sổ quá rộng hoặc `minutes` quá nhỏ',
    )
  }
  return out
}

/**
 * Xếp người vào các lượt, luân phiên, bỏ người bị loại trừ.
 *
 * ⭐ THUẦN TÍNH, KHÔNG NGẪU NHIÊN. Cùng danh sách người, cùng cửa sổ, cùng luật
 *    → cùng kết quả. Xếp trực mà mỗi lần chạy ra một kiểu thì không ai đối chiếu
 *    được với bản đã ký.
 *
 * ⛔ NÉM KHI KHÔNG CÒN AI. Danh sách rỗng sau khi loại trừ là một câu hỏi
 *    nghiệp vụ — *"ai trực?"* — không phải một mảng rỗng để màn hình tự xoay xở.
 */
export const rotate = <T>(people: T[], excluded: T[], count: number): T[] => {
  const pool = people.filter((p) => !excluded.includes(p))
  if (pool.length === 0) {
    throw new Error('Không còn ai để xếp trực sau khi áp luật loại trừ')
  }
  return Array.from({ length: count }, (_, i) => pool[i % pool.length]!)
}
