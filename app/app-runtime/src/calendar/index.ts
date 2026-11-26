// @dqa-ai-solutions/app-runtime/calendar — lát cắt thời gian trên hồ sơ của app.
//
// ⭐ MỘT CÂU: bất cứ hồ sơ nào có ngày theo kế hoạch và có chủ thì hiện lên một
//    lưới duy nhất. Engine KHÔNG sở hữu ngày nào — nó chiếu.
//
// ⛔ KHÔNG NHẬP @dqa-ai-solutions/app-runtime/cascade-ledger, và ngược lại cũng không. Hai engine ngang
//    hàng, không chia sẻ khái niệm nào ngoài `date`. Sổ cái dùng `Period` — một
//    cái SỔ có đóng, có restatement. Lịch dùng `Interval` — một cái THƯỚC, không
//    đóng, không restate.
//
export * from './types.js'
export * from './time.js'
export * from './contract.js'
export * from './bind.js'
export * from './project.js'
export * from './recurrence.js'
export * from './roster.js'
export * from './invariants.js'
