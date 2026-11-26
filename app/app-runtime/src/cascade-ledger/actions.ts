// Tầng Action — cửa ghi duy nhất. §E.1.
//
// Mỗi hàm ở đây nhận một `LedgerStore` ĐANG Ở TRONG giao dịch của bên gọi, và
// làm trọn một việc nghiệp vụ: trừ phần còn lại VÀ tạo bản giao là một, không
// tách ra được.

import {
  type AllocationRec, type Basis, type Measure, type MeasurabilityDecl,
  type DocTypeExpectation, type Violation, LedgerError,
} from './types.js'
import { allocatedQty, effectiveQty, plan, planReturn, planRevise, reportedTotal } from './algebra.js'
import type { ActualRec, LedgerStore, TargetRow } from './store.js'
import type { PeriodBook } from './period.js'
import type { MeasureRegistry } from './measure.js'
import { checkTargetMeasurable, checkDeclaration } from './measurability.js'

export interface AllocateParams {
  targetId: string
  toUnitId: string
  qty: number
  basis: Basis
  allocationId: string
  allowOverAllocation?: boolean
}

/** Số lần thử lại khi có người chen vào giữa. Đua ở một chỉ tiêu là chuyện hiếm và ngắn. */
const RETRIES = 3

async function loadPair(store: LedgerStore, targetId: string, reg: MeasureRegistry) {
  const t = await store.getTarget(targetId)
  if (!t) throw new LedgerError('MEASURE_UNKNOWN', `Không có chỉ tiêu "${targetId}"`, targetId)
  return { t, m: reg.require(t.measureKey) as Measure }
}

/** Nền đang có hiệu lực của một chỉ tiêu. */
const currentBasis = (t: TargetRow): Basis => (t.revisedQty === null || t.revisedQty === undefined ? 'baseline' : 'revised')

/**
 * ⭐ CHỐT CHỐNG TRÔI — chạy trước MỌI lệnh ghi, không chỉ trong `probe`.
 *
 * `plan()` tính lại phần còn lại từ *nền − tổng dòng giao*; cột `remaining_qty`
 * là thứ chở ràng buộc CSDL. Hai thứ ấy PHẢI bằng nhau. Lệch nhau nghĩa là có
 * ai đó đã ghi ngoài cửa Action — đúng thứ `check-writes` sinh ra để chặn.
 *
 * ⚠️ VÌ SAO KHÔNG LẶNG LẼ TỰ CHỮA: nếu mỗi lệnh ghi cứ lấy số tính lại đè lên
 *    cột, thì cột luôn luôn đúng sau mỗi lần ghi và phép đo đối chiếu ở §K.2.2
 *    sẽ KHÔNG BAO GIỜ bắt được gì. Lúc ấy cột đúng là bộ nhớ đệm, và lời chê
 *    "cột dẫn xuất sẽ trôi" thành đúng. Trôi thì phải kêu, không phải phải vá.
 *
 * Cột `null` trên thước `divide` là *chưa khởi tạo* — cho phép, và lần ghi này
 * đặt nó.
 */
function assertNoDrift(
  t: TargetRow, m: Measure, allocs: readonly AllocationRec[], basis: Basis,
): void {
  if (m.allocation === 'replicate') return
  if (t.remainingQty === null || t.remainingQty === undefined) return
  const computed = effectiveQty(t, basis) - allocatedQty(allocs)
  if (t.remainingQty !== computed) {
    throw new LedgerError('LEDGER_DRIFT',
      `Phần còn lại đang ghi ${t.remainingQty} ${m.unit} nhưng tổng dòng giao nói ${computed} ${m.unit}. `
      + 'Có lệnh ghi đi ngoài cửa Action — dừng lại, đối chiếu trước khi giao tiếp.', t.id)
  }
}

/**
 * Giao một phần chỉ tiêu xuống một đơn vị — I1.
 *
 * ⭐ Vòng lặp không phải để "thử lại cho may". `compareAndSetRemaining` trả
 *    `false` là bằng chứng CHẮC CHẮN rằng con số ta vừa tính đã cũ — nên tính
 *    lại trên số mới là việc đúng, và nếu lần này vượt trần thì `plan()` ném
 *    đúng lỗi người dùng cần đọc. Không có vòng lặp thì hai người bấm cùng lúc
 *    sẽ có một người nhận lỗi kỹ thuật thay vì lời giải thích.
 */
