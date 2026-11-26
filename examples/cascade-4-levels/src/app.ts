// Trục dọc BỐN CẤP, chạy thật trên @dqa-ai-solutions/app-runtime/cascade-ledger.
//
//   Bộ 4.000  →  Vùng B 600  →  Tỉnh A 45  →  Xã X 3
//
// ⭐ APP MẪU NÀY CỐ Ý DÙNG TỪ VỰNG RIÊNG — `soGiao`, `conLai`, `trangThai`,
//    `tinhTrang` — chứ không dùng tên của engine. Nếu engine lỡ đọc thẳng một ô
//    nào của app thì mọi thứ ở đây sẽ hỏng ngay, nên đây vừa là ví dụ vừa là
//    phép thử cho lời hứa "engine không biết ô của app tên gì".

import {
  MeasureRegistry, Lens, attach, rollupTree, checkEvidencePlacement,
  allocate, acceptAllocation, returnAllocation, revise, approveBaseline,
  remainingQty, proposeTargets, PeriodBook,
  fundingSummary, checkFundingLinked, checkDerivation,
  checkTargetMeasurable, checkDeclaration, report,
  type Measure, type TargetRec, type AllocationRec, type FundingRec,
} from '@dqa-ai-solutions/app-runtime/cascade-ledger'
import { openStore, realPort, PROV, CTX } from './kho.js'

// ── Từ vựng của app: engine không bao giờ thấy những tên này ────────────────
// ⚠️ HAI VAI THÌ HAI THẤU KÍNH — dùng chung một cái là `id` của vai này đè vai kia.
export const LENS = new Lens({
  fields: {
    measure: 'thuocDo', baselineQty: 'soGiao', revisedQty: 'soDieuChinh',
    remainingQty: 'conLai', state: 'tinhTrang', period: 'ky', selfExecuted: 'tuPhat',
    fulfils: 'theoLanGiao',
  },
  values: {
    state: { OK: 'binh_thuong', OVER_COMMITTED: 'giao_vuot', DRAFT: 'dang_lap' },
    selfExecuted: { yes: 'co', no: 'khong' },
  },
})
export const ASSIGNMENT_LENS = new Lens({
  fields: { id: 'maLanGiao', qty: 'soChia', state: 'trangThai', target: 'maChiTieu', toUnit: 'maDonVi' },
  values: { state: { DELEGATED: 'da_giao', ACCEPTED: 'da_nhan', DONE: 'xong', RETURNED: 'tra_lai' } },
})

export const LEVEL = { bo: 'bo', vung: 'vung-b', tinh: 'tinh-a', xa: 'xa-x' } as const

export interface Result {
  remaining: Record<string, number | null>
  achieved: Record<string, number | null>
  errors: string[]
  warnings: string[]
  measured: ReturnType<typeof report>
  reported: number | null
  current: number | null
  drift: string[]
  funding: ReturnType<typeof fundingSummary>
  /** id thật kernel sinh ra, để phép thử soi lại kho. */
  ids: Record<string, string>
}

