import type { HTMLAttributes, ReactNode } from 'react'
import { cls, cx } from '../prefix/index.js'

/**
 * A ROUTE, AND WHERE ON IT THE RECORD IS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ THIS DRAWS. IT DECIDES NOTHING, AND IT NAMES NOTHING.
 *
 *   `milestoneModel` in `@dqa-ai-solutions/ui-kit` works out which points exist, what order
 *   they come in, which one the record is on, and which gate it is waiting for.
 *   Every word printed here — a point's label, an actor's name — arrives as a
 *   prop from the application. Same law as `Badge`: it takes children, it never
 *   invents "Đang xử lý".
 *
 * ⚠️ SO `standing` IS NOT A COLOUR CHOICE. It is the model's answer, and the
 *    kit already has CSS for all three. A caller passing the standing it wishes
 *    were true rather than the one the model computed will draw a route that
 *    disagrees with the record it sits above, and nothing will say so.
 *
 * ⭐ NOT `<ol>`, AND THE REASON IS ASSISTIVE, NOT VISUAL. An ordered list
 *    announces "list, 6 items, item 1 of 6" and stops — a reader hears the
 *    positions and never hears which one is CURRENT, which is the single thing
 *    the strip exists to say. `<nav>` was wrong too: nothing here navigates.
 *    A group with an accessible name, and one `aria-current` on the point the
 *    record is on, is what actually reads back correctly.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export interface MilestonesProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * What this route is a route THROUGH — a record's name, a process's label.
   *
   * ⚠️ Required, because a group with no name is announced as "group" and a
   *    screen with two of them is announced as "group, group".
   */
  label: string
  children?: ReactNode
}

export function Milestones({ label, className, children, ...rest }: MilestonesProps) {
  return (
    <div {...rest} className={cx(cls('milestones'), className)} role="group" aria-label={label}>
      {children}
    </div>
  )
}

/** Where a point sits relative to the record — see `MilestoneStanding` in the kit. */
export type Standing = 'past' | 'current' | 'ahead'

/**
 * How a gate was ruled on — the only two answers a picture can hold.
 *
 * ⚠️ `passed`/`refused` rather than `approved`/`rejected`: a gate is not always
 *    an approval. A test passed, a condition met, a check that came back clean
 *    are all the same shape, and the word must not narrow them to one domain.
 */
export type Settlement = 'passed' | 'refused'

export interface MilestoneProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** The point's own word — a state's label, or the label of the step opening a gate. */
  label: ReactNode
  standing: Standing
  /**
   * A gate rather than a state: a condition standing between two points.
   *
   * ⛔ DRAWN DIFFERENTLY BECAUSE IT IS DIFFERENT, and the reader must not have
   *    to read the label to find out. A record is never *in* a gate.
   */
  gate?: boolean
  awaiting?: boolean
  /**
   * This gate has been RULED ON, and which way it went.
   *
   * ⛔ WITHOUT THIS, AN APPROVED GATE GOES ON WEARING THE WAITING COLOUR. On a
   *    cross-level line the record deliberately does not move when the level
   *    above decides, so the kit stands the gate `past` on the verdict alone —
   *    but `--gate` repaints the dot after `--past` does, and the reader is left
   *    with a warn-coloured ring sitting under the words "already approved".
   *    Reported on the reference app 9/9/2026, in those words.
   *
   * ⚠️ TWO VALUES, NOT THE VERDICT ITSELF. `Milestone.verdict` in the kit is the
   *    application's own word — `approve`, `RETURNED`, whatever the domain
   *    says — and this package must not learn to read domain vocabulary. The
   *    app maps its word onto one of these two; drawing is ours, naming is not.
   */
  settled?: Settlement
  /** Whose move it is here, and when it happened. The application's words. */
  who?: ReactNode
  /**
   * What goes in the point itself: a tick, an index, a verdict mark.
   *
   * ⚠️ Never load-bearing on its own. Standing is carried by colour AND by the
   *    connector AND by `aria-current`; the mark is the fourth channel, not the
   *    first. Absent is fine.
   */
  mark?: ReactNode
}

export function Milestone({
  label, standing, gate, awaiting, settled, who, mark, className, ...rest
}: MilestoneProps) {

  return (
    <div
      {...rest}
      className={cx(
        cls('milestone'),
        cls(`milestone--${standing}`),
        gate && cls('milestone--gate'),
        awaiting && cls('milestone--awaiting'),
        settled && cls(`milestone--${settled}`),
        className,
      )}
      /* ⭐ THE ONE THING A SIGHTED READER GETS FOR FREE AND A LISTENER DOES NOT.
         `step` rather than `true`: it says *which step of the process*, which is
         precisely the question. Exactly one point on a route carries it. */
      aria-current={standing === 'current' ? 'step' : undefined}
    >
      <span className={cls('milestone-dot')} aria-hidden="true">{mark}</span>
      <span className={cls('milestone-label')}>{label}</span>
      {who && <span className={cls('milestone-who')}>{who}</span>}
    </div>
  )
}

/**
 * WORK THAT HAS NO POSITION ON THE ROUTE, gathered under the rail.
 *
 * ⛔ THREE KINDS FAIL TO BE A POINT, AND ALL THREE ARE ORDINARY.
 *
 *     return    walks the record backward — 22 of 54 processes have one
 *     parallel  another role's work, running alongside, blocking nobody
 *     optional  outside the sequence, taken only when needed
 *
 *   Drawn as another point, each asserts an order it does not hold: a return
 *   would read as coming AFTER the state it returns to, and parallel work as a
 *   step everyone must pass through.
 *
 * ⚠️ GREW FROM `MilestonesReturn`, WHICH KNEW ONLY THE FIRST KIND. The second
 *    screen to want a route had three lines of the other two, and stacking three
 *    `MilestonesReturn` gave three dividers for one seam — the foot owns the
 *    rule, its lines do not.
 */
export function MilestonesFoot({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx(cls('milestones-foot'), className)}>{children}</div>
}

export interface MilestoneNoteProps extends HTMLAttributes<HTMLParagraphElement> {
  /**
   * The mark that says which kind this is.
   *
   * ⚠️ REQUIRED, and it is not decoration. These three lines sit together and
   *    read alike; without a mark apiece, "you can go back" and "somebody else
   *    is doing this" are one undifferentiated grey paragraph. The application
   *    supplies the mark — naming what a kind LOOKS like is ours, naming the
   *    kinds is not.
   */
  mark: ReactNode
}

export function MilestoneNote({ mark, className, children, ...rest }: MilestoneNoteProps) {
  return (
    <p {...rest} className={cx(cls('milestone-note'), className)}>
      <span aria-hidden="true">{mark}</span>
      <span>{children}</span>
    </p>
  )
}
