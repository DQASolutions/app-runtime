# Ví dụ — trục dọc bốn cấp

Chạy `@dqa-ai-solutions/app-runtime/cascade-ledger` trên một câu chuyện đi hết trục:

```
Bộ 4.000  →  Vùng B 600  →  Tỉnh A 45  →  Xã X 3
```

kèm một chỉ tiêu **tỷ lệ** giao cùng lúc, một lệnh **cắt chỉ tiêu giữa kỳ**, và
một **số về muộn** sau khi cấp trên đã gửi báo cáo.

```bash
npm run build && npm start     # in ra một lượt chạy
npm test                       # 26 phép thử e2e
```

⭐ **Chạy trên ONTOLOGY VÀ CỔNG KHO THẬT của kernel** — `createOntology` +
`InMemoryAdapter`, provenance thật, `traverse()` thật. Không phải kho giả lập.

## ⭐ App mẫu này cố ý dùng từ vựng RIÊNG

Nó không gọi ô của mình theo tên của engine. Nó gọi bằng tiếng Việt:

| Engine cần | App mẫu gọi là |
|---|---|
| `baselineQty` | `soGiao` |
| `remainingQty` | `conLai` |
| `state` | `tinhTrang`, giá trị `binh_thuong` · `giao_vuot` |
| `selfExecuted` | `tuPhat`, giá trị `co` · `khong` |

Và mỗi hàng còn mang `maTinh`, `ghiChu`, `nguoiKy`, `capBanHanh` — bốn ô nghiệp vụ
engine **không đọc, không ghi, không biết là có**. Có phép thử canh đúng điều đó.

Nếu engine lỡ đọc thẳng một ô nào của app thì ví dụ này hỏng ngay — nên nó vừa
là ví dụ, vừa là phép thử cho lời hứa *"engine không biết ô của app tên gì"*.

## Ví dụ chứng minh được gì

| | |
|---|---|
| Bảo toàn dọc bốn cấp | mỗi cấp còn đúng phần mình giữ; chia 41 khi còn 40 bị chặn |
| Thước **truyền** khác thước **chia** | tỷ lệ: còn lại là `null` chứ không phải `0`; chia nhỏ bị chặn; khai `ratio`+`divide` bị bác ngay lúc định nghĩa |
| Gộp lên đếm một lần | xã 3 → tỉnh 40 → vùng 78; một bằng chứng nối hai chỉ tiêu thì bị bắt |
| Đo được | chỉ tiêu chết bị bắt; kế hoạch huấn luyện khai văn xuôi bị đòi lý do + người duyệt + hạn |
| I2 trên cả trục | bốn cấp sạch — đỉnh trục khai `tuPhat`, ba cấp dưới nối về đúng lần giao |
| Số về muộn | số đã gửi giữ nguyên `3`, số hiện tại `2`, chênh lệch bày ra |
| Cắt giữa kỳ | `OVER_COMMITTED`, còn `-60`; thu hồi bớt thì dương trở lại |
| Tiền bám chỉ tiêu | chênh `-50.000.000`; dòng chi mồ côi bị kêu |

## ⭐ Phép thử đua thật — và nó đo được đề nghị `Q4`

`src/dua.test.ts` cho hai lệnh `allocate` chạy bằng `Promise.all` trên một chỉ
tiêu còn 40, mỗi lệnh giao 40, qua cổng kho thật:

| Cách so-rồi-đặt | Qua cửa | Tổng đã giao | Sổ nói |
|---|:--:|--:|---|
| shim ngây thơ ở tầng ứng dụng | **2** | **640** trên trần 600 | "còn 0" — sai mà trông như đúng |
| shim có khoá theo chỉ tiêu | 1 | 600 | đúng — nhưng chỉ trong **một tiến trình** |

Giữa `get` và `update` luôn có một `await`, và Node nhả sự kiện đúng ở đó. Nên
**không vá được ở tầng ứng dụng**: cổng kho của kernel phải có lệnh ghi có điều
kiện. Đó là `Q4`, và bảng trên là số đo chứ không phải ý kiến.

## Ba chỗ ví dụ này tự dạy lại thiết kế

**① Đỉnh trục phải khai `selfExecuted`.** Lần chạy đầu, I2 kêu chỉ tiêu của Bộ
Bộ là mồ côi — đúng, vì đỉnh trục không có ai giao cho nó. Đó là lời khai
theo định nghĩa, không phải chỗ sót.

**② Id của engine không nhất thiết là id của kho.** App ánh xạ vai ô `id` sang
`maLanGiao`, nên `g1` mà engine cầm nằm trong một ô của bản ghi còn kho tự sinh
khoá riêng. `attach()` từng cập nhật thẳng bằng `g1` và tìm một bản ghi không tồn
tại. Kho giả lập dùng chung một id nên **mọi phép thử vẫn xanh** — chỉ chạy thật
mới lộ.

**③ `TraversalResult.nodes` chỉ gom đường đi ĐẦU TIÊN.** Đếm bằng `nodes` thì mọi
chỉ tiêu đều ra 1 — sai mà trông như có số. Phải đếm bằng `paths`.
