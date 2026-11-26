// C4 · E6 · H5 · I1 — bốn chỗ hụt của sổ nghiệm thu, mỗi chỗ một phép thử.
import { describe, it, expect } from 'vitest'
import {
  MeasureRegistry, MemoryStore, PeriodBook, Lens, recordActual, overdueExemptions, reportedTotal, reportedAchieved,
  allocate, rollupTree, remainingQty,
  type Measure, type MeasurePort, type TargetRow, type ActualRec, type AllocationRec,
} from './index.js'

// ── H5 · Thước phải sống qua lần khởi động lại ─────────────────────────────
describe('H5 — thước cấp trên định nghĩa sống qua khởi động lại', () => {
  const saved: Measure[] = []
  const port: MeasurePort = {
    saveMeasure: async (m) => { saved.push(m) },
    loadMeasures: async () => [...saved],
  }

  it('định nghĩa thì GHI XUỐNG, không chỉ nhớ trong đầu', async () => {
    const reg = new MeasureRegistry()
    await reg.defineAndSave(port, { key: 'xa_dat_chuan', unit: 'xã', agg: 'sum',
      allocation: 'divide', source: 'reported', sourceRef: 'QĐ.../2027' })
    expect(saved).toHaveLength(1)
  })

  it('⭐ vứt sổ trong bộ nhớ đi, dựng lại TỪ KHO, vẫn dùng được', async () => {
    const reloaded = await MeasureRegistry.load(port)      // như máy chủ vừa khởi động lại
    expect(reloaded.require('xa_dat_chuan').unit).toBe('xã')
  })

  it('ghi hỏng thì sổ trong bộ nhớ KHÔNG được nói là đã có', async () => {
    const reg = new MeasureRegistry()
    const hong: MeasurePort = { saveMeasure: async () => { throw new Error('kho đầy') }, loadMeasures: async () => [] }
    await expect(reg.defineAndSave(hong, { key: 'x', unit: 'cái', agg: 'sum',
      allocation: 'divide', source: 'reported' })).rejects.toThrow()
    expect(reg.get('x')).toBeUndefined()
  })

  it('thước sai hình dạng thì KHÔNG ghi xuống', async () => {
    const reg = new MeasureRegistry()
    const before = saved.length
    await expect(reg.defineAndSave(port, { key: 'ty_le', unit: '%', agg: 'ratio',
      allocation: 'divide', source: 'reported' })).rejects.toThrow(/không chia xuống được/)
    expect(saved).toHaveLength(before)
  })
})

// ── C4 · Số đạt do NGƯỜI báo ───────────────────────────────────────────────
describe('C4 — ghi số đạt do người báo, và ba cửa nó phải qua', () => {
  const REPORTED_RATIO: Measure = { key: 'ty_le_ht', unit: '%', agg: 'ratio', allocation: 'replicate', source: 'reported' }
  const COUNT: Measure = { key: 'head_count', unit: 'người', agg: 'sum', allocation: 'divide',
    source: 'derived', evidence: ['hoc_vien'] }
  const reg = new MeasureRegistry(); reg.define(REPORTED_RATIO); reg.define(COUNT)

  const buildStore = () => {
    const write: ActualRec[] = []
    const s = new MemoryStore([
      { id: 't-bao', measureKey: 'ty_le_ht', baselineQty: 25, remainingQty: null, state: 'OK', periodKey: '2027' },
      { id: 't-dem', measureKey: 'head_count', baselineQty: 3, remainingQty: 3, state: 'OK', periodKey: '2027' },
    ] as TargetRow[])
    ;(s as MemoryStore & { insertActual?: (a: ActualRec) => Promise<void> }).insertActual =
      async (a: ActualRec) => { write.push(a) }
    return { s, ghi: write }
  }

  it('kỳ còn mở + có chứng từ thì ghi được', async () => {
    const { s, ghi: write } = buildStore()
    await recordActual(s, new PeriodBook(), reg, { id: 'a1', targetId: 't-bao', unitId: 'xa-x',
      periodKey: '2027', qty: 27, evidenceRef: 'BC-115/2027' })
    expect(write[0].qty).toBe(27)
  })

  it('⭐ thước ĐẾM-TỪ-CẠNH thì KHÔNG cho gõ tay — giữ cho lối `derived` có nghĩa', async () => {
    const { s } = buildStore()
    await expect(recordActual(s, new PeriodBook(), reg, { id: 'a2', targetId: 't-dem', unitId: 'xa-x',
      periodKey: '2027', qty: 99, evidenceRef: 'BC-1' })).rejects.toThrow(/không gõ tay được/)
  })

  it('kỳ ĐÃ ĐÓNG thì chặn — I5 nay có đường ghi để ép', async () => {
    const { s } = buildStore()
    const so = new PeriodBook(); so.close('2027', 'xa-x', {}, '2027-11-20T00:00:00.000Z')
    await expect(recordActual(s, so, reg, { id: 'a3', targetId: 't-bao', unitId: 'xa-x',
      periodKey: '2027', qty: 27, evidenceRef: 'BC-2' })).rejects.toThrow(/đã chốt/)
  })

  it('không có chứng từ thì không ghi một con số trần trụi', async () => {
    const { s } = buildStore()
    await expect(recordActual(s, new PeriodBook(), reg, { id: 'a4', targetId: 't-bao', unitId: 'xa-x',
      periodKey: '2027', qty: 27, evidenceRef: '  ' })).rejects.toThrow(/chứng từ/)
  })

  it('app chưa bind vai `Actual` thì báo rõ, không ghi lặng lẽ vào đâu', async () => {
    /* ⚠️ PHẢI DỰNG MỘT KHO KHÔNG CÓ `insertActual`, không dùng `MemoryStore`.
       Bản trước dùng `MemoryStore` để "chứng minh nó thiếu" — rồi 5/9/2026
       `MemoryStore` được cho `insertActual` (bản tham chiếu phải chở được lối
       `reported`), và phép thử này đỏ. Nó đo bằng một sự VẮNG MẶT tình cờ của
       vật đo, chứ không đo điều nó định nói. Nay gỡ thẳng hàm ấy ra. */
    const base = new MemoryStore([{ id: 't-bao', measureKey: 'ty_le_ht', baselineQty: 25,
      remainingQty: null, state: 'OK', periodKey: '2027' }] as TargetRow[])
    const s = Object.create(base) as typeof base
    Object.defineProperty(s, 'insertActual', { value: undefined })
    await expect(recordActual(s, new PeriodBook(), reg, { id: 'a5', targetId: 't-bao', unitId: 'u',
      periodKey: '2027', qty: 1, evidenceRef: 'x' })).rejects.toThrow(/vai `Actual` phải bind/)
  })
})

