// Bất biến chấm trên một rổ dữ liệu — phần DÒ (🔍) của I2, I7, I10.
// Phần CHẶN (⛔) nằm ở `algebra.plan*` và `measure.define`, vì chúng phải chạy
// trong giao dịch ghi.

import { type AllocationRec, type TargetRec, type Violation } from './types.js'
import { type MeasureRegistry } from './measure.js'

/**
 * I2 — chỉ tiêu không tự phát thì phải nối về lần giao đã sinh ra nó.
 *
 * ⭐ NGUỒN GỐC SUY TỪ ĐỒ THỊ, KHÔNG HỎI MỘT Ô — sửa 5/9/2026.
 *
 *   Ba tình huống trông giống nhau ở chỗ "không có cạnh lên trên", mà chỉ một
 *   là lỗi:
 *
 *     ① NHẬN TỪ TRÊN   có `fulfilsAllocationId` — cộng ngược lên được. Đạt.
 *     ② TỰ ĐẶT         mệnh lệnh chủ KHÔNG do một lần giao nào đẻ ra, nên
 *                      không có gì ở trên để cộng vào. Hợp lệ, đừng kêu.
 *     ③ MỒ CÔI         mệnh lệnh chủ DO một lần giao đẻ ra, mà chỉ tiêu lại
 *                      không nối về lần giao ấy — ai đó bóc rồi quên nối, và
 *                      con số này sẽ không bao giờ về tới cấp trên.
 *
 *   Trước hôm nay pack phân biệt ② với ③ bằng một ô người ta tick
 *   (`selfExecuted`). Nhưng đồ thị đã trả lời sẵn: chỉ cần biết mệnh lệnh chủ
 *   của chỉ tiêu có nằm trong tập "mệnh lệnh do một lần giao đẻ ra" hay không.
 *   Đo ở app tham chiếu 5/9/2026: 83/83 chỉ tiêu khớp tuyệt đối, không một
 *   ngoại lệ — cái ô kia không thêm thông tin gì, chỉ thêm chỗ để gõ sai.
 *
 * ⛔ VÀ NÓ LÀ CHỖ ĐÃ GÂY LỖI THẬT. `selfExecuted` của pack hỏi "từ đâu ra";
 *    ô cùng tên ở app tham chiếu trả lời "ai thực hiện". Bind vào nhau nên 28
 *    chỉ tiêu bị kết là mồ côi hoàn toàn oan. Bớt được một ô bắt buộc là bớt
 *    được một chỗ để bind nhầm — đó mới là cái lợi chính.
 *
 * @param targets  chỉ tiêu cần chấm.
 * @param cascadedMandates  id những mệnh lệnh DO MỘT LẦN GIAO đẻ ra. Không
 *   truyền thì pack lùi về lối cũ: tin ô `selfExecuted`.
 */
export function checkDerivation(
  targets: readonly TargetRec[],
  cascadedMandates?: ReadonlySet<string>,
): Violation[] {
  const out: Violation[] = []
  for (const t of targets) {
    if (t.fulfilsAllocationId) continue                       // ① nhận từ trên
    if (t.selfExecuted) continue                              // ② khai tay — cửa thoát
    if (cascadedMandates && t.mandateId != null) {
      if (!cascadedMandates.has(t.mandateId)) continue        // ② suy từ đồ thị
      out.push({ code: 'ORPHAN_TARGET', subject: t.id,        // ③ mồ côi THẬT
        message: 'Mệnh lệnh chủ của chỉ tiêu này do một lần giao ở trên đẻ ra, '
          + 'mà chỉ tiêu lại không nối về lần giao nào — số của nó sẽ không về tới cấp trên' })
      continue
    }
    out.push({ code: 'ORPHAN_TARGET', subject: t.id,
      message: 'Chỉ tiêu không khai tự phát mà cũng không nối về lần giao nào của cấp trên' })
  }
  return out
}

/**
 * I10 — thước không đổi dọc trục.
 *
 * ⚠️ Đây là bất biến chỉ nhìn thấy được khi thừa nhận thước là ĐỘNG. Cha giao
 *    "số đợt", con lặng lẽ đo "ngày công" thì phép gộp lên hỏng mà không ai thấy
 *    — hai con số vẫn cộng được, chỉ là cộng sai.
 */
export function checkMeasureContinuity(
  targets: readonly TargetRec[],
  allocations: readonly AllocationRec[],
  targetsById: ReadonlyMap<string, TargetRec>,
  registry: MeasureRegistry,
): Violation[] {
  const allocById = new Map(allocations.map((a) => [a.id, a]))
  const v: Violation[] = []
  for (const child of targets) {
    if (!child.fulfilsAllocationId) continue
    const parentTarget = targetsById.get(allocById.get(child.fulfilsAllocationId)?.targetId ?? '')
    if (!parentTarget) continue
    if (!registry.commensurable(child.measureKey, parentTarget.measureKey)) {
      v.push({ code: 'MEASURE_DRIFT', subject: child.id,
        message: `Chỉ tiêu con đo bằng "${child.measureKey}" còn chỉ tiêu cha đo bằng `
          + `"${parentTarget.measureKey}" — đổi thước phải khai phép quy đổi có căn cứ` })
    }
  }
  return v
}

/** I7 — một bằng chứng nối vào đúng một chỉ tiêu, không cấp nào đếm lại của cấp dưới. */
export function checkCountedOnce(
  links: ReadonlyArray<{ evidenceId: string; targetId: string }>,
): Violation[] {
  const seen = new Map<string, string[]>()
  for (const l of links) seen.set(l.evidenceId, [...(seen.get(l.evidenceId) ?? []), l.targetId])
  return [...seen]
    .filter(([, ts]) => new Set(ts).size > 1)
    .map(([evidenceId, ts]) => ({ code: 'DOUBLE_COUNTED' as const, subject: evidenceId,
      message: `Bản ghi này nối vào ${new Set(ts).size} chỉ tiêu — sẽ bị đếm nhiều lần khi gộp lên` }))
}
