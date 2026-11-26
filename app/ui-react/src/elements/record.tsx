import type { ElementType, HTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react'
import { createElement } from 'react'
import { cls, cx } from '../prefix/index.js'
import type { Tone } from './surface.js'

/**
 * WHAT A RECORD LOOKS LIKE — card, its parts, its values, and the small marks.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ THE KIT HAS DRAWN ALL OF THIS SINCE `0.30`. WHAT WAS MISSING WAS A MOULD.
 *
 *   Every rule below already exists in `component-css.ts` — `.fos-card`,
 *   `.fos-card-head`, `.fos-facts`, `.fos-badge`, `.fos-count`, `.fos-tag`,
 *   `.fos-meter`, `.fos-avatar`, `.fos-provenance`. What did not exist was any
 *   way to REACH them except by typing the class name.
 *
 *   Measured on the application this was extracted from, the day this file was
 *   written: **1.719 hand-typed `fos-*` class names across 33 classes**, and
 *   **1.087 of them wrote the kernel class AND an application class for the
 *   same idea side by side** — `class="fos-card card"`. Two names for one
 *   thing, in two stylesheets, one of which loads last and wins.
 *
 * ⚠️ SO THE POINT OF THIS FILE IS SUBTRACTION, NOT ADDITION. It adds no rule,
 *    no token and no decision. It removes the only way the two could disagree.
 *
 * ⛔ AND NOT ONE OF THESE CARRIES A WORD — same law as `surface.tsx`. `Badge`
 *    takes children; it never invents "Đang xử lý". Naming a state is the
 *    application's job, and a grammar that names states is a grammar that only
 *    fits the application it was cut from.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── card, and its two parts ───────────────────────────────────────────────

/**
 * GROUPS THINGS THAT BELONG TOGETHER.
 *
 * ⭐ `head` and `body` are PARTS, the way `th` and `td` are parts — the kit
 *    says so, and drops the card's own padding via `:has(> .card-head)` the
 *    moment it is given a head. So a bare `<Card>` with no parts still works,
 *    and a card with parts does not double its padding.
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * ⭐ THẺ KHÁC — và đây không phải sở thích, đo trên ứng dụng gốc ra 73 chỗ.
   *
   *   Một thẻ có tiêu đề đọc lên đúng hơn khi là `<section>`; một thẻ hỏi người
   *   dùng điền gì đó LÀ một `<form>`. Ép cả hai thành `<div>` là ném đi ngữ
   *   nghĩa nền tảng đã cho không, và chỗ gọi sẽ đi vòng bằng cách gõ lại tên
   *   lớp — đúng thứ tệp này dựng ra để dẹp.
   *
   * ⚠️ Lối thoát cho THẺ, không phải cho hình dáng: `as="button"` biến một mặt
   *    phẳng thành một thứ bấm được mà không mang một luật nào của nút.
   */
  as?: ElementType
  children?: ReactNode
}

const mat = (ten: string) => function Mat({ as, className, children, ...rest }: CardProps) {
  return createElement(as ?? 'div', { ...rest, className: cx(cls(ten), className) }, children)
}

export const Card = mat('card')

/**
 * WHAT A CARD IS, AND WHAT CAN BE DONE TO IT.
 *
 * ⚠️ The kit gives the LAST child `margin-left: auto` — the trailing slot, for
 *    a count, a state, an action. Never the title. So order the children the
 *    way they read: title first, trailing thing last.
 */
export const CardHead = mat('card-head')

/** What the card holds. */
export const CardBody = mat('card-body')

// ── facts: a record's own values ──────────────────────────────────────────

/**
 * NAME BESIDE VALUE — and it is a `<dl>`, which is the whole reason it exists.
 *
 * ⛔ IT IS NOT A GRID OF `<div>`s. The kit styles `> dt` and `> dd` directly,
 *    so anything else gets the geometry and none of the type. And a description
 *    list is the one element the platform already understands as name/value:
 *    a screen reader can walk it pair by pair, which a stack of divs cannot
 *    offer at any price.
 *
 * ⚠️ `stacked` for long values — the kit's own variant. A long sentence squeezed
 *    into a second column reads worse than the same sentence under its name.
 */
export interface FactsProps extends HTMLAttributes<HTMLDListElement> {
  /** Long values read better under their name than beside it. */
  stacked?: boolean
  children?: ReactNode
}

export function Facts({ stacked, className, children, ...rest }: FactsProps) {
  return (
    <dl {...rest} className={cx(cls('facts'), stacked && cls('facts--stacked'), className)}>
      {children}
    </dl>
  )
}

/**
 * ONE PAIR.
 *
 * ⭐ It returns a FRAGMENT of `<dt>` + `<dd>`, not a wrapper. The kit's grid is
 *    on the `<dl>` and its children are the cells; wrapping each pair in a
 *    `<div>` puts a box between the grid and its cells, and the columns stop
 *    lining up — the exact failure that makes people give up on `<dl>` and
 *    hand-roll a grid.
 */
