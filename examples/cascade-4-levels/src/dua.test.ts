// ⭐ PHÉP THỬ ĐUA THẬT — Promise.all, không mô phỏng chen ngang.
//
// Hai cán bộ bấm "giao chỉ tiêu" cùng lúc trên một chỉ tiêu còn 40, mỗi người
// giao 40. Đúng một người được, hay cả hai?
import { describe, it, expect } from 'vitest'
import { MeasureRegistry, allocate, attach, Lens, type Measure } from '@dqa-ai-solutions/app-runtime/cascade-ledger'
import { openStore, naivePort, lockedPort, realPort, PROV, CTX } from './kho.js'

// ⚠️ HAI VAI, HAI THẤU KÍNH. Dùng chung một cái là `id` của vai này đè lên vai
//    kia — lỗi đầu tiên ví dụ này bắt được, và bắt bằng cách hỏng thật.
const TARGET_LENS = new Lens({
  // `id` KHÔNG ánh xạ: chỉ tiêu dùng thẳng id kernel sinh ra.
  fields: { measure: 'thuocDo', baselineQty: 'soGiao', remainingQty: 'conLai', state: 'tinhTrang' },
  values: { state: { OK: 'binh_thuong', OVER_COMMITTED: 'giao_vuot', DRAFT: 'dang_lap' } },
})
const ASSIGNMENT_LENS = new Lens({
  fields: { id: 'maLanGiao', qty: 'soChia', state: 'trangThai', target: 'maChiTieu', toUnit: 'maDonVi' },
  values: { state: { DELEGATED: 'da_giao', ACCEPTED: 'da_nhan', DONE: 'xong', RETURNED: 'tra_lai' } },
})
const HEADCOUNT: Measure = { key: 'head_count', unit: 'người', agg: 'sum', allocation: 'divide', source: 'reported' }

async function race(portFactory: (o: Awaited<ReturnType<typeof openStore>>) => ReturnType<typeof naivePort>) {
  const onto = await openStore()
  const target = await onto.create('ChiTieu',
    { thuocDo: 'head_count', soGiao: 600, conLai: 40, tinhTrang: 'binh_thuong' }, PROV, CTX)
  // Mồi phải NHẤT QUÁN: 600 − 560 = 40. Mồi lệch thì chốt chống trôi chặn ngay,
  // và đó đúng là việc của nó — ví dụ này đã bị chặn một lần vì mồi sai.
  await onto.create('LanGiao', { maLanGiao: 'g-cu', maChiTieu: target.id,
    maDonVi: 'cac-tinh-khac', soChia: 560, trangThai: 'da_giao' }, PROV, CTX)
  const port = portFactory(onto)
  const store = attach(port, {
    targetType: 'ChiTieu', allocationType: 'LanGiao',
    targetLens: TARGET_LENS, allocationLens: ASSIGNMENT_LENS,
    allocationsOf: (id) => ({ op: 'compare', left: { kind: 'property', entity: 'LanGiao', name: 'maChiTieu' },
      cmp: '=', right: { kind: 'literal', value: id } }),
    provenance: PROV,
  })
  const reg = new MeasureRegistry(); reg.define(HEADCOUNT)

  const results = await Promise.allSettled([
    allocate(store, reg, { targetId: target.id, toUnitId: 'tinh-a', qty: 40, basis: 'baseline', allocationId: 'g-a' }),
    allocate(store, reg, { targetId: target.id, toUnitId: 'tinh-b', qty: 40, basis: 'baseline', allocationId: 'g-b' }),
  ])
  const succeeded = results.filter((k) => k.status === 'fulfilled').length
  const after = await onto.get(target.id, CTX)
  const assigned = (await onto.find('LanGiao', undefined, CTX))
    .reduce((s, i) => s + Number(i.data.soChia ?? 0), 0)   // gồm cả 560 mồi
  return { thanh: succeeded, conLai: Number(after!.data.conLai), daGiao: assigned, ten: port.tenGoi }
}

describe('đua thật trên cổng kho thật của kernel', () => {
  it('⛔ shim NGÂY THƠ ở tầng ứng dụng KHÔNG chặn được — đo được, không suy', async () => {
    const r = await race(naivePort)
    expect(r.thanh).toBe(2)          // cả hai cùng qua cửa
    expect(r.daGiao).toBe(640)       // 560 + 40 + 40 → vượt trần 600
    expect(r.conLai).toBe(0)         // và sổ nói còn 0 — sai mà trông như đúng
  })

  it('⚠️ shim CÓ KHOÁ chặn được — nhưng chỉ trong MỘT tiến trình', async () => {
    const r = await race(lockedPort)
    expect(r.thanh).toBe(1)
    expect(r.daGiao).toBe(600)       // 560 + 40, đúng trần
    expect(r.conLai).toBe(0)
  })

  it('✅ CỔNG THẬT của kernel chặn được — đúng ở mọi số tiến trình', async () => {
    const r = await race(realPort)
    expect(r.thanh).toBe(1)          // đúng một người qua cửa
    expect(r.daGiao).toBe(600)       // không vượt trần
    expect(r.conLai).toBe(0)
  })
})
