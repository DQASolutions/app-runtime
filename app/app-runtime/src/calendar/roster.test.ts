// Phép thử sổ phân công trực.
//
// ⭐ Luật ca theo một quy chế trực mẫu:
//      trực quản lý   Phó Giám đốc luân phiên THEO TUẦN, 7h30 T2 → T2 tuần sau
//      trực ban       ca 16h00 → 16h00 hôm sau
//      giao ban ngày  07h30 hằng ngày
//    và một luật loại trừ: "nhân viên nghỉ thai sản, lái xe, nhân viên văn thư không đảm
//    nhiệm trực ban".
import { describe, it, expect } from 'vitest'
import {
  proposeShifts, projectShifts, projectEntries, entryPressure, rosterDrift, check, weekdayOf,
  type RosterDecl, type ShiftDecl, type SourceRecord, type Interval,
} from './index.js'

const rec = (entity: string, id: string, fields: Record<string, unknown>): SourceRecord =>
  ({ entity, id, fields })

const rosterDecl: RosterDecl = {
  entity: 'DutyRoster',
  fields: { from: 'periodStart', to: 'periodEnd', state: 'status', scope: 'ownerScope' },
  whenState: ['APPROVED'],
}

const shiftDecl: ShiftDecl = {
  entity: 'DutyShift',
  fields: { roster: 'rosterId', kind: 'shiftKind', from: 'startsAt', to: 'endsAt', person: 'holderName' },
  kinds: {
    'truc-ban': { every: 'rotation', startAt: '2026-06-01T16:00:00.000Z', minutes: 24 * 60 },
    'truc-quan-ly': { every: 'rotation', startAt: '2026-06-01T07:30:00.000Z', minutes: 7 * 24 * 60 },
  },
  excluded: { 'truc-ban': ['Trần Thị H', 'Lái xe Nam'] },
}

const juneRoster = rec('DutyRoster', 'r6', {
  periodStart: '2026-06-01', periodEnd: '2026-06-07',
  status: 'APPROVED', ownerScope: 'phong-nhan-su',
})

const crew = ['Nguyễn Văn A', 'Trần Thị H', 'Lê Văn C', 'Lái xe Nam', 'Phạm Văn D']

// ── ① Đề xuất ───────────────────────────────────────────────────────────────
describe('proposeShifts', () => {
  it('nở đủ ca cho trọn kỳ của sổ', () => {
    const p = proposeShifts({ roster: juneRoster, rosterDecl, shiftDecl, people: crew })
    expect(p.filter((x) => x.kind === 'truc-ban').length).toBeGreaterThanOrEqual(6)
    expect(p.filter((x) => x.kind === 'truc-quan-ly')).toHaveLength(1)
  })

  it('⭐ luật loại trừ áp ĐÚNG loại ca, không áp tràn', () => {
    const p = proposeShifts({ roster: juneRoster, rosterDecl, shiftDecl, people: crew })
    const onDuty = p.filter((x) => x.kind === 'truc-ban').map((x) => x.person)
    expect(onDuty).not.toContain('Trần Thị H')
    expect(onDuty).not.toContain('Lái xe Nam')
    const managers = p.filter((x) => x.kind === 'truc-quan-ly').map((x) => x.person)
    expect(managers[0]).toBe('Nguyễn Văn A')
  })

  it('⭐ thuần tính — chạy hai lần ra một kết quả', () => {
    const a = proposeShifts({ roster: juneRoster, rosterDecl, shiftDecl, people: crew })
    const b = proposeShifts({ roster: juneRoster, rosterDecl, shiftDecl, people: crew })
    expect(a).toEqual(b)
  })

  it('⭐ mỗi loại ca một vòng luân phiên RIÊNG', () => {
    const p = proposeShifts({ roster: juneRoster, rosterDecl, shiftDecl, people: crew })
    const dutyOfficer = p.find((x) => x.kind === 'truc-ban')!.person
    const firstManager = p.find((x) => x.kind === 'truc-quan-ly')!.person
    expect(dutyOfficer).toBe('Nguyễn Văn A')
    expect(firstManager).toBe('Nguyễn Văn A')
    const ban2 = p.filter((x) => x.kind === 'truc-ban')[1]!.person
    expect(ban2).toBe('Lê Văn C')
  })

  it('mỗi ca kèm câu giải thích ở đâu ra', () => {
    const p = proposeShifts({ roster: juneRoster, rosterDecl, shiftDecl, people: crew })
    expect(p[0]!.because).toMatch(/luân phiên/)
    expect(p.find((x) => x.kind === 'truc-ban')!.because).toContain('đã trừ 2 người')
  })

  it('⛔ không có ai thì NÉM, không trả sổ rỗng', () => {
    expect(() => proposeShifts({ roster: juneRoster, rosterDecl, shiftDecl, people: [] }))
      .toThrow(/Không có người nào/)
  })

  it('⛔ loại trừ hết người của một loại ca thì NÉM', () => {
    const allExcluded: ShiftDecl = { ...shiftDecl, excluded: { 'truc-ban': crew } }
    expect(() => proposeShifts({ roster: juneRoster, rosterDecl, shiftDecl: allExcluded, people: crew }))
      .toThrow(/Không còn ai/)
  })

  it('⛔ sổ thiếu mốc kỳ thì NÉM', () => {
    const incomplete = rec('DutyRoster', 'r0', { status: 'APPROVED', ownerScope: 'x' })
    expect(() => proposeShifts({ roster: incomplete, rosterDecl, shiftDecl, people: crew }))
      .toThrow(/thiếu mốc/)
  })

  it('⚠️ C7 — ngày nghỉ do app quyết, và trực ban KHÔNG bỏ cuối tuần', () => {
    const isWorkday = (d: string) => ![6, 7].includes(weekdayOf(d))
    const p = proposeShifts({ roster: juneRoster, rosterDecl, shiftDecl, people: crew, isWorkingDay: isWorkday })
    expect(p.filter((x) => x.kind === 'truc-ban').length).toBeGreaterThanOrEqual(6)
  })
})

