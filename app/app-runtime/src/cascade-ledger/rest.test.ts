// Phép thử I5 (kỳ), I6 (tiền), đề xuất chỉ tiêu, và cổng kho.
// Vẫn đi theo tình huống bốn cấp: xã chốt năm trước, tỉnh còn ghi tới 25/11.
import { describe, it, expect } from 'vitest'
import {
  PeriodBook, fundingSummary, checkFundingLinked, proposeTargets, attach,
  Lens, MeasureRegistry, allocate,
  type Measure, type InstancePort, type FundingRec,
} from './index.js'

describe('I5 — đóng kỳ theo CẶP (kỳ × đơn vị)', () => {
  const at = '2027-11-20T00:00:00.000Z'

  it('xã chốt năm rồi, tỉnh vẫn ghi được — đó là cả điểm của việc khoá theo cặp', () => {
    const book = new PeriodBook()
    book.close('2027', 'xa-X', { 't1': 3 }, at)
    expect(book.isClosed('2027', 'xa-X')).toBe(true)
    expect(book.isClosed('2027', 'tinh-A')).toBe(false)
    expect(() => book.assertOpen('2027', 'tinh-A')).not.toThrow()
    expect(() => book.assertOpen('2027', 'xa-X')).toThrow(/đã chốt/)
  })

  it('không chốt hai lần', () => {
    const book = new PeriodBook()
    book.close('2027', 'xa-X', {}, at)
    expect(() => book.close('2027', 'xa-X', {}, at)).toThrow(/đã chốt rồi/)
  })
})

describe('I5 — số về muộn không được đổi số đã gửi', () => {
  const at = '2027-11-20T00:00:00.000Z'
  const book = new PeriodBook()
  book.close('2027', 'xa-X', { 't1': 3 }, '2027-11-20T00:00:00.000Z')

  it('trước khi có bản bổ sung: đã báo = hiện tại', () => {
    expect(book.asReported('2027', 'xa-X', 't1')).toBe(3)
    expect(book.asNow('2027', 'xa-X', 't1')).toBe(3)
  })

  it('⭐ xã báo 1 người bỏ học sau khi tỉnh đã gửi: số ĐÃ GỬI giữ nguyên', () => {
    book.restate({ id: 'r1', periodKey: '2027', unitId: 'xa-X', targetId: 't1',
      delta: -1, reason: 'một người bỏ học giữa khoá', at: '2027-12-10T00:00:00.000Z' })
    expect(book.asReported('2027', 'xa-X', 't1')).toBe(3)   // không đổi
    expect(book.asNow('2027', 'xa-X', 't1')).toBe(2)        // số thật bây giờ
  })

  it('chênh lệch được bày ra, không giấu', () => {
    const d = book.drifted()
    expect(d).toHaveLength(1)
    expect(d[0].message).toMatch(/đã báo lên 3, số hiện tại 2/)
  })

  it('kỳ chưa chốt thì không dùng bản bổ sung — sửa thẳng', () => {
    expect(() => new PeriodBook().restate({ id: 'r', periodKey: '2027', unitId: 'u',
      targetId: 't', delta: 1, reason: 'x', at })).toThrow(/Kỳ chưa chốt/)
  })

  it('bản bổ sung phải có lý do', () => {
    const b = new PeriodBook(); b.close('2027', 'u', {}, at)
    expect(() => b.restate({ id: 'r', periodKey: '2027', unitId: 'u', targetId: 't',
      delta: 1, reason: '  ', at })).toThrow(/phải có lý do/)
  })
})

describe('I6 — tiền bám chỉ tiêu', () => {
  const lines: FundingRec[] = [
    { id: 'b1', targetId: 't1', proposed: 100, approved: 80 },
    { id: 'b2', targetId: 't1', proposed: 50, approved: 50 },
    { id: 'b3', targetId: null, proposed: 20, approved: 20 },
  ]
  it('gộp theo chỉ tiêu, chênh lệch âm là bị cắt', () => {
    expect(fundingSummary('t1', lines)).toEqual(
      { targetId: 't1', proposed: 150, approved: 130, variance: -20, lines: 2 })
  })
  it('dòng tiền mồ côi bị kêu', () => {
    const v = checkFundingLinked(lines)
    expect(v).toHaveLength(1)
    expect(v[0].subject).toBe('b3')
  })
  it('miễn trừ phải khai rõ, không mở sẵn', () => {
    expect(checkFundingLinked(lines, new Set(['b3']))).toEqual([])
  })
})

