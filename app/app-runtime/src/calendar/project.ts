// Bộ chiếu — từ hồ sơ của app ra ô trên lưới thời gian.
//
// ⭐ ĐÂY LÀ CHỖ DUY NHẤT BIẾT CÁCH QUY MỘT HỒ SƠ RA MỘT Ô LỊCH. Cùng lẽ với
//    `queue/project.mjs` của app tham chiếu — bộ móc lúc đổi chặng, bộ dựng lại toàn
//    bộ, và bộ đối chiếu đều gọi vào đây, nên ba đường không thể trôi khỏi nhau.
//
// ⛔ ENGINE KHÔNG SỞ HỮU NGÀY — bất biến C1, và nó được ép ngay ở kiểu trả về:
//    mọi ô sinh ra từ vai `Source` mang `origin: 'projected'`, và không có hàm
//    nào trong gói này ghi ngược vào hồ sơ gốc. Muốn dời một đợt huấn luyện thì
//    sửa ở hồ sơ đợt huấn luyện.

import type { CalendarDecl, SourceDecl } from './bind.js'
import { slot } from './bind.js'
import type { Holder, Interval, Occurrence, SourceRecord } from './types.js'
import { byStart, overlaps } from './time.js'

export interface ProjectInput {
  decl: CalendarDecl
  /** Hồ sơ app đã nạp, gom theo tên thực thể. */
  records: SourceRecord[]
  /** Cửa sổ đang xem. Ô nằm ngoài bị bỏ — bất biến C6. */
  window: Interval
  /** Ai đang giữ vai nào. Thiếu thì `ownerPerson` là `null`, KHÔNG phải bịa. */
  holders?: Holder[]
  /**
   * ⭐ VAI CÓ THỂ SUY RA, KHÔNG NHẤT THIẾT LƯU THÀNH CỘT — thêm sau lượt ướm
   *    vào app tham chiếu 27/8/2026.
   *
   *    Đo được: `PlanDocument` sinh việc cho **8 vai khác nhau** và **không có
   *    cột vai nào**; `ManagementBoard` 4 vai, cũng không cột. Vai ở đó là hàm của
   *    CHẶNG — bước kế tiếp là của ai. Bắt app thêm một cột `ownerRole` vào chín
   *    bảng là chép sự thật của quy trình sang chỗ thứ hai, và hai chỗ sẽ lệch.
   *
   * ⚠️ Trả về MẢNG là hợp lệ: một cuộc họp hai vai cùng phải dự thì nó xuất hiện
   *    trên lịch của cả hai. Đó không phải đếm hai lần — đó là cùng một việc trên
   *    hai cuốn lịch.
   */
  resolveOwner?: (rec: SourceRecord) => string | string[] | null
}

