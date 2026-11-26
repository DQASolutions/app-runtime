import type { ButtonHTMLAttributes, ElementType, HTMLAttributes, ReactNode } from 'react'
import { createElement } from 'react'
import { cls, cx } from '../prefix/index.js'

/**
 * A MENU IS A LIST, AND ITS ITEMS ARE LIST ITEMS.
 *
 * ⛔ A stack of `<button>`s in a `<div>` announces "button, button, button" and
 *    never says how many there are or which one you are on. `<ul role="menu">`
 *    with `role="menuitem"` children says "menu, 4 items, item 2 of 4" — the
 *    two facts that make a menu usable without sight.
 *
 * ⚠️ Container and item are declared as two elements in the kit for the same
 *    reason `table` has `th` and `td`: the container owns no hover and no
 *    focus, and asking it for those left four cells of the coverage matrix
 *    unanswered until they were split.
 */

export interface MenuProps extends Omit<HTMLAttributes<HTMLUListElement>, 'role'> {
  /** Names the menu for anyone who cannot see what opened it. */
  label: string
  children?: ReactNode
}

export const Menu = ({ label, className, children, ...rest }: MenuProps) => (
  <ul {...rest} role="menu" aria-label={label} className={cx(cls('menu'), className)}>
    {children}
  </ul>
)

export interface MenuItemProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** Dấu của mục này. Bắt buộc — xem `doiHinh`. */
  icon: ReactNode
  /** This is where you are. Drawn by the kit through `[aria-current="page"]`. */
  current?: boolean
  /**
   * ⭐ A menu item that GOES SOMEWHERE is a link, not a button.
   *
   *   "Sign out" is a command and stays a `<button>`; "Switch workspace" is a
   *   destination, and a destination the platform cannot open in a new tab,
   *   cannot copy, and does not announce as a link is a destination in
   *   disguise. Pass `"a"` or the router's own component.
   */
  as?: ElementType
  /**
   * ⚠️ Khoá tự do cho thẻ mà `as` chỉ tới — `href`, `to`, `target`… Gói không
   *    biết trước bộ định tuyến của app dùng khoá nào, và liệt kê hết là khoá
   *    cứng gói vào một thư viện.
   */
  [key: string]: unknown
  children?: ReactNode
}

/**
 * ⛔ `type="button"` IS NOT OPTIONAL. A `<button>` with no type inside a form
 *    is a SUBMIT button, so a menu opened from a form submits it on the way to
 *    doing whatever the item was for.
 */
export function MenuItem({ icon, current, as, className, children, ...rest }: MenuItemProps) {
  const content = <>{icon}{children}</>
  const shared = {
    ...rest,
    role: 'menuitem' as const,
    className: cx(cls('menu-item'), className),
    ...(current ? { 'aria-current': 'page' as const } : {}),
  }
  return (
    <li role="none">
      {as
        ? createElement(as, shared, content)
        /* ⛔ `type="button"` chỉ đặt cho NÚT. Đặt lên `<a>` thì nó thành một
           thuộc tính `type` nói về kiểu MIME của đích đến — sai hẳn nghĩa. */
        : createElement('button', { ...shared, type: 'button' }, content)}
    </li>
  )
}

/**
 * A rule between groups of items.
 *
 * ⚠️ NO CLASS OF ITS OWN. The kit draws it as a descendant rule on the menu —
 *    a PART of the menu, anchored to the role a screen reader actually reads.
 *    A dedicated class would let someone draw the line and forget the role.
 */
export const MenuSeparator = () => <li role="separator" />
