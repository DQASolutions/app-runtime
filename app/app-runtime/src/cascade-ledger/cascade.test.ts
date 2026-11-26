// Phép thử đi theo ĐÚNG tình huống đã ướm ở docs/cascade-ledger-fit-log.md §M:
// chỉ tiêu đào tạo trưởng phòng cấp xã 2027 — Bộ 4.000 → Vùng B 600 →
// tỉnh A 45 → xã X 3, kèm một chỉ tiêu TỶ LỆ giao cùng lúc.
import { describe, it, expect } from 'vitest'
import {
  MeasureRegistry, checkMeasureShape, plan, planReturn, planRevise, remainingQty, rollup,
  checkTargetMeasurable, reportedTotal, checkDeclaration, classifyConversion, report,
  checkBindings, bindOrThrow, checkDerivation, checkMeasureContinuity, checkCountedOnce,
  type Measure, type TargetRec, type AllocationRec, type CascadeDecl, type SchemaView,
} from './index.js'

const reg = new MeasureRegistry()
const HEADCOUNT: Measure = { key: 'head_count', unit: 'người', agg: 'sum', allocation: 'divide',
  source: 'derived', evidence: ['trainee'], sourceRef: 'QĐ-01/2027' }
const RATIO: Measure = { key: 'ty_le_ht', unit: '%', agg: 'ratio', allocation: 'replicate', source: 'reported' }
reg.define(HEADCOUNT); reg.define(RATIO)

const T = (id: string, qty: number, key = 'head_count'): TargetRec =>
  ({ id, measureKey: key, baselineQty: qty, periodKey: '2027', selfExecuted: true })
const A = (id: string, targetId: string, qty: number, state: AllocationRec['state'] = 'DELEGATED'): AllocationRec =>
  ({ id, targetId, toUnitId: 'u-' + id, qty, state })

describe('thước — engine chấm HÌNH DẠNG, không chấm thước nào', () => {
  it('bác chia một tỷ lệ: 25% chia 12 tỉnh không thành 2%', () => {
    const v = checkMeasureShape({ ...RATIO, allocation: 'divide' })
    expect(v.map((x) => x.code)).toContain('MEASURE_SHAPE')
    expect(v[0].message).toMatch(/không chia xuống được/)
  })
  it('bác chỉ tiêu chết: đếm-từ-cạnh mà không nêu bằng chứng', () => {
    const v = checkMeasureShape({ ...HEADCOUNT, evidence: [] })
    expect(v.map((x) => x.code)).toContain('DEAD_TARGET')
  })
  it('nhận một thước CHƯA AI NGHĨ RA nếu hình dạng đúng', () => {
    expect(checkMeasureShape({ key: 'xa_dat_chuan_2027', unit: 'xã', agg: 'sum',
      allocation: 'divide', source: 'reported', sourceRef: 'QĐ.../2027' })).toEqual([])
  })
  it('không cho sửa một thước đang dùng — đổi nghĩa mọi số đã ghi theo nó', () => {
    expect(() => reg.define({ ...HEADCOUNT, unit: 'lượt' })).toThrow(/đã có với hình dạng khác/)
  })
})

describe('bảo toàn — I1', () => {
  const vung = T('vung', 600)
  it('Vùng chia 560 cho 12 tỉnh, giữ 40', () => {
    const allocs = Array.from({ length: 12 }, (_, i) => A('a' + i, 'vung', i === 0 ? 45 : 46.818181818))
    const rem = remainingQty(vung, HEADCOUNT, [A('a', 'vung', 560)], 'baseline')
    expect(rem).toBe(40)
    expect(allocs.length).toBe(12)
  })
  it('chia quá phần còn lại thì bị chặn, kèm số còn lại', () => {
    expect(() => plan(vung, HEADCOUNT, [A('a', 'vung', 560)], 41, 'baseline'))
      .toThrow(/còn 40 người, đang chia 41/)
  })
  it('trả về SỐ PHẢI GHI, không chỉ trả đúng/sai — đó là chỗ khác của "chặn nguyên tử"', () => {
    expect(plan(vung, HEADCOUNT, [A('a', 'vung', 560)], 40, 'baseline')).toEqual({ nextRemaining: 0, delta: -40 })
  })
  it('bản đã TRẢ LẠI không tính vào tổng đã giao', () => {
    const allocs = [A('a', 'vung', 560), A('b', 'vung', 40, 'RETURNED')]
    expect(remainingQty(vung, HEADCOUNT, allocs, 'baseline')).toBe(40)
  })
  it('trả lại thì cộng ngược', () => {
    const a = A('b', 'vung', 40)
    expect(planReturn(vung, HEADCOUNT, [A('a', 'vung', 560), a], a, 'baseline').nextRemaining).toBe(40)
  })
})

