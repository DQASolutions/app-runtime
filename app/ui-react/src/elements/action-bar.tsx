import type { ElementType, ReactNode } from 'react'
import { useEffect, useId, useRef } from 'react'
import { actionBar, type ActionFacts, type ActionSurface, type ActionView } from '@dqa-ai-solutions/ui-kit/primitives'
import { cls, cx } from '../prefix/index.js'
import { Button } from './button.js'
import { Menu, MenuItem } from './menu.js'
import { InActionBar } from './action-scope.js'

export interface ActionItem extends Omit<ActionFacts, 'icon'> {
  /** Hình của việc. Nhân không vẽ hình — bên gọi đưa vào. Bắt buộc (luật ③). */
  icon: ReactNode
  /** Bấm vào. Không có khi việc là một đường dẫn (`as` + `to`/`href`). */
  onSelect?: () => void
  /** Việc DẪN ĐI ĐÂU ĐÓ — `Link` của bộ định tuyến, hoặc `'a'`. */
  as?: ElementType
  /** Việc chính gửi một biểu mẫu thì nói ra: `type="submit"` (+ `form` nếu nằm ngoài). */
  type?: 'button' | 'submit' | 'reset'
  form?: string
  /** Khoá tự do cho thẻ mà `as` chỉ tới — `to`, `href`, `target`… */
  [key: string]: unknown
}

export interface ActionBarProps {
  /** Mặt mà thanh này đứng — quyết ai đứng tại chỗ. */
  surface: ActionSurface
  /** Tên của nhóm việc — cũng là tên của nút "⋯" và của menu. Chữ của app. */
  label: string
  /** Hình cho nút "⋯". Bắt buộc khi có việc vào menu. */
  moreIcon?: ReactNode
  /**
   * CHỮ của nút mở menu — "Thêm". Bắt buộc khi có việc vào menu, trừ dòng bảng
   * (dòng bảng không có chữ). NN/g: hình "⋯" tự nó không mang nghĩa — ghi chữ ra.
   */
  moreLabel?: string
  /** Việc của mặt này. `false`/`null` bị bỏ qua, để bên gọi viết `cond && {…}`. */
  actions: Array<ActionItem | false | null | undefined>
  className?: string
}

const FACT_KEYS = ['key', 'label', 'advances', 'outcome', 'exits', 'destroys', 'primary', 'busy', 'disabled', 'provisional'] as const

/** Khoá còn lại sau khi bỏ các sự thật — chỉ những gì thẻ của `as` cần (`to`, `href`…). */
const OWN = new Set<string>([...FACT_KEYS, 'icon', 'onSelect', 'as', 'type', 'form'])
const passThrough = (a: ActionItem): Record<string, unknown> =>
  Object.fromEntries(Object.entries(a).filter(([k]) => !OWN.has(k)))

const whyOf = (v: ActionView): string | null =>
  v.disabled ? [v.disabled.because, v.disabled.hint].filter(Boolean).join(' — ') : null

