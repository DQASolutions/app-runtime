// Phép thử tầng ② và ③ — bind bằng tên ô của một app mẫu (app tự đặt tên, pack chỉ đọc qua bind).
//
// ⭐ Tên ô do app đặt; pack không đặt tên nào:
//    PlanTarget { measureKey, assignedQty, achievedQty, selfExecuted, dueDate, provinceCode… }
//    PlanAssignment { delegatedQty, status: DELEGATED·ACCEPTED·DONE·RETURNED }
import { describe, it, expect } from 'vitest'
import {
  Lens, SLOTS, checkFields, degradations, checkBindings, bindOrThrow,
  type CascadeDecl, type SchemaView, type RoleLens,
} from './index.js'

// ── Lược đồ mẫu, rút gọn ───────────────────────────────────────────────────
const E = (name: string, props: string[]) => ({ name, properties: props.map((n) => ({ name: n })) })
const schema: SchemaView = {
  entityTypes: [
    E('AdministrativeUnit', ['unitCode', 'unitName', 'level', 'parentCode']),
    E('WorkTasking', ['level', 'taskingKind', 'title', 'period', 'status', 'priorityLevel']),
    E('PlanDocument', ['docType', 'status', 'purpose']),
    E('PlanTarget', ['measureKey', 'name', 'unit', 'assignedQty', 'achievedQty',
      'selfExecuted', 'dueDate', 'provinceCode', 'communeCode', 'resourceKind', 'note',
      'remainingQty', 'ledgerState']),
    E('PlanAssignment', ['delegatedQty', 'status', 'planTargetId', 'toAdminUnitId', 'dueDate']),
    E('BudgetLine', ['itemCode', 'proposedAmount']),
    E('CourseTrainee', ['fullName']),
    // Bảng số báo của app tham chiếu — tên ô theo từ vựng của nó, không theo pack.
    E('TargetActual', ['planTargetId', 'communeCode', 'periodKey', 'reportedQty',
      'evidenceRef', 'reportedAt', 'note']),
  ],
  relationshipTypes: [
    { name: 'answeredBy', from: 'PlanDocument', to: 'WorkTasking', cardinality: '1..N' },
    { name: 'targetOfPlan', from: 'PlanTarget', to: 'PlanDocument', cardinality: '1..N' },
    { name: 'assignsTarget', from: 'PlanAssignment', to: 'PlanTarget', cardinality: '1..N' },
    { name: 'assignedToAdminUnit', from: 'PlanAssignment', to: 'AdministrativeUnit', cardinality: '1..N' },
    { name: 'fulfilsAssignment', from: 'PlanTarget', to: 'PlanAssignment', cardinality: 'N..1' },
    { name: 'traineeUnderTarget', from: 'CourseTrainee', to: 'PlanTarget', cardinality: '1..N' },
    { name: 'raisedTasking', from: 'PlanAssignment', to: 'WorkTasking', cardinality: '1..N' },
    { name: 'hasTarget', from: 'PlanTarget', to: 'WorkTasking', cardinality: '1..N' },
  ],
}

const decl: CascadeDecl = {
  bind: {
    Unit: 'AdministrativeUnit', Mandate: 'WorkTasking', Commitment: 'PlanDocument',
    Target: 'PlanTarget', Allocation: 'PlanAssignment', FundingLine: 'BudgetLine',
  },
  fields: {
    Target: {
      measure: 'measureKey', baselineQty: 'assignedQty',
      remainingQty: 'remainingQty', state: 'ledgerState',
      dueDate: 'dueDate', selfExecuted: 'selfExecuted',
    },
    Allocation: { qty: 'delegatedQty', state: 'status', target: 'planTargetId', toUnit: 'toAdminUnitId' },
    Commitment: { docType: 'docType' },
  },
  values: {
    Target: { selfExecuted: { yes: 'yes', no: 'no' } },
    Allocation: { state: { DELEGATED: 'DELEGATED', ACCEPTED: 'ACCEPTED', DONE: 'DONE', RETURNED: 'RETURNED' } },
  },
  edges: {
    answers: 'answeredBy', targetOf: 'targetOfPlan', allocatesTarget: 'assignsTarget',
    allocatedTo: 'assignedToAdminUnit', fulfils: 'fulfilsAssignment',
  },
  evidence: { trainee: 'traineeUnderTarget' },
  measures: { head_count: { unit: 'người', agg: 'sum', allocation: 'divide', source: 'derived', evidence: ['trainee'] } },
}

