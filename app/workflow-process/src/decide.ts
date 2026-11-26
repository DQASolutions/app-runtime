// Deciding what a step is allowed to do — ONE source, used by both directions.
//
// The read direction ("what can I do with this record") and the write direction
// ("do this") must agree. When they are two pieces of code they drift, and the
// drift is invisible: the button hides correctly while the API still accepts the
// call. Every predicate a step is judged by lives here, and both directions ask
// this module.

import type { ExtraCheck, FactGate, Facts, Record_, Transition, Verdict } from './types.js'

const READY: Verdict = { ready: true, notReady: null, notReadyKind: null, code: null }

/**
 * Is the record in a state this step accepts?
 *
 * `from: []` means the step CREATES a record, so it is attached to no record and
 * never offered against one. Kept separate from {@link checkTransition} on
 * purpose: the read side filters such steps out silently, the write side throws
 * with the current state named. Same rule, two presentations.
 */
export function matchesFrom(transition: Transition, status: unknown): boolean {
  const from = transition.from ?? []
  return from.length > 0 && from.includes(String(status))
}

/**
 * The authority's decision currently in force — the LATEST by `decidedAt`.
 *
 * A submission may be returned and resubmitted many times, so the approval chain
 * is a history, not a flag. Reading the first one lets a plan that was sent back
 * still pass as approved; counting them blocks the very loop the process exists
 * to serve.
 */
export function latestApprovalDecision(approvals: Record_[] = []): string | null {
  if (!approvals.length) return null
  const latest = [...approvals].sort((a, b) =>
    String(a.data?.decidedAt ?? '').localeCompare(String(b.data?.decidedAt ?? '')),
  ).at(-1)
  return (latest?.data?.decision as string | undefined) ?? null
}

/**
 * Judge one step against one record.
 *
 * Deliberately does NOT check the role or the `from` state — see
 * {@link matchesFrom}. Those two are presented differently on each side; every
 * other predicate is identical and lives here.
 */
/**
 * A fact gate as a list, whichever form it was declared in. The one reader of `requiresFact` /
 * `forbidsFact` — `.property` on a list is `undefined`, and a gate read that way is a gate that
 * silently never closes.
 */
export function factGates(spec: FactGate | FactGate[] | undefined | null): FactGate[] {
  if (!spec) return []
  return (Array.isArray(spec) ? spec : [spec]).filter((g): g is FactGate => Boolean(g?.property))
}

export function checkTransition(
  transition: Transition,
  record: Record_ | null | undefined,
  facts: Facts = {},
  extra: ExtraCheck[] = [],
): Verdict {
  // A prerequisite must be done — or must NOT have been done yet.
  //
  // Expressing these as extra states makes the state machine grow
  // combinatorially (supplied × attended × filed…). Expressing them as an `if`
  // in the screen puts business rules back in the UI. So they are two lines of
  // declaration, and this engine reads them.
  const gates: Array<['requiresFact' | 'forbidsFact', boolean, 'waiting' | 'done', string]> = [
    ['requiresFact', true, 'waiting', 'FACT_MISSING'],
    ['forbidsFact', false, 'done', 'FACT_PRESENT'],
  ]
  let held: Verdict | null = null

  // Link gates — the same idea as the fact gates, but the condition lives in a
  // relationship instead of a column. See `Facts.links`.
  //
  // ⚠️ AN UNKNOWN COUNT IS NOT ZERO. The read side is handed `links` because the
  //    screen has already loaded them; when it hands nothing, the engine must NOT
  //    invent a count. `requiresLink` on an unknown count would hide a button that
  //    works, and `forbidsLink` would offer one that the write path then refuses.
  //    Either way the two directions disagree — the one thing this module exists
  //    to prevent. So: unknown → skip here, and the WRITE path decides, where the
  //    count is always derived from the store and never taken from a caller.
  const linkGates: Array<['requiresLink' | 'forbidsLink', 'waiting' | 'done', string]> = [
    ['requiresLink', 'waiting', 'LINK_MISSING'],
    ['forbidsLink', 'done', 'LINK_PRESENT'],
  ]
  for (const [key, kind, code] of linkGates) {
    const spec = transition[key]
    if (!spec) continue
    const rel = spec.relationship ?? spec.via
    if (!rel) continue
    const count = facts.links?.[rel]
    if (count === undefined) continue
    const min = key === 'requiresLink' ? ((spec as { min?: number }).min ?? 1) : 0
    const bad = key === 'requiresLink' ? count < min : count > 0
    if (bad) {
      held = { ready: false, notReady: spec.message, notReadyKind: kind, code }
      break
    }
  }

  for (const [key, wanted, kind, code] of gates) {
    if (held) break
    // Every fact in declared order — the first one that does not hold is the one a person is told.
    for (const spec of factGates(transition[key])) {
      if (Boolean(record?.data?.[spec.property]) !== wanted) {
        held = { ready: false, notReady: spec.message, notReadyKind: kind, code, property: spec.property }
        break
      }
    }
  }

  // Anything else a domain wants judged plugs in through `extraChecks`. The
  // rule that a submission must not be approved twice used to live here, named
  // after one app's entity — a kernel deciding that would be wrong for the next app.
  //
  // ⭐ A PERMANENT REFUSAL OUTRANKS A TEMPORARY ONE, whatever order they were
  //    declared in. `notReadyKind: 'n/a'` means "this step does not apply to this
  //    record, ever"; 'waiting' means "not yet". Returning the fact gate first
  //    just because it is evaluated first tells the reader to wait for something
  //    that will never arrive.
  //
  // ⛔ THIS IS NOT A STYLE CHOICE — it changed what an app could express. Before
  //    it, a domain that wanted `appliesTo` (permanent, in `extraChecks`) to win
  //    over `requiresFact` (temporary, in the declaration) had to DELETE the
  //    declaration and hand-write the whole gate in JavaScript, purely to control
  //    evaluation order. Measured in a reference app on 21/8/2026: two gates rewritten
  //    that way, and a plan type left showing "the assistant has not handed the
  //    draft over" for a button that can never appear on it.
  //
  // ⚠️ Only 'n/a' jumps the queue. Two temporary refusals keep declaration order,
  //    because between "not yet A" and "not yet B" the engine has no grounds to
  //    say which the reader should act on first — the domain does, and it says so
  //    by the order it declares them.
  for (const check of extra) {
    const verdict = check(transition, record, facts)
    if (!verdict) continue
    if (verdict.notReadyKind === 'n/a') return verdict
    held ??= verdict
  }

  return held ?? READY
}
