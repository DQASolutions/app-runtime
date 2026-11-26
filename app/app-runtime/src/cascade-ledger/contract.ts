// Hợp đồng Ô — engine đòi gì ở một vai, và app đáp ứng bằng TỪ VỰNG CỦA MÌNH.
//
// ⭐ CÂU HỎI ĐẺ RA TỆP NÀY: "engine là xương sống, app dùng thật thì phần dữ
//    liệu nở ra theo nghiệp vụ — vậy app KẾ THỪA xương sống bằng cách nào?"
//
//    Trả lời: KHÔNG kế thừa. Không có bảng của engine, không có lớp cha để
//    extends. Engine chỉ tuyên bố một danh sách Ô nó cần đọc/ghi; app tự khai ô
//    của mình đóng vai ô nào. Bảng vẫn là bảng của app, khoá vẫn là khoá của
//    app, hàng rào phạm vi vẫn là hàng rào của app.
//
// ⚠️ VÌ SAO KHÔNG DÙNG BẢNG RIÊNG CHO ENGINE (1..1 với bảng app):
//
//    ① Mỗi phép đọc thành một phép nối, mà màn hình của app là LENS trên
//       ontology — một hồ sơ sẽ hiện ra làm hai mảnh.
//    ② Hàng rào phạm vi phải chép sang bảng thứ hai. app tham chiếu đã ghi đúng cái
//       giá của việc chép ấy: "Lệch một nhánh thì màn hình đọc được kế hoạch mà
//       không đọc được tiến độ của chính nó."
//    ③ Nâng phiên bản engine thành đổi lược đồ trong kho của app.
//
//    Một bảng, app sở hữu. Engine giữ một thấu kính trên đó.

/** Kiểu của một ô, ở mức engine cần biết — không phải kiểu SQL. */
export type SlotType = 'number' | 'text' | 'enum' | 'date'

export interface SlotSpec {
  slot: string
  type: SlotType
  required: boolean
  /** Thiếu ô tuỳ chọn thì mất tính năng nào — nói ra để người khai biết mình đang bỏ gì. */
  degrades?: string
  why: string
}

/**
 * Ô engine cần ở từng vai. Đây là TOÀN BỘ bề mặt dữ liệu của engine — ngoài
 * danh sách này, engine không đọc và không ghi một ô nào của app.
 *
 * ⭐ Đó chính là cách "phần dữ liệu nở ra" mà không vỡ: mọi ô khác trên bản ghi
 *    — `provinceCode`, `priorityLevel`, `ownerRole`, ba mươi ô nghiệp vụ khác —
 *    engine KHÔNG NHÌN THẤY, nên app thêm bao nhiêu cũng được.
 */