// ── ② Chiếu ca đã có ────────────────────────────────────────────────────────
const week: Interval = { from: '2026-06-01T00:00:00.000Z', to: '2026-06-08T00:00:00.000Z' }
const ca = (id: string, kind: string, from: string, to: string, person: string | null) =>
  rec('DutyShift', id, { rosterId: 'r6', shiftKind: kind, startsAt: from, endsAt: to, holderName: person })

describe('projectShifts', () => {
  it('ca của sổ đã duyệt thì lên lịch, mang origin `owned`', () => {
    const { occurrences } = projectShifts({
      roster: juneRoster, rosterDecl, shiftDecl, window: week,
      shifts: [ca('s1', 'truc-ban', '2026-06-01T16:00:00.000Z', '2026-06-02T16:00:00.000Z', 'Nguyễn Văn A')],
    })
    expect(occurrences).toHaveLength(1)
    expect(occurrences[0]!.origin).toBe('owned')
    expect(occurrences[0]!.ownerPerson).toBe('Nguyễn Văn A')
  })

  it('⛔ C3 — sổ chưa duyệt thì KHÔNG ca nào chiếm giờ, và nói ra vì sao', () => {
    const draft = rec('DutyRoster', 'r6', { ...juneRoster.fields, status: 'DRAFT' })
    const { occurrences, skipped } = projectShifts({
      roster: draft, rosterDecl, shiftDecl, window: week,
      shifts: [ca('s1', 'truc-ban', '2026-06-01T16:00:00.000Z', '2026-06-02T16:00:00.000Z', 'Nguyễn Văn A')],
    })
    expect(occurrences).toHaveLength(0)
    expect(skipped[0]!.why).toContain('DRAFT')
  })

  it('⭐ ca CHƯA CÓ NGƯỜI vẫn lên lịch — C4 nêu ra, không giấu', () => {
    const { occurrences } = projectShifts({
      roster: juneRoster, rosterDecl, shiftDecl, window: week,
      shifts: [ca('s2', 'truc-ban', '2026-06-02T16:00:00.000Z', '2026-06-03T16:00:00.000Z', null)],
    })
    expect(occurrences).toHaveLength(1)
    expect(occurrences[0]!.ownerPerson).toBeNull()
    const r = check(occurrences)
    expect(r.blocked).toBe(false)
    expect(r.findings.some((f) => f.code === 'C4')).toBe(true)
  })

  it('ca của sổ khác thì bỏ, kèm lý do', () => {
    const { skipped } = projectShifts({
      roster: juneRoster, rosterDecl, shiftDecl, window: week,
      shifts: [rec('DutyShift', 'sx', {
        rosterId: 'r7', shiftKind: 'truc-ban',
        startsAt: '2026-06-02T16:00:00.000Z', endsAt: '2026-06-03T16:00:00.000Z', holderName: 'A',
      })],
    })
    expect(skipped[0]!.why).toBe('ca không thuộc sổ này')
  })

  it('⛔ ca nằm ngoài kỳ của chính sổ nó thì bỏ', () => {
    const { skipped } = projectShifts({
      roster: juneRoster, rosterDecl, shiftDecl,
      window: { from: '2026-06-01T00:00:00.000Z', to: '2026-07-01T00:00:00.000Z' },
      shifts: [ca('s9', 'truc-ban', '2026-06-20T16:00:00.000Z', '2026-06-21T16:00:00.000Z', 'A')],
    })
    expect(skipped[0]!.why).toContain('ngoài kỳ của chính sổ')
  })

  it('⭐ hai ca nối đuôi 16h→16h KHÔNG bị coi là đụng độ', () => {
    const { occurrences } = projectShifts({
      roster: juneRoster, rosterDecl, shiftDecl, window: week,
      shifts: [
        ca('s1', 'truc-ban', '2026-06-01T16:00:00.000Z', '2026-06-02T16:00:00.000Z', 'Nguyễn Văn A'),
        ca('s2', 'truc-ban', '2026-06-02T16:00:00.000Z', '2026-06-03T16:00:00.000Z', 'Nguyễn Văn A'),
      ],
    })
    expect(check(occurrences).conflicts).toHaveLength(0)
  })

  it('⭐ C5 — cùng người trực ban và trực quản lý chồng giờ thì NÊU RA', () => {
    const { occurrences } = projectShifts({
      roster: juneRoster, rosterDecl, shiftDecl, window: week,
      shifts: [
        ca('s1', 'truc-ban', '2026-06-01T16:00:00.000Z', '2026-06-02T16:00:00.000Z', 'Nguyễn Văn A'),
        ca('s3', 'truc-quan-ly', '2026-06-02T07:30:00.000Z', '2026-06-09T07:30:00.000Z', 'Nguyễn Văn A'),
      ],
    })
    const r = check(occurrences)
    expect(r.conflicts).toHaveLength(1)
    expect(r.blocked).toBe(false)
  })
})

