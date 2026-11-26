// Sổ phân công trực — từ luật ca ra ĐỀ XUẤT, và từ ca đã duyệt ra ô lịch.
//
// ⭐ HAI HÀM, HAI VIỆC KHÁC HẲN NHAU, và tách chúng là quyết định quan trọng
//    nhất của tệp này:
//
//      proposeShifts()  luật lặp + danh sách người  →  ĐỀ XUẤT (thuần, không ghi)
//      projectShifts()  ca ĐÃ CÓ trong kho          →  ô trên lưới
//
// ⛔ VÌ SAO KHÔNG GỘP LÀM MỘT. Sổ phân công là một VĂN BẢN ĐÃ KÝ, và nó bị sửa
//    tay: người trực ốm, đổi ca, cấp trên điều đi công tác. Nếu mỗi lần vẽ lịch
//    engine lại tự xếp lại thì bản in trên tường và màn hình nói khác nhau — và
//    bản in mới là bản người ta cầm đi trực.
//
//    Nên: engine ĐỀ XUẤT một lần lúc lập sổ; từ đó trở đi nó chỉ ĐỌC. Cùng lẽ
//    với `propose.ts` của cascade-ledger: *máy đề xuất là giúp việc, máy tự đặt
//    là giành quyền.*

import type { EntryDecl, RosterDecl, ShiftDecl } from './bind.js'
import { slot } from './bind.js'
import type { Holder, Interval, Occurrence, SourceRecord } from './types.js'
import { byStart, intersect } from './time.js'
import { expand, rotate, type WorkingDays } from './recurrence.js'

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.length > 0 ? v : null

/** Kỳ của sổ, đọc ra thành một khoảng. Ngày trần thì lấy trọn ngày. */
const rosterSpan = (rec: SourceRecord, d: RosterDecl): Interval | null => {
  const from = str(slot(rec, d.fields, 'from'))
  const to = str(slot(rec, d.fields, 'to'))
  if (!from || !to) return null
  return {
    from: from.length === 10 ? `${from}T00:00:00.000Z` : from,
    /* Ngày cuối tính TRỌN — sổ "tới 30/6" phải phủ hết ngày 30. */
    to: to.length === 10 ? `${to}T23:59:59.999Z` : to,
  }
}

// ── ① ĐỀ XUẤT ───────────────────────────────────────────────────────────────

export interface ShiftProposal {
  kind: string
  interval: Interval
  person: string
  /** Câu người lập sổ đọc được: ca này ở đâu ra. */
  because: string
}

export interface ProposeInput {
  roster: SourceRecord
  rosterDecl: RosterDecl
  shiftDecl: ShiftDecl
  /** Người của cơ quan này — app cấp; engine không tự biết ai làm ở đâu. */
  people: string[]
  /** Ngày nghỉ, lễ, tết — bất biến C7, app quyết. */
  isWorkingDay?: WorkingDays
}

/**
 * Đề xuất ca trực cho cả kỳ của sổ.
 *
 * ⚠️ KHÔNG GHI GÌ, và không nhận `window`: sổ phân công lập cho **trọn kỳ của
 *    nó**, không lập cho "tuần đang xem". Lập theo cửa sổ là mỗi lần cuộn màn
 *    hình lại ra một danh sách trực khác.
 *
 * ⛔ NÉM khi không xếp được, không trả mảng rỗng. Một sổ trực rỗng trông y hệt
 *    một sổ chưa lập, và đó là chỗ để một tháng không ai trực mà không ai thấy.
 */
export const proposeShifts = (
  { roster, rosterDecl, shiftDecl, people, isWorkingDay }: ProposeInput,
): ShiftProposal[] => {
  const span = rosterSpan(roster, rosterDecl)
  if (!span) throw new Error('Sổ phân công thiếu mốc đầu hoặc mốc cuối kỳ')
  if (people.length === 0) throw new Error('Không có người nào của cơ quan này để xếp trực')

  const out: ShiftProposal[] = []
  for (const [kind, rule] of Object.entries(shiftDecl.kinds)) {
    const slots = expand(rule, span, isWorkingDay)
    if (slots.length === 0) continue
    /* ⭐ Mỗi LOẠI ca một vòng luân phiên riêng — trực ban và trực quản lý là hai
       danh sách khác nhau, hai nhóm người khác nhau. Gộp một vòng là một người
       vừa hết trực ban đã tới lượt trực quản lý. */
    const bo = shiftDecl.excluded?.[kind] ?? []
    const ai = rotate(people, bo, slots.length)
    slots.forEach((l, i) => {
      out.push({
        kind,
        interval: l.interval,
        person: ai[i]!,
        because: bo.length > 0
          ? `luân phiên ${kind}, lượt ${i + 1}/${slots.length}, đã trừ ${bo.length} người không đảm nhiệm`
          : `luân phiên ${kind}, lượt ${i + 1}/${slots.length}`,
      })
    })
  }
  out.sort((a, b) => byStart(a.interval, b.interval) || a.kind.localeCompare(b.kind))
  return out
}

