// Bảy bất biến — đặc tả của engine này.
//
// ⭐ Cùng vai trò với `invariants.ts` của cascade-ledger, và cố ý cùng hình dạng:
//    một bảng nói RÕ cái gì CHẶN và cái gì chỉ DÒ. Trộn hai loại là giết niềm
//    tin — một danh sách "lỗi" mà phân nửa là báo động giả thì người ta thôi đọc,
//    và họ đúng.
//
// ⛔ KHÁC cascade-ledger ở một điểm đáng nói: engine này CHẶN RẤT ÍT. Sổ cái
//    chặn nhiều vì một con số sai là một con số sai. Lịch thì phần lớn "bất
//    thường" là đời thật — người quản lý đi hai cuộc họp chồng giờ là chuyện có thật,
//    và máy không được quyết hộ họ bỏ cái nào.

import type { Conflict, Occurrence } from './types.js'
import { intersect } from './time.js'

export type Severity = 'block' | 'surface'

export interface Finding {
  code: 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7'
  severity: Severity
  message: string
  occurrenceIds: string[]
}

/**
 * C1 · Engine không sở hữu ngày.
 *
 * Ép ở tầng kiểu (`origin: 'projected'` và không có hàm ghi ngược), nhưng vẫn
 * kiểm ở đây vì app có thể tự dựng `Occurrence` rồi đưa vào.
 */
export const c1_ownsNoDates = (occ: Occurrence[], willWrite: string[]): Finding[] =>
  occ
    .filter((o) => o.origin === 'projected' && willWrite.includes(o.id))
    .map((o) => ({
      code: 'C1' as const,
      severity: 'block' as const,
      message: `\`${o.title}\` chiếu từ hồ sơ gốc — sửa giờ ở hồ sơ ấy, không sửa trên lịch`,
      occurrenceIds: [o.id],
    }))

/**
 * C2 · Một hồ sơ, một ô.
 *
 * ⭐ Cùng lẽ với I7 của cascade-ledger (*đếm một lần*): một sự thật hiện hai lần
 *    thì mọi phép đếm trên nó sai gấp đôi, và không ai thấy vì cả hai đều trông
 *    hợp lý.
 */
export const c2_oneRecordOneSlot = (occ: Occurrence[]): Finding[] => {
  const seen = new Map<string, string[]>()
  for (const o of occ) {
    /* ⭐ Khoá mang cả VAI — một việc hai vai cùng dự là hai ô hợp lệ, không phải
       trùng lặp. Bỏ vai khỏi khoá là kêu oan mỗi lần hai phòng cùng họp. */
    const key = `${o.sourceRole}:${o.sourceId}:${o.seq}:${o.ownerRole}`
    seen.set(key, [...(seen.get(key) ?? []), o.id])
  }
  return [...seen.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({
      code: 'C2' as const,
      severity: 'block' as const,
      message: `hồ sơ \`${key}\` chiếu ra ${ids.length} ô — khai nguồn trùng`,
      occurrenceIds: ids,
    }))
}

/**
 * C4 · Ô nào cũng có chủ, và *chưa giải được người* phải nói ra.
 *
 * ⚠️ DÒ, KHÔNG CHẶN. Ở ba cấp trên của app tham chiếu chưa có sổ nhân sự nên vai
 *    không ra được tên người — chặn là làm cả lịch không dùng được. Nêu ra thì
 *    màn hình nói *"vai này chưa có người"* và người dùng biết phải đi lập sổ.
 */
export const c4_hasOwner = (occ: Occurrence[]): Finding[] =>
  occ
    .filter((o) => o.ownerPerson === null)
    .map((o) => ({
      code: 'C4' as const,
      severity: 'surface' as const,
      message: `\`${o.title}\` gắn vai \`${o.ownerRole}\` mà chưa tra ra người — cần sổ nhân sự cho phạm vi này`,
      occurrenceIds: [o.id],
    }))

/**
 * C5 · Không đụng độ im lặng.
 *
 * ⭐ NÊU RA, KHÔNG CHẶN. Đời thật có đụng độ; người quản lý tự quyết bỏ cái nào.
 *    Chặn là máy giành quyền của người; im lặng là để họ lỡ cả hai.
 */
export const c5_collisions = (occ: Occurrence[]): Conflict[] => {
  const out: Conflict[] = []
  const byPerson = new Map<string, Occurrence[]>()
  for (const o of occ) {
    if (!o.ownerPerson || o.allDay) continue
    byPerson.set(o.ownerPerson, [...(byPerson.get(o.ownerPerson) ?? []), o])
  }
  for (const [person, list] of byPerson) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!
        const b = list[j]!
        const overlap = intersect(a.interval, b.interval)
        if (overlap) out.push({ person, a, b, overlap })
      }
    }
  }
  return out
}

export interface CheckResult {
  findings: Finding[]
  conflicts: Conflict[]
  blocked: boolean
}

/**
 * Chạy hết các bất biến chấm được trên một tập ô.
 *
 * C3 chấm ở bộ chiếu (cổng chặng), C6 chấm ở bộ nở luật lặp (biên cửa sổ),
 * C7 chấm ở chỗ app cấp lịch ngày nghỉ — cả ba đều ép ở nơi sinh ra chúng chứ
 * không đợi tới đây, vì ép ở nơi sinh thì không có đường vòng.
 */
export const check = (occ: Occurrence[], willWrite: string[] = []): CheckResult => {
  const findings = [
    ...c1_ownsNoDates(occ, willWrite),
    ...c2_oneRecordOneSlot(occ),
    ...c4_hasOwner(occ),
  ]
  const conflicts = c5_collisions(occ)
  return {
    findings,
    conflicts,
    blocked: findings.some((f) => f.severity === 'block'),
  }
}
