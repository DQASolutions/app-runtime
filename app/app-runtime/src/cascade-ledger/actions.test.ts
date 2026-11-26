// Nghiệm thu mũi khoan §I bước 3: "hai lệnh giao đồng thời trên cùng một chỉ
// tiêu — phải có ĐÚNG MỘT cái hỏng."
import { describe, it, expect } from 'vitest'
import {
  MeasureRegistry, MemoryStore, allocate, returnAllocation, revise, approveBaseline,
  acceptAllocation, type Measure, type TargetRow, type AllocationRec,
} from './index.js'

const HEADCOUNT: Measure = { key: 'head_count', unit: 'người', agg: 'sum', allocation: 'divide',
  source: 'derived', evidence: ['trainee'] }
const RATIO: Measure = { key: 'ty_le', unit: '%', agg: 'ratio', allocation: 'replicate', source: 'reported' }
const reg = new MeasureRegistry(); reg.define(HEADCOUNT); reg.define(RATIO)

const target = (over: Partial<TargetRow> = {}): TargetRow => ({
  id: 'vung', measureKey: 'head_count', baselineQty: 600, remainingQty: 600,
  state: 'OK', periodKey: '2027', selfExecuted: true, ...over,
})

describe('allocate — giao xuống', () => {
  it('Vùng chia 560, còn 40', async () => {
    const s = new MemoryStore([target()])
    await allocate(s, reg, { targetId: 'vung', toUnitId: 'tinh-a', qty: 560, basis: 'baseline', allocationId: 'a1' })
    expect(s.targets.get('vung')!.remainingQty).toBe(40)
    expect(s.allocations.get('a1')!.state).toBe('DELEGATED')
  })

  it('chia quá phần còn lại thì bị chặn, và KHÔNG ghi gì', async () => {
    const s = new MemoryStore([target({ remainingQty: 40 })], [{ id: 'a1', targetId: 'vung', toUnitId: 'x', qty: 560, state: 'DELEGATED' }])
    await expect(allocate(s, reg, { targetId: 'vung', toUnitId: 'tinh-b', qty: 41, basis: 'baseline', allocationId: 'a2' }))
      .rejects.toThrow(/còn 40 người, đang chia 41/)
    expect(s.allocations.has('a2')).toBe(false)
    expect(s.targets.get('vung')!.remainingQty).toBe(40)
  })

  // ⭐ PHÉP THỬ QUAN TRỌNG NHẤT CỦA CẢ GÓI.
  it('HAI lệnh giao đồng thời, mỗi lệnh 40 trên chỉ tiêu còn 40 → đúng MỘT cái hỏng', async () => {
    const s = new MemoryStore([target({ remainingQty: 40 })],
      [{ id: 'a0', targetId: 'vung', toUnitId: 'x', qty: 560, state: 'DELEGATED' }])

    // Chen ngang: ngay trước khi lệnh thứ nhất ghi, lệnh thứ hai đã ghi xong.
    // Đây chính là cái khe mà lối "đọc tổng → so → ghi" để hở.
    let chen = false
    s.onBeforeWrite = async () => {
      if (chen) return
      chen = true
      const t = s.targets.get('vung')!
      t.remainingQty = 0
      s.allocations.set('b1', { id: 'b1', targetId: 'vung', toUnitId: 'tinh-c', qty: 40, state: 'DELEGATED' })
    }

    await expect(allocate(s, reg, { targetId: 'vung', toUnitId: 'tinh-b', qty: 40, basis: 'baseline', allocationId: 'a1' }))
      .rejects.toThrow(/còn 0 người, đang chia 40/)

    // Kẻ chen ngang thắng; tổng không vượt; và không có bản giao ma nào.
    expect(s.targets.get('vung')!.remainingQty).toBe(0)
    expect(s.allocations.has('a1')).toBe(false)
    expect(s.allocations.has('b1')).toBe(true)
    const total = [...s.allocations.values()].reduce((n, a) => n + a.qty, 0)
    expect(total).toBe(600)
  })

  it('chen ngang mà VẪN CÒN chỗ thì tính lại rồi ghi, không bắt người dùng bấm lại', async () => {
    const s = new MemoryStore([target({ baselineQty: 100, remainingQty: 100 })])
    let chen = false
    s.onBeforeWrite = async () => {
      if (chen) return
      chen = true
      s.targets.get('vung')!.remainingQty = 70
      s.allocations.set('b1', { id: 'b1', targetId: 'vung', toUnitId: 'z', qty: 30, state: 'DELEGATED' })
    }
    await allocate(s, reg, { targetId: 'vung', toUnitId: 'y', qty: 40, basis: 'baseline', allocationId: 'a1' })
    expect(s.targets.get('vung')!.remainingQty).toBe(30)   // 100 − 30 − 40
    expect(s.allocations.has('a1')).toBe(true)
  })

  it('thước truyền: giao xuống không đụng phần còn lại', async () => {
    const s = new MemoryStore([target({ id: 't', measureKey: 'ty_le', baselineQty: 25, remainingQty: null })])
    await allocate(s, reg, { targetId: 't', toUnitId: 'tinh-a', qty: 25, basis: 'baseline', allocationId: 'a1' })
    expect(s.targets.get('t')!.remainingQty).toBeNull()
  })
})