describe('tỷ lệ truyền xuống, không chia — F1', () => {
  const t = T('bo', 25, 'ty_le_ht')
  it('phần còn lại của thước truyền là null, KHÔNG phải 0', () => {
    expect(remainingQty(t, RATIO, [A('a', 'bo', 25)], 'baseline')).toBeNull()
  })
  it('chia nhỏ một tỷ lệ thì bị chặn', () => {
    expect(() => plan(t, RATIO, [], 2, 'baseline')).toThrow(/truyền xuống nguyên vẹn/)
  })
  it('truyền nguyên vẹn thì không đụng phần còn lại', () => {
    expect(plan(t, RATIO, [], 25, 'baseline')).toEqual({ nextRemaining: null, delta: 0 })
  })
})

describe('cắt chỉ tiêu giữa kỳ — F5', () => {
  it('cắt 600 → 560 khi đã chia 560 + giữ 40: KHÔNG ném, đặt cờ overCommitted', () => {
    const r = planRevise(T('vung', 600), HEADCOUNT, [A('a', 'vung', 560)], 560)
    expect(r).toEqual({ nextRemaining: 0, overCommitted: false })
    const r2 = planRevise(T('vung', 600), HEADCOUNT, [A('a', 'vung', 560)], 500)
    expect(r2.overCommitted).toBe(true)
    expect(r2.nextRemaining).toBe(-60)
  })
})

describe('nền so sánh — I3', () => {
  it('không có nền mặc định', () => {
    expect(() => remainingQty(T('t', 10), HEADCOUNT, [], undefined as never)).toThrow(/Phải khai đọc trên nền nào/)
  })
  it('revised đè baseline, baseline không đổi', () => {
    const t: TargetRec = { ...T('t', 600), revisedQty: 560 }
    expect(remainingQty(t, HEADCOUNT, [], 'baseline')).toBe(600)
    expect(remainingQty(t, HEADCOUNT, [], 'revised')).toBe(560)
  })
})

describe('gộp lên — I4, I7', () => {
  it('tỉnh = 3 tự làm + 42 của xã', () => {
    expect(rollup(HEADCOUNT, 3, [42]).achieved).toBe(45)
  })
  it('thước tỷ lệ trả null, KHÔNG trả 0', () => {
    const r = rollup(RATIO, 25, [30])
    expect(r.achieved).toBeNull()
    expect(r.note).toMatch(/không gộp được/)
  })
  it('một bằng chứng nối vào hai chỉ tiêu thì bị bắt', () => {
    expect(checkCountedOnce([{ evidenceId: 'm1', targetId: 'xa' }, { evidenceId: 'm1', targetId: 'tinh' }])
      .map((x) => x.code)).toEqual(['DOUBLE_COUNTED'])
  })
})

describe('đo được thật — I8 ba điều kiện', () => {
  const bound = new Set(['trainee'])
  it('đủ ba điều kiện thì sạch', () => {
    expect(checkTargetMeasurable(T('t', 3), HEADCOUNT, bound)).toEqual([])
  })
  it('chỉ tiêu CHẾT: đếm-từ-cạnh mà cạnh chưa bind', () => {
    const v = checkTargetMeasurable(T('t', 3), HEADCOUNT, new Set())
    expect(v[0].code).toBe('DEAD_TARGET')
    expect(v[0].message).toMatch(/mãi bằng 0/)
  })
  it('không kỳ, không hạn thì không có lúc nào chốt', () => {
    const t: TargetRec = { ...T('t', 3), periodKey: null, dueDate: null }
    expect(checkTargetMeasurable(t, HEADCOUNT, bound).map((x) => x.code)).toContain('DEAD_TARGET')
  })
})

