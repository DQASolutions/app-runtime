// One value, resolved into something a renderer can draw without asking anything.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ THREE OUTCOMES, NOT TWO — AND THAT IS THE WHOLE FILE
//
//     has a value        → draw it
//     key present, null  → the record has no link. Normal. Draw an em dash.
//     key ABSENT         → the read layer never produced this key. A WIRING
//                          FAULT. Say so, loudly.
//
//   Every earlier version drew the same em dash for the last two, so a broken
//   join looked exactly like an empty field. In the reference app three entities
//   matched the read layer's keys by coincidence and the fourth did not; a
//   subtitle simply vanished, with no error, no warning, and no log line, for
//   weeks.
//
//   `@dqa-ai-solutions/ontology-view` owns the same distinction at the row level
//   (`missingDerived`). This is it at the cell.
// ═══════════════════════════════════════════════════════════════════════════

import type { ResolvedField, Tone } from '@dqa-ai-solutions/ontology-view'
import { writeValue, LONG_TEXT, type Formatter } from './format.js'
import type { BlockRegistry } from './registry.js'
import { readValue, ABSENT } from './shape.js'

export type Cell =
  | { kind: 'text'; field: ResolvedField; text: string; numeric: boolean; long: boolean }
  /** An enum value with the weight the ontology gave it. */
  | { kind: 'tone'; field: ResolvedField; value: string; label: string; tone: Tone }
  /** Present and null — the record legitimately has nothing here. */
  | { kind: 'blank'; field: ResolvedField }
  /** The read layer never produced the key. Not a value; a defect. */
  | { kind: 'unwired'; field: ResolvedField; message: string }
  /**
   * A value that also NAMES another record, and can open it.
   *
   * ⛔ `to` IS `{ entity, id }`, NEVER A STRING — and the type is the guard.
   *    An edge points at an identity, not at a display name: names are typed by
   *    people, get renamed, and repeat. A link built from one works until two
   *    units share a name, and then it opens the wrong record silently.
   *
   *    Measured: 70 cross-record links hand-written across one application, each
   *    one composing its own path.
   */
  | { kind: 'link'; field: ResolvedField; text: string; to: { entity: string; id: string } }
  /** A named component draws this, and receives the whole record. */
  | { kind: 'block'; field: ResolvedField; widget: string }
  /** A block was named that the renderer does not publish. */
  | { kind: 'missing-block'; field: ResolvedField; widget: string; message: string }

export interface CellContext {
  format: Formatter
  blocks: BlockRegistry
  /**
   * Draw an enum as plain words rather than as a badge.
   *
   * ⚠️ Not an aesthetic switch. The same enum means different things in
   *    different places: in a COLUMN it is a status the eye should catch, so a
   *    badge; on the SECOND LINE under a name it is an aside, so words. Draw
   *    badges in both and every row has two chips competing, and the eye has
   *    nowhere to land.
   */
  plain?: boolean
}



/**
 * ⚠️ Uses `in`, not truthiness and not `!= null`. That is the entire point: a
 *    present-but-null key is a record with no link, which is fine; an absent key
 *    is a join that never ran.
 */
function valueOf(row: Record<string, unknown>, field: ResolvedField): unknown | typeof ABSENT {
  if (field.kind !== 'derived') {
    /* ⚠️ `readValue` returns ABSENT for a plain key found in neither place, and
       this deliberately does NOT report that as a fault. Read layers that drop
       null keys from their JSON are common, and turning every optional empty
       field into a defect banner is a change that needs evidence this package
       does not have yet. Only DERIVED keys are held to that standard, below. */
    const v = readValue(row, field.key)
    return v === ABSENT ? undefined : v
  }
  if (field.derived && !(field.key in row)) return ABSENT
  const value = row[field.key]
  if (value == null) return null
  /* ⚠️ Asks whether it is `linked`, not which aggregate it is. The vocabulary
     has count · sum · min · max · avg and will grow; only `linked` returns a
     RECORD that needs one more hop. Written this way, a new aggregate needs no
     change here. */
  return field.derived?.kind === 'linked'
    ? (value as Record<string, unknown>)[field.derived.show]
    : value
}

export function cellOf(row: Record<string, unknown>, field: ResolvedField, ctx: CellContext): Cell {
  /* ⚠️ A block cell does NOT go down the value path. What it draws is usually
     not a value at all but the result of a function over several fields — a
     deadline in working days, two approvals judged side by side. */
  if (field.widget) {
    return ctx.blocks.has(field.widget)
      ? { kind: 'block', field, widget: field.widget }
      : {
        kind: 'missing-block',
        field,
        widget: field.widget,
        message:
          `"${field.label}" names the block "${field.widget}", which this renderer does not `
          + `publish. Register it, or the column is blank with nothing to notice.`,
      }
  }

  const value = valueOf(row, field)

  if (value === ABSENT) {
    const via = field.derived && 'via' in field.derived ? field.derived.via : undefined
    return {
      kind: 'unwired',
      field,
      message:
        `the row carries no "${field.key}" key`
        + (via ? `, so the join through "${via}" never ran` : '')
        + '. The ontology name and the read layer\'s key must be the same word.',
    }
  }
  if (value == null || value === '') return { kind: 'blank', field }

  if (field.enum?.length) {
    const match = field.enum.find((e) => e.value === value)
    if (match && !ctx.plain) {
      return { kind: 'tone', field, value: String(value), label: match.label, tone: match.tone ?? 'plain' }
    }
    /* ⛔ An unlabelled enum value prints the MACHINE CODE at a user — `needs_repair`
       in front of an officer. The resolver reports this at start-up; here the
       value still has to be drawn, so it is drawn as what it is. */
    return {
      kind: 'text',
      field,
      text: match ? match.label : String(value),
      numeric: false,
      long: false,
    }
  }

  /* ⭐ A linked column knows which entity it points at (the resolver worked it
     out to check the property, and now says so) and the row carries the id. Both
     halves present means the cell can offer a way to open the record. */
  const linked = field.derived?.kind === 'linked' ? row[field.key] : null
  const id = linked && typeof linked === 'object' ? (linked as { id?: unknown }).id : undefined
  if (field.refEntity && typeof id === 'string') {
    return {
      kind: 'link',
      field,
      text: writeValue(ctx.format, field, value),
      to: { entity: field.refEntity, id },
    }
  }

  const text = writeValue(ctx.format, field, value)
  return {
    kind: 'text',
    field,
    text,
    numeric: Boolean(field.numeric) || field.kind === 'number',
    long: text.length > LONG_TEXT,
  }
}

/** Every cell that is a defect rather than a value. */
export const defectsOf = (cells: Cell[]): Cell[] =>
  cells.filter((c) => c.kind === 'unwired' || c.kind === 'missing-block')
