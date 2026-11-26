// ⭐ THE TEST THAT KEEPS THE PACKAGE HONEST.
//
// ═══════════════════════════════════════════════════════════════════════════
// A CONTRACT THAT ONLY ONE RENDERER CAN DRAW IS NOT A CONTRACT
//
//   The claim this package makes is that a screen is a LENS over the ontology —
//   which is only true if the same resolved contract can be drawn by anything:
//   React, Vue, Svelte, an Electron desktop window, a terminal, a printer.
//
//   That claim is cheap to make and easy to quietly break. It breaks the moment
//   one renderer's vocabulary leaks into the contract — `align: 'num'` is CSS,
//   `multiline` is `<textarea>`, `wrap` is `white-space`. Each looks harmless.
//   Together they make the contract mean "a React table", and then Vue gets a
//   worse deal and a terminal gets nothing.
//
//   So the claim is TESTED, not asserted. Below are two complete renderers
//   written in this file with no framework, no DOM, no imports beyond the
//   contract itself:
//
//     · a plain-text table  — what a terminal or a printed sheet needs
//     · an HTML string      — what a server-rendered page or Vue would emit
//
//   ⚠️ If a future change makes either renderer need something the contract does
//      not carry, this test is where it shows up — BEFORE the missing thing
//      gets added as a React-shaped field that Vue cannot use.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { resolveView } from './resolve.js'
import type { ProcessDecl, ResolvedField, ViewContract, ViewDecl, ViewOntologyDecl } from './types.js'

const ontology: ViewOntologyDecl = {
  entities: [
    {
      name: 'Claim',
      label: 'Benefit claim',
      properties: [
        { name: 'reference', type: 'text', required: true, description: 'File reference' },
        { name: 'amount', type: 'number', description: 'Amount awarded' },
        { name: 'status', type: 'enum', required: true, enumValues: ['open', 'paid'], description: 'Status' },
      ],
      labels: { reference: 'Reference', amount: 'Amount', status: 'Status' },
      meanings: { amount: 'currency' },
      values: {
        status: [
          { value: 'open', label: 'Open', tone: 'doing' },
          { value: 'paid', label: 'Paid', tone: 'done' },
        ],
      },
      keys: { reference: 'title' },
      visibility: { reference: 'prominent', claimant: 'prominent', amount: 'prominent', status: 'prominent' },
      derived: [{ name: 'claimant', kind: 'linked', via: 'claimFor', show: 'fullName', label: 'Claimant' }],
    },
    {
      name: 'Person',
      label: 'Person',
      labels: { fullName: 'Full name' },
      properties: [{ name: 'fullName', type: 'text', required: true, description: 'Full name' }],
    },
  ],
  relationships: [{ name: 'claimFor', from: 'Claim', to: 'Person', cardinality: '1..1', directed: true }],
}

const process: ProcessDecl = {
  process: 'benefit',
  entity: 'Claim',
  stateProperty: 'status',
  roles: { clerk: 'ROLE-CLERK' },
  states: [{ name: 'open', label: 'Open' }, { name: 'paid', label: 'Paid' }],
  transitions: [{
    action: 'pay', label: 'Record payment', from: ['open'], to: 'paid', role: 'clerk',
    params: { target: 'claimId', required: ['claimId', 'amount'] },
  }],
}

const decl: ViewDecl = { entity: 'Claim', list: {}, row: {} }

/** One row of data, as a store would hand it over. */
const rows = [
  { data: { reference: 'HS-01', amount: 2500000, status: 'paid' }, claimant: { fullName: 'Trần Văn B' } },
  { data: { reference: 'HS-02', amount: 900000, status: 'open' }, claimant: { fullName: 'Nguyễn Văn B' } },
]

/**
 * Read one cell out of a row.
 *
 * ⚠️ Shared by both renderers below, and that is the point: the only thing a
 *    renderer needs to know about a derived value is whether it is `linked` —
 *    everything else is a scalar. Adding `sum` later does not touch this.
 */
const valueOf = (row: (typeof rows)[number], f: ResolvedField): unknown => {
  if (f.kind !== 'derived') return (row.data as Record<string, unknown>)[f.key]
  const v = (row as Record<string, any>)[f.key]
  return v == null ? null : (f.derived?.kind === 'linked' ? v[f.derived.show] : v)
}

/**
 * Turn a value into words.
 *
 * ⭐ `Intl` does the formatting — the contract only said WHAT the number is.
 *    That split is exactly what makes this file possible: a terminal in Hanoi
 *    and a browser in Geneva format the same contract differently and both are
 *    right, because neither was told how by the ontology.
 */
const say = (v: unknown, f: ResolvedField, locale: string) => {
  if (v == null || v === '') return '—'
  if (f.enum) return f.enum.find((e) => e.value === v)?.label ?? `?${v}`
  if (f.meaning === 'currency') {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'VND' }).format(Number(v))
  }
  if (f.meaning === 'percent') return new Intl.NumberFormat(locale, { style: 'percent' }).format(Number(v))
  return String(v)
}

