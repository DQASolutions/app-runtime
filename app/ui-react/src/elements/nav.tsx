import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ElementType, ReactNode } from 'react'
import { createElement } from 'react'
import { cls, cx } from '../prefix/index.js'

/**
 * ĐIỀU HƯỚNG — và ba thứ ở đây KHÔNG phải một thứ với ba kiểu dáng.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ `tab` · `rail-item` · `segmented-item` KHÁC NHAU Ở CÂU HỎI CHÚNG TRẢ LỜI
 *
 *     rail-item       ĐI TỚI MỘT MÀN KHÁC          — đường dẫn đổi, cả trang đổi
 *     tab             ĐỔI LÁT NÀO CỦA MÀN NÀY      — nội dung thay, vẫn một màn
 *     segmented-item  ĐỔI CÁCH NHÌN CÙNG NỘI DUNG  — danh sách y nguyên, lọc lại
 *
 *   Vẽ giống nhau thì người đọc không đoán được một cú bấm sẽ đưa họ đi xa bao
 *   nhiêu. Nhân đánh dấu chúng khác nhau có chủ ý — thẻ gạch chân dưới, lát tô
 *   nền — và đó là lý do chúng là ba phần tử, không phải một cái có cờ.
 *
 * ⚠️ `aria-current` KHÔNG PHẢI `:active`. Nhân đã tách hai trạng thái ấy trong
 *    chuẩn: `active` là NGÓN TAY ĐANG ĐÈ, `current` là ĐANG Ở ĐÂY và nó sống
 *    sau khi mọi ngón tay đã rời. Gộp một chữ là bỏ sót một trạng thái thật —
 *    lần trước gộp làm ba phần tử không được vẽ trạng thái nào.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── tab: switches which slice is shown ────────────────────────────────────

export interface TabsProps {
  /** ⛔ Bắt buộc: một hàng thẻ không tên thì đọc lên là mấy cái nút rời rạc. */
  label: string
  children?: ReactNode
  className?: string
}

export const Tabs = ({ label, className, children }: TabsProps) => (
  <div role="tablist" aria-label={label} className={className}>{children}</div>
)

export interface TabProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** Dấu của lát này. Bắt buộc — xem `doiHinh`. */
  icon: ReactNode
  /** Lát đang xem. */
  current?: boolean
  /**
   * Bao nhiêu ở sau lát này.
   *
   * ⛔ SỐ 0 VẪN HIỆN. "Đã ghi 0 người" là một câu trả lời; ẩn đi thì cán bộ
   *    không biết mình đã mở bảng ấy ra hay chưa.
   */
  count?: number
  /** Đường dẫn — truyền `Link` của bộ định tuyến khi lát sống trong URL. */
  as?: ElementType
  children?: ReactNode
}

export function Tab({ icon, current, count, as, className, children, ...rest }: TabProps) {
  const inner = (
    <>
      {icon}
      {children}
      {count != null && <span className={cls('count')}>{count}</span>}
    </>
  )
  /* ⚠️ `role="tab"` đi cùng `aria-selected`, KHÔNG cùng `aria-current`: một thẻ
     là lát đang xem TRONG màn này, không phải trang bạn đang đứng. Nhân neo cả
     hai nên vẽ ra như nhau; trình đọc màn hình thì không. */
  const mark = { role: 'tab' as const, 'aria-selected': Boolean(current) }
  const cn = cx(cls('tab'), className)
  return as
    ? createElement(as, { ...rest, ...mark, className: cn }, inner)
    : createElement('button', { ...rest, ...mark, type: 'button', className: cn }, inner)
}

// ── rail-item: goes to a screen ───────────────────────────────────────────

export interface RailItemProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> {
  /** Màn đang đứng. */
  current?: boolean
  /** Bộ định tuyến của app — `NavLink`, `Link`. */
  as?: ElementType
  /**
   * ⛔ NHẬN CẢ MỘT HÀM, và đó không phải sự chiều chuộng.
   *
   *   `NavLink` của `react-router` gọi `className` VỚI trạng thái của chính nó
   *   (`{ isActive, isPending }`) — đó là cách nó nói "đang ở đây" mà không bắt
   *   nơi gọi tự so đường dẫn. Ghép thẳng bằng chuỗi thì một hàm bị đổi thành
   *   chuỗi `"(state) => ..."` và rơi nguyên vào thuộc tính `class`.
   *
   *   Không lỗi nào nổ. Mục rãnh mất sạch kiểu dáng và mang một cái class dài
   *   ba dòng — thứ chỉ thấy khi mở thanh tra phần tử ra xem.
   */
  className?: string | ((state: Record<string, unknown>) => string | undefined)
  /**
   * Rãnh dài — hạ chiều cao mục xuống bậc điều khiển.
   *
   * ⚠️ Ô chạm 44px đúng cho một điều khiển đứng riêng; với một rãnh 45 mục nó
   *    nhân thành 3,1 màn cuộn và cán bộ mất khả năng QUÉT. Cùng ngoại lệ, cùng
   *    lý do đã ghi cho nút trong bảng — và vẫn trên sàn WCAG 2.2 §2.5.8.
   */
  dense?: boolean
  children?: ReactNode
}

export function RailItem({ current, as, dense, className, children, ...rest }: RailItemProps) {
  const baseClass = cx(cls('rail-item'), dense && cls('rail-item--dense'))
  const combinedClass = typeof className === 'function'
    ? (state: Record<string, unknown>) => cx(baseClass, className(state))
    : cx(baseClass, className)
  /* ⭐ `aria-current="page"` — đây là một TRANG, và nó vẫn đúng sau khi ngón tay
     rời đi. Cũng chính là thứ luật của nhân neo vào.
     ⚠️ Khi `as` là `NavLink`, chính nó cũng tự đặt `aria-current` — nên chỗ này
        chỉ đặt khi nơi gọi khai `current`, không đè lên bộ định tuyến. */
  return createElement(
    as ?? 'a',
    {
      ...rest,
      className: combinedClass,
      ...(current ? { 'aria-current': 'page' as const } : {}),
    },
    children,
  )
}
