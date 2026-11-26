import type { ReactNode } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { cls, cx } from '../prefix/index.js'
import { placePop } from './pop.js'

/**
 * ONE FACET OF A LIST FILTER — and it takes almost no room until it is used.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ WHAT THIS REPLACES, AND WHY THE FIRST TWO TRIES WERE BOTH WRONG
 *
 *   ① A "lifecycle band": a title, a stacked proportion bar, and a row of count
 *      chips, sitting above every list. It answered *what is the ratio* while
 *      the person was asking *show me the ones that are stuck* — and it took the
 *      top of the screen to do it.
 *
 *   ② A segmented control: the same values, one line lower. Better, and still
 *      wrong for the same reason — every choice is on screen before anyone has
 *      asked for any of them. On a list with twelve states it is a wall.
 *
 * ⭐ THE THING BOTH MISSED IS NOT A NICER WIDGET. IT IS LESS FURNITURE.
 *
 *      not filtering  →  one small `+ Filter` button, and nothing else
 *      filtering      →  one pill reading `State: In draft ×`
 *      choosing       →  a list, opened on purpose, with counts
 *
 *   The twelve states of a roster are NOT VISIBLE until someone opens them.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ SINGLE CHOICE, DELIBERATELY. Multi-select is what a person expects in
 *    2026, and the list endpoints behind this take ONE value. Drawing tick
 *    boxes over an API that cannot honour them builds a promise that breaks on
 *    the second tick. When the endpoint takes an array, this grows a `values`
 *    prop and the popover grows a search box — not before.
 */

export interface FilterOption {
  /** Empty string means "no filter" — the entry that clears the facet. */
  value: string
  label: ReactNode
  /** How many records sit behind this choice. `0` is worth showing. */
  count?: number
}

export interface FilterSelectProps {
  /** The facet's name — "State", "Kind". Read out, and shown once chosen. */
  label: string
  /** Empty string = not filtering. */
  value: string
  options: FilterOption[]
  onPick: (value: string) => void
  /** What the unset button says. No default: the kernel carries no language. */
  addLabel: ReactNode
  /** Accessible name for the control that clears this facet. */
  clearLabel: string
  /**
   * The glyph inside that control.
   *
   * ⛔ The kernel draws no icons — it does not know the app's icon set, and a
   *    hard-coded `×` is a different weight and a different vertical rhythm from
   *    every other icon on the screen. Falls back to `×` only so the control is
   *    never invisible.
   */
  clearIcon?: ReactNode
  className?: string
}

export function FilterSelect({
  label, value, options, onPick, addLabel, clearLabel, clearIcon, className,
}: FilterSelectProps) {
  const [open, setOpen] = useState(false)
  const [up, setUp] = useState(false)
  const [end, setEnd] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const chosen = options.find((o) => o.value === value && o.value !== '')

  /* ⚠️ Đo lúc MỞ, không đo lúc dựng: một nút ở hàng cuối bảng dài thì mở xuống
     là tràn khung nhìn, và chỗ đứng của nó đổi theo lúc người ta cuộn. */
  useEffect(() => {
    if (!open) { setUp(false); setEnd(false); return undefined }
    const place = placePop(trigger.current)
    setUp(place.up)
    setEnd(place.end)

    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      const items = Array.from(
        box.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
      )
      if (!items.length) return
      const at = items.indexOf(document.activeElement as HTMLElement)
      /* ⛔ Escape TRẢ TIÊU ĐIỂM VỀ NÚT. Bỏ bước ấy thì tiêu điểm rơi về đầu
         trang và người dùng bàn phím phải Tab lại từ đầu — đúng lúc họ vừa nói
         "thôi, không lọc nữa". */
      if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(at + 1) % items.length]?.focus() }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(at - 1 + items.length) % items.length]?.focus() }
      else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus() }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus() }
    }
    /* Tiêu điểm vào lựa chọn ĐANG CHỌN, không vào cái đầu tiên — người ta mở ra
       để đổi từ chỗ đang đứng. */
    const items = box.current?.querySelectorAll<HTMLElement>('[role="option"]')
    const now = box.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    ;(now ?? items?.[0])?.focus()

    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  const pick = (v: string) => { setOpen(false); trigger.current?.focus(); onPick(v) }

  return (
    <div className={cx(cls('menu-anchor'), className)} ref={box}>
      {chosen ? (
        /*
         * ⭐ ĐÃ LỌC: một viên đọc ra được, và cái gỡ nằm NGAY TRONG nó. Bỏ lọc là
         *    việc người ta làm nhiều thứ hai sau đặt lọc; bắt mở popover ra để
         *    bỏ là thêm một bước cho việc thường xuyên nhất.
         *
         * ⛔ HAI NÚT THẬT, không phải một `<span>` đội lớp `.fos-btn`. Bản đầu
         *    bọc chúng trong một `<span className="fos-btn fos-btn--normal">` —
         *    trông đúng, mà là gắn lớp ĐIỀU KHIỂN lên một thứ không phải điều
         *    khiển: nó ăn `cursor: pointer`, ăn `:hover`, và trình đọc màn hình
         *    nghe một cái nút chứa hai cái nút. `.fos-actions` là chỗ dành cho
         *    một hàng việc, và nó không giả vờ là gì cả.
         */
        <span className={cls('actions')}>
          <button
            ref={trigger} type="button" className={cx(cls('btn'), cls('btn--normal'))}
            aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
            onClick={() => setOpen((v) => !v)}
          >
            {label}: {chosen.label}
          </button>
          <button
            type="button"
            className={cx(cls('btn'), cls('btn--quiet'), cls('btn--icon'))}
            aria-label={clearLabel} onClick={() => onPick('')}
          >
            {clearIcon ?? '×'}
          </button>
        </span>
      ) : (
        /* ⚠️ `quiet` khi CHƯA lọc, có chủ ý: chưa ai hỏi tới thì nó không được
           tranh chỗ với tiêu đề thẻ. Nó vẫn nói ra mình bấm được qua `:hover`
           và vòng tiêu điểm, và bên gọi đặt một hình nhỏ vào `addLabel`. */
        <button
          ref={trigger} type="button" className={cx(cls('btn'), cls('btn--quiet'))}
          aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          {addLabel}
        </button>
      )}

      {open && (
        /* ⚠️ `listbox`, KHÔNG phải `menu`. Một thực đơn chứa VIỆC; đây là chọn
           một GIÁ TRỊ, và trình đọc màn hình nói hai thứ ấy khác nhau: "menu, 6
           mục" so với "hộp danh sách, mục 2 trên 6, đang chọn". */
        <ul
          id={listId} role="listbox" aria-label={label}
          className={cx(cls('menu'), cls('menu--pop'),
            up && cls('menu--pop-up'), end && cls('menu--pop-end'))}
        >
          {options.map((o) => (
            <li key={o.value || '·'} role="none">
              <button
                type="button" role="option" aria-selected={o.value === value}
                className={cls('menu-item')} onClick={() => pick(o.value)}
              >
                {o.label}
                {o.count != null && <span className={cls('count')}>{o.count}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
