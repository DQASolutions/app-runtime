// Phép thử — bind bằng tên ô của một app mẫu (app tự đặt tên, pack chỉ đọc qua bind).
//
// ⭐ Tên ô do app đặt; pack không đặt tên nào:
//      TrainingEvent    { startDate, endDate, eventName, status }
//      TravelOrder  { startDate, endDate, status }   ← KHÔNG có ô chủ
//      CourseTrainee   { dispatchedAt, graduatedAt, traineeName }
//      PlanAssignment   { dueDate, delegatedQty, status, toRole }
import { describe, it, expect } from 'vitest'
import {
  bindOrThrow, checkBindings, project, expand, rotate, check,
  overlaps, intersect, weekdayOf, atOn, daysIn,
  type CalendarDecl, type SchemaView, type SourceRecord, type Interval,
} from './index.js'

const E = (name: string, props: string[]) => ({ name, properties: props.map((n) => ({ name: n })) })

const schema: SchemaView = {
  entityTypes: [
    E('TrainingEvent', ['eventName', 'startDate', 'endDate', 'status', 'ownerRole', 'communeCode']),
    E('TravelOrder', ['startDate', 'endDate', 'status', 'communeCode']),
    E('PlanAssignment', ['dueDate', 'delegatedQty', 'status', 'toRole', 'title']),
    E('DutyRoster', ['periodStart', 'periodEnd', 'status', 'ownerScope']),
    E('DutyShift', ['rosterId', 'shiftKind', 'startsAt', 'endsAt', 'holderName']),
  ],
}

const decl: CalendarDecl = {
  sources: [
    {
      entity: 'TrainingEvent', kind: 'huan-luyen',
      fields: {
        from: 'startDate', to: 'endDate', title: 'eventName',
        state: 'status', ownerRole: 'ownerRole', scope: 'communeCode',
      },
      whenState: ['APPROVED', 'RUNNING'],
    },
    {
      entity: 'PlanAssignment', kind: 'han-giao-viec',
      fields: { from: 'dueDate', title: 'title', state: 'status', ownerRole: 'toRole' },
      whenState: ['DELEGATED', 'ACCEPTED'],
      allDay: true,
    },
  ],
}

const week: Interval = { from: '2026-06-01T00:00:00.000Z', to: '2026-06-08T00:00:00.000Z' }

// ── ① Khai báo đứng vững ─────────────────────────────────────────────────────
describe('bind', () => {
  it('khai đúng thì qua', () => {
    expect(() => bindOrThrow(decl, schema)).not.toThrow()
  })

  it('⛔ trỏ vào ô không có trên thực thể thì chặn', () => {
    const bad: CalendarDecl = {
      sources: [{
        entity: 'TrainingEvent', kind: 'x',
        fields: { from: 'ngayBatDau', title: 'eventName', ownerRole: 'ownerRole' },
      }],
    }
    const r = checkBindings(bad, schema)
    expect(r.ok).toBe(false)
    expect(r.problems[0]!.problem).toContain('ngayBatDau')
  })

  it('⛔ khai một thực thể hai lần thì chặn — C2 vỡ ngay từ khai báo', () => {
    const r = checkBindings({ sources: [decl.sources[0]!, decl.sources[0]!] }, schema)
    expect(r.ok).toBe(false)
    expect(r.problems.some((p) => p.problem.includes('hai lần'))).toBe(true)
  })

  it('⛔ không nguồn nào thì chặn — lịch trống vĩnh viễn', () => {
    expect(checkBindings({ sources: [] }, schema).ok).toBe(false)
  })

  it('⚠️ thiếu whenState thì CẢNH BÁO, không chặn', () => {
    const r = checkBindings({
      sources: [{
        entity: 'TravelOrder', kind: 'cong-tac',
        fields: { from: 'startDate', to: 'endDate', title: 'startDate', ownerRole: 'status' },
      }],
    }, schema)
    expect(r.ok).toBe(true)
    expect(r.warnings.join(' ')).toContain('whenState')
  })

  it('⚠️ thiếu ô tuỳ chọn thì nói mất tính năng gì', () => {
    const r = checkBindings({
      sources: [{
        entity: 'PlanAssignment', kind: 'han',
        fields: { from: 'dueDate', title: 'title', ownerRole: 'toRole' },
        whenState: ['DELEGATED'],
      }],
    }, schema)
    expect(r.warnings.join(' ')).toContain('chồng lấn')
  })
})

// ── ② Bộ chiếu ───────────────────────────────────────────────────────────────
const rec = (entity: string, id: string, fields: Record<string, unknown>): SourceRecord =>
  ({ entity, id, fields })