describe('bind bằng tên ô của app', () => {
  it('đi qua sạch', () => {
    expect(checkBindings(decl, schema)).toEqual([])
  })

  it('ánh xạ vào ô KHÔNG có trên thực thể thì bị bắt lúc khởi động', () => {
    const d: CascadeDecl = { ...decl, fields: { ...decl.fields, Target: { ...decl.fields!.Target!, baselineQty: 'assingedQty' } } }
    const v = checkFields(d, schema)
    expect(v[0].message).toMatch(/PlanTarget.assingedQty/)
  })

  it('thiếu ô BẮT BUỘC thì báo kèm việc phải làm, không dừng ở "thiếu ô"', () => {
    const f = { ...decl.fields!.Target! }; delete (f as Record<string, string>).remainingQty
    const v = checkFields({ ...decl, fields: { ...decl.fields, Target: f } }, schema)
    expect(v).toHaveLength(1)
    expect(v[0].message).toMatch(/thiếu ô bắt buộc "remainingQty"/)
    expect(v[0].message).toMatch(/Thêm vào `PlanTarget` một ô/)
    expect(v[0].message).toMatch(/fields.Target.remainingQty:/)
  })

  it('thiếu ô TUỲ CHỌN thì vẫn khởi động, và nói ra là tắt cái gì', () => {
    const f = { ...decl.fields!.Target! }; delete (f as Record<string, string>).selfExecuted
    const d = { ...decl, fields: { ...decl.fields, Target: f } }
    expect(checkFields(d, schema)).toEqual([])          // không chặn
    expect(degradations(d).join(' ')).toMatch(/selfExecuted.*mồ côi/)
  })

  it('app chưa có revisedQty → mất điều chỉnh giữa kỳ, và được nói ra', () => {
    expect(degradations(decl).join(' ')).toMatch(/revisedQty.*chỉ tiêu giữa kỳ/)
  })
})

describe('Lens — dịch hai chiều', () => {
  const lens = new Lens({
    fields: decl.fields!.Target!,
    values: decl.values!.Target!,
  } as RoleLens)

  const row = {
    id: 'vung', measureKey: 'head_count', assignedQty: 600, achievedQty: 87,
    remainingQty: 600, ledgerState: 'OK', dueDate: '2027-11-30', selfExecuted: 'no',
    provinceCode: '01', communeCode: null, resourceKind: 'people', note: 'ghi chú nội bộ',
  }

  it('đọc: đổi tên ô của app thành tên của engine', () => {
    const t = lens.readTarget(row)
    expect(t.baselineQty).toBe(600)      // ← assignedQty
    expect(t.remainingQty).toBe(600)
    expect(t.measureKey).toBe('head_count')
    expect(t.selfExecuted).toBe(false)
  })

  it('⭐ 30 ô kia KHÔNG lọt vào kiểu của engine', () => {
    const t = lens.readTarget(row) as unknown as Record<string, unknown>
    for (const o of ['provinceCode', 'communeCode', 'resourceKind', 'note', 'achievedQty'])
      expect(t[o]).toBeUndefined()
  })

  it('ghi: chỉ đụng đúng ô engine muốn ghi, không đụng gì khác', () => {
    expect(lens.writeTarget({ remainingQty: 40 })).toEqual({ remainingQty: 40 })
    expect(lens.writeTarget({ remainingQty: -60, state: 'OVER_COMMITTED' }))
      .toEqual({ remainingQty: -60, ledgerState: 'OVER_COMMITTED' })
  })

  it('vai ô app không khai thì engine không ghi bừa vào đâu cả', () => {
    const l = new Lens({ fields: { measure: 'measureKey', baselineQty: 'assignedQty' } })
    expect(l.writeTarget({ remainingQty: 40 })).toEqual({})
  })
})

