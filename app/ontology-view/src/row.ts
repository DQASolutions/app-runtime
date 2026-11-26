// What the READ LAYER must supply, and how to find out that it did not.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ THE SEAM THAT HAD NO GUARD
//
//   A contract says: "this entity has a derived property `unit`; follow
//   `heldByUnit` and show `unitName`." A renderer therefore reads
//   `row.unit.unitName`.
//
//   Nothing anywhere checks that the read layer actually returns a key called
//   `unit`. The name in the ontology and the key in the query result match by
//   CONVENTION — and in the application this package was built against, three
//   entities matched by coincidence and the fourth did not. The column rendered
//   blank. No error, no warning, no log line. A subtitle simply vanished.
//
//   ⚠️ That failure is invisible in exactly the way this package exists to
//      prevent, and it lived at the one seam the resolver cannot see: the
//      resolver has the declaration, never the data.
//
//   So the check has to happen where the two meet — at the row.
//
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐ THE DISTINCTION THAT MAKES THIS WORK
//
//   `null` and *absent* mean completely different things here, and conflating
//   them is why the bug hid:
//
//     row.unit === null      → the record has no linked unit. Legitimate.
//                              Render an em dash.
//     'unit' in row === false → the read layer never produced this key at all.
//                              A WIRING FAULT. Render a warning, loudly.
//
//   Every previous version treated both as "no value" and drew the same em
//   dash, which is why a broken join looked exactly like an empty field.

import type { ViewContract, ResolvedField } from './types.js'

/** A derived property the contract promises that the row does not carry. */
export interface MissingDerived {
  /** Property name as declared in the ontology — and as the row must key it. */
  key: string
  label: string
  /** What the renderer would have followed, for the error message. */
  via?: string
  show?: string
}

const derivedFields = (c: ViewContract): ResolvedField[] => {
  const all = [
    ...(c.list?.columns ?? []),
    ...(c.list?.main ? [c.list.main] : []),
    ...(c.list?.sub ? [c.list.sub] : []),
    ...(c.detail?.facts ?? []),
    ...(c.row ? [c.row.main, c.row.sub, c.row.badge] : []),
  ].filter((f): f is ResolvedField => f != null)

  // A virtual column also has `kind: 'derived'` but no `derived` block — it is
  // drawn entirely by a named component and reads whatever it likes off the row.
  // Only declared derivations make a promise about a key.
  return all.filter((f) => f.kind === 'derived' && f.derived)
}

/**
 * Derived properties the contract promises but this row does not carry.
 *
 * ⚠️ Uses `in`, not a truthiness or `!= null` test. That is the whole point:
 *    a present-but-null key is a record with no link, which is fine; an absent
 *    key is a read layer that never ran the join.
 *
 * Returns `[]` for a healthy row, so `missingDerived(c, row).length` reads as
 * "is this row wired correctly".
 */
export function missingDerived(contract: ViewContract, row: unknown): MissingDerived[] {
  if (row == null || typeof row !== 'object') return []
  const seen = new Set<string>()
  const out: MissingDerived[] = []

  for (const f of derivedFields(contract)) {
    if (seen.has(f.key)) continue
    seen.add(f.key)
    if (f.key in (row as Record<string, unknown>)) continue
    const d = f.derived as { via?: string; show?: string } | undefined
    out.push({ key: f.key, label: f.label, via: d?.via, show: d?.show })
  }
  return out
}

/**
 * One sentence a renderer or a build check can print.
 *
 * Says what is wrong AND where to fix it — the name in the ontology and the key
 * in the query result have to be the same word, and whoever hits this needs to
 * be told which of the two to change.
 */
export function explainMissing(entity: string, m: MissingDerived): string {
  const follow = m.via ? ` (follows "${m.via}"${m.show ? `, shows "${m.show}"` : ''})` : ''
  return (
    `"${entity}" declares derived property "${m.key}"${follow}, but the row does not carry a `
    + `"${m.key}" key. The ontology name and the read layer's key must be the same word — `
    + `change whichever is wrong.`
  )
}