describe('project', () => {
  it('hồ sơ trong cửa sổ, đúng chặng → lên lịch', () => {
    const { occurrences } = project({
      decl, window: week,
      records: [rec('TrainingEvent', 't1', {
        eventName: 'Huấn luyện nhân viên đợt 2',
        startDate: '2026-06-03T01:00:00.000Z', endDate: '2026-06-03T04:00:00.000Z',
        status: 'APPROVED', ownerRole: 'ROLE-ADMIN', communeCode: '00001',
      })],
    })
    expect(occurrences).toHaveLength(1)
    expect(occurrences[0]!.title).toBe('Huấn luyện nhân viên đợt 2')
    expect(occurrences[0]!.kind).toBe('huan-luyen')
    expect(occurrences[0]!.origin).toBe('projected')
  })

  it('⛔ C3 — bản còn dự thảo KHÔNG chiếm giờ, và nói ra vì sao', () => {
    const { occurrences, skipped } = project({
      decl, window: week,
      records: [rec('TrainingEvent', 't2', {
        eventName: 'Đợt chưa duyệt',
        startDate: '2026-06-03T01:00:00.000Z', endDate: '2026-06-03T04:00:00.000Z',
        status: 'DRAFT', ownerRole: 'ROLE-ADMIN', communeCode: '00001',
      })],
    })
    expect(occurrences).toHaveLength(0)
    expect(skipped[0]!.why).toContain('DRAFT')
  })

  it('⭐ hồ sơ bị bỏ luôn kèm LÝ DO — không im lặng thiếu', () => {
    const { skipped } = project({
      decl, window: week,
      records: [
        rec('TrainingEvent', 't3', { eventName: 'X', status: 'APPROVED', ownerRole: 'ROLE-ADMIN' }),
        rec('Inspection', 'i1', { startDate: '2026-06-02T00:00:00.000Z' }),
      ],
    })
    expect(skipped.map((s) => s.why)).toEqual([
      'không có mốc bắt đầu',
      'thực thể chưa khai là nguồn của lịch',
    ])
  })

  it('⚠️ C4 — tra không ra người thì `ownerPerson` là null, KHÔNG bịa', () => {
    const { occurrences } = project({
      decl, window: week,
      records: [rec('TrainingEvent', 't4', {
        eventName: 'Đợt 3', startDate: '2026-06-04T01:00:00.000Z',
        endDate: '2026-06-04T03:00:00.000Z', status: 'APPROVED',
        ownerRole: 'ROLE-PLAN', communeCode: null,
      })],
    })
    expect(occurrences[0]!.ownerPerson).toBeNull()
  })

  it('⭐ tra ra người khi app cấp sổ nhân sự', () => {
    const { occurrences } = project({
      decl, window: week,
      holders: [{ role: 'ROLE-ADMIN', scopeId: '00001', person: 'Lê Thị C' }],
      records: [rec('TrainingEvent', 't5', {
        eventName: 'Đợt 4', startDate: '2026-06-04T01:00:00.000Z',
        endDate: '2026-06-04T03:00:00.000Z', status: 'APPROVED',
        ownerRole: 'ROLE-ADMIN', communeCode: '00001',
      })],
    })
    expect(occurrences[0]!.ownerPerson).toBe('Lê Thị C')
  })

  it('ngoài cửa sổ thì bỏ, kèm lý do', () => {
    const { occurrences, skipped } = project({
      decl, window: week,
      records: [rec('TrainingEvent', 't6', {
        eventName: 'Tháng sau', startDate: '2026-07-01T01:00:00.000Z',
        endDate: '2026-07-01T03:00:00.000Z', status: 'APPROVED',
        ownerRole: 'ROLE-ADMIN', communeCode: '00001',
      })],
    })
    expect(occurrences).toHaveLength(0)
    expect(skipped[0]!.why).toBe('ngoài cửa sổ đang xem')
  })

  it('việc một mốc (chỉ có `from`) vẫn hợp lệ', () => {
    const { occurrences } = project({
      decl, window: week,
      records: [rec('PlanAssignment', 'a1', {
        title: 'Hạn giao chỉ tiêu quý II', dueDate: '2026-06-05T00:00:00.000Z',
        status: 'DELEGATED', toRole: 'ROLE-HEAD',
      })],
    })
    expect(occurrences).toHaveLength(1)
    expect(occurrences[0]!.allDay).toBe(true)
    expect(occurrences[0]!.interval.from).toBe(occurrences[0]!.interval.to)
  })
})