// ── E6 · Hết hạn miễn đo ───────────────────────────────────────────────────
describe('E6 — miễn đo là giấy phép CÓ THỜI HẠN', () => {
  const rows = [
    { subject: 'kh-xa', decl: { grade: 'narrative' as const, reason: 'chờ chỉ tiêu trên giao',
      approvedBy: 'ROLE-HEAD', reviewBy: '2027-06-30' } },
    { subject: 'kh-tinh', decl: { grade: 'narrative' as const, reason: 'x', approvedBy: 'y', reviewBy: '2028-06-30' } },
    { subject: 'quy-che', decl: { grade: 'narrative' as const } },   // đúng loại — không có hạn, không đòi
  ]
  it('tới hạn thì hồ sơ quay lại hàng việc, kèm việc phải làm', () => {
    const overdue = overdueExemptions(rows, '2027-12-31')
    expect(overdue.map((v) => v.subject)).toEqual(['kh-xa'])
    expect(overdue[0].todo).toMatch(/bổ sung chỉ tiêu hoặc mốc/)
  })
  it('chưa tới hạn thì im', () => {
    expect(overdueExemptions(rows, '2027-01-01')).toEqual([])
  })
})

// ── I1 · MIỀN THỨ HAI: quản lý tài trợ, từ vựng tiếng Anh ─────────────────
describe('I1 — cùng lõi chạy cho miền quản lý tài trợ, không sửa một dòng pack', () => {
  // award → subaward → drawdown. Không một chữ nào của app tham chiếu.
  const LENS = new Lens({
    fields: { measure: 'metric', baselineQty: 'awardedAmount', remainingQty: 'unobligated',
      state: 'ledgerStatus', period: 'fiscalYear' },
    values: { state: { OK: 'active', OVER_COMMITTED: 'overobligated', DRAFT: 'draft' } },
  })
  const USD: Measure = { key: 'usd', unit: 'USD', agg: 'sum', allocation: 'divide', source: 'reported' }
  const reg = new MeasureRegistry(); reg.define(USD)

  it('chia tài trợ xuống subaward, và không cho vượt', async () => {
    const row = { id: 'aw-1', metric: 'usd', awardedAmount: 500_000, unobligated: 500_000,
      ledgerStatus: 'active', fiscalYear: 'FY2027',
      // ô nghiệp vụ của miền tài trợ — pack không đọc
      cfda: '12.345', recipientDUNS: '0123', indirectRate: 0.32 }
    const store = new MemoryStore([LENS.readTarget(row)])
    await allocate(store, reg, { targetId: 'aw-1', toUnitId: 'sub-a', qty: 300_000,
      basis: 'baseline', allocationId: 's1' })
    const t = (await store.getTarget('aw-1'))!
    expect(remainingQty(t, USD, await store.listAllocations('aw-1'), 'baseline')).toBe(200_000)
    await expect(allocate(store, reg, { targetId: 'aw-1', toUnitId: 'sub-b', qty: 250_000,
      basis: 'baseline', allocationId: 's2' })).rejects.toThrow(/còn 200000 USD/)
  })

  it('⭐ ô nghiệp vụ của miền tài trợ KHÔNG lọt vào kiểu của engine', () => {
    const t = LENS.readTarget({ id: 'a', metric: 'usd', awardedAmount: 1, unobligated: 1,
      ledgerStatus: 'active', cfda: '12.345', indirectRate: 0.32 }) as unknown as Record<string, unknown>
    for (const o of ['cfda', 'recipientDUNS', 'indirectRate']) expect(t[o]).toBeUndefined()
  })

  it('trạng thái riêng của miền được dịch hai chiều', () => {
    expect(LENS.readTarget({ id: 'a', metric: 'usd', awardedAmount: 1,
      unobligated: -1, ledgerStatus: 'overobligated' }).state).toBe('OVER_COMMITTED')
    expect(LENS.writeTarget({ state: 'OVER_COMMITTED' })).toEqual({ ledgerStatus: 'overobligated' })
  })

  it('gộp lên hoạt động y hệt, trên cây subaward', () => {
    const targets = [
      { id: 'aw-1', measureKey: 'usd', baselineQty: 500_000 },
      { id: 'sub-a', measureKey: 'usd', baselineQty: 300_000, fulfilsAllocationId: 's1' },
    ]
    const allocs: AllocationRec[] = [{ id: 's1', targetId: 'aw-1', toUnitId: 'sub-a',
      qty: 300_000, state: 'ACCEPTED' }]
    const tree = rollupTree({ targets, allocations: allocs,
      ownEvidence: { 'aw-1': 0, 'sub-a': 120_000 }, measures: new Map([['usd', USD]]) })
    expect(tree.get('aw-1')!.achieved).toBe(120_000)   // cộng lên từ subaward
  })
})

