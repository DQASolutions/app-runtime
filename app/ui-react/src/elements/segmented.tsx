import type { ButtonHTMLAttributes, ElementType, HTMLAttributes, ReactNode } from 'react'
import { createElement } from 'react'
import { cls, cx } from '../prefix/index.js'

/**
 * SWITCHES HOW YOU LOOK, NOT WHERE YOU ARE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ WHY THIS IS NOT TABS, AND THE DIFFERENCE IS NOT COSMETIC
 *
 *   Tabs change WHICH SLICE of a screen is shown — the content is replaced.
 *   A segmented control changes HOW THE SAME CONTENT IS LOOKED AT: a filter, a
 *   density, a date range. The list underneath is the same list.
 *
 *   Drawn identically, a reader cannot tell whether pressing will take them
 *   somewhere. That is why the kit gives them different marks — tabs underline,
 *   segments fill — and why they are two elements, not one with a flag.
 *
 * ⭐ THE SHAPE THIS REPLACES, MEASURED
 *
 *   Six list screens in the reference application each hand-built the same
 *   thing at the top: a title, a stacked proportion bar in eight greys, and a
 *   row of count chips under it. It filtered — every chip was a link — but it
 *   answered *"what is the ratio"* while the person was asking *"show me the
 *   ones that are stuck"*, and it took the top of the screen to do it.
 *
 *   The user's own words, on seeing it: *"rất nhiều màn có phân [loại tổng] hợp
 *   trên đầu, và nó tệ."*
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface SegmentedProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  /**
   * ⛔ REQUIRED. A row of unlabelled buttons is a row of unlabelled buttons:
   *    without a group name, a screen reader reads five choices with nothing
   *    saying what is being chosen.
   */
  label: string
  children?: ReactNode
}

export const Segmented = ({ label, className, children, ...rest }: SegmentedProps) => (
  <div {...rest} role="group" aria-label={label} className={cx(cls('segmented'), className)}>
    {children}
  </div>
)

export interface SegmentedItemProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** Dấu của lựa chọn này. Bắt buộc — xem `doiHinh`. */
  icon: ReactNode
  /** This is the view being looked at now. */
  current?: boolean
  /**
   * How many are behind this choice.
   *
   * ⚠️ A COUNT, NEVER A STATE — the kit is explicit that `count` answers "how
   *    many" and nothing else. It is drawn beside the label, not instead of it:
   *    a bare number is unreadable without the word it counts.
   */
  count?: number
  /**
   * Render as a link instead of a button — pass the router's own component.
   * A filter that lives in the URL can be shared, bookmarked and gone Back from;
   * one that lives in component state cannot.
   */
  as?: ElementType
  children?: ReactNode
}

export function SegmentedItem({
  icon, current, count, as, className, children, ...rest
}: SegmentedItemProps) {
  const inner = (
    <>
      {icon}
      {children}
      {/* ⛔ `count != null`, not `count &&` — nought is a number worth showing.
          "Đã huỷ 0" tells the reader the state exists and is empty; dropping it
          makes them wonder whether the filter is broken. */}
      {count != null && <span className={cls('count')}>{count}</span>}
    </>
  )
  /* ⚠️ `aria-current="page"` is the kit's hook, and it is also the right word
     when the choice lives in the URL. `type="button"` for the same reason as
     `MenuItem`: an untyped button inside a form submits it. */
  const mark = current ? { 'aria-current': 'page' as const } : {}
  const cn = cx(cls('segmented-item'), className)

  return as
    ? createElement(as, { ...rest, className: cn, ...mark }, inner)
    : createElement('button', { ...rest, type: 'button', className: cn, ...mark }, inner)
}