describe('đề xuất chỉ tiêu — làm cho đo được là đường dễ nhất', () => {
  it('⭐ ứng viên từ lần giao là ĐỦ: bấm nhận, không gõ gì', () => {
    const [c] = proposeTargets({
      received: [{ allocationId: 'a1', measureKey: 'head_count', qty: 45, dueDate: '2027-11-30' }],
      periodKey: '2027',
    })
    expect(c.complete).toBe(true)
    expect(c.baselineQty).toBe(45)
    expect(c.fulfilsAllocationId).toBe('a1')      // nối `fulfils` luôn → I2 đóng ngay
    expect(c.because).toMatch(/Cấp trên vừa giao 45/)
  })

  it('nghĩa vụ thắng thói quen: lần giao đè chu kỳ trước', () => {
    const [c] = proposeTargets({
      received: [{ allocationId: 'a1', measureKey: 'head_count', qty: 45 }],
      previous: [{ measureKey: 'head_count', baselineQty: 60, achievedQty: 58 }],
    })
    expect(c.origin).toBe('allocation')
    expect(c.baselineQty).toBe(45)
  })

  it('không có lần giao thì lấy chu kỳ trước, và nói rõ vì sao', () => {
    const [c] = proposeTargets({ previous: [{ measureKey: 'head_count', baselineQty: 60, achievedQty: 58 }] })
    expect(c.origin).toBe('previous')
    expect(c.complete).toBe(false)
    expect(c.because).toMatch(/đặt 60, đạt 58/)
  })

  it('cuối cùng mới tới định mức trong danh mục tham số', () => {
    const [c] = proposeTargets({ parameters: [{ measureKey: 'so_dot', qty: 4, sourceRef: 'QĐ-02/2027' }] })
    expect(c.origin).toBe('parameter')
    expect(c.because).toMatch(/QĐ-02\/2027/)
  })

  it('⛔ thước truyền chỉ nhận số của cấp trên, không lấy chu kỳ trước đè lên', () => {
    const measures = new Map<string, Measure>([['ty_le',
      { key: 'ty_le', unit: '%', agg: 'ratio', allocation: 'replicate', source: 'reported' }]])
    expect(proposeTargets({ previous: [{ measureKey: 'ty_le', baselineQty: 20 }], measures })).toEqual([])
    expect(proposeTargets({
      received: [{ allocationId: 'a', measureKey: 'ty_le', qty: 25 }], measures,
    })).toHaveLength(1)
  })
})

describe('cổng kho — không giả vờ có tính nguyên tử', () => {
  const lens = new Lens({ fields: { measure: 'measureKey', baselineQty: 'assignedQty',
    remainingQty: 'remainingQty', state: 'ledgerState', qty: 'delegatedQty' } })
  const base = {
    getInstance: async () => null,
    queryInstances: async () => [],
    insertInstance: async () => ({ id: 'x' }),
    updateInstance: async () => undefined,
  }

  it('adapter không so-rồi-đặt được thì NÉM LÚC KHỞI ĐỘNG', () => {
    expect(() => attach(base as unknown as InstancePort, {
      targetType: 'PlanTarget', allocationType: 'PlanAssignment',
      targetLens: lens, allocationLens: lens, allocationsOf: () => null, provenance: {},
    })).toThrow(/KHÔNG chạy trên nó/)
  })

  it('id engine khác id kho thì phải TRA, không cập nhật thẳng', async () => {
    // App ánh xạ vai ô `id` sang ô của mình → `g1` nằm TRONG bản ghi, không phải khoá.
    const lensLG = new Lens({ fields: { id: 'maLanGiao', qty: 'delegatedQty', state: 'status' } })
    let receivedCondition: unknown = null
    const port = {
      ...base,
      queryInstances: async (_t: string, cond: unknown) => { receivedCondition = cond; return [{ id: 'uuid-that', data: {} }] },
      updateInstance: async (id: string) => { seenId = id },
      compareAndSetInstance: async () => true,
    }
    let seenId = ''
    const store = attach(port as unknown as InstancePort, {
      targetType: 'PlanTarget', allocationType: 'PlanAssignment',
      targetLens: lens, allocationLens: lensLG, allocationsOf: () => null, provenance: {},
    })
    await store.setAllocationState('g1', 'ACCEPTED')
    expect(seenId).toBe('uuid-that')                    // cập nhật đúng khoá của kho
    expect(JSON.stringify(receivedCondition)).toMatch(/maLanGiao/) // và tra bằng ô app đã khai
  })

  it('có khả năng ấy thì nối được, và so-rồi-đặt đi qua thấu kính', async () => {
    const seen: Array<Record<string, unknown>> = []
    const port = {
      ...base,
      getInstance: async (id: string) => ({ id, data: { measureKey: 'head_count', assignedQty: 600,
        remainingQty: 600, ledgerState: 'OK' } }),
      compareAndSetInstance: async (_id: string, expected: Record<string, unknown>, patch: Record<string, unknown>) => {
        seen.push(expected, patch); return true
      },
    }
    const store = attach(port as unknown as InstancePort, {
      targetType: 'PlanTarget', allocationType: 'PlanAssignment',
      targetLens: lens, allocationLens: lens, allocationsOf: () => null, provenance: {},
    })
    const reg = new MeasureRegistry()
    reg.define({ key: 'head_count', unit: 'người', agg: 'sum', allocation: 'divide', source: 'reported' })
    await allocate(store, reg, { targetId: 'vung', toUnitId: 'tinh', qty: 560,
      basis: 'baseline', allocationId: 'a1' })
    // ⭐ điều kiện và giá trị ghi đều mang TÊN Ô CỦA APP, không phải tên của engine
    expect(seen[0]).toEqual({ remainingQty: 600 })
    expect(seen[1]).toEqual({ remainingQty: 40 })
  })
})