describe('trả lại — cộng ngược', () => {
  it('xã trả lại 40 thì tỉnh được cộng lại 40', async () => {
    const s = new MemoryStore([target({ remainingQty: 0 })], [
      { id: 'a1', targetId: 'vung', toUnitId: 'x', qty: 560, state: 'ACCEPTED' },
      { id: 'a2', targetId: 'vung', toUnitId: 'y', qty: 40, state: 'DELEGATED' },
    ])
    await returnAllocation(s, reg, 'a2', 'vung', 'baseline')
    expect(s.targets.get('vung')!.remainingQty).toBe(40)
    expect(s.allocations.get('a2')!.state).toBe('RETURNED')
  })
  it('trả lại hai lần không cộng hai lần', async () => {
    const s = new MemoryStore([target({ remainingQty: 40 })], [
      { id: 'a1', targetId: 'vung', toUnitId: 'x', qty: 560, state: 'ACCEPTED' },
      { id: 'a2', targetId: 'vung', toUnitId: 'y', qty: 40, state: 'RETURNED' },
    ])
    await returnAllocation(s, reg, 'a2', 'vung', 'baseline')
    expect(s.targets.get('vung')!.remainingQty).toBe(40)
  })
})

describe('cắt chỉ tiêu giữa kỳ — §C.5', () => {
  it('Bộ cắt 600 → 500 khi Vùng đã chia 560: KHÔNG từ chối, đặt OVER_COMMITTED', async () => {
    const s = new MemoryStore([target({ remainingQty: 40 })],
      [{ id: 'a1', targetId: 'vung', toUnitId: 'x', qty: 560, state: 'ACCEPTED' }])
    const r = await revise(s, reg, 'vung', 500)
    expect(r.overCommitted).toBe(true)
    const t = s.targets.get('vung')!
    expect(t.remainingQty).toBe(-60)   // phần âm HIỆN RA, là một việc phải xử
    expect(t.state).toBe('OVER_COMMITTED')
    expect(t.revisedQty).toBe(500)
    expect(t.baselineQty).toBe(600)    // nền gốc không đổi — I3
  })
  it('thu hồi bớt thì hết OVER_COMMITTED', async () => {
    const s = new MemoryStore([target({ remainingQty: -60, state: 'OVER_COMMITTED', revisedQty: 500 })],
      [{ id: 'a1', targetId: 'vung', toUnitId: 'x', qty: 560, state: 'ACCEPTED' }])
    await returnAllocation(s, reg, 'a1', 'vung', 'revised')
    expect(s.targets.get('vung')!.remainingQty).toBe(500)
  })
})

describe('duyệt — I3 + I8 + I9 gặp nhau đúng một chỗ', () => {
  const cat = { training_plan: { expects: 'quantitative' as const } }
  const bound = new Set(['trainee'])
  const at = '2027-01-15T00:00:00.000Z'

  it('đủ điều kiện thì duyệt và đóng dấu', async () => {
    const s = new MemoryStore([target({ state: 'DRAFT' })])
    const v = await approveBaseline(s, reg, { commitmentId: 'p1', docType: 'training_plan',
      decl: { grade: 'quantitative' }, targets: [s.targets.get('vung')!], catalogue: cat, boundEvidence: bound, at })
    expect(v).toEqual([])
    expect(s.targets.get('vung')!.approvedAt).toBe(at)
  })

  it('chỉ tiêu CHẾT thì không duyệt được, và không đóng dấu gì', async () => {
    const s = new MemoryStore([target({ state: 'DRAFT' })])
    const v = await approveBaseline(s, reg, { commitmentId: 'p1', docType: 'training_plan',
      decl: { grade: 'quantitative' }, targets: [s.targets.get('vung')!], catalogue: cat,
      boundEvidence: new Set(), at })
    expect(v[0].code).toBe('DEAD_TARGET')
    expect(s.targets.get('vung')!.approvedAt).toBeUndefined()
  })

  it('kế hoạch huấn luyện khai văn xuôi mà không có lý do → không duyệt', async () => {
    const s = new MemoryStore([target({ state: 'DRAFT' })])
    const v = await approveBaseline(s, reg, { commitmentId: 'p1', docType: 'training_plan',
      decl: { grade: 'narrative' }, targets: [], catalogue: cat, boundEvidence: bound, at })
    expect(v[0].code).toBe('NOT_MEASURABLE')
  })
})

describe('chốt chống trôi', () => {
  it('cột lệch với tổng dòng giao thì DỪNG, không lặng lẽ tự chữa', async () => {
    // 600 − 560 = 40, nhưng cột ghi 100: có ai đó ghi ngoài cửa Action.
    const s = new MemoryStore([target({ remainingQty: 100 })],
      [{ id: 'a1', targetId: 'vung', toUnitId: 'x', qty: 560, state: 'ACCEPTED' }])
    await expect(allocate(s, reg, { targetId: 'vung', toUnitId: 'y', qty: 10, basis: 'baseline', allocationId: 'a2' }))
      .rejects.toThrow(/đang ghi 100 người nhưng tổng dòng giao nói 40/)
    expect(s.allocations.has('a2')).toBe(false)
  })
  it('cột chưa khởi tạo (null) trên thước chia thì lần ghi này đặt nó', async () => {
    const s = new MemoryStore([target({ remainingQty: null })])
    await allocate(s, reg, { targetId: 'vung', toUnitId: 'y', qty: 100, basis: 'baseline', allocationId: 'a1' })
    expect(s.targets.get('vung')!.remainingQty).toBe(500)
  })
})

describe('vòng đời một lần giao', () => {
  it('nhận rồi thì vẫn tính vào tổng đã giao', async () => {
    const s = new MemoryStore([target({ remainingQty: 40 })],
      [{ id: 'a1', targetId: 'vung', toUnitId: 'x', qty: 560, state: 'DELEGATED' }])
    await acceptAllocation(s, 'a1')
    expect(s.allocations.get('a1')!.state).toBe('ACCEPTED')
    await expect(allocate(s, reg, { targetId: 'vung', toUnitId: 'y', qty: 41, basis: 'baseline', allocationId: 'a2' }))
      .rejects.toThrow(/còn 40/)
  })
})
