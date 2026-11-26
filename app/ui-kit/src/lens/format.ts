// How a value READS. The contract says what it is; `Intl` says how it is written.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ TWO FAILURES THIS FILE EXISTS TO END
//
//   ① A duty officer's alert list printed `2026-08-04T16:46:51.134Z` in the
//      "received at" column. Not a formatting preference — the renderer simply
//      never called `Intl` for dates. The vocabulary had correctly handed date
//      formatting back to the platform, and nobody picked it up on the other
//      side. **Removing something from a declaration does not delete it; it
//      MOVES it, and the new home has to exist.**
//
//   ② `new Intl.NumberFormat('vi-VN', { currency: 'VND' })` was a module-level
//      constant in the shared library. One app's locale, welded into the layer
//      every app shares. A second app in another country gets Vietnamese
//      thousands separators and dong.
//
// ⭐ So locale and currency are DECLARED, once, by the app — and there is no
//    default. A default locale is the first failure wearing a helpful face.
// ═══════════════════════════════════════════════════════════════════════════

import type { ResolvedField } from '@dqa-ai-solutions/ontology-view'

export interface FormatDecl {
  /** BCP-47. No default: a wrong locale is worse than a missing one. */
  locale: string
  /** ISO-4217, for fields the ontology marks `meaning: currency`. */
  currency: string
  timeZone?: string
}

export interface Formatter {
  number(value: number): string
  currency(value: number): string
  percent(value: number): string
  date(value: string | number | Date): string
  datetime(value: string | number | Date): string
  decl: FormatDecl
}

/**
 * ⚠️ Built once and reused. `Intl` constructors are expensive enough that
 *    building one per cell is measurable on a table of a few hundred rows, and
 *    a list lens draws exactly that.
 */
export function formatter(decl: FormatDecl): Formatter {
  const { locale, currency, timeZone } = decl
  const num = new Intl.NumberFormat(locale)
  const cur = new Intl.NumberFormat(locale, { style: 'currency', currency })
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 })
  const day = new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric', ...(timeZone ? { timeZone } : {}),
  })
  const stamp = new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  })
  const parse = (v: string | number | Date) => (v instanceof Date ? v : new Date(v))
  return {
    decl,
    number: (v) => num.format(v),
    currency: (v) => cur.format(v),
    percent: (v) => pct.format(v / 100),
    /* ⚠️ An unparseable date comes back as the raw string, NOT as "Invalid Date".
       The raw value is at least evidence of what is stored; the browser's phrase
       is a dead end for whoever has to fix it. */
    date: (v) => (Number.isNaN(+parse(v)) ? String(v) : day.format(parse(v))),
    datetime: (v) => (Number.isNaN(+parse(v)) ? String(v) : stamp.format(parse(v))),
  }
}

/** Anything longer than this is a paragraph wearing a cell. */
export const LONG_TEXT = 120

/**
 * One value, written out.
 *
 * ⚠️ `meaning` outranks `kind`, because meaning is the rarer and stronger claim:
 *    a currency is stored as a number, and the ontology went to the trouble of
 *    saying it is money.
 */
export function writeValue(f: Formatter, field: ResolvedField, value: unknown): string {
  if (value == null) return ''
  if (field.meaning === 'currency' && typeof value === 'number') return f.currency(value)
  if (field.meaning === 'percent' && typeof value === 'number') return f.percent(value)

  switch (field.kind) {
    case 'date': return f.date(value as string)
    case 'datetime': return f.datetime(value as string)
    case 'number': return typeof value === 'number' ? f.number(value) : String(value)
    case 'text[]': return Array.isArray(value) ? value.join(', ') : String(value)
    /* ⛔ A derived column is `kind: 'derived'` and its numeric-ness is a separate
       fact the contract states, because the renderer cannot work it out. */
    default:
      if (field.numeric && typeof value === 'number') return f.number(value)
      return String(value)
  }
}
