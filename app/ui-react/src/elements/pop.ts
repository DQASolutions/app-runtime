/**
 * Chỗ mở của một lớp nổi thả từ một cái nút — đo LÚC MỞ, không đo lúc dựng.
 *
 * ⭐ Tách ra khi phần tử nổi thứ hai (`ColumnPicker`) cần đúng phép đo mà
 *    `FilterSelect` đã có. Hai bản chép thì một ngày hai bản lệch: một cái mở
 *    ngược lên ở hàng cuối bảng, cái kia vẫn tràn khung nhìn.
 *
 * ⚠️ Một nút ở hàng cuối bảng dài thì mở xuống là tràn khung nhìn, và chỗ đứng
 *    của nó đổi theo lúc người ta cuộn — nên đo mỗi lần mở.
 */
export function placePop(trigger: HTMLElement | null): { up: boolean; end: boolean } {
  const r = trigger?.getBoundingClientRect()
  if (!r) return { up: false, end: false }
  return {
    up: window.innerHeight - r.bottom < 240 && r.top > 240,
    /* Nút đứng ở nửa phải màn hình thì hộp neo phải — điều khiển của một bảng
       nằm ở góc phải đầu thẻ, neo trái từ đó là chạy ra ngoài khung nhìn. */
    end: r.left > window.innerWidth / 2,
  }
}