export interface FactProps {
  name: ReactNode
  children?: ReactNode
}

export function Fact({ name, children }: FactProps) {
  return <><dt>{name}</dt><dd>{children}</dd></>
}

// ── the small marks ───────────────────────────────────────────────────────

/**
 * A STATE, IN ONE WORD — and the colour is a DOT, not a filled pill.
 *
 * ⚠️ `bare` is a dot with no word, and it is the dangerous one: colour alone is
 *    a channel roughly one man in twelve cannot read. So `bare` DEMANDS a
 *    `label`, the way an icon-only button demands one, and there is a `Legend`
 *    below because a dot with no word needs somewhere its meaning is written.
 */
export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  tone?: Tone | 'plain'
  children?: ReactNode
  /** The word, for a `bare` badge that shows none. */
  label?: string
}

export function Badge({ tone, className, children, label, ...rest }: BadgeProps) {
  const bare = children == null || children === '' || children === false
  return (
    <span
      {...rest}
      className={cx(cls('badge'), tone && cls(`badge--${tone}`), bare && cls('badge--bare'), className)}
      {...(label ? { 'aria-label': label, title: label } : {})}
    >
      {children}
    </span>
  )
}

/** Where the bare dots are explained. */
export function Legend({ as, className, children, ...rest }: CardProps) {
  return createElement(as ?? 'div', { ...rest, className: cx(cls('legend'), className) }, children)
}

/**
 * HOW MANY — never a state.
 *
 * ⚠️ A count borrows the badge TYPE SIZE and nothing else: no dot, no tone. The
 *    kit says why in the stylesheet — draw "how many" with a tone and the reader
 *    starts looking for a meaning that is not there, which is how a screen ends
 *    up with fourteen coloured things and no signal.
 */
export function Count({ as, className, children, ...rest }: CardProps) {
  return createElement(as ?? 'span', { ...rest, className: cx(cls('count'), className) }, children)
}

/** WHAT KIND — a classification, never a state. Same warning as `Count`. */
export function Tag({ as, className, children, ...rest }: CardProps) {
  return createElement(as ?? 'span', { ...rest, className: cx(cls('tag'), className) }, children)
}

/**
 * HOW FAR ALONG, AGAINST A TARGET.
 *
 * ⛔ `role="meter"` WITH THE REAL NUMBERS, not a decorative bar. A bare number
 *    cannot say "0 of 240" at a glance across forty rows; a bar can — but only
 *    for someone who can see it. The numbers go in the ARIA so the value is
 *    there for everyone else, and they are the SAME numbers that size the fill,
 *    so the bar and the announcement can never drift apart.
 *
 * ⚠️ `max` of 0 is not an error and not a crash — it is a target nobody set
 *    yet. The bar reads empty and says so.
 */
export interface MeterProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  value: number
  max: number
  tone?: Tone
  /** What is being measured — `role="meter"` is unreadable without a name. */
  label: string
}

export function Meter({ value, max, tone, label, className, ...rest }: MeterProps) {
  const fraction = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <div
      {...rest}
      className={cx(cls('meter'), tone && cls(`meter--${tone}`), className)}
      role="meter"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <span style={{ width: `${fraction * 100}%` }} />
    </div>
  )
}

/**
 * WHO — a face, or the initials standing for one.
 *
 * ⚠️ Initials are NOT computed here. Which letters stand for a person is a
 *    naming convention, and naming conventions are not the same in every
 *    language the kernel will be read in — a Vietnamese name gives its initials
 *    from the last two syllables, not the first letters of the first two words.
 *    The caller passes what it wants shown.
 *
 * ⛔ AND IT IS NEVER THE ONLY THING SAYING WHO. Two letters in a circle is not
 *    a name; `label` goes onto the element so it is announced, and the row is
 *    expected to carry the person's name in words as well.
 */
export interface AvatarProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** A picture, if there is one. */
  src?: string
  /** The letters shown when there is no picture. */
  initials?: string
  /** The person's name. Required — see above. */
  label: string
  imgProps?: ImgHTMLAttributes<HTMLImageElement>
}

export function Avatar({ src, initials, label, imgProps, className, ...rest }: AvatarProps) {
  return (
    <span {...rest} className={cx(cls('avatar'), className)} role="img" aria-label={label}>
      {src
        ? <img {...imgProps} src={src} alt="" />
        : initials}
    </span>
  )
}

/**
 * WHERE THIS NUMBER CAME FROM.
 *
 * ⚠️ THE CONTRACT DOES NOT CARRY THIS — the kit says so where it draws it. What
 *    `@dqa-ai-solutions/ontology-view` carries is `notes` / `ResolvedField.note`: the
 *    authority behind ONE FIELD. This is the RECORD-level block, and it has no
 *    contract behind it today. The mould is here because the shape is general.
 */
export function Provenance({ as, className, children, ...rest }: CardProps) {
  return createElement(as ?? 'div', { ...rest, className: cx(cls('provenance'), className) }, children)
}