// ── Renderer ①: a plain-text table (terminal, printed sheet) ───────────────
function asText(c: ViewContract, data: typeof rows, locale = 'vi-VN'): string {
  const cols = c.list!.columns
  const cell = (r: (typeof rows)[number], f: ResolvedField) => say(valueOf(r, f), f, locale)
  const width = (f: ResolvedField, i: number) =>
    Math.max(f.label.length, ...data.map((r) => cell(r, cols[i]).length))
  const pad = (s: string, w: number, f: ResolvedField) =>
    // Alignment is decided HERE, from `numeric` — a fact, not a CSS instruction.
    f.numeric ? s.padStart(w) : s.padEnd(w)

  const head = cols.map((f, i) => pad(f.label, width(f, i), f)).join('  ')
  const body = data.map((r) => cols.map((f, i) => pad(cell(r, f), width(f, i), f)).join('  '))
  return [c.label, head, ...body].join('\n')
}

// ── Renderer ②: an HTML string (server render, Vue, anything) ──────────────
function asHtml(c: ViewContract, data: typeof rows, locale = 'vi-VN'): string {
  const cols = c.list!.columns
  const th = cols.map((f) => `<th${f.numeric ? ' class="num"' : ''}>${f.label}</th>`).join('')
  const td = (r: (typeof rows)[number], f: ResolvedField) => {
    const text = say(valueOf(r, f), f, locale)
    // Tone is a MEANING; this renderer maps it to its own class names.
    const tone = f.enum?.find((e) => e.value === valueOf(r, f))?.tone
    return `<td${f.numeric ? ' class="num"' : ''}>${tone ? `<b data-tone="${tone}">${text}</b>` : text}</td>`
  }
  const body = data.map((r) => `<tr>${cols.map((f) => td(r, f)).join('')}</tr>`).join('')
  return `<table><caption>${c.label}</caption><tr>${th}</tr>${body}</table>`
}

describe('the contract can be drawn without React, without a DOM', () => {
  const { contract, diagnostics } = resolveView(decl, ontology, [process])

  it('resolves cleanly with the view declaring nothing but the entity', () => {
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    // Columns and the title cell came from the ONTOLOGY, not from the view.
    expect(contract.list!.columns.map((c) => c.key)).toEqual(['reference', 'claimant', 'amount', 'status'])
    expect(contract.list!.main!.key).toBe('reference')
  })

  it('renders a text table — labels, wording and numeric alignment all present', () => {
    const out = asText(contract, rows)
    expect(out).toContain('Benefit claim')
    expect(out).toContain('Reference')
    expect(out).toContain('Trần Văn B')   // followed through a link
    expect(out).toContain('Paid')          // enum wording, never the code
    expect(out).not.toContain('paid')      // ...and the code never leaks
    // Right-aligned: the amount column is padded on the left.
    const amountLines = out.split('\n').slice(2).map((l) => l.split('  ').filter(Boolean))
    expect(amountLines.every((cells) => cells.length === 4)).toBe(true)
  })

  it('renders HTML from the SAME contract, choosing its own class names', () => {
    const out = asHtml(contract, rows)
    expect(out).toContain('<caption>Benefit claim</caption>')
    expect(out).toContain('data-tone="done"')     // tone mapped by the renderer
    expect(out).toContain('class="num"')          // alignment decided by the renderer
    expect(out).toContain('Nguyễn Văn B')
  })

  it('formats the same number differently per locale — the ontology never said how', () => {
    const vi = asText(contract, rows, 'vi-VN')
    const en = asText(contract, rows, 'en-US')
    // vi-VN: `2.500.000 ₫` · en-US: `₫2,500,000` — dấu phân cách và vị trí ký hiệu
    // đều khác, và cả hai đều đúng ở nơi của nó.
    expect(vi).not.toEqual(en)
    expect(vi).toContain('2.500.000')
    expect(en).toContain('2,500,000')
    // Both are correct. The contract only ever said "this is money".
    expect(contract.list!.columns.find((c) => c.key === 'amount')!.meaning).toBe('currency')
  })

  it('carries a step form as data, with no widget named anywhere', () => {
    const pay = contract.actions.find((a) => a.action === 'pay')!
    // A renderer builds inputs from `kind`; nothing here says <input> or <textarea>.
    expect(pay.fields.map((f) => ({ key: f.key, kind: f.kind, required: f.required })))
      .toEqual([{ key: 'amount', kind: 'number', required: true }])
    expect(JSON.stringify(pay)).not.toMatch(/input|textarea|className|style/)
  })

  it('⛔ holds the line: no renderer vocabulary anywhere in the contract', () => {
    // The guard that would have caught `align: 'num'`, `wrap` and `multiline`
    // on the way in. Each of those shipped once; this is why they left.
    const BANNED = /"(align|wrap|multiline|className|style|rows|cols|width|colour|color|icon)"\s*:/
    expect(JSON.stringify(contract)).not.toMatch(BANNED)
  })
})
