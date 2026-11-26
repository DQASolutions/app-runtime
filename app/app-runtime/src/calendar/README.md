# @dqa-ai-solutions/app-runtime/calendar

Lát cắt thời gian trên hồ sơ của app: **hồ sơ nào có ngày theo kế hoạch và có
chủ thì hiện lên một lưới duy nhất**.

⭐ **Engine không sở hữu ngày nào.** Ngày của một đợt huấn luyện thuộc hồ sơ đợt
huấn luyện; gói này chiếu nó. Muốn dời buổi họp thì sửa ở hồ sơ gốc — đó là bất
biến `C1`, ép ngay ở tầng kiểu và ở hợp đồng ô.

⭐ **Không sở hữu từ vựng của app.** Pack khai **vai**; app khai thực thể của mình
đóng vai nào. Bind sai → **máy chủ không khởi động được**.

## Bảy bất biến

| | | Chặn / Nêu |
|---|---|---|
| `C1` | Không sở hữu ngày — ô chiếu từ hồ sơ gốc không sửa được ở đây | ⛔ tầng kiểu + `contract` |
| `C2` | Một hồ sơ, một ô — khoá mang cả vai | ⛔ `bind` + `check` |
| `C3` | Chặng quyết định có chiếm giờ — bản dự thảo thì không | ⛔ `project` |
| `C4` | Ô nào cũng có chủ; chưa tra ra người thì `null`, không bịa | 🔍 nêu |
| `C5` | Không đụng độ im lặng — một người hai chỗ | 🔍 nêu |
| `C6` | Luật lặp phải có biên | ⛔ `expand` |
| `C7` | Ngày nghỉ do app quyết | app cấp |

⭐ **Gói này chặn rất ít, và đó là chủ ý.** Sổ cái chặn nhiều vì một con số sai là
sai. Lịch thì phần lớn bất thường là đời thật — người quản lý đi hai cuộc họp chồng giờ
là chuyện có thật. *Chặn là máy giành quyền của người; im lặng là để họ lỡ cả hai.*

## Bốn vai

| Vai | Là gì | Engine ghi |
|---|---|:--:|
| `Source` | Thực thể của app có ngày theo kế hoạch. **Vai mở** | không |
| `Roster` | Sổ phân công — văn bản có kỳ, có duyệt | không |
| `Shift` | Ca trong sổ — engine xếp luân phiên | **có** |
| `Entry` | Việc đột xuất, không có hồ sơ gốc. **Dùng ít** | **có** |

## Dùng

```ts
bindOrThrow(decl, schema)                       // lúc khởi động, không lúc chạy
const { occurrences, skipped } = project({ decl, records, window, holders })
const { findings, conflicts, blocked } = check(occurrences)

proposeShifts({ roster, rosterDecl, shiftDecl, people })   // thuần, không ghi
projectShifts({ roster, rosterDecl, shifts, shiftDecl, window })
rosterDrift(proposals, occurrences)             // sổ đã ký lệch đề xuất ở đâu
entryPressure(occurrences)                      // bao nhiêu phần lưới là đột xuất
```

⚠️ `project` trả về **cả `skipped` kèm lý do**. Hồ sơ có ngày mà không lên lịch thì
người dùng phải biết vì sao — im lặng bỏ là cách chắc nhất để họ thôi tin cái lịch.

## ⛔ Không ghép với `@dqa-ai-solutions/app-runtime/cascade-ledger`

Hai gói ngang hàng, **không gói nào nhập gói kia**, và **không chia sẻ khái niệm
nào ngoài `date`**. `Period` của sổ cái là một **cuốn sổ** — có đóng, có
restatement. Lịch dùng `Interval` — một cái **thước**, không đóng, không restate.