describe('không im lặng — I9 khai theo LOẠI', () => {
  const cat = { coordination_charter: { expects: 'narrative' as const },
                training_plan: { expects: 'quantitative' as const } }
  it('quy chế khai văn xuôi: KHÔNG hỏi một câu nào', () => {
    expect(checkDeclaration('c1', 'coordination_charter', { grade: 'narrative' }, cat)).toEqual([])
  })
  it('kế hoạch huấn luyện khai văn xuôi: đòi lý do + người duyệt + hạn xem lại', () => {
    const v = checkDeclaration('p1', 'training_plan', { grade: 'narrative' }, cat)
    expect(v[0].message).toMatch(/thiếu: lý do, người duyệt, hạn xem lại/)
  })
  it('có đủ ba thứ thì cho qua', () => {
    expect(checkDeclaration('p1', 'training_plan',
      { grade: 'narrative', reason: 'chưa có chỉ tiêu trên giao', approvedBy: 'ROLE-HEAD', reviewBy: '2027-06-30' },
      cat)).toEqual([])
  })
  it('không khai gì thì bị chặn', () => {
    expect(checkDeclaration('p1', 'training_plan', undefined, cat)[0].code).toBe('NOT_MEASURABLE')
  })
})

describe('nơi văn xuôi biến thành số', () => {
  it('chỉ thị → kế hoạch có số = cấp này làm đúng việc', () => {
    expect(classifyConversion('narrative', 'quantitative')).toBe('converted')
  })
  it('chỉ thị → văn xuôi = đi xuyên qua, cấp này không thêm gì', () => {
    expect(classifyConversion('narrative', 'narrative')).toBe('passthrough')
  })
  it('trên giao số, dưới không nhận số', () => {
    expect(classifyConversion('quantitative', 'narrative')).toBe('downgraded')
  })
  it('báo cáo đếm được passthrough và ngoại lệ quá hạn', () => {
    const r = report([
      { subject: 'a', mandate: 'narrative', commitment: 'quantitative' },
      { subject: 'b', mandate: 'narrative', commitment: 'narrative',
        decl: { grade: 'narrative', reason: 'x', approvedBy: 'y', reviewBy: '2027-01-01' } },
    ], '2027-06-30')
    expect(r.passthrough).toBe(1)
    expect(r.measurable).toBe(1)
    expect(r.expired).toEqual(['b'])
  })
})

describe('bind — hỏng thì máy chủ không khởi động', () => {
  const schema: SchemaView = {
    entityTypes: ['AdministrativeUnit', 'WorkTasking', 'PlanDocument', 'PlanTarget',
      'PlanAssignment', 'BudgetLine', 'CourseTrainee'].map((name) => ({ name })),
    relationshipTypes: [
      { name: 'answeredBy', from: 'PlanDocument', to: 'WorkTasking', cardinality: '1..N' },
      { name: 'targetOfPlan', from: 'PlanTarget', to: 'PlanDocument', cardinality: '1..N' },
      { name: 'assignsTarget', from: 'PlanAssignment', to: 'PlanTarget', cardinality: '1..N' },
      { name: 'assignedToAdminUnit', from: 'PlanAssignment', to: 'AdministrativeUnit', cardinality: '1..N' },
      { name: 'fulfilsAssignment', from: 'PlanTarget', to: 'PlanAssignment', cardinality: 'N..1' },
      { name: 'traineeUnderTarget', from: 'CourseTrainee', to: 'PlanTarget', cardinality: '1..N' },
    ],
  }
  const decl: CascadeDecl = {
    bind: { Unit: 'AdministrativeUnit', Mandate: 'WorkTasking', Commitment: 'PlanDocument',
      Target: 'PlanTarget', Allocation: 'PlanAssignment', FundingLine: 'BudgetLine' },
    fields: {
      Target: { measure: 'measureKey', baselineQty: 'assignedQty',
        remainingQty: 'remainingQty', state: 'ledgerState' },
      Allocation: { qty: 'delegatedQty', state: 'status' },
      Commitment: { docType: 'docType' },
    },
    edges: { answers: 'answeredBy', targetOf: 'targetOfPlan', allocatesTarget: 'assignsTarget',
      allocatedTo: 'assignedToAdminUnit', fulfils: 'fulfilsAssignment' },
    evidence: { trainee: 'traineeUnderTarget' },
    measures: { head_count: { unit: 'người', agg: 'sum', allocation: 'divide', source: 'derived', evidence: ['trainee'] } },
  }
  it('bind thật của app tham chiếu đi qua sạch', () => {
    expect(checkBindings(decl, schema)).toEqual([])
    expect(bindOrThrow(decl, schema).entityOf('Target')).toBe('PlanTarget')
  })
  it('thiếu cạnh `fulfils` thì bị bắt — mắt xích nối hai cấp', () => {
    const d = { ...decl, edges: { ...decl.edges } }; delete (d.edges as Record<string, string>).fulfils
    expect(checkBindings(d, schema).some((v) => v.subject === 'fulfils')).toBe(true)
  })
  it('thước cần bằng chứng chưa bind → mọi chỉ tiêu theo thước ấy sẽ chết', () => {
    const d: CascadeDecl = { ...decl, evidence: {} }
    expect(checkBindings(d, schema).some((v) => v.code === 'DEAD_TARGET')).toBe(true)
  })
  it('bind vào thực thể không có thì ném lúc khởi động', () => {
    const d: CascadeDecl = { ...decl, bind: { ...decl.bind, Target: 'KhongCo' } }
    expect(() => bindOrThrow(d, schema)).toThrow(/không có thực thể ấy/)
  })
})