describe('Lens — vai GIÁ TRỊ, nhiều về một', () => {
  // Một hệ khác gọi trạng thái giao bằng sáu tên; engine chỉ cần bốn.
  const lens = new Lens({
    fields: { id: 'id', qty: 'amount', state: 'phase', target: 'awardId', toUnit: 'granteeId' },
    values: { state: { DELEGATED: ['SUBMITTED', 'APPROVED'], ACCEPTED: 'ACCEPTED', DONE: 'CLOSED', RETURNED: 'WITHDRAWN' } },
  })

  it('hai giá trị của app gộp về một trạng thái của engine', () => {
    expect(lens.readAllocation({ id: 'a', amount: 5, phase: 'SUBMITTED' }).state).toBe('DELEGATED')
    expect(lens.readAllocation({ id: 'a', amount: 5, phase: 'APPROVED' }).state).toBe('DELEGATED')
  })

  it('ghi thì lấy giá trị ĐẦU danh sách — giá trị chuẩn tắc', () => {
    expect(lens.writeAllocation({ id: 'a', targetId: 't', toUnitId: 'u', qty: 5, state: 'DELEGATED' }).phase)
      .toBe('SUBMITTED')
    expect(lens.writeAllocation({ id: 'a', targetId: 't', toUnitId: 'u', qty: 5, state: 'DONE' }).phase)
      .toBe('CLOSED')
  })

  it('đi rồi về vẫn ra đúng trạng thái ấy', () => {
    for (const st of ['DELEGATED', 'ACCEPTED', 'DONE', 'RETURNED'] as const) {
      const w = lens.writeAllocation({ id: 'a', targetId: 't', toUnitId: 'u', qty: 5, state: st })
      expect(lens.readAllocation(w).state).toBe(st)
    }
  })
})