export const SLOTS: Record<string, SlotSpec[]> = {
  Target: [
    { slot: 'measure', type: 'text', required: true,
      why: 'Chỉ tiêu đo bằng thước nào — không có thì I4 và I10 không chấm được' },
    { slot: 'baselineQty', type: 'number', required: true,
      why: 'Nền gốc, đóng băng lúc duyệt — I3' },
    { slot: 'remainingQty', type: 'number', required: true,
      why: 'Chỗ chở ràng buộc bảo toàn I1. App PHẢI thêm ô này nếu chưa có' },
    { slot: 'state', type: 'enum', required: true,
      why: 'Cửa thoát OVER_COMMITTED phải được đặt tên — §C.5' },
    { slot: 'revisedQty', type: 'number', required: false,
      degrades: 'không điều chỉnh chỉ tiêu giữa kỳ được; mọi phép đọc chỉ có nền `baseline`',
      why: 'Nền sau điều chỉnh — I3' },
    { slot: 'period', type: 'text', required: false,
      degrades: 'chỉ tiêu phải có `dueDate` thay thế, nếu không thì I8 ③ báo thiếu mốc chốt',
      why: 'Kỳ của chỉ tiêu — I5, I8 ③' },
    { slot: 'dueDate', type: 'date', required: false,
      degrades: 'phải có `period` thay thế', why: 'Hạn — I8 ③' },
    // ⚠️ 5/9/2026 — Ô NÀY NAY LÀ ĐƯỜNG THỨ HAI, KHÔNG PHẢI ĐƯỜNG CHÍNH.
    //    Khai hai cạnh `raises` + `targetOfMandate` thì `checkDerivation` suy
    //    được nguồn gốc từ đồ thị và không cần ô này. Suy đáng tin hơn tick, và
    //    bớt một ô là bớt một chỗ bind nhầm — chính ô này đã bị bind nhầm ở app
    //    tham chiếu (nó hỏi "từ đâu ra", app trả lời "ai thực hiện").
    { slot: 'selfExecuted', type: 'enum', required: false,
      degrades: 'chỉ tiêu không nối về lần giao nào sẽ bị I2 kêu là mồ côi — trừ khi bind hai cạnh `raises` và `targetOfMandate` để suy từ đồ thị',
      why: 'Cửa thoát khai rõ cho chỉ tiêu tự phát — I2' },
  ],
  // ═══════════════════════════════════════════════════════════════════════════
  // ⭐ VAI `Actual` — CHỖ CHỞ SỐ ĐẠT DO NGƯỜI BÁO. Thêm 5/9/2026.
  //
  //   `recordActual()` và `ActualRec` có từ đầu, cổng `LedgerStore.insertActual`
  //   cũng vậy — nhưng `SLOTS` bỏ trống vai này, nên KHÔNG APP NÀO KHAI ĐƯỢC ô
  //   của mình đóng vai nào, `lensOf('Actual')` ném, và `recordActual` luôn từ
  //   chối bằng *"kho chưa khai chỗ ghi số đạt"*. Lối `reported` có đủ mã, thiếu
  //   đúng cái bản lề.
  //
  // ⛔ ĐO ĐƯỢC Ở APP THAM CHIẾU (app tham chiếu, 5/9/2026): bốn thước — tỷ lệ, đơn vị
  //    tổ chức, thiết bị, lớp bồi dưỡng — luật giao số cho cả bốn mà
  //    hệ không có loại bản ghi nào đếm ra chúng. Chúng chia được, giao được,
  //    cấp dưới nhận được, và cột "đã đạt" đứng ở 0 VĨNH VIỄN. Đúng cái
  //    *dead target*: khai rồi, mãi bằng không, và không ai
  //    thấy vì số không trông giống một kết quả.
  //
  // ⭐ VÌ SAO ĐÚNG NĂM Ô NÀY, KHÔNG HƠN: chúng là đúng những ô `ActualRec` đang
  //    có. `unit` phải có vì đóng kỳ khoá theo cặp (kỳ × đơn vị) — §C.1; thiếu
  //    nó thì `assertOpen` không biết hỏi ai đã chốt. `evidenceRef` bắt buộc vì
  //    một con số trần không phải một con số, chỉ là lời nói.
  //
  // ⚠️ Vai này VẪN được phép vắng — app chỉ dùng thước `derived` thì không cần
  //    bảng nào. Nhưng khai một thước `reported` mà không bind vai này thì
  //    `checkBindings` báo `DEAD_TARGET` ngay lúc khởi động, cùng lẽ với thước
  //    `derived` thiếu cạnh bằng chứng.
  // ═══════════════════════════════════════════════════════════════════════════
  Actual: [
    { slot: 'target', type: 'text', required: true,
      why: 'Số này báo cho chỉ tiêu nào — không có thì không cộng vào đâu được' },
    { slot: 'unit', type: 'text', required: true,
      why: 'Đơn vị báo — đóng kỳ khoá theo cặp (kỳ × đơn vị), §C.1' },
    { slot: 'period', type: 'text', required: true,
      why: 'Kỳ của số báo — một số đạt thuộc đúng một kỳ, I5' },
    { slot: 'qty', type: 'number', required: true, why: 'Con số đã đạt' },
    { slot: 'evidenceRef', type: 'text', required: true,
      why: 'Dẫn chiếu chứng từ — số báo không kèm căn cứ thì không kiểm lại được' },
  ],
  Allocation: [
    { slot: 'qty', type: 'number', required: true, why: 'Số chia cho nơi nhận — I1' },
    { slot: 'state', type: 'enum', required: true,
      why: 'Bản đã trả lại không tính vào tổng đã giao — §C.0' },
  ],
  Mandate: [
    { slot: 'measurability', type: 'enum', required: false,
      degrades: 'I9 không chấm được nơi văn xuôi biến thành số',
      why: 'Bậc đo của nhiệm vụ trên giao — I9' },
  ],
  Commitment: [
    { slot: 'docType', type: 'text', required: true, why: 'Bậc đo khai theo LOẠI — I9' },
    { slot: 'measurability', type: 'enum', required: false,
      degrades: 'không duyệt được bằng I9; mọi cam kết coi như chưa khai bậc đo',
      why: 'Bậc đo đã khai — I9' },
  ],
}

/** Ánh xạ ô: `slot` → tên ô của app. Thiếu một ô bắt buộc là máy chủ không khởi động. */
export type FieldLens = Record<string, string>

/**
 * Ánh xạ GIÁ TRỊ enum: giá trị engine → giá trị (hoặc các giá trị) của app.
 *
 * ⚠️ Cần thật, không phải cho đẹp. app tham chiếu gọi trạng thái giao là
 *    `DELEGATED/ACCEPTED/DONE/RETURNED`; một hệ quản lý tài trợ gọi
 *    `issued/accepted/closed/withdrawn`. Chỉ ánh xạ tên ô là chưa đủ.
 *
 * ⭐ CHO PHÉP NHIỀU VỀ MỘT. App có sáu trạng thái mà engine chỉ cần bốn thì khai
 *    `DELEGATED: ['SUBMITTED', 'APPROVED']`. Engine nhìn thấy bốn; app vẫn có
 *    sáu trên màn hình của nó. Khi GHI thì lấy giá trị ĐẦU danh sách — đó là
 *    giá trị chuẩn tắc, và vì thế thứ tự khai không phải chuyện tuỳ tiện.
 */
export type ValueLens = Record<string, Record<string, string | string[]>>

export interface RoleLens { fields: FieldLens; values?: ValueLens }

/** Gợi ý di trú khi app thiếu một ô bắt buộc — báo lỗi kèm việc phải làm. */
export function migrationHint(role: string, spec: SlotSpec, entity: string): string {
  return `Thêm vào \`${entity}\` một ô cho vai "${spec.slot}" (kiểu ${spec.type}). ${spec.why}. `
    + `Rồi khai: fields.${role}.${spec.slot}: <tên ô của bạn>`
}