describe('truy nguyên và thước dọc trục — I2, I10', () => {
  it('chỉ tiêu mồ côi bị bắt', () => {
    expect(checkDerivation([{ id: 't', measureKey: 'head_count', baselineQty: 3 }])
      .map((x) => x.code)).toEqual(['ORPHAN_TARGET'])
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // ⭐ NGUỒN GỐC SUY TỪ ĐỒ THỊ — 5/9/2026.
  //
  //   Ba tình huống trông giống nhau ở chỗ "không có cạnh lên trên"; chỉ một là
  //   lỗi. Trước hôm nay pack phân biệt bằng một ô người ta tick, và chính ô ấy
  //   đã bị bind nhầm ở app tham chiếu (28 chỉ tiêu bị kết oan).
  // ═══════════════════════════════════════════════════════════════════════════
  const assigned = new Set(['nv-tren-giao'])   // mệnh lệnh do một lần giao đẻ ra
  const selfOpened   = 'nv-luat-giao'              // mệnh lệnh cấp mình tự mở theo luật

  it('① nhận từ trên — có cạnh về lần giao thì đạt, không cần ô nào', () => {
    expect(checkDerivation(
      [{ id: 't', measureKey: 'head_count', baselineQty: 3, mandateId: 'nv-tren-giao', fulfilsAllocationId: 'a1' }],
      assigned)).toEqual([])
  })

  it('② tự đặt — mệnh lệnh chủ KHÔNG do giao mà có thì hợp lệ, dù không tick gì', () => {
    expect(checkDerivation(
      [{ id: 't', measureKey: 'head_count', baselineQty: 3, mandateId: selfOpened }],
      assigned)).toEqual([])
  })

  it('③ mồ côi thật — mệnh lệnh chủ DO giao mà có, mà chỉ tiêu không nối về đâu', () => {
    const v = checkDerivation(
      [{ id: 't', measureKey: 'head_count', baselineQty: 3, mandateId: 'nv-tren-giao' }],
      assigned)
    expect(v.map((x) => x.code)).toEqual(['ORPHAN_TARGET'])
    // Lời phải nói rõ hơn lối cũ: chỉ ra ĐÚNG chỗ đứt, không nói chung chung.
    expect(v[0].message).toMatch(/không về tới cấp trên/)
  })

  it('⛔ tình huống ② và ③ KHÁC NHAU — lối cũ không phân biệt nổi', () => {
    const selfSet  = { id: 'a', measureKey: 'head_count', baselineQty: 3, mandateId: selfOpened }
    const orphan  = { id: 'b', measureKey: 'head_count', baselineQty: 3, mandateId: 'nv-tren-giao' }
    // Không có đồ thị: cả hai cùng bị kêu — đó chính là lý do phải có tham số thứ hai.
    expect(checkDerivation([selfSet, orphan]).length).toBe(2)
    // Có đồ thị: chỉ cái thứ hai bị kêu.
    expect(checkDerivation([selfSet, orphan], assigned).map((x) => x.subject)).toEqual(['b'])
  })

  it('ô `selfExecuted` vẫn là cửa thoát — khai tay thì vẫn cho qua', () => {
    expect(checkDerivation(
      [{ id: 't', measureKey: 'head_count', baselineQty: 3, selfExecuted: true }])).toEqual([])
  })

  it('không truyền đồ thị thì lùi về lối cũ — app cũ không gãy', () => {
    expect(checkDerivation([{ id: 't', measureKey: 'head_count', baselineQty: 3 }])
      .map((x) => x.code)).toEqual(['ORPHAN_TARGET'])
    expect(checkDerivation([{ id: 't', measureKey: 'head_count', baselineQty: 3, fulfilsAllocationId: 'a1' }]))
      .toEqual([])
  })

  it('chỉ tiêu không khai mệnh lệnh chủ thì vẫn theo lối cũ, không đoán hộ', () => {
    expect(checkDerivation([{ id: 't', measureKey: 'head_count', baselineQty: 3 }], assigned)
      .map((x) => x.code)).toEqual(['ORPHAN_TARGET'])
  })
  it('cha giao "người", con lặng lẽ đo "ngày công" thì bị bắt', () => {
    reg.define({ key: 'ngay_cong', unit: 'ngày công', agg: 'sum', allocation: 'divide', source: 'reported' })
    const parent: TargetRec = T('tinh', 45)
    const child: TargetRec = { id: 'xa', measureKey: 'ngay_cong', baselineQty: 3, fulfilsAllocationId: 'a1' }
    const v = checkMeasureContinuity([child], [A('a1', 'tinh', 3)], new Map([['tinh', parent]]), reg)
    expect(v[0].code).toBe('MEASURE_DRIFT')
  })
  it('có quy đổi khai rõ thì cho qua', () => {
    reg.define({ key: 'ngay_cong_qd', unit: 'ngày công', agg: 'sum', allocation: 'divide', source: 'reported',
      derivedFrom: { from: 'head_count', factor: 12, sourceRef: 'QĐ-02/2027 Đ.4' } })
    const child: TargetRec = { id: 'xa', measureKey: 'ngay_cong_qd', baselineQty: 36, fulfilsAllocationId: 'a1' }
    expect(checkMeasureContinuity([child], [A('a1', 'tinh', 3)], new Map([['tinh', T('tinh', 45)]]), reg)).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ LỐI `reported` KHÉP VÒNG — 5/9/2026.
//
//   Trước đó pack chấm và GHI số báo, rồi bỏ mặc phần đọc: `rollup` nhận
//   `ownEvidence` là con số app tự cộng, kể cả với thước `reported` nơi chính
//   pack vừa ghi con số ấy. App tham chiếu phải viết lại phép cộng bằng SQL và
//   tự nhớ luật "chỉ đếm bản còn hiệu lực".
// ═══════════════════════════════════════════════════════════════════════════
describe('reportedTotal — pack cộng hộ số đã báo', () => {
  const reported = (id: string, periodKey: string, qty: number) =>
    ({ id, targetId: 't', unitId: 'u', periodKey, qty, evidenceRef: 'BC/1' })
  const mReported = { key: 'so_don_vi', unit: 'đơn vị', agg: 'sum', allocation: 'divide', source: 'reported' } as const
  const mDerived = { key: 'head_count2', unit: 'người', agg: 'sum', allocation: 'divide',
    source: 'derived', evidence: ['trainee'] } as const

  it('cộng số của các kỳ khác nhau', () => {
    expect(reportedTotal(mReported, [reported('a', '2026', 3), reported('b', '2027', 4)])).toBe(7)
  })

  it('⛔ MỘT KỲ MỘT SỐ — hai bản cùng kỳ thì lấy bản CUỐI, không cộng đôi', () => {
    // Sổ lỡ có hai bản cho kỳ 2026: 3 rồi 5. Đúng là 5, không phải 8.
    expect(reportedTotal(mReported, [reported('a', '2026', 3), reported('b', '2026', 5)])).toBe(5)
  })

  it('không có số báo nào thì 0 — khác hẳn "không đo được"', () => {
    expect(reportedTotal(mReported, [])).toBe(0)
  })

  it('⛔ gọi trên thước đếm-từ-cạnh thì NÉM, không lặng lẽ trả 0', () => {
    expect(() => reportedTotal(mDerived, [reported('a', '2026', 3)])).toThrow(/không cộng từ số báo được/)
  })

  it('nối vào `rollup` thì ra số đạt của cả cây', () => {
    const own = reportedTotal(mReported, [reported('a', '2026', 3), reported('b', '2027', 4)])
    expect(rollup(mReported, own, [10, null, 2]).achieved).toBe(19)
  })
})