// ── ③ Luật lặp ───────────────────────────────────────────────────────────────
describe('expand', () => {
  it('hằng ngày 07:30 — bảy lượt trong một tuần', () => {
    const l = expand({ every: 'day', at: '07:30', minutes: 60 }, week)
    expect(l).toHaveLength(7)
    expect(l[0]!.interval.from).toBe('2026-06-01T07:30:00.000Z')
  })

  it('⚠️ C7 — ngày nghỉ do APP quyết, engine không tự đoán', () => {
    const isWorkday = (d: string) => ![6, 7].includes(weekdayOf(d))
    const l = expand({ every: 'day', at: '07:30', minutes: 60 }, week, isWorkday)
    expect(l).toHaveLength(5)
  })

  it('⭐ seq đếm CẢ lượt bị ngày nghỉ loại — id ổn định giữa hai cửa sổ', () => {
    const isWorkday = (d: string) => d !== '2026-06-01'
    const l = expand({ every: 'day', at: '07:30', minutes: 60 }, week, isWorkday)
    expect(l[0]!.seq).toBe(1)
  })

  it('hằng tuần thứ năm — tổng vệ sinh 16:00', () => {
    const l = expand({ every: 'week', weekday: 4, at: '16:00', minutes: 60 }, week)
    expect(l).toHaveLength(1)
    expect(weekdayOf(l[0]!.interval.from)).toBe(4)
  })

  it('⭐ luân phiên KHÔNG bỏ lượt cuối tuần — ca trực tồn tại chính vì có ngày nghỉ', () => {
    const isWorkday = (d: string) => ![6, 7].includes(weekdayOf(d))
    const l = expand(
      { every: 'rotation', startAt: '2026-06-01T16:00:00.000Z', minutes: 24 * 60 },
      week, isWorkday,
    )
    expect(l.length).toBeGreaterThanOrEqual(7)
  })

  it('⛔ C6 — luật nở quá biên thì ném, không lặp vô hạn', () => {
    expect(() => expand(
      { every: 'rotation', startAt: '2020-01-01T00:00:00.000Z', minutes: 1 },
      { from: '2020-01-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' },
    )).toThrow(/10.000 lượt/)
  })
})

describe('rotate', () => {
  it('luân phiên thuần tính — chạy hai lần ra một kết quả', () => {
    const ai = ['A', 'B', 'C']
    expect(rotate(ai, [], 5)).toEqual(['A', 'B', 'C', 'A', 'B'])
    expect(rotate(ai, [], 5)).toEqual(rotate(ai, [], 5))
  })

  it('⭐ luật loại trừ là tri thức của APP, engine chỉ bỏ ra', () => {
    expect(rotate(['A', 'B', 'C'], ['B'], 4)).toEqual(['A', 'C', 'A', 'C'])
  })

  it('⛔ hết người thì NÉM — không trả mảng rỗng cho màn hình tự xoay', () => {
    expect(() => rotate(['A'], ['A'], 3)).toThrow(/Không còn ai/)
  })
})

// ── ④ Bất biến ───────────────────────────────────────────────────────────────
describe('bất biến', () => {
  const occ = (id: string, person: string | null, from: string, to: string) => ({
    id, origin: 'projected' as const, sourceRole: 'Source' as const,
    sourceId: id, seq: 0, interval: { from, to }, allDay: false,
    title: id, kind: 'k', ownerRole: 'ROLE-HEAD', ownerPerson: person, state: 'APPROVED',
  })

  it('⛔ C1 — không cho ghi giờ vào ô chiếu từ hồ sơ gốc', () => {
    const r = check([occ('a', 'X', '2026-06-01T01:00:00Z', '2026-06-01T02:00:00Z')], ['a'])
    expect(r.blocked).toBe(true)
    expect(r.findings[0]!.code).toBe('C1')
  })

  it('⛔ C2 — một hồ sơ chiếu ra hai ô thì chặn', () => {
    const a = occ('a', 'X', '2026-06-01T01:00:00Z', '2026-06-01T02:00:00Z')
    const r = check([a, { ...a, id: 'a-bis' }])
    expect(r.findings.some((f) => f.code === 'C2')).toBe(true)
    expect(r.blocked).toBe(true)
  })

  it('⚠️ C4 — chưa tra ra người thì NÊU RA, không chặn', () => {
    const r = check([occ('a', null, '2026-06-01T01:00:00Z', '2026-06-01T02:00:00Z')])
    expect(r.blocked).toBe(false)
    expect(r.findings[0]!.code).toBe('C4')
    expect(r.findings[0]!.message).toContain('sổ nhân sự')
  })

  it('⭐ C5 — một người hai chỗ cùng giờ thì NÊU RA, không chặn', () => {
    const r = check([
      occ('a', 'Lê Thị C', '2026-06-03T01:00:00Z', '2026-06-03T04:00:00Z'),
      occ('b', 'Lê Thị C', '2026-06-03T03:00:00Z', '2026-06-03T05:00:00Z'),
    ])
    expect(r.blocked).toBe(false)
    expect(r.conflicts).toHaveLength(1)
    expect(r.conflicts[0]!.overlap.from).toBe('2026-06-03T03:00:00Z')
  })

  it('hai người trùng giờ thì KHÔNG phải đụng độ', () => {
    const r = check([
      occ('a', 'Lê Thị C', '2026-06-03T01:00:00Z', '2026-06-03T04:00:00Z'),
      occ('b', 'Nguyễn Văn D', '2026-06-03T01:00:00Z', '2026-06-03T04:00:00Z'),
    ])
    expect(r.conflicts).toHaveLength(0)
  })
})

