import { useId, useState, type KeyboardEvent } from 'react'
import { cls, cx } from '../prefix/index.js'
import type { FieldProps } from './field.js'

export interface SuggestProps extends Omit<FieldProps, 'type' | 'value' | 'onChange' | 'defaultValue'> {
  value: string
  /** Giá trị mới — cả khi gõ lẫn khi chọn một gợi ý. */
  onValue: (value: string) => void
  /** Những giá trị đã có. Người dùng vẫn gõ được giá trị ngoài danh sách. */
  options: readonly string[]
  /** Hiện tối đa bấy nhiêu dòng khớp. */
  max?: number
}

/** Bỏ dấu để gõ "dieu duong" vẫn ra "Điều dưỡng". Hạ chữ thường TRƯỚC: "Đ" hoa
 *  là một chữ cái riêng (U+0110), NFD không tách nó ra được. */
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

export function Suggest({ value, onValue, options, max = 8, className, invalid, ...rest }: SuggestProps) {

  const id = useId()
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState(-1) // dòng bàn phím đang trỏ; -1 là chưa trỏ dòng nào

  const q = fold(value ?? '')
  const hits = (options ?? []).filter((o) => o !== value && fold(o).includes(q)).slice(0, max)
  const show = open && hits.length > 0

  const close = () => { setOpen(false); setAt(-1) }
  const pick = (v: string) => { onValue(v); close() }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    rest.onKeyDown?.(e)
    if (!show) {
      if (e.key === 'ArrowDown' && hits.length) { e.preventDefault(); setOpen(true); setAt(0) }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setAt((i) => (i + 1) % hits.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((i) => (i - 1 + hits.length) % hits.length) }
    // Enter khi chưa trỏ dòng nào vẫn gửi biểu mẫu.
    else if (e.key === 'Enter' && at >= 0) { e.preventDefault(); pick(hits[at]) }
    // Esc phải preventDefault: không thì trình duyệt đóng luôn cả <dialog>, mà người
    // dùng chỉ muốn cất danh sách gợi ý đi chứ chưa muốn bỏ biểu mẫu đang nhập dở.
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
  }

  return (
    <span className={cx(cls('suggest'), className)}>
      <input
        {...rest}
        type="text"
        className={cls('field')}
        {...(invalid ? { 'aria-invalid': true as const } : {})}
        value={value}
        onChange={(e) => { onValue(e.target.value); setOpen(true); setAt(-1) }}
        onFocus={(e) => { rest.onFocus?.(e); setOpen(true) }}
        onBlur={(e) => { rest.onBlur?.(e); close() }}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={show}
        aria-controls={show ? id : undefined}
        aria-activedescendant={at >= 0 ? `${id}-${at}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {show && (
        <ul id={id} role="listbox" className={cx(cls('menu'), cls('menu--pop'))}>
          {hits.map((o, i) => (
            // onMouseDown chặn blur: không chặn thì ô mất nét trước khi click kịp chạy.
            <li key={o} id={`${id}-${i}`} role="option" aria-selected={i === at}
              className={cls('menu-item')} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)}>
              {o}
            </li>
          ))}
        </ul>
      )}
    </span>
  )
}