export async function allocate(
  store: LedgerStore, reg: MeasureRegistry, p: AllocateParams,
): Promise<AllocationRec> {
  for (let attempt = 0; ; attempt++) {
    const { t, m } = await loadPair(store, p.targetId, reg)
    const allocs = await store.listAllocations(p.targetId)
    assertNoDrift(t, m, allocs, p.basis)
    const next = plan(t, m, allocs, p.qty, p.basis, { allowOverAllocation: p.allowOverAllocation })

    const ok = await store.compareAndSetRemaining(p.targetId, t.remainingQty, next.nextRemaining)
    if (!ok) {
      if (attempt < RETRIES) continue
      throw new LedgerError('OVER_DELEGATED',
        'Có người khác vừa giao chỉ tiêu này cùng lúc. Mở lại và thử lần nữa.', p.targetId)
    }
    const rec: AllocationRec = {
      id: p.allocationId, targetId: p.targetId, toUnitId: p.toUnitId, qty: p.qty, state: 'DELEGATED',
    }
    await store.insertAllocation(rec)
    return rec
  }
}

/** Cấp dưới nhận / hoàn thành — không đụng tới đại lượng. */
export async function acceptAllocation(store: LedgerStore, id: string): Promise<void> {
  await store.setAllocationState(id, 'ACCEPTED')
}
export async function completeAllocation(store: LedgerStore, id: string): Promise<void> {
  await store.setAllocationState(id, 'DONE')
}

/**
 * Cấp dưới trả lại — cộng ngược, cùng giao dịch với việc trả.
 *
 * ⚠️ Phần trả lại nằm lại ở cấp trên chờ chia cho nơi khác. Không cộng ngược là
 *    khoá luôn phần mà chính mình vừa được trả lại.
 */
export async function returnAllocation(
  store: LedgerStore, reg: MeasureRegistry, allocationId: string, targetId: string, basis: Basis,
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    const { t, m } = await loadPair(store, targetId, reg)
    const allocs = await store.listAllocations(targetId)
    const a = allocs.find((x) => x.id === allocationId)
    if (!a) throw new LedgerError('OVER_DELEGATED', `Không có bản giao "${allocationId}"`, allocationId)
    if (a.state === 'RETURNED') return
    assertNoDrift(t, m, allocs, basis)

    const next = planReturn(t, m, allocs, a, basis)
    const ok = await store.compareAndSetRemaining(targetId, t.remainingQty, next.nextRemaining)
    if (!ok) {
      if (attempt < RETRIES) continue
      throw new LedgerError('OVER_DELEGATED', 'Có người khác vừa đổi chỉ tiêu này cùng lúc.', targetId)
    }
    await store.setAllocationState(allocationId, 'RETURNED')
    return
  }
}

/**
 * Điều chỉnh chỉ tiêu giữa kỳ — §C.5.
 *
 * ⚠️ KHÔNG từ chối khi nền mới thấp hơn phần đã chia. Cắt chỉ tiêu giữa năm là
 *    lệnh của cấp trên; từ chối là làm cán bộ không thi hành được. Engine đặt
 *    `OVER_COMMITTED` để phần âm HIỆN RA như một việc phải xử — thu hồi của ai
 *    là quyết định của người.
 */
export async function revise(
  store: LedgerStore, reg: MeasureRegistry, targetId: string, newQty: number,
): Promise<{ overCommitted: boolean }> {
  const { t, m } = await loadPair(store, targetId, reg)
  const allocs = await store.listAllocations(targetId)
  assertNoDrift(t, m, allocs, currentBasis(t))
  const r = planRevise(t, m, allocs, newQty)
  const ok = await store.compareAndSetRemaining(
    targetId, t.remainingQty, r.nextRemaining, r.overCommitted ? 'OVER_COMMITTED' : 'OK')
  if (!ok) throw new LedgerError('OVER_COMMITTED', 'Có người khác vừa đổi chỉ tiêu này cùng lúc.', targetId)
  await store.setRevised(targetId, newQty)
  return { overCommitted: r.overCommitted }
}

