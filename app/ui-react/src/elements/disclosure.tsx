import type { DetailsHTMLAttributes, ReactNode } from 'react'
import { createElement } from 'react'
import { cls, cx } from '../prefix/index.js'

/**
 * SHOWS MORE OF WHAT IS ALREADY HERE — and never navigates.
 *
 * ⭐ `<details>`/`<summary>`, not a button and a piece of state. The platform
 *    already owns the open/closed toggle, the keyboard, and the announcement;
 *    a hand-rolled version re-implements three of those and usually gets the
 *    announcement wrong.
 *
 * ⚠️ `list-style: none` is in the kit's rule for a reason — a `<summary>` draws
 *    a disclosure triangle by default, and a design that supplies its own
 *    affordance ends up with two. The class must therefore land on the
 *    `<summary>`, which is what `.fos-disclosure` is written for: it carries
 *    `hover`, `active` and `focus-visible`, all of which belong to the thing
 *    that is pressed, not to the box that opens.
 */
export interface DisclosureProps
  extends Omit<DetailsHTMLAttributes<HTMLDetailsElement>, 'title'> {
  /** What the closed state says. Never a value — a name for what is hidden. */
  summary: ReactNode
  children?: ReactNode
  /** Class for the `<summary>`; `className` still dresses the `<details>`. */
  summaryClassName?: string
}

export function Disclosure(
  { summary, children, summaryClassName, className, ...rest }: DisclosureProps,
) {
  return createElement(
    'details',
    { ...rest, className },
    createElement('summary', { className: cx(cls('disclosure'), summaryClassName) }, summary),
    children,
  )
}