export function ActionBar({ surface, label, moreIcon, moreLabel, actions, className }: ActionBarProps) {
  const id = useId()
  const box = useRef<HTMLDivElement>(null)
  /* Mở bằng bàn phím thì tiêu điểm vào mục đầu; mở bằng chuột thì KHÔNG — vòng
     tiêu điểm hiện lên mục đầu trông như mục ấy đã được chọn sẵn. */
  const byKeyboard = useRef(false)
  const popOf = () => (typeof document === 'undefined' ? null : document.getElementById(id))
  const items = actions.filter((a): a is ActionItem => Boolean(a))
  const byKey = new Map(items.map((a) => [a.key, a]))
  const facts: ActionFacts[] = items.map((a) => {
    const f: Record<string, unknown> = {}
    for (const k of FACT_KEYS) if (a[k] !== undefined) f[k] = a[k]
    if (a.icon != null) f.icon = a.key
    return f as unknown as ActionFacts
  })
  const bar = actionBar(facts, { surface })
  const wordedMore = surface !== 'table'

  useEffect(() => {
    const el = popOf()
    if (!el) return undefined
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState !== 'open') return
      const t = document.querySelector(`[popovertarget="${CSS.escape(id)}"]`)?.getBoundingClientRect()
      if (!t) return
      const below = t.bottom + 4 + el.offsetHeight <= window.innerHeight
      el.style.top = `${below ? t.bottom + 4 : Math.max(8, t.top - 4 - el.offsetHeight)}px`
      el.style.left = `${Math.max(8, t.right - el.offsetWidth)}px`
      if (byKeyboard.current) el.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus()
    }
    const onKey = (e: KeyboardEvent) => {
      const list = Array.from(el.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'))
      const at = list.indexOf(document.activeElement as HTMLElement)
      if (e.key === 'ArrowDown') { e.preventDefault(); list[(at + 1) % list.length]?.focus() }
      else if (e.key === 'ArrowUp') { e.preventDefault(); list[(at - 1 + list.length) % list.length]?.focus() }
    }
    el.addEventListener('toggle', onToggle)
    el.addEventListener('keydown', onKey)
    return () => { el.removeEventListener('toggle', onToggle); el.removeEventListener('keydown', onKey) }
  }, [id, bar.menu.length])

  const hasPrimary = bar.inline.some((v) => v.primary)

  const notes: Array<{ key: string; label: string; note: string; primary: boolean }> = []
  const inline = bar.inline.map((v) => {
    const a = byKey.get(v.key)!
    const why = whyOf(v)
    const common = {
      ...passThrough(a), tier: v.tier, busy: v.busy, as: a.as, type: a.type, form: a.form,
      disabled: why ? true : undefined, title: why ?? undefined,
      'aria-describedby': why || v.provisional ? `${id}-${v.key}` : undefined,
      onClick: a.onSelect,
    }
    const button = v.showLabel
      ? <Button key={v.key} {...common} icon={a.icon}>{v.label}</Button>
      : <Button key={v.key} {...common} icon={a.icon} label={v.label} />
    const note = why ?? v.provisional
    if (!note) return button
    /* ⚠️ Trong DÒNG BẢNG, lý do không in ra giữa dòng: bốn mươi dòng lặp một câu
       là bốn mươi câu che dữ liệu. Nó vẫn là tên phụ (trình đọc màn hình) và
       tooltip — và câu ấy thuộc về đầu bảng, nơi app nói MỘT lần vì sao. */
    if (surface === 'table') {
      return (
        <span key={v.key} className={cls('actions')}>
          {button}
          <span id={`${id}-${v.key}`} className={cls('sr-only')}>{note}</span>
        </span>
      )
    }
    notes.push({ key: v.key, label: v.label, note, primary: v.primary })
    return button
  })
  /* ⛔ Lý do khoá HIỆN RA, không chỉ nằm trong `title`: rê chuột không có trên màn
     cảm ứng, và người dùng bàn phím không bao giờ thấy nó.
     ⭐ DƯỚI HÀNG NÚT, MỖI NÚT MỘT DÒNG, theo thứ tự các nút — đổi 27/9/2026. Đứng
     sát nút thì chữ chen giữa các nút; gom thành một câu sau hàng nút thì vẫn rối.
     Người dùng: "các text báo trạng thái cho các button nên hiển thị phía dưới
     button đó, nếu có nhiều text của nhiều button thì show lần lượt theo cột".
     Từ hai dòng thì mỗi dòng mang tên nút của nó. */
  const caption = notes.length > 0 && (
    <ul className={cls('actions-why')}>
      {notes.map((n) => (
        <li key={n.key} id={`${id}-${n.key}`} className={cls('hint')}>
          {notes.length > 1 ? `${n.label} — ${n.note}` : n.note}
        </li>
      ))}
    </ul>
  )
  return (
    <InActionBar.Provider value>
      <div ref={box} role="group" aria-label={label} className={cx(cls('actions'), notes.length > 0 && cls('actions--noted'), className)}
        data-fos-primary={hasPrimary ? '' : undefined} data-fos-card={surface === 'card' ? '' : undefined}>
        {inline}
        {bar.menu.length > 0 && (
          <>
            {/* Có chữ thì là một nút thường (hình + chữ); dòng bảng thì vẫn là ô vuông `btn--menu`. */}
            <Button tier="quiet" icon={moreIcon}
              {...(wordedMore && moreLabel
                ? { children: moreLabel, 'aria-label': `${moreLabel}: ${label}` }
                : { label, className: cls('btn--menu') })}
              aria-haspopup="menu" popoverTarget={id}
              onPointerDown={() => { byKeyboard.current = false }}
              onKeyDown={(e: { key: string }) => { if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) byKeyboard.current = true }} />
            {/* ⛔ MỘT khung: `popover` đặt thẳng lên `<Menu>`. Bản đầu bọc menu trong
                một khối nổi CŨNG mang lớp `menu` — hai viền, hai bóng, hai lớp đệm
                lồng nhau (người dùng chụp lại 26/9/2026: "cái popup này tệ quá"). */}
            <Menu label={label} id={id} popover="auto"
              style={{ position: 'fixed', inset: 'auto', margin: 0, maxHeight: '60vh', overflowY: 'auto' }}>
              {bar.menu.map((v) => {
                const a = byKey.get(v.key)!
                const why = whyOf(v)
                return (
                  <MenuItem key={v.key} {...passThrough(a)} icon={a.icon} as={a.as}
                    disabled={why || v.busy ? true : undefined} title={why ?? undefined}
                    data-tier={v.tier}
                    onClick={() => { popOf()?.hidePopover?.(); a.onSelect?.() }}>
                    {v.label}
                    {why && <span className={cls('hint')}> · {why}</span>}
                  </MenuItem>
                )
              })}
            </Menu>
          </>
        )}
        {caption}
      </div>
    </InActionBar.Provider>
  )
}