/**
 * Ghi một số đạt do người báo — I5 + C4.
 *
 * Ba cửa, theo thứ tự: thước có cho gõ tay không · kỳ còn mở không · có chứng từ
 * không. Cửa đầu là cửa hay bị quên nhất, và là cửa giữ cho lối `derived` có
 * nghĩa.
 */
export async function recordActual(
  store: LedgerStore, book: PeriodBook, reg: MeasureRegistry,
  p: { id: string; targetId: string; unitId: string; periodKey: string; qty: number; evidenceRef: string },
): Promise<ActualRec> {
  const { m } = await loadPair(store, p.targetId, reg)
  if (m.source !== 'reported') {
    throw new LedgerError('DEAD_TARGET',
      `Thước "${m.key}" đếm từ bản ghi thật — số đạt không gõ tay được. `
      + 'Muốn số này đổi thì tạo bản ghi thực hiện, đừng ghi đè con số.', p.targetId)
  }
  book.assertOpen(p.periodKey, p.unitId)
  if (!p.evidenceRef?.trim()) {
    throw new LedgerError('DEAD_TARGET', 'Số báo phải kèm dẫn chiếu chứng từ', p.targetId)
  }
  if (!store.insertActual) {
    throw new LedgerError('BIND_INVALID',
      'Kho chưa khai chỗ ghi số đạt — vai `Actual` phải bind trước khi dùng thước `reported`', p.targetId)
  }
  const rec: ActualRec = { ...p }
  await store.insertActual(rec)
  return rec
}

/**
 * Số đạt của một chỉ tiêu theo lối BÁO LÊN — đọc lại rồi cộng, bằng phép của pack.
 *
 * ⭐ VÌ SAO PACK LÀM, KHÔNG ĐỂ APP LÀM. Trước 5/9/2026 lối `reported` là NỬA
 *    VÒNG: pack chấm và ghi, rồi bỏ mặc phần đọc — `rollup()` nhận `ownEvidence`
 *    là con số app tự cộng. Với `derived` thì đúng (app đếm cạnh, pack không
 *    biết cạnh nào); với `reported` thì vô lý, vì chính pack vừa ghi con số ấy.
 *    Hậu quả đo được ở app tham chiếu: nó viết lại phép cộng bằng SQL của mình
 *    và phải tự nhớ luật "một kỳ một số" — luật pack biết rõ hơn.
 *
 * ⛔ Kho chưa khai `listActuals` thì NÉM, không lặng lẽ trả 0. Trả 0 là nói
 *    "chưa đạt gì" cho một chỗ thật ra là "chưa đọc được" — hai câu khác hẳn.
 */
export async function reportedAchieved(
  store: LedgerStore, registry: MeasureRegistry, targetId: string, periodKey?: string,
): Promise<number> {
  const { m } = await loadPair(store, targetId, registry)
  if (!store.listActuals) {
    throw new LedgerError('BIND_INVALID',
      'Kho chưa khai chỗ ĐỌC số đạt — vai `Actual` phải bind `listActuals` để pack cộng hộ', targetId)
  }
  return reportedTotal(m, await store.listActuals(targetId, periodKey))
}

export interface ApprovalInput {
  commitmentId: string
  docType: string
  decl?: MeasurabilityDecl
  targets: readonly TargetRow[]
  catalogue: Readonly<Record<string, DocTypeExpectation>>
  boundEvidence: ReadonlySet<string>
  at: string
}

/**
 * Duyệt và đóng băng nền — I3 + I8 + I9.
 *
 * ⭐ Đây là CHỖ DUY NHẤT ba bất biến ấy gặp nhau, và đúng là chỗ nên gặp: duyệt
 *    là lúc bản kế hoạch thành ràng buộc. Trước đó cán bộ còn đang soạn, chặn
 *    sớm chỉ làm phiền; sau đó thì đã muộn.
 */
export async function approveBaseline(
  store: LedgerStore, reg: MeasureRegistry, input: ApprovalInput,
): Promise<Violation[]> {
  const v: Violation[] = [
    ...checkDeclaration(input.commitmentId, input.docType, input.decl, input.catalogue),
    ...input.targets.flatMap((t) => checkTargetMeasurable(t, reg.get(t.measureKey), input.boundEvidence)),
  ]
  if (v.length) return v
  for (const t of input.targets) await store.markApproved(t.id, input.at)
  return []
}
