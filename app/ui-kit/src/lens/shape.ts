// HOW TO READ ONE VALUE OFF ONE RECORD. ONE READER, FOR EVERY SURFACE.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ THERE WERE THREE, AND I WROTE THE THIRD ONE THE SAME DAY I WARNED ABOUT IT
//
//   A record can carry an envelope AND top-level columns at once:
//
//       { id, entityType, source_ref, currentStrength, authority,
//         data: { unitName, orgLevel, tier } }
//
//   All three readers in this package spelled the lookup `record.data ?? record`
//   — the envelope when there is one, the row when there is not, and nothing at
//   all for the shape that has both:
//
//     `cell.ts`    every table cell        → a real value drew an em dash
//     `record.ts`  `stateOf`               → the record's WORKFLOW STATE
//                                            vanished; no badge, no error
//     `list.ts`    `subjectOf`             → written by me hours after warning
//                                            the app session about second
//                                            sources of truth
//
//   ⭐ The third one is the point. Knowing the failure mode, having just written
//      it down for someone else, does not stop anyone reproducing it — because
//      copying a two-token expression does not FEEL like duplicating a decision.
//      Only one exported function does.
//
// ⚠️ So this file is deliberately tiny and deliberately its own module: a
//    checker refuses `.data ??` anywhere in `lens/`, and a name is easier to
//    obey than a rule about an expression.
// ═══════════════════════════════════════════════════════════════════════════

/*
 * ⛔ EXPORTED FROM THE PACKAGE, AND IT SHOULD HAVE BEEN FROM THE START.
 *
 *   The adopting app built the reader-count check this file's rule suggested,
 *   and it found FIVE places in their own code writing `x.data ?? x` — one of
 *   them on the path that decides whether a workflow step is eligible, which is
 *   the same consequence measured here for `stateOf`: the button disappears
 *   from the record page, with no error.
 *
 *   ⭐ So they had a way to WATCH five copies and no way to DELETE them, because
 *      this function was internal. A rule that can only be monitored is a rule
 *      that will be broken; a rule you can import is a rule that goes away.
 *
 * ⚠️ ON SERVER CODE IMPORTING A UI PACKAGE. One of those five sites is
 *    `libs/process`, which runs on the server, and reaching into `@dqa-ai-solutions/ui-kit`
 *    from there is a smell. It is still the better trade: this package has ZERO
 *    runtime dependencies and the lens layer is plain JavaScript with no DOM,
 *    while the package that OUGHT to own a record's shape —
 *    `@dqa-ai-solutions/ontology-view` — cannot be imported by browser code at all (it
 *    reaches for `js-yaml` and `fs-extra`), which is the exact constraint that
 *    already forced `missingDerived` to be duplicated once.
 *
 *    If a server would rather not import a UI package, copy these six lines
 *    DELIBERATELY and say so in a comment beside them, the way `missingDerived`
 *    does — a copy someone chose is answerable; a copy nobody noticed is not.
 */

/** The read layer never produced this key — not a value, a wiring fault. */
export const ABSENT = Symbol('the read layer never produced this key')

/**
 * One property of one record, wherever the store chose to put it.
 *
 * ⚠️ THE ENVELOPE WINS A COLLISION, deliberately. It holds the ontology's own
 *    properties; a store column that happens to share a name is the one that
 *    should give way — otherwise a soft-delete flag called `status` quietly
 *    replaces the workflow state called `status`.
 */
export function readValue(
  row: Record<string, unknown>,
  key: string,
): unknown | typeof ABSENT {
  const data = row.data as Record<string, unknown> | undefined
  if (data && key in data) return data[key]
  if (key in row) return row[key]
  return ABSENT
}

/**
 * The record flattened: envelope over top-level, in one object.
 *
 * ⭐ FOR THE CALLER READING SEVERAL FIELDS AT ONCE, which is what every copy of
 *    `x.data ?? x` in the wild was actually doing — a filter testing three
 *    properties of a signed decision, a row builder reading four columns.
 *    Offering only `readValue` would have left those sites writing the merge
 *    themselves, which is the thing being removed.
 *
 * ⚠️ `data` itself is dropped from the result. A flattened view with a nested
 *    `data` key still in it invites exactly the two-shape confusion this exists
 *    to end.
 *
 * ⚠️ Same collision rule as `readValue`: the envelope wins.
 */
export function fieldsOf(row: Record<string, unknown>): Record<string, unknown> {
  const data = row.data as Record<string, unknown> | undefined
  const { data: _envelope, ...top } = row
  return data ? { ...top, ...data } : top
}