// ── ② CHIẾU CA ĐÃ CÓ ────────────────────────────────────────────────────────

export interface ProjectShiftsInput {
  roster: SourceRecord
  rosterDecl: RosterDecl
  /** Ca đã có trong kho — engine ĐỌC, không xếp lại. */
  shifts: SourceRecord[]
  shiftDecl: ShiftDecl
  window: Interval
  holders?: Holder[]
}

export interface ProjectShiftsResult {
  occurrences: Occurrence[]
  skipped: { id: string; why: string }[]
}

/**
 * Chiếu ca đã duyệt lên lưới.
 *
 * ⛔ CỔNG CHẶNG CỦA SỔ — bất biến C3, áp cho cả sổ chứ không cho từng ca. Sổ
 *    chưa duyệt thì mọi ca trong nó chưa chiếm giờ của ai. Một danh sách trực
 *    còn dự thảo mà đã hiện trên lịch là cách chắc chắn nhất để hai người cùng
 *    tưởng mình không phải trực.
 */
export const projectShifts = (
  { roster, rosterDecl, shifts, shiftDecl, window, holders }: ProjectShiftsInput,
): ProjectShiftsResult => {
  const occurrences: Occurrence[] = []
  const skipped: ProjectShiftsResult['skipped'] = []

  const rosterId = roster.id
  const state = str(slot(roster, rosterDecl.fields, 'state'))
  const effectiveStates = rosterDecl.whenState
  if (effectiveStates && effectiveStates.length > 0 && (!state || !effectiveStates.includes(state))) {
    for (const s of shifts) {
      skipped.push({ id: s.id, why: `sổ phân công đang ở chặng \`${state ?? '—'}\` — ca chưa chiếm giờ` })
    }
    return { occurrences, skipped }
  }

  const span = rosterSpan(roster, rosterDecl)
  for (const s of shifts) {
    if (str(slot(s, shiftDecl.fields, 'roster')) !== rosterId) {
      skipped.push({ id: s.id, why: 'ca không thuộc sổ này' })
      continue
    }
    const from = str(slot(s, shiftDecl.fields, 'from'))
    const to = str(slot(s, shiftDecl.fields, 'to'))
    const kind = str(slot(s, shiftDecl.fields, 'kind'))
    const person = str(slot(s, shiftDecl.fields, 'person'))
    if (!from || !to) { skipped.push({ id: s.id, why: 'ca thiếu mốc đầu hoặc mốc cuối' }); continue }
    if (!kind) { skipped.push({ id: s.id, why: 'ca chưa khai loại' }); continue }
    /* ⚠️ Ca chưa có người vẫn LÊN LỊCH, mang `ownerPerson: null`. Bỏ nó đi là
       giấu đúng chỗ nguy hiểm nhất: một ca không ai trực. C4 sẽ nêu ra. */
    const interval: Interval = { from, to }
    if (!intersect(interval, window)) { skipped.push({ id: s.id, why: 'ngoài cửa sổ đang xem' }); continue }
    if (span && !intersect(interval, span)) {
      skipped.push({ id: s.id, why: 'ca nằm ngoài kỳ của chính sổ nó' })
      continue
    }
    occurrences.push({
      id: `${s.entity}:${s.id}:0:${kind}`,
      /* ⭐ `owned`, không phải `projected` — đây là vai app TRAO HẲN cho engine,
         nên C1 không cấm sửa giờ ở đây. Khác hẳn một đợt huấn luyện. */
      origin: 'owned',
      sourceRole: 'Shift',
      sourceId: s.id,
      seq: 0,
      interval,
      allDay: false,
      title: kind,
      kind,
      /* Vai của một ca là chính LOẠI CA, trừ khi app khai vai riêng: người trực
         đã biết đích danh, nên vai ở đây dùng để lọc và tô màu chứ không để tra
         người. */
      ownerRole: shiftDecl.roles?.[kind] ?? kind,
      ownerPerson: person ?? resolveByRole(holders, shiftDecl.roles?.[kind]),
      state,
    })
  }

  occurrences.sort((a, b) => byStart(a.interval, b.interval) || a.id.localeCompare(b.id))
  return { occurrences, skipped }
}

const resolveByRole = (holders: Holder[] | undefined, role?: string): string | null => {
  if (!holders || !role) return null
  return holders.find((h) => h.role === role)?.person ?? null
}

// ── ③ ĐỐI CHIẾU ĐỀ XUẤT VỚI SỔ ĐÃ CÓ ────────────────────────────────────────