// ── ⑤ Số học thời gian ───────────────────────────────────────────────────────
describe('time', () => {
  it('⭐ nửa khoảng — hai ca nối đuôi KHÔNG chồng nhau', () => {
    const a = { from: '2026-06-01T16:00:00Z', to: '2026-06-02T16:00:00Z' }
    const b = { from: '2026-06-02T16:00:00Z', to: '2026-06-03T16:00:00Z' }
    expect(overlaps(a, b)).toBe(false)
    expect(intersect(a, b)).toBeNull()
  })

  it('thứ trong tuần theo ISO — chủ nhật là 7, không phải 0', () => {
    expect(weekdayOf('2026-06-07')).toBe(7)
    expect(weekdayOf('2026-06-01')).toBe(1)
  })

  it('⛔ giờ sai định dạng thì ném ngay', () => {
    expect(() => atOn('2026-06-01', '7:30')).toThrow(/hh:mm/)
  })

  it('⛔ mốc không đọc được thì ném, không trả NaN', () => {
    expect(() => overlaps(
      { from: 'hôm qua', to: '2026-06-01T00:00:00Z' },
      { from: '2026-06-01T00:00:00Z', to: '2026-06-02T00:00:00Z' },
    )).toThrow(/không đọc được/)
  })

  it('ngày trong cửa sổ — kể ngày đầu, không kể ngày cuối', () => {
    expect(daysIn(week)).toHaveLength(7)
    expect(daysIn(week)[0]).toBe('2026-06-01')
  })
})

// ── ⑥ Vai SUY RA, không lưu thành cột ────────────────────────────────────────
// ⭐ Đo trên app tham chiếu 27/8/2026: PlanDocument sinh việc cho 8 vai và KHÔNG có
//    cột vai nào. Vai ở đó là hàm của CHẶNG. Engine phải nhận được cách ấy.
describe('vai suy ra', () => {
  const withoutRoleColumn: CalendarDecl = {
    sources: [{
      entity: 'TravelOrder', kind: 'cong-tac',
      fields: { from: 'startDate', to: 'endDate', title: 'startDate', state: 'status' },
      whenState: ['ISSUED'],
    }],
  }
  const r1 = rec('TravelOrder', 'd1', {
    startDate: '2026-06-02T01:00:00.000Z', endDate: '2026-06-02T05:00:00.000Z', status: 'ISSUED',
  })

  it('⛔ không cột vai, không bộ giải → bỏ kèm lý do', () => {
    const { occurrences, skipped } = project({ decl: withoutRoleColumn, records: [r1], window: week })
    expect(occurrences).toHaveLength(0)
    expect(skipped[0]!.why).toBe('không có vai chịu trách nhiệm')
  })

  it('⭐ app suy vai từ chặng → lên lịch bình thường', () => {
    const { occurrences } = project({
      decl: withoutRoleColumn, records: [r1], window: week,
      resolveOwner: (r) => (r.fields.status === 'ISSUED' ? 'ROLE-HEAD' : null),
    })
    expect(occurrences).toHaveLength(1)
    expect(occurrences[0]!.ownerRole).toBe('ROLE-HEAD')
  })

  it('⭐ hai vai cùng dự → hai ô, và C2 KHÔNG kêu oan', () => {
    const { occurrences } = project({
      decl: withoutRoleColumn, records: [r1], window: week,
      resolveOwner: () => ['ROLE-HEAD', 'ROLE-ADMIN'],
    })
    expect(occurrences).toHaveLength(2)
    expect(occurrences.map((o) => o.ownerRole).sort()).toEqual(['ROLE-ADMIN', 'ROLE-HEAD'])
    expect(check(occurrences).blocked).toBe(false)
  })

  it('cột vai THẮNG bộ giải — lời khai rõ ràng hơn phép suy', () => {
    const { occurrences } = project({
      decl, records: [rec('PlanAssignment', 'a9', {
        title: 'Hạn quý III', dueDate: '2026-06-05T00:00:00.000Z',
        status: 'DELEGATED', toRole: 'ROLE-HEAD',
      })],
      window: week, resolveOwner: () => 'ROLE-XXX',
    })
    expect(occurrences[0]!.ownerRole).toBe('ROLE-HEAD')
  })

  it('⚠️ bind: thiếu cột vai thì CẢNH BÁO phải cấp bộ giải, không chặn', () => {
    const r = checkBindings(withoutRoleColumn, schema)
    expect(r.ok).toBe(true)
    expect(r.warnings.join(' ')).toContain('resolveOwner')
  })
})
