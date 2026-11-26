// Cổng kho — pack KHÔNG biết Postgres, không biết ontology-sdk. §D.4.
//
// ⭐ MỌI HÀM Ở ĐÂY CHẠY TRONG MỘT GIAO DỊCH DO BÊN GỌI MỞ. Pack không tự mở
//    giao dịch: app biết phạm vi nghiệp vụ của một lệnh ghi, pack thì không.
//
// ⚠️ VÌ SAO CÓ `compareAndSetRemaining` CHỨ KHÔNG PHẢI `setRemaining`:
//
//    Chặn kiểu "đọc tổng → so → ghi" để hở một khe giữa hai việc; hai lệnh giao
//    đồng thời cùng đọc số cũ, cùng qua cửa, cùng ghi. Khoá hàng (`FOR UPDATE`)
//    bịt được, nhưng bắt tầng ghi phải ĐỌC kho — thứ `AD-15` cấm — và buộc mọi
//    adapter phải hiện thực khoá hàng.
//
//    So-rồi-đặt thì không cần cả hai: lệnh ghi chỉ thành công khi phần còn lại
//    VẪN ĐÚNG BẰNG số ta đã tính trên. Ai đó chen vào giữa thì `rowCount = 0`,
//    và ta biết chắc chứ không đoán. Đúng ở mọi mức cô lập, đúng với cả adapter
//    không có khoá hàng.

import type { AllocationRec, AllocationState, TargetRec } from './types.js'

/**
 * Một số đạt do người báo — chỉ dùng với thước `reported`.
 *
 * ⚠️ Thước `derived` KHÔNG nhận bản ghi này: số ấy máy đếm từ bản ghi thật, và
 *    cho gõ tay là mở đúng cái cửa mà lối `derived` sinh ra để đóng.
 */
export interface ActualRec {
  id: string
  targetId: string
  unitId: string
  periodKey: string
  qty: number
  /** Dẫn chiếu chứng từ — không cho ghi một con số trần trụi. */
  evidenceRef: string
}

/** `OVER_COMMITTED` là cửa thoát ĐƯỢC ĐẶT TÊN cho §C.5 — âm phải cố ý, không phải tai nạn. */
export type TargetState = 'DRAFT' | 'OK' | 'OVER_COMMITTED'

export interface TargetRow extends TargetRec {
  state: TargetState
  /** `null` với thước `replicate` — câu hỏi "còn lại bao nhiêu" vô nghĩa, không phải bằng 0. */
  remainingQty: number | null
  approvedAt?: string | null
}

export interface LedgerStore {
  getTarget(id: string): Promise<TargetRow | undefined>
  listAllocations(targetId: string): Promise<AllocationRec[]>

  /**
   * Ghi phần còn lại — CHỈ khi nó vẫn đúng bằng `expected`.
   * @returns `false` nghĩa là có người khác đã đổi nó từ lúc ta đọc.
   */
  compareAndSetRemaining(
    targetId: string, expected: number | null, next: number | null, state?: TargetState,
  ): Promise<boolean>

  insertAllocation(a: AllocationRec): Promise<void>
  setAllocationState(id: string, state: AllocationState): Promise<void>
  setRevised(targetId: string, qty: number): Promise<void>

  /** Ghi một số đạt do NGƯỜI báo. Bắt buộc với thước `reported`. */
  insertActual?(a: ActualRec): Promise<void>

  /**
   * Đọc lại số đã báo của một chỉ tiêu. Bắt buộc với thước `reported` nếu app
   * muốn pack cộng hộ; không khai thì app tự cộng và tự truyền `ownEvidence`.
   *
   * ⭐ VÌ SAO PHẢI CÓ — thêm 5/9/2026. Trước đó lối `reported` là NỬA VÒNG: pack
   *    chấm và ghi số, rồi bỏ mặc phần đọc. `rollup()` nhận `ownEvidence` là một
   *    con số APP tự tính — hợp lý với lối `derived` (app đếm cạnh, pack không
   *    biết cạnh nào), nhưng vô lý với `reported`, nơi chính pack vừa ghi con số
   *    ấy. Hậu quả đo được ở app tham chiếu: nó phải viết lại phép cộng bằng SQL
   *    của mình, và phải tự nhớ luật "chỉ đếm bản còn hiệu lực" — luật mà pack
   *    biết rõ hơn.
   *
   * ⚠️ `periodKey` rỗng nghĩa là MỌI kỳ. Bên gọi lọc kỳ, không phải pack đoán.
   */
  listActuals?(targetId: string, periodKey?: string): Promise<ActualRec[]>
  markApproved(targetId: string, at: string): Promise<void>
}

/** Bên gọi cung cấp: chạy `fn` trong một giao dịch. */
export type WithTx<T> = (fn: (store: LedgerStore) => Promise<T>) => Promise<T>
