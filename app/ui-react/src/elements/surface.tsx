import type { HTMLAttributes, ReactNode, SVGProps } from 'react'
import { createElement } from 'react'
import { cls, cx } from '../prefix/index.js'

/**
 * THE SURFACES A DATA SCREEN IS MADE OF — and what each one is NOT.
 *
 * ⛔ NOT ONE OF THESE CARRIES A WORD. `Notice` takes children, `Empty` takes
 *    children; neither invents a sentence. The application this grammar was
 *    extracted from had three separate classes for "nothing here" — `empty`,
 *    `sscd-empty`, `wg-empty` — because each screen that needed one wrote its
 *    own, and each one worded it differently. One shape, supplied words.
 */

/**
 * ⭐ THE TONE IS THE KIT'S LIST, NOT A FREE STRING.
 *
 *   The reference application called them `info` · `ok` · `stop` · `warn` ·
 *   `wait` · `done` — six names for five tones, with `info` and `ok` being
 *   `wait` and `done` under other names. Mapping a domain word onto a tone is
 *   the application's job; carrying two names for one tone is how a stylesheet
 *   grows a dead rule.
 */
export type Tone = 'wait' | 'doing' | 'done' | 'warn' | 'stop'

// ── notice: says something about the whole screen ─────────────────────────

export interface NoticeProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone
  children?: ReactNode
}

export function Notice({ tone, className, children, ...rest }: NoticeProps) {
  /* ⚠️ No children, no notice — and NOT an empty box. A bordered strip with
     nothing in it reads as a rendering fault, and the reference app shipped
     exactly that wherever a message turned out to be conditional. */
  if (children == null || children === false || children === '') return null
  return (
    <div {...rest} className={cx(cls('notice'), tone && cls(`notice--${tone}`), className)}>
      {children}
    </div>
  )
}

// ── empty: nothing here, and what to do about it ──────────────────────────

export interface EmptyProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Gọn — câu ấy nằm TẠI CHỖ, trong một thẻ hoặc một danh sách con, thay vì là
   * một khoảng trống căn giữa cao bằng nửa màn hình.
   *
   * ⚠️ Cùng phần tử, khác chỗ đứng. Ba lớp riêng cho ba chỗ là ba chỗ để lệch —
   *    ứng dụng gốc đã có đúng ba.
   */
  compact?: boolean
  /** `p` khi nó là một câu; `div` khi nó chứa nhiều thứ. Mặc định `div`. */
  as?: 'div' | 'p' | 'li'
  children?: ReactNode
}

export function Empty({ compact, as = 'div', className, children, ...rest }: EmptyProps) {
  return createElement(
    as,
    { ...rest, className: cx(cls('empty'), compact && cls('empty--compact'), className) },
    children,
  )
}

// ── skeleton: data is coming ──────────────────────────────────────────────

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * How many bars. `skeletonFor(surface)` in the kit answers WHICH SHAPE; how
   * many of it is the caller's, because only the caller knows how tall the
   * thing being stood in for is.
   */
  lines?: number
  /**
   * ⛔ REQUIRED, and it is not decoration. A pulsing grey block announces
   *    nothing to a screen reader: without a live region and a label, a blind
   *    user hears silence and then, with no warning, a full table. The kit's
   *    own note says a skeleton stands in for DATA — data that is on its way is
   *    a thing to say out loud.
   */
  label: string
}

export function Skeleton({ lines = 3, label, className, ...rest }: SkeletonProps) {
  return (
    <div {...rest} role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className={cls('sr-only')}>{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={cls('skeleton')} aria-hidden="true" />
      ))}
    </div>
  )
}

// ── icon: never alone unless labelled ─────────────────────────────────────

export interface IconProps extends SVGProps<SVGSVGElement> {
  /**
   * ⛔ The kit's one clause for this element is *"never alone unless
   *    labelled"*, so the type enforces the choice instead of hoping. Either
   *    the icon sits beside words — `decorative`, and it is hidden from the
   *    accessibility tree so those words are not read twice — or it stands
   *    alone and MUST carry its own name.
   */
  label?: string
  decorative?: boolean
  children?: ReactNode
}

export function Icon({ label, decorative, className, children, ...rest }: IconProps) {
  return (
    <svg
      {...rest} className={cx(cls('icon'), className)}
      {...(decorative
        ? { 'aria-hidden': true as const, focusable: 'false' as const }
        : { role: 'img' as const, 'aria-label': label })}
    >
      {children}
    </svg>
  )
}

// ── sr-only: out of sight, still heard ────────────────────────────────────

export const SrOnly = ({ children }: { children?: ReactNode }) =>
  createElement('span', { className: cls('sr-only') }, children)
