# @dqa-ai-solutions/app-runtime/cascade-ledger

Sổ cái nghĩa vụ: **phân rã xuống, bằng chứng gộp lên**.

Khuôn *nhiệm vụ trên giao → kế hoạch → chỉ tiêu → giao xuống → thực hiện → báo cáo
lên → quyết toán* chạy ở đầu tư công, quản lý dự án (EVM), quản lý tài trợ, MRP,
và GRC. Gói này là bộ xương ấy, dựng một lần.

⭐ **Không sở hữu từ vựng của app.** Pack khai **vai**; app khai thực thể của mình
đóng vai nào. Bind sai → **máy chủ không khởi động được**.

## Mười bất biến

| | | Chặn ở |
|---|---|---|
| `I1` | Bảo toàn — `remaining ≥ 0`, chỉ với thước `divide` | `plan()` + `CHECK` |
| `I2` | Truy nguyên — chỉ tiêu con nối về lần giao của cha | `checkDerivation` |
| `I3` | Nền so sánh — `basis` không có mặc định | chữ ký hàm |
| `I4` | Cùng đơn vị — `ratio` không gộp | `rollup()` |
| `I5` | Kỳ — đóng theo *(kỳ × đơn vị)* | `PeriodBook` + `recordActual` |
| `I6` | Tiền bám chỉ tiêu | `checkFundingLinked` |
| `I7` | Đếm một lần | `checkCountedOnce` |
| `I8` | Đo được thật — thước · đường lấy số · mốc chốt | `checkTargetMeasurable` |
| `I9` | Không im lặng — bậc đo khai theo **loại** | `checkDeclaration` |
| `I10` | Thước không đổi dọc trục | `checkMeasureContinuity` |

## App gắn vào bằng cách nào

Engine **không có bảng**. Nó tuyên bố một danh sách ô cần đọc/ghi (`SLOTS`); app
khai ô của mình đóng vai ô nào; lớp `Lens` dịch hai chiều. Bảng vẫn là bảng của
app, và ba mươi ô nghiệp vụ khác trên đó engine **không có dòng nào đọc**.

```yaml
bind:    { Target: PlanTarget }
fields:
  Target: { baselineQty: assignedQty, remainingQty: remainingQty, state: ledgerState }
values:
  Allocation: { state: { DELEGATED: [SUBMITTED, APPROVED] } }   # nhiều về một
```

Thiếu ô **bắt buộc** → máy chủ không khởi động, báo kèm việc phải làm. Thiếu ô
**tuỳ chọn** → vẫn chạy, và nói ra là tắt tính năng nào.

## Đã dựng / chưa dựng

✅ Lõi thuần: đăng ký thước · đại số đại lượng · đo được · bind + kiểm khởi động ·
bất biến dò được.
✅ Tầng Action: `allocate` · `acceptAllocation` · `completeAllocation` ·
`returnAllocation` · `revise` · `approveBaseline`, trên cổng `LedgerStore` —
**so-rồi-đặt**, đúng ở mọi mức cô lập, không đòi adapter phải có khoá hàng.
✅ Chốt chống trôi chạy trước **mọi** lệnh ghi: cột lệch tổng dòng giao thì DỪNG,
không lặng lẽ tự chữa.
✅ Tầng bind đủ ba: vai **thực thể** · vai **ô** · vai **giá trị** — `SLOTS` ·
`Lens` · `checkFields` · `degradations`.

✅ `PeriodBook` — đóng kỳ theo *(kỳ × đơn vị)*, ảnh chụp số đã báo, bản bổ sung
cho số về muộn: `asReported()` và `asNow()` cùng đọc được.
✅ `fundingSummary` · `checkFundingLinked` — I6.
✅ `proposeTargets` — sinh chỉ tiêu ứng viên từ lần giao vừa nhận · chu kỳ trước ·
danh mục tham số, để lập chỉ tiêu thành việc **xác nhận** thay vì **nhập liệu**.
✅ `attach()` — `LedgerStore` trên cổng kho của kernel, chạy trên **mọi** adapter.

**99 phép thử**, đi theo tình huống bốn cấp thật — kể cả phép thử hai lệnh giao
đồng thời trên cùng một chỉ tiêu.

✅ `compareAndSetInstance` — **đã dựng trong kernel**, cả ba adapter: bộ nhớ *(so
và ghi không có `await` ở giữa)*, jsonb *(`data @> expected` trong `WHERE`)*, bảng
thật *(`IS NOT DISTINCT FROM` để `null` so được)*.
✅ `MeasureRegistry.load()` — thước sống qua lần khởi động lại.
✅ `recordActual` — số đạt do người báo, ba cửa: thước có cho gõ tay không · kỳ
còn mở không · có chứng từ không.
✅ `overdueExemptions` — hết hạn miễn đo thì quay lại hàng việc.
✅ Bind thử **miền thứ hai** *(quản lý tài trợ, từ vựng tiếng Anh)* — cùng lõi,
không sửa một dòng pack.

🔴 Còn lại: khuôn app của FieldOS *(`app.yaml` · `workflow.yaml` · `FieldApp`)*.