export interface RosterDrift {
  kind: string
  interval: Interval
  /** Engine đề xuất ai, và trong sổ đang là ai. */
  proposed: string
  actual: string | null
}

/**
 * Sổ đã ký khác đề xuất ở chỗ nào.
 *
 * ⭐ NÊU RA, KHÔNG SỬA. Người trực ốm thì đổi ca là chuyện đúng — engine không
 *    được kéo về. Nhưng người lập sổ tháng sau cần biết tháng này lệch ở đâu,
 *    nếu không thì vòng luân phiên trôi dần và có người trực gấp đôi người khác.
 */
export const rosterDrift = (
  proposals: ShiftProposal[], occurrences: Occurrence[],
): RosterDrift[] => {
  const actual = new Map<string, string | null>()
  for (const o of occurrences) actual.set(`${o.kind}@${o.interval.from}`, o.ownerPerson)
  const out: RosterDrift[] = []
  for (const p of proposals) {
    const key = `${p.kind}@${p.interval.from}`
    if (!actual.has(key)) continue
    const a = actual.get(key) ?? null
    if (a !== p.person) out.push({ kind: p.kind, interval: p.interval, proposed: p.person, actual: a })
  }
  return out
}

// ── ④ VIỆC ĐỘT XUẤT ─────────────────────────────────────────────────────────

/**
 * Chiếu việc đột xuất — thứ KHÔNG có hồ sơ gốc ở đâu cả.
 *
 * ⚠️ VAI NÀY PHẢI DÙNG ÍT, và engine không ép được điều đó — chỉ nói ra được.
 *    Mỗi mục ở đây là một sự thật không có chỗ ở trong nghiệp vụ. Nếu nó phình
 *    ra thì đó là dấu hiệu **app đang thiếu một thực thể**, không phải dấu hiệu
 *    lịch cần thêm tính năng. `entryPressure()` ngay dưới là chỗ đo áp lực ấy.
 *
 * ⭐ `origin: 'owned'` — app trao hẳn vai này cho engine, nên C1 không cấm sửa
 *    giờ ở đây. Khác hẳn một đợt huấn luyện.
 */
export const projectEntries = (
  { entries, entryDecl, window, holders }: {
    entries: SourceRecord[]
    entryDecl: EntryDecl
    window: Interval
    holders?: Holder[]
  },
): ProjectShiftsResult => {
  const occurrences: Occurrence[] = []
  const skipped: ProjectShiftsResult['skipped'] = []

  for (const e of entries) {
    const from = str(slot(e, entryDecl.fields, 'from'))
    const title = str(slot(e, entryDecl.fields, 'title'))
    const ownerRole = str(slot(e, entryDecl.fields, 'ownerRole'))
    if (!from) { skipped.push({ id: e.id, why: 'không có mốc bắt đầu' }); continue }
    if (!title) { skipped.push({ id: e.id, why: 'không có tên để hiện' }); continue }
    if (!ownerRole) { skipped.push({ id: e.id, why: 'không có vai chịu trách nhiệm' }); continue }

    const to = str(slot(e, entryDecl.fields, 'to')) ?? from
    const interval: Interval = { from, to }
    const inWindow = from === to
      ? from >= window.from && from < window.to
      : Boolean(intersect(interval, window))
    if (!inWindow) { skipped.push({ id: e.id, why: 'ngoài cửa sổ đang xem' }); continue }

    const person = str(slot(e, entryDecl.fields, 'person'))
    occurrences.push({
      id: `${e.entity}:${e.id}:0:${ownerRole}`,
      origin: 'owned',
      sourceRole: 'Entry',
      sourceId: e.id,
      seq: 0,
      interval,
      allDay: from === to,
      title,
      kind: 'dot-xuat',
      ownerRole,
      ownerPerson: person ?? resolveByRole(holders, ownerRole),
      state: null,
    })
  }
  occurrences.sort((a, b) => byStart(a.interval, b.interval) || a.id.localeCompare(b.id))
  return { occurrences, skipped }
}

/**
 * Áp lực của vai `Entry` — bao nhiêu phần trăm ô trên lưới là việc không có chỗ ở.
 *
 * ⭐ MỘT CON SỐ ĐỂ BIẾT KHI NÀO PHẢI DỪNG LẠI MÀ NGHĨ. Lịch mà một phần ba là
 *    việc đột xuất thì app đang thiếu một thực thể nghiệp vụ, và người ta đang
 *    lấy ô lịch làm chỗ ghi tạm. Engine không chặn — nó đưa con số.
 */
export const entryPressure = (occ: Occurrence[]): { entries: number; total: number; ratio: number } => {
  const entries = occ.filter((o) => o.sourceRole === 'Entry').length
  const total = occ.length
  return { entries, total, ratio: total === 0 ? 0 : entries / total }
}