export async function run(): Promise<Result> {
  const errors: string[] = []
  const reg = new MeasureRegistry()

  // ① Bộ định nghĩa hai thước — một CHIA được, một chỉ TRUYỀN được.
  const HEADCOUNT: Measure = reg.define({
    key: 'head_count', unit: 'người', agg: 'sum', allocation: 'divide',
    source: 'derived', evidence: ['hoc_vien'], sourceRef: 'QĐ-01/2027',
  })
  const RATIO: Measure = reg.define({
    key: 'ty_le_ht', unit: '%', agg: 'ratio', allocation: 'replicate',
    source: 'reported', sourceRef: 'NQ.../2027',
  })
  try { reg.define({ ...RATIO, key: 'sai', allocation: 'divide' }) }
  catch (e) { errors.push(`thước sai hình dạng bị bác: ${(e as Error).message}`) }

  // ② KHO THẬT của kernel — ontology thật, provenance thật, cổng thật.
  const onto = await openStore()
  const store = attach(realPort(onto), {
    targetType: 'ChiTieu', allocationType: 'LanGiao',
    targetLens: LENS, allocationLens: ASSIGNMENT_LENS,
    allocationsOf: (id) => ({ op: 'compare',
      left: { kind: 'property', entity: 'LanGiao', name: 'maChiTieu' },
      cmp: '=', right: { kind: 'literal', value: id } }),
    provenance: PROV,
  })

  // Hàng lưu bằng TỪ VỰNG CỦA APP, kèm ô nghiệp vụ engine không biết là có.
  const create = async (measureKey: string, assignedQty: number, extra: Record<string, unknown> = {}) =>
    (await onto.create('ChiTieu', {
      thuocDo: measureKey, soGiao: assignedQty, conLai: assignedQty, tinhTrang: 'binh_thuong', ky: '2027', tuPhat: 'khong',
      maTinh: '01', ghiChu: 'x', nguoiKy: 'ROLE-HEAD', ...extra,
    }, PROV, CTX)).id

  // ⭐ ĐỈNH TRỤC PHẢI KHAI TỰ PHÁT — không ai giao cho Bộ, nên chỉ tiêu của nó
  //    mồ côi theo định nghĩa. Ba cấp dưới nối về đúng lần giao sinh ra nó.
  const ids = {
    bo: await create('head_count', 4000, { tuPhat: 'co' }),
    vung: await create('head_count', 600, { theoLanGiao: 'g1' }),
    tinh: await create('head_count', 45, { theoLanGiao: 'g2' }),
    xa: await create('head_count', 3, { theoLanGiao: 'g5' }),
    tyLeBo: await create('ty_le_ht', 25, { conLai: null, tuPhat: 'co' }),
    tyLeQk: await create('ty_le_ht', 25, { conLai: null, theoLanGiao: 'r1' }),
  }
  const T = async (id: string) => (await store.getTarget(id))!

  // ③ Bộ chia 600 cho Vùng B.
  await allocate(store, reg, { targetId: ids.bo, toUnitId: LEVEL.vung, qty: 600, basis: 'baseline', allocationId: 'g1' })
  await acceptAllocation(store, 'g1')

  // ④ Vùng nhận, và ĐỀ XUẤT chỉ tiêu của mình từ chính lần giao ấy.
  const candidates = proposeTargets({
    received: [{ allocationId: 'g1', measureKey: 'head_count', qty: 600, dueDate: '2027-11-30' }],
    previous: [{ measureKey: 'head_count', baselineQty: 580, achievedQty: 561 }],
    periodKey: '2027',
    measures: new Map([['head_count', HEADCOUNT], ['ty_le_ht', RATIO]]),
  })

  // ⑤ Vùng chia 560 cho các tỉnh, giữ 40 tự mở lớp.
  await allocate(store, reg, { targetId: ids.vung, toUnitId: LEVEL.tinh, qty: 45, basis: 'baseline', allocationId: 'g2' })
  await allocate(store, reg, { targetId: ids.vung, toUnitId: 'cac-tinh-khac', qty: 515, basis: 'baseline', allocationId: 'g3' })

  // ⛔ Thử chia thêm 41 khi chỉ còn 40.
  try {
    await allocate(store, reg, { targetId: ids.vung, toUnitId: 'tinh-b', qty: 41, basis: 'baseline', allocationId: 'g4' })
  } catch (e) { errors.push(`giao vượt bị chặn: ${(e as Error).message}`) }

  // ⑥ Tỉnh chia 42 cho các xã, giữ 3.
  await allocate(store, reg, { targetId: ids.tinh, toUnitId: LEVEL.xa, qty: 3, basis: 'baseline', allocationId: 'g5' })
  await allocate(store, reg, { targetId: ids.tinh, toUnitId: 'cac-xa-khac', qty: 39, basis: 'baseline', allocationId: 'g6' })

  // ⑦ Tỷ lệ TRUYỀN xuống — không đụng phần còn lại.
  await allocate(store, reg, { targetId: ids.tyLeBo, toUnitId: LEVEL.vung, qty: 25, basis: 'baseline', allocationId: 'r1' })
  try {
    await allocate(store, reg, { targetId: ids.tyLeQk, toUnitId: LEVEL.tinh, qty: 2, basis: 'baseline', allocationId: 'r2' })
  } catch (e) { errors.push(`chia nhỏ một tỷ lệ bị chặn: ${(e as Error).message}`) }

  const remaining: Record<string, number | null> = {}
  for (const [name, id] of Object.entries({ bo: ids.bo, vung: ids.vung, tinh: ids.tinh, xa: ids.xa, tyLe: ids.tyLeBo })) {
    const t = await T(id)
    remaining[name] = remainingQty(t, reg.require(t.measureKey), await store.listAllocations(id), 'baseline')
  }

  // ⑧ ⭐ BẰNG CHỨNG LÀ BẢN GHI THẬT, VÀ ENGINE ĐẾM CẠNH — không ai gõ số đạt.
  //    Xã X cử 3 học viên; vùng tự mở lớp cho 2 người. Mỗi học viên là một
  //    bản ghi có cạnh nối về đúng MỘT chỉ tiêu.
  const trainees: Array<{ evidenceId: string; targetId: string }> = []
  const sendToTraining = async (fullName: string, targetId: string) => {
    const trainee = await onto.create('HocVien', { hoTen: fullName, maChiTieu: targetId }, PROV, CTX)
    await onto.link('hocVienTheoChiTieu', trainee.id, targetId, PROV, CTX)
    trainees.push({ evidenceId: trainee.id, targetId: targetId })
  }
  for (const t of ['Nguyễn Văn A', 'Trần Văn B', 'Lê Văn C']) await sendToTraining(t, ids.xa)
  for (const t of ['Phạm Văn D', 'Đỗ Văn E']) await sendToTraining(t, ids.vung)

  // Đếm bằng cách DUYỆT CẠNH — app biết cạnh tên gì, engine không cần biết.
  // ⚠️ ĐẾM BẰNG `paths`, KHÔNG BẰNG `nodes`. `TraversalResult.nodes` của kernel
  //    chỉ gom ĐƯỜNG ĐI ĐẦU TIÊN, còn `paths` mới là mỗi hàng xóm một đường.
  //    Đếm bằng `nodes` thì mọi chỉ tiêu đều ra 1 — sai mà trông như có số.
  const edgeCounts: Record<string, number> = {}
  for (const id of Object.values(ids)) {
    const r = await onto.traverse({ start: id, path: ['hocVienTheoChiTieu'], direction: 'backward' }, CTX)
    edgeCounts[id] = r.paths.filter((p) => p.length > 0).length
  }

  const treeTargets: TargetRec[] = []
  for (const id of Object.values(ids)) treeTargets.push(await T(id))
  const tree = rollupTree({
    targets: treeTargets,
    allocations: [...await store.listAllocations(ids.bo), ...await store.listAllocations(ids.vung),
      ...await store.listAllocations(ids.tinh), ...await store.listAllocations(ids.tyLeBo)],
    ownEvidence: edgeCounts,
    measures: new Map([['head_count', HEADCOUNT], ['ty_le_ht', RATIO]]),
  })
  const achieved: Record<string, number | null> = {
    bo: tree.get(ids.bo)!.achieved, vung: tree.get(ids.vung)!.achieved,
    tinh: tree.get(ids.tinh)!.achieved, xa: tree.get(ids.xa)!.achieved,
    tyLe: tree.get(ids.tyLeBo)!.achieved,
  }

  // ⑨ Đo được chưa — ba điều kiện, và bậc đo khai theo LOẠI.
  const warnings: string[] = []
  warnings.push(...checkTargetMeasurable(await T(ids.xa), HEADCOUNT, new Set(['hoc_vien'])).map((v) => v.message))
  warnings.push(...checkTargetMeasurable(await T(ids.xa), HEADCOUNT, new Set()).map((v) => v.message))
  const catalog = {
    chi_thi: { expects: 'narrative' as const },
    ke_hoach_huan_luyen: { expects: 'quantitative' as const },
  }
  warnings.push(...checkDeclaration('kh-1', 'ke_hoach_huan_luyen', { grade: 'narrative' }, catalog).map((v) => v.message))
  const measured = report([
    { subject: 'kh-tinh', mandate: 'narrative', commitment: 'quantitative' },
    { subject: 'kh-xa', mandate: 'narrative', commitment: 'narrative',
      decl: { grade: 'narrative', reason: 'chờ chỉ tiêu trên giao', approvedBy: 'ROLE-HEAD', reviewBy: '2027-06-30' } },
  ], '2027-12-31')

  // ⑩ Kỳ: xã chốt năm trước, tỉnh còn ghi. Rồi xã báo bổ sung.
  const periodBook = new PeriodBook()
  periodBook.close('2027', LEVEL.xa, { [ids.xa]: 3 }, '2027-11-20T00:00:00.000Z')
  periodBook.assertOpen('2027', LEVEL.tinh)   // tỉnh vẫn mở — không ném
  periodBook.restate({ id: 'bs1', periodKey: '2027', unitId: LEVEL.xa, targetId: ids.xa,
    delta: -1, reason: 'một học viên bỏ giữa khoá', at: '2027-12-10T00:00:00.000Z' })

  // ⑪ Tiền bám chỉ tiêu.
  const fundingFlows: FundingRec[] = [
    { id: 'kh1', targetId: ids.tinh, proposed: 450_000_000, approved: 400_000_000 },
    { id: 'kh2', targetId: ids.tinh, proposed: 50_000_000, approved: 50_000_000 },
    { id: 'kh3', targetId: null, proposed: 20_000_000, approved: 20_000_000 },
  ]
  warnings.push(...checkFundingLinked(fundingFlows).map((v) => v.message))

  // ⑫ Bộ CẮT chỉ tiêu giữa kỳ, xuống dưới phần Vùng đã chia.
  const cut = await revise(store, reg, ids.vung, 500)
  const afterCut = await T(ids.vung)

  // ⑬ Thu hồi bớt để hết giao vượt.
  await returnAllocation(store, reg, 'g3', ids.vung, 'revised')
  const afterRevoke = await T(ids.vung)

  // ⑭ Duyệt: I3 + I8 + I9 gặp nhau đúng một chỗ.
  const approvalViolations = await approveBaseline(store, reg, {
    commitmentId: 'kh-tinh', docType: 'ke_hoach_huan_luyen', decl: { grade: 'quantitative' },
    targets: [await T(ids.tinh)], catalogue: catalog, boundEvidence: new Set(['hoc_vien']),
    at: '2027-01-15T00:00:00.000Z',
  })

  // ⑮ Bất biến dò được trên cả rổ.
  // Chấm I2 trên CẢ trục — bốn cấp phải sạch; chỉ cái cố ý hỏng mới bị kêu.
  const orphans = checkDerivation([
    await T(ids.bo), await T(ids.vung), await T(ids.tinh), await T(ids.xa),
    { id: 't-le', measureKey: 'head_count', baselineQty: 5 },   // ⛔ cố ý: không tự phát, không nối
  ])
  // Đếm hai lần: cố ý nối THÊM một học viên của xã vào chỉ tiêu tỉnh (cấp cha).
  const misplacedEvidence = checkEvidencePlacement(
    [...trainees, { evidenceId: trainees[0].evidenceId, targetId: ids.tinh }], tree)

  return {
    remaining: remaining,
    achieved: achieved,
    errors: errors,
    warnings: [...warnings, ...orphans.map((v: { message: string }) => v.message), ...misplacedEvidence.map((v: { message: string }) => v.message),
      ...(cut.overCommitted ? [`cắt giữa kỳ: ${afterCut.state}, còn ${afterCut.remainingQty}`] : []),
      `thu hồi xong: còn ${afterRevoke.remainingQty}`,
      `duyệt kế hoạch tỉnh: ${approvalViolations.length === 0 ? 'đạt' : approvalViolations[0].message}`,
      `ứng viên chỉ tiêu Vùng: ${candidates[0].because} (đủ để bấm nhận: ${candidates[0].complete})`],
    measured: measured,
    reported: periodBook.asReported('2027', LEVEL.xa, ids.xa),
    current: periodBook.asNow('2027', LEVEL.xa, ids.xa),
    drift: periodBook.drifted().map((v) => v.message),
    funding: fundingSummary(ids.tinh, fundingFlows),
    ids: ids,
  }
}
