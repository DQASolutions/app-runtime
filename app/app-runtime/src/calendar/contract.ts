// Hợp đồng Ô — engine đòi gì ở một vai, và app đáp ứng bằng TỪ VỰNG CỦA MÌNH.
//
// ⭐ Cùng cơ chế `contract.ts` của cascade-ledger, và cố ý giống: một người đã
//    đọc gói kia thì đọc gói này không phải học lại. Engine tuyên bố một danh
//    sách Ô nó cần ĐỌC; app khai ô của mình đóng vai ô nào. Bảng vẫn là bảng của
//    app, khoá vẫn là khoá của app, hàng rào phạm vi vẫn của app.
//
// ⛔ VÀ ĐÂY LÀ KHÁC BIỆT LỚN NHẤT VỚI cascade-ledger: engine này KHÔNG GHI VÀO
//    Ô NÀO CỦA VAI `Source`. Nó chỉ đọc. Ghi chỉ xảy ra ở hai vai app trao hẳn
//    cho nó — `Shift` và `Entry`.
//
//    Vì sao: ngày của một đợt huấn luyện thuộc hồ sơ đợt huấn luyện. Engine mà
//    ghi được vào đó thì ngày có hai chủ, và bất biến C1 mất hiệu lực ngay từ
//    tầng hợp đồng chứ không phải tầng kiểm.

import type { Role } from './types.js'

/** Kiểu của một ô, ở mức engine cần biết — không phải kiểu SQL. */
export type SlotType = 'instant' | 'date' | 'text' | 'enum' | 'number'

export type Access = 'read' | 'write'

export interface SlotSpec {
  slot: string
  type: SlotType
  required: boolean
  access: Access
  /** Thiếu ô tuỳ chọn thì mất tính năng nào — nói ra để người khai biết mình đang bỏ gì. */
  degrades?: string
  why: string
}

/**
 * Ô engine cần ở từng vai. Đây là TOÀN BỘ bề mặt dữ liệu của engine.
 *
 * ⭐ Đó chính là cách "phần dữ liệu nở ra" mà không vỡ: mọi ô khác trên bản ghi
 *    — `provinceCode`, `priorityLevel`, ba mươi ô nghiệp vụ khác — engine KHÔNG
 *    NHÌN THẤY, nên app thêm bao nhiêu cũng được.
 */
export const SLOTS: Record<Role, SlotSpec[]> = {
  Source: [
    { slot: 'from', type: 'instant', required: true, access: 'read',
      why: 'Mốc bắt đầu. Không có thì hồ sơ không lên được lưới nào' },
    { slot: 'to', type: 'instant', required: false, access: 'read',
      degrades: 'coi là việc một mốc — vẽ dấu chấm thay vì dải, và KHÔNG dò được chồng lấn cho dòng này',
      why: 'Mốc kết thúc. Thiếu thì khoảng dài 0 nên C5 không bao giờ kêu, dù người ấy có bận thật' },
    { slot: 'title', type: 'text', required: true, access: 'read',
      why: 'Chữ hiện trên ô. Engine không sinh chữ — sinh là bịa tên nghiệp vụ' },
    { slot: 'state', type: 'enum', required: false, access: 'read',
      degrades: 'mọi bản ghi đều chiếm giờ, kể cả bản còn dự thảo',
      why: 'Chặng — cổng của bất biến C3. Thiếu thì lịch đầy thứ chưa chắc xảy ra' },
    { slot: 'ownerRole', type: 'text', required: false, access: 'read',
      degrades: 'phải cấp `resolveOwner` lúc chiếu, nếu không hồ sơ bị bỏ kèm lý do',
      why: 'Vai chịu trách nhiệm — C4. ⭐ KHÔNG bắt buộc là một CỘT: một hồ sơ có thể sinh việc '
         + 'cho nhiều vai mà không có cột vai nào — vai khi đó là hàm của CHẶNG. App suy ra rồi '
         + 'truyền vào qua `resolveOwner`' },
    { slot: 'scope', type: 'text', required: false, access: 'read',
      degrades: 'tra người theo vai trên toàn hệ, không theo phạm vi',
      why: 'Phạm vi để tra ra NGƯỜI đang giữ vai ấy' },
  ],
  /**
   * Sổ phân công — một văn bản có kỳ và có duyệt. App sở hữu vòng đời duyệt;
   * engine chỉ đọc chặng để biết sổ đã hiệu lực chưa.
   */
  Roster: [
    { slot: 'from', type: 'date', required: true, access: 'read',
      why: 'Sổ phủ từ ngày nào' },
    { slot: 'to', type: 'date', required: true, access: 'read',
      why: 'Tới ngày nào — biên của phép nở luật lặp, bất biến C6' },
    { slot: 'state', type: 'enum', required: true, access: 'read',
      why: 'Sổ chưa duyệt thì ca trong nó chưa chiếm giờ của ai' },
    { slot: 'scope', type: 'text', required: true, access: 'read',
      why: 'Sổ của cơ quan nào — cũng là nơi tra danh sách người để luân phiên' },
  ],
  /**
   * Một ca trong sổ. ⭐ Đây là vai app TRAO HẲN cho engine: engine xếp luân
   * phiên rồi ghi người vào. Không có ô nào khác của app bị ghi.
   */
  Shift: [
    { slot: 'roster', type: 'text', required: true, access: 'read',
      why: 'Thuộc sổ nào' },
    { slot: 'kind', type: 'text', required: true, access: 'read',
      why: 'Loại ca — trực quản lý, trực ban, trực nghiệp vụ' },
    { slot: 'from', type: 'instant', required: true, access: 'write',
      why: 'Engine nở luật lặp ra thành từng ca rồi ghi mốc' },
    { slot: 'to', type: 'instant', required: true, access: 'write',
      why: 'Mốc hết ca' },
    { slot: 'person', type: 'text', required: true, access: 'write',
      why: 'Người trực — engine xếp luân phiên và ghi vào đây' },
  ],
  /**
   * Việc đột xuất, không có hồ sơ gốc ở đâu cả.
   *
   * ⚠️ DÙNG ÍT. Mỗi mục ở đây là một sự thật KHÔNG có chỗ ở trong nghiệp vụ.
   *    Nếu vai này phình ra thì đó là dấu hiệu app đang thiếu một thực thể, chứ
   *    không phải dấu hiệu lịch cần thêm tính năng.
   */
  Entry: [
    { slot: 'from', type: 'instant', required: true, access: 'write', why: 'Mốc bắt đầu' },
    { slot: 'to', type: 'instant', required: false, access: 'write', why: 'Mốc kết thúc' },
    { slot: 'title', type: 'text', required: true, access: 'write', why: 'Chữ hiện trên ô' },
    { slot: 'ownerRole', type: 'text', required: true, access: 'write', why: 'Vai chịu trách nhiệm' },
    { slot: 'person', type: 'text', required: false, access: 'write',
      degrades: 'chỉ gắn vai, không gắn người',
      why: 'Người cụ thể, nếu đã biết' },
  ],
}

/** Ô bắt buộc của một vai — dùng ở bind và ở thông báo lỗi. */
export const requiredSlots = (role: Role): string[] =>
  SLOTS[role].filter((s) => s.required).map((s) => s.slot)

/** Tính năng mất đi nếu bỏ các ô tuỳ chọn — nói ra thay vì im lặng hỏng. */
export const degradations = (role: Role, bound: string[]): string[] =>
  SLOTS[role]
    .filter((s) => !s.required && !bound.includes(s.slot) && s.degrades)
    .map((s) => `${role}.${s.slot} chưa khai → ${s.degrades}`)
