import type { AnchorHTMLAttributes, ElementType, ReactNode } from 'react'
import { createElement } from 'react'
import { cls, cx } from '../prefix/index.js'

/**
 * A LINK — goes somewhere, and never commits.
 *
 * ⚠️ The kit is explicit that this is a different thing from a button, and says
 *    why in the stylesheet itself: *"drawn as a button, a reader cannot tell
 *    which one is safe to press twice."* So this component refuses to be one —
 *    it has no `type`, no tier, and no busy state.
 *
 * ⛔ WHAT `as` IS FOR, AND WHAT IT IS NOT FOR
 *
 *   A React app almost always routes with something — `react-router`'s `Link`,
 *   a framework's own. The kernel must not know which, so the caller passes it:
 *
 *       <Link as={RouterLink} to="/plans">Kế hoạch</Link>
 *
 *   It is an escape hatch for the ROUTER, not for the tag. Passing `as="button"`
 *   defeats the distinction this element exists to hold, so the disabled path
 *   below ignores `as` entirely.
 */
export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href?: string
  /** The router's own link component. Anything else is a mistake — see above. */
  as?: ElementType
  /**
   * Reachable, but not now.
   *
   * ⛔ NOT `<a disabled>` — that attribute does nothing on an anchor, and a
   *    "disabled" link written that way stays clickable, stays focusable, and
   *    stays announced as a link. The kit's rule targets
   *    `[aria-disabled="true"]` for exactly this reason, so that is what gets
   *    written, and the `href` is removed so the platform stops treating it as
   *    a destination at all.
   */
  disabled?: boolean
  children?: ReactNode
}

export function Link({ as, disabled, className, href, onClick, ...rest }: LinkProps) {
  const classes = cx(cls('link'), className)

  if (disabled) {
    /* No `href`, so it is not focusable and not followable — the two halves of
       "disabled" that an ARIA attribute alone does not deliver. `as` is dropped:
       a router component given no destination is a bug waiting for a reader. */
    return createElement('a', { ...rest, className: classes, 'aria-disabled': true })
  }

  return createElement(as ?? 'a', { ...rest, className: classes, href, onClick })
}
