import type { InputHTMLAttributes, ReactNode } from 'react'
import { createElement } from 'react'
import { cls, cx } from '../prefix/index.js'

/**
 * YES/NO, AND ONE-OF-A-FEW — and the class goes on the LABEL, not the box.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ WHY THE WRAPPER, MEASURED RATHER THAN ARGUED
 *
 *   The kit's rule carries its own reason: *"a checkbox is a few pixels of ink
 *   inside a full-size target — shrinking the target to match the ink is the
 *   commonest tap failure in a form."* The geometry it emits says the same —
 *   `inline-flex`, a `gap` between the ink and its words, `min-height` — all of
 *   which describe a LABEL holding a box and a sentence, not a bare box.
 *
 *   Both placements were rendered against the emitted stylesheet and measured:
 *
 *       class on <label>  geometry right · checked colour DEAD
 *       class on <input>  colour right   · words fall to the next line
 *
 *   Neither half worked, because the kit's states were written for the input
 *   while its geometry was written for the wrapper. The kit has been fixed to
 *   say what `pick` already said — `:has(:checked)` — and this component takes
 *   the placement the geometry demands.
 *
 * ⚠️ Requires `@dqa-ai-solutions/ui-kit` ≥ 0.27.0. On 0.26.0 the box still works and the
 *    selected colour silently does not.
 * ═══════════════════════════════════════════════════════════════════════════
 */

interface ChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** The words beside the ink. A choice with no words is a choice nobody can read. */
  children?: ReactNode
  /** Class for the LABEL — the target. Style the box through the kit, not here. */
  className?: string
}

const choice = (kind: 'check' | 'radio', type: 'checkbox' | 'radio') =>
  function Choice({ children, className, ...rest }: ChoiceProps) {
    /* ⛔ `disabled` stays on the INPUT, where the platform acts on it. The kit
       now reaches the wrapper through `:has(:disabled)`, so the wrapper needs
       no attribute of its own — and must not get `aria-disabled`, which would
       announce the label as disabled while the input still answers. */
    return createElement(
      'label',
      { className: cx(cls(kind), className) },
      createElement('input', { ...rest, type }),
      children,
    )
  }

export const Check = choice('check', 'checkbox')
export const Radio = choice('radio', 'radio')
export type { ChoiceProps }
