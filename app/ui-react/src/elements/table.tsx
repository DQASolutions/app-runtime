import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes, ReactNode, InputHTMLAttributes, ButtonHTMLAttributes } from 'react'
import { createContext, useContext } from 'react'
import { cls, cx } from '../prefix/index.js'

/** Đang ở trong `<thead>` hay không — `Th` đọc chỗ đứng, không hỏi người gọi. */
const InTableHead = createContext(false)

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /**
   * Đầu bảng dính khi cuộn.
   *
   * ⚠️ Là một CỜ, không phải một chuỗi lớp người gọi tự ghép. 65 tệp của ứng
   *    dụng gốc chép `fos-table--sticky` hai lần trong cùng một thuộc tính —
   *    thứ chỉ xảy ra khi người ta chép chuỗi thay vì khai ý định.
   */
  sticky?: boolean
  /**
   * Bọc bảng trong khung cuộn ngang.
   *
   * ⛔ MẶC ĐỊNH BẬT. Một bảng rộng không có khung cuộn riêng thì kéo CẢ TRANG
   *    trượt ngang, và người đọc mất luôn cột danh tính bên trái.
   */
  wrap?: boolean
  wrapClassName?: string
  children?: ReactNode
}

export function Table({ sticky, wrap = true, wrapClassName, className, children, ...rest }: TableProps) {
  const bang = (
    <table {...rest} className={cx(cls('table'), sticky && cls('table--sticky'), className)}>
      {children}
    </table>
  )
  return wrap
    ? <div className={cx(cls('table-wrap'), wrapClassName)}>{bang}</div>
    : bang
}

export const THead = ({ children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) => (
  <InTableHead.Provider value>
    <thead {...rest}>{children}</thead>
  </InTableHead.Provider>
)

export const TBody = ({ children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody {...rest}>{children}</tbody>
)

export interface TrProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Dòng đang chọn — nhân neo vào `[aria-selected="true"]`. */
  selected?: boolean
  children?: ReactNode
}

export const Tr = ({ selected, children, ...rest }: TrProps) => (
  <tr {...rest} {...(selected ? { 'aria-selected': true as const } : {})}>{children}</tr>
)

export interface ThProps extends Omit<ThHTMLAttributes<HTMLTableCellElement>, 'scope'> {
  /** Số liệu — chữ số thẳng cột, căn phải. */
  numeric?: boolean
  children?: ReactNode
}

/**
 * ĐẦU CỘT. `scope="col"` suy ra từ chỗ đứng, không do ai nhớ gõ.
 *
 * ⚠️ Ngoài `<THead>` thì nó vẫn là `<th>` nhưng KHÔNG tự khai `scope` — một
 *    `<th>` giữa thân bảng thì chỉ có người viết mới biết nó đứng đầu hàng hay
 *    đầu cột, và đoán hộ là đoán sai. Chỗ ấy dùng `RowHeader`.
 */
export function Th({ numeric, className, children, ...rest }: ThProps) {
  const inHead = useContext(InTableHead)
  return (
    <th
      {...rest}
      {...(inHead ? { scope: 'col' as const } : {})}
      className={cx(numeric && cls('num'), className)}
    >
      {children}
    </th>
  )
}

/**
 * Ô DANH TÍNH CỦA DÒNG — `<th scope="row">`, không phải `<td>`.
 *
 * ⛔ Đây là ô NÓI BẢN GHI NÀY LÀ AI. Trình đọc màn hình dùng nó để đọc lại
 *    "đang ở dòng nào" khi người dùng đi ngang; để là `<td>` thì mỗi ô chỉ đọc
 *    lên một con số trần không biết của ai.
 */
export interface RowHeaderProps
  extends Omit<ThHTMLAttributes<HTMLTableCellElement>, 'scope'> {
  lead: ReactNode
}

export function RowHeader({ lead, className, children, ...rest }: RowHeaderProps) {
  return (
    <th {...rest} scope="row" className={className}>
      <span className={cls('row-head')}>
        <span className={cls('row-head-lead')}>{lead}</span>
        <span className={cls('row-head-text')}>{children}</span>
      </span>
    </th>
  )
}

export interface TdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean
  children?: ReactNode
}

export const Td = ({ numeric, className, children, ...rest }: TdProps) => (
  <td {...rest} className={cx(numeric && cls('num'), className)}>{children}</td>
)

// ── pick: chọn chính dòng nó ngồi trong ───────────────────────────────────

export interface PickProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** ⛔ Bắt buộc: một ô tích trần trong bảng không nói nó chọn dòng NÀO. */
  label: string
  /** Bọc sẵn trong `<td>` của bảng. Tắt khi đặt ở chỗ khác. */
  cell?: boolean
}

export function Pick({ label, cell = true, className, ...rest }: PickProps) {
  const o = (
    <label className={cx(cls('pick'), !cell && className)}>
      <input {...rest} type="checkbox" aria-label={label} />
    </label>
  )
  return cell ? <td className={cx(cls('pick-cell'), className)}>{o}</td> : o
}

// ── tree-toggle: mở các dòng bên dưới dòng này ────────────────────────────

export interface TreeToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  open: boolean
  /** ⛔ Bắt buộc: nút chỉ có một hình thì cái tên là thứ duy nhất đọc lên được. */
  label: string
  children?: ReactNode
}

export const TreeToggle = ({ open, label, className, children, ...rest }: TreeToggleProps) => (
  <button
    {...rest} type="button" aria-expanded={open} aria-label={label}
    className={cx(cls('tree-toggle'), className)}
  >
    {children}
  </button>
)