// ⭐ VÒNG KHÉP CỦA LỐI `reported` — 5/9/2026. Ghi rồi ĐỌC LẠI rồi CỘNG, tất cả
//    bằng phép của pack. Trước đó pack chỉ làm được nửa đầu.
describe('reported — ghi, đọc lại, cộng: một vòng khép', () => {
  it('recordActual → listActuals → reportedTotal ra đúng số', async () => {
    const reg = new MeasureRegistry()
    const m = reg.define({ key: 'so_lop', unit: 'lớp', agg: 'sum', allocation: 'divide', source: 'reported' })
    const s = new MemoryStore([{
      id: 't-lop', measureKey: 'so_lop', baselineQty: 10, remainingQty: 10, state: 'OK',
    }])
    const book = new PeriodBook()
    await recordActual(s, book, reg, { id: 'a1', targetId: 't-lop', unitId: 'xa', periodKey: '2026', qty: 3, evidenceRef: 'BC/1' })
    await recordActual(s, book, reg, { id: 'a2', targetId: 't-lop', unitId: 'xa', periodKey: '2027', qty: 4, evidenceRef: 'BC/2' })
    const doc = await s.listActuals('t-lop')
    expect(doc).toHaveLength(2)
    expect(reportedTotal(m, doc)).toBe(7)
    /* ⭐ Và pack tự khép vòng — app không phải nối `listActuals` với `reportedTotal`. */
    expect(await reportedAchieved(s, reg, 't-lop')).toBe(7)
    expect(await reportedAchieved(s, reg, 't-lop', '2027')).toBe(4)
  })

  it('⛔ kho chưa khai `listActuals` thì NÉM, không lặng lẽ trả 0', async () => {
    const reg2 = new MeasureRegistry()
    reg2.define({ key: 'so_lop3', unit: 'lớp', agg: 'sum', allocation: 'divide', source: 'reported' })
    const base = new MemoryStore([{ id: 't3', measureKey: 'so_lop3', baselineQty: 5, remainingQty: 5, state: 'OK' }])
    const s = Object.create(base) as typeof base
    Object.defineProperty(s, 'listActuals', { value: undefined })
    await expect(reportedAchieved(s, reg2, 't3')).rejects.toThrow(/chỗ ĐỌC số đạt/)
  })

  it('lọc theo kỳ thì chỉ trả kỳ ấy', async () => {
    const reg = new MeasureRegistry()
    reg.define({ key: 'so_lop2', unit: 'lớp', agg: 'sum', allocation: 'divide', source: 'reported' })
    const s = new MemoryStore([{ id: 't2', measureKey: 'so_lop2', baselineQty: 10, remainingQty: 10, state: 'OK' }])
    await recordActual(s, new PeriodBook(), reg, { id: 'b1', targetId: 't2', unitId: 'xa', periodKey: '2026', qty: 3, evidenceRef: 'BC/1' })
    await recordActual(s, new PeriodBook(), reg, { id: 'b2', targetId: 't2', unitId: 'xa', periodKey: '2027', qty: 4, evidenceRef: 'BC/2' })
    expect(await s.listActuals('t2', '2027')).toHaveLength(1)
  })
})