// ── ③ Sổ đã ký lệch đề xuất ─────────────────────────────────────────────────
describe('rosterDrift', () => {
  it('⭐ đổi ca vì người ốm → NÊU RA, không kéo về', () => {
    const p = proposeShifts({ roster: juneRoster, rosterDecl, shiftDecl, people: crew })
    const first = p.find((x) => x.kind === 'truc-ban')!
    const { occurrences } = projectShifts({
      roster: juneRoster, rosterDecl, shiftDecl, window: week,
      shifts: [ca('s1', 'truc-ban', first.interval.from, first.interval.to, 'Phạm Văn D')],
    })
    const drift = rosterDrift(p, occurrences)
    expect(drift).toHaveLength(1)
    expect(drift[0]!.proposed).toBe('Nguyễn Văn A')
    expect(drift[0]!.actual).toBe('Phạm Văn D')
  })

  it('sổ khớp đề xuất thì không lệch gì', () => {
    const p = proposeShifts({ roster: juneRoster, rosterDecl, shiftDecl, people: crew })
    const first = p.find((x) => x.kind === 'truc-ban')!
    const { occurrences } = projectShifts({
      roster: juneRoster, rosterDecl, shiftDecl, window: week,
      shifts: [ca('s1', 'truc-ban', first.interval.from, first.interval.to, first.person)],
    })
    expect(rosterDrift(p, occurrences)).toHaveLength(0)
  })
})

// ── ④ Việc đột xuất ─────────────────────────────────────────────────────────
describe('projectEntries', () => {
  const entryDecl = {
    entity: 'CalendarEntry',
    fields: { from: 'startsAt', to: 'endsAt', title: 'subject', ownerRole: 'ownerRole', person: 'holderName' },
  }
  const e = (id: string, f: Record<string, unknown>) => rec('CalendarEntry', id, f)

  it('việc đột xuất lên lịch, mang origin `owned`', () => {
    const { occurrences } = projectEntries({
      entryDecl, window: week,
      entries: [e('e1', {
        subject: 'Tiếp đoàn công tác Bộ', startsAt: '2026-06-03T02:00:00.000Z',
        endsAt: '2026-06-03T04:00:00.000Z', ownerRole: 'ROLE-DEPT', holderName: 'Nguyễn Văn A',
      })],
    })
    expect(occurrences).toHaveLength(1)
    expect(occurrences[0]!.origin).toBe('owned')
    expect(occurrences[0]!.kind).toBe('dot-xuat')
  })

  it('thiếu vai thì bỏ kèm lý do', () => {
    const { skipped } = projectEntries({
      entryDecl, window: week,
      entries: [e('e2', { subject: 'X', startsAt: '2026-06-03T02:00:00.000Z' })],
    })
    expect(skipped[0]!.why).toBe('không có vai chịu trách nhiệm')
  })

  it('⭐ áp lực việc đột xuất — con số để biết khi nào app đang thiếu thực thể', () => {
    const { occurrences } = projectEntries({
      entryDecl, window: week,
      entries: [1, 2, 3].map((i) => e(`e${i}`, {
        subject: `Việc ${i}`, startsAt: '2026-06-03T02:00:00.000Z',
        endsAt: '2026-06-03T03:00:00.000Z', ownerRole: 'ROLE-DEPT',
      })),
    })
    const ap = entryPressure(occurrences)
    expect(ap).toEqual({ entries: 3, total: 3, ratio: 1 })
  })

  it('lịch rỗng thì áp lực bằng 0, không chia cho 0', () => {
    expect(entryPressure([]).ratio).toBe(0)
  })
})