export interface ProjectResult {
  occurrences: Occurrence[]
  /** Hồ sơ bị bỏ, và vì sao — để màn hình nói được, thay vì im lặng thiếu. */
  skipped: { id: string; entity: string; why: string }[]
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.length > 0 ? v : null

const resolvePerson = (
  holders: Holder[] | undefined, role: string, scope: string | null,
): string | null => {
  if (!holders) return null
  const exact = holders.find((h) => h.role === role && h.scopeId === scope)
  if (exact) return exact.person
  /* Không khớp phạm vi thì thử vai không phạm vi — cơ quan cấp trên hay khai vậy. */
  const loose = holders.find((h) => h.role === role && h.scopeId === null)
  return loose ? loose.person : null
}

const projectOne = (
  rec: SourceRecord, d: SourceDecl, window: Interval, holders?: Holder[],
  resolveOwner?: ProjectInput['resolveOwner'],
): Occurrence[] | { why: string } => {
  const from = str(slot(rec, d.fields, 'from'))
  if (!from) return { why: 'không có mốc bắt đầu' }

  /* ⭐ Việc một mốc là việc hợp lệ, không phải lỗi. `to` khuyết thì khoảng dài 0,
     và bộ dò đụng độ tự bỏ qua vì nửa khoảng rỗng không chồng lên gì. */
  const to = str(slot(rec, d.fields, 'to')) ?? from
  const interval: Interval = { from, to }
  if (!overlaps(interval, window) && from !== to) return { why: 'ngoài cửa sổ đang xem' }
  if (from === to && (from < window.from || from >= window.to)) {
    return { why: 'ngoài cửa sổ đang xem' }
  }

  /* ⛔ CỔNG CHẶNG — bất biến C3. Bản còn dự thảo không chiếm giờ của ai. */
  const state = str(slot(rec, d.fields, 'state'))
  if (d.whenState && d.whenState.length > 0) {
    if (!state) return { why: 'chưa khai chặng nên không biết đã chiếm giờ chưa' }
    if (!d.whenState.includes(state)) return { why: `chặng \`${state}\` chưa chiếm giờ` }
  }

  const title = str(slot(rec, d.fields, 'title'))
  if (!title) return { why: 'không có tên để hiện' }

  /* Cột trước, người giải sau — cột là lời khai rõ ràng, nên nó thắng. */
  const fromField = str(slot(rec, d.fields, 'ownerRole'))
  const resolved = fromField ? [fromField] : toRoles(resolveOwner?.(rec))
  if (resolved.length === 0) return { why: 'không có vai chịu trách nhiệm' }

  const scope = str(slot(rec, d.fields, 'scope'))
  return resolved.map((ownerRole) => ({
    /* ⭐ Khoá mang cả VAI: cùng một việc trên lịch hai người là hai ô, và hai ô
       ấy phải phân biệt được — nếu không thì C2 kêu oan mỗi lần hai vai cùng dự. */
    id: `${rec.entity}:${rec.id}:0:${ownerRole}`,
    origin: 'projected' as const,
    sourceRole: 'Source' as const,
    sourceId: rec.id,
    seq: 0,
    interval,
    allDay: d.allDay === true,
    title,
    kind: d.kind,
    ownerRole,
    ownerPerson: resolvePerson(holders, ownerRole, scope),
    state,
  }))
}

/** Chuẩn hoá kết quả của bộ giải vai về một mảng, bỏ chỗ rỗng. */
const toRoles = (v: string | string[] | null | undefined): string[] =>
  v == null ? [] : (Array.isArray(v) ? v : [v]).filter((x) => typeof x === 'string' && x.length > 0)

/**
 * Chiếu mọi hồ sơ trong cửa sổ ra ô lịch.
 *
 * ⭐ TRẢ VỀ CẢ CHỖ BỊ BỎ. Một hồ sơ có ngày mà không lên lịch thì người dùng
 *    phải biết vì sao — im lặng bỏ là cách chắc chắn nhất để họ mất tin vào lịch.
 *    Đây đúng bài học đã trả giá ở app tham chiếu: một dấu im lặng khiến cán bộ đi
 *    tìm thứ không tồn tại.
 */
export const project = (
  { decl, records, window, holders, resolveOwner }: ProjectInput,
): ProjectResult => {
  const occurrences: Occurrence[] = []
  const skipped: ProjectResult['skipped'] = []
  const byEntity = new Map(decl.sources.map((s) => [s.entity, s]))

  for (const rec of records) {
    const d = byEntity.get(rec.entity)
    if (!d) {
      skipped.push({ id: rec.id, entity: rec.entity, why: 'thực thể chưa khai là nguồn của lịch' })
      continue
    }
    const out = projectOne(rec, d, window, holders, resolveOwner)
    if ('why' in out) skipped.push({ id: rec.id, entity: rec.entity, why: out.why })
    else occurrences.push(...out)
  }

  occurrences.sort((a, b) => byStart(a.interval, b.interval) || a.id.localeCompare(b.id))
  return { occurrences, skipped }
}