describe('hợp đồng ô — SLOTS', () => {
  it('mọi ô tuỳ chọn phải nói được thiếu thì mất gì', () => {
    for (const specs of Object.values(SLOTS))
      for (const s of specs) if (!s.required) expect(s.degrades, s.slot).toBeTruthy()
  })
  it('mọi ô đều phải nói được vì sao cần', () => {
    for (const specs of Object.values(SLOTS))
      for (const s of specs) expect(s.why, s.slot).toBeTruthy()
  })
  it('bindOrThrow trả về thấu kính dùng được ngay', () => {
    expect(bindOrThrow(decl, schema).lensOf('Target').field('baselineQty')).toBe('assignedQty')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ VAI `Actual` — thêm 5/9/2026 cùng `SLOTS.Actual`.
//
//   Trước đó vai này nằm trong `ROLES` mà không có trong `SLOTS`: app khai thước
//   `reported` thì bind vẫn XANH, rồi chết lúc chạy. Bốn phép thử dưới đây là
//   bốn hình dạng của đúng cái lỗ ấy.
// ═══════════════════════════════════════════════════════════════════════════
describe('vai Actual — chỗ chở số đạt do người báo', () => {
  const withActual: CascadeDecl = {
    ...decl,
    bind: { ...decl.bind, Actual: 'TargetActual' },
    fields: {
      ...decl.fields,
      Actual: { target: 'planTargetId', unit: 'communeCode', period: 'periodKey',
        qty: 'reportedQty', evidenceRef: 'evidenceRef' },
    },
    measures: {
      ...decl.measures,
      so_don_vi: { unit: 'đơn vị', agg: 'sum', allocation: 'divide', source: 'reported' },
    },
  }

  it('khai đủ thì bind xanh, và có thấu kính dùng ngay', () => {
    expect(checkBindings(withActual, schema)).toEqual([])
    expect(bindOrThrow(withActual, schema).lensOf('Actual').field('qty')).toBe('reportedQty')
  })

  it('⛔ thước `reported` mà chưa bind vai Actual → DEAD_TARGET, chặn lúc khởi động', () => {
    const d: CascadeDecl = { ...withActual, bind: { ...decl.bind }, fields: { ...decl.fields } }
    const v = checkBindings(d, schema)
    expect(v.some((x) => x.code === 'DEAD_TARGET' && x.subject === 'so_don_vi')).toBe(true)
    expect(() => bindOrThrow(d, schema)).toThrow(/chưa bind/)
  })

  it('⛔ bind Actual vào thực thể không có → BIND_INVALID (trước đây bị bỏ qua im lặng)', () => {
    const d: CascadeDecl = { ...withActual, bind: { ...withActual.bind, Actual: 'KhongCoBang' } }
    expect(checkBindings(d, schema).some(
      (x) => x.code === 'BIND_INVALID' && x.subject === 'Actual')).toBe(true)
  })

  it('⛔ thiếu một ô bắt buộc của vai Actual → BIND_INVALID kèm gợi ý di trú', () => {
    const d: CascadeDecl = {
      ...withActual,
      fields: { ...withActual.fields, Actual: { target: 'planTargetId', qty: 'reportedQty' } },
    }
    const v = checkFields(d, schema)
    expect(v.map((x) => x.subject).sort())
      .toEqual(['Actual.evidenceRef', 'Actual.period', 'Actual.unit'])
    expect(v[0].message).toMatch(/Thêm vào `TargetActual`/)
  })

  it('⛔ ô của Actual trỏ vào tên không có trên bảng ấy → BIND_INVALID', () => {
    const d: CascadeDecl = {
      ...withActual,
      fields: { ...withActual.fields, Actual: { ...withActual.fields!.Actual!, qty: 'khongCoO' } },
    }
    expect(checkFields(d, schema).some((x) => x.subject === 'Actual.qty')).toBe(true)
  })

  it('app chỉ dùng thước `derived` thì KHÔNG cần vai Actual — vẫn xanh', () => {
    expect(checkBindings(decl, schema)).toEqual([])
    expect(decl.bind.Actual).toBeUndefined()
  })

  it('thấu kính dịch hai chiều bằng từ vựng của app', () => {
    const lens = bindOrThrow(withActual, schema).lensOf('Actual')
    const rec = { id: 'x1', targetId: 't1', unitId: '00001', periodKey: '2026', qty: 3, evidenceRef: '112/BC' }
    const row = lens.writeActual(rec)
    expect(row).toMatchObject({ planTargetId: 't1', communeCode: '00001', periodKey: '2026', reportedQty: 3 })
    expect(lens.readActual({ ...row, note: 'ô app, pack không nhìn thấy' })).toEqual(rec)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ HAI CẠNH TUỲ CHỌN CỦA I2 — thêm 5/9/2026 cùng `checkDerivation` suy đồ thị.
//   Được phép vắng, nhưng KHAI RỒI THÌ PHẢI ĐÚNG — cùng luật với vai `Actual`.
// ═══════════════════════════════════════════════════════════════════════════
describe('cạnh tuỳ chọn raises / targetOfMandate', () => {
  const withEdges: CascadeDecl = {
    ...decl,
    edges: { ...decl.edges, raises: 'raisedTasking', targetOfMandate: 'hasTarget' },
  }

  it('khai đúng thì bind xanh', () => {
    expect(checkBindings(withEdges, schema)).toEqual([])
  })

  it('không khai thì vẫn xanh — app một cấp không cần hai cạnh này', () => {
    expect(checkBindings(decl, schema)).toEqual([])
  })

  it('⛔ khai `raises` trỏ vào quan hệ không có → BIND_INVALID', () => {
    const d: CascadeDecl = { ...decl, edges: { ...decl.edges, raises: 'khongCoQuanHe' } }
    expect(checkBindings(d, schema).some((x) => x.subject === 'raises')).toBe(true)
  })

  it('⛔ khai `raises` trỏ vào cạnh nối SAI hai đầu → BIND_INVALID', () => {
    // `traineeUnderTarget` nối CourseTrainee → PlanTarget, không phải Allocation ↔ Mandate.
    const d: CascadeDecl = { ...decl, edges: { ...decl.edges, raises: 'traineeUnderTarget' } }
    const v = checkBindings(d, schema)
    expect(v.some((x) => x.subject === 'raises')).toBe(true)
    expect(v.find((x) => x.subject === 'raises')!.message).toMatch(/nhưng vai đòi/)
  })

  it('⛔ `targetOfMandate` sai hai đầu cũng bị bắt', () => {
    const d: CascadeDecl = { ...decl, edges: { ...decl.edges, targetOfMandate: 'assignsTarget' } }
    expect(checkBindings(d, schema).some((x) => x.subject === 'targetOfMandate')).toBe(true)
  })

  it('không khai thì `degradations` nói mất phép chấm nào', () => {
    const d = degradations(decl).join(' | ')
    expect(d).toMatch(/cạnh raises không khai/)
    expect(d).toMatch(/cạnh targetOfMandate không khai/)
    // Khai đủ thì hai dòng ấy biến mất.
    expect(degradations(withEdges).join(' | ')).not.toMatch(/cạnh raises/)
  })
})
