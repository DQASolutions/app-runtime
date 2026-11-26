// The RECORD lens — the piece that was missing, and the reason for the package.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ THE MEASUREMENT
//
//   In the reference app, 48 of 50 view declarations carry `detail.facts`, and
//   NO RENDERER READS IT. Fifty record pages therefore answer "what does this
//   record show" by hand, fifty different ways: 340 lines for an order, 569 for
//   a plan, 862 for a member, 1,284 for a case. The list lens, which exists,
//   holds its pages to 60–130.
//
//   The contract already answered the question. Nobody was listening.
//
// ⭐ TWO BORROWED SHAPES, AND THE SECOND ONE IS THE IMPORTANT ONE
//
//   ① Foundry's Object View is three tiers — TAB → SECTION → BLOCK. Layout is
//      declared, not coded, and the tiers are what stop a record page from being
//      one flat wall of fields.
//
//   ② Salesforce shipped Dynamic Forms and DID NOT DELETE PAGE LAYOUTS. The old
//      flat layout still drives everything the new one does not reach. That
//      restraint is the whole migration strategy here:
//
//      ⚠️ `layout` IS OPTIONAL. With none, every fact lands in one section and
//         fifty entities get a usable record page for ZERO extra declaration.
//         Sections are then added to the entities that earn them. Replacing the
//         flat default instead of layering over it is how fifty pages break at
//         once.
//
// ⛔ AND WHAT IS REFUSED: `when` compares the record's STATE, and nothing else.
//    A block that appears once a case is closed depends on data already written.
//    A field that appears when another field is being typed depends on data that
//    does not exist yet, and needs a rule engine — which is precisely the road
//    Camunda walked down and reversed out of. The line is drawn here on purpose.
// ═══════════════════════════════════════════════════════════════════════════

import type { ViewContract, ResolvedField } from '@dqa-ai-solutions/ontology-view'
import { surfaceState, type SurfaceState, type EmptyCopy, type Fault, type ActionView } from '../primitives/index.js'
import { cellOf, type Cell, type CellContext } from './cell.js'
import { availableActions, actionFacts, actionButtons, type ActionHints } from './action.js'
import { readValue } from './shape.js'
import type { LensDiagnostic } from './diagnostic.js'

export interface RecordSection {
  name: string
  label?: string
  /** Which tab this belongs on. Omitted, it sits on the first tab. */
  tab?: string
  /** Property names, from those the contract carries. */
  facts?: string[]
  /** A named component instead of facts. The two are exclusive. */
  block?: string
  /** Visible only while the record is in one of these states. */
  when?: string[]
}

export interface RecordLayout {
  /** Optional — see the header. Without it, one section holding every fact. */
  sections?: RecordSection[]
  tabs?: { name: string; label: string }[]
}

export type RecordPart =
  | { kind: 'facts'; name: string; label?: string; facts: { field: ResolvedField; cell: Cell }[] }
  /**
   * The records hanging off this one — most of a record page.
   *
   * ⚠️ Rows arrive from the app under `related[name]`; this package never
   *    queries. Absent rows are reported, never drawn as an empty table: a
   *    section that silently shows nothing looks identical to one that has
   *    nothing to show.
   */
  | {
    kind: 'related'
    name: string
    label: string
    entity: string
    columns: ResolvedField[]
    rows: { id: string; cells: Cell[] }[]
    rowHeaderKey: string | null
  }
  | { kind: 'block'; name: string; label?: string; widget: string }
  | { kind: 'missing-block'; name: string; widget: string; message: string }

export interface RecordTab {
  name: string
  label: string
  parts: RecordPart[]
}

export interface RecordBody {
  /** What this record is CALLED to a person. */
  title: string | null
  /** The state badge, with the weight the ontology gave it. */
  badge: Cell | null
  /** One clause saying what the current state MEANS operationally. */
  hint?: string
  /**
   * The state the record is IN, as the ontology spells it.
   *
   * ⭐ Load-bearing inside this model already — it filters sections, related
   *    rows and available actions — and it was invisible on the way out, so a
   *    renderer wanting to draw it had to re-derive it from the record. That is
   *    the same shape as an app hand-writing `subjectOf`: the contract knows,
   *    and the package did not hand it over.
   *
   * ⚠️ The raw name, not wording. `badge` carries what a person reads.
   */
  state: string | null
  tabs: RecordTab[]
  actions: ActionView[]
}

export interface RecordInput {
  contract: ViewContract
  record: Record<string, unknown> | null
  loading: boolean
  error?: string | null
  forbidden?: string | false
  layout?: RecordLayout
  hints?: ActionHints
  /** Rows for each declared related list, keyed by its `name`. */
  related?: Record<string, Record<string, unknown>[]>
  /** Shown when the id resolves to nothing. */
  empty: EmptyCopy
}

export interface RecordModel {
  state: SurfaceState<RecordBody>
  diagnostics: LensDiagnostic[]
  faults: Fault[]
}

const DEFAULT_TAB = { name: 'main', label: '' }

const stateOf = (contract: ViewContract, record: Record<string, unknown>): string | null => {
  if (!contract.stateProperty) return null
  /* ⛔ Used to be `record.data ?? record`, which lost the state entirely on a
     record carrying an envelope AND top-level columns — no badge, no error. */
  const v = readValue(record, contract.stateProperty)
  return typeof v === 'string' ? v : null
}

export function recordModel(input: RecordInput, ctx: CellContext): RecordModel {
  const { contract, record, layout, empty } = input
  const diagnostics: LensDiagnostic[] = []
  const faults: Fault[] = []
  const facts = contract.detail?.facts ?? []
  const byKey = new Map(facts.map((f) => [f.key, f]))

  let body: RecordBody | null = null

  if (record != null) {
    const current = stateOf(contract, record)

    // ── Identity ───────────────────────────────────────────────────────────
    const titleField = contract.row?.main ?? contract.list?.main ?? null
    const titleCell = titleField ? cellOf(record, titleField, ctx) : null
    const title = titleCell?.kind === 'text' ? titleCell.text : null
    if (!titleField) {
      diagnostics.push({
        severity: 'error',
        code: 'NO_TITLE',
        where: contract.entity,
        message:
          `no property is marked \`keys: title\`, so this record has no name to show at the top `
          + `of its own page. Every other screen that lists it has the same problem.`,
      })
    }

    const badgeField = contract.row?.badge
      ?? (contract.stateProperty ? byKey.get(contract.stateProperty) : undefined)
      ?? null
    const badge = badgeField ? cellOf(record, badgeField, ctx) : null
    const hint = contract.states?.find((s) => s.name === current)?.hint

    // ── Sections: declared, or the one implied by the flat list ────────────
    const declared = layout?.sections ?? []
    const visible = declared.filter((s) => !s.when || (current != null && s.when.includes(current)))
    const claimed = new Set(visible.flatMap((s) => s.facts ?? []))

    for (const s of declared) {
      for (const key of s.facts ?? []) {
        if (!byKey.has(key)) {
          diagnostics.push({
            severity: 'error',
            code: 'UNKNOWN_FACT',
            where: `sections.${s.name}`,
            message:
              `"${key}" is not among the facts this contract carries. Either the ontology never `
              + `declared it, or \`detail.facts\` does not list it — the section would simply be `
              + `short one row, with nothing to notice.`,
          })
        }
      }
      if (s.facts?.length && s.block) {
        diagnostics.push({
          severity: 'error',
          code: 'UNKNOWN_BLOCK',
          where: `sections.${s.name}`,
          message: 'a section draws facts or a block, never both — pick one.',
        })
      }
    }

    /* ⛔ ANY FACT NO SECTION CLAIMED STILL GETS DRAWN.
       Dropping it would be the exact failure this package exists to remove: a
       declaration says the record shows a thing, the screen does not, and no
       error is raised. It lands in a trailing section and the warning names it,
       so the layout can be finished rather than silently trusted. */
    const orphans = facts.filter((f) => !claimed.has(f.key))
    if (declared.length && orphans.length) {
      diagnostics.push({
        severity: 'warn',
        code: 'ORPHAN_FACTS',
        where: contract.entity,
        message:
          `${orphans.length} declared fact(s) belong to no section and were appended at the end: `
          + `${orphans.map((f) => f.key).join(', ')}. Place them, or drop them from \`detail.facts\`.`,
      })
    }

    const sections: RecordSection[] = declared.length
      ? [...visible, ...(orphans.length ? [{ name: '_rest', facts: orphans.map((f) => f.key) }] : [])]
      : [{ name: 'main', facts: facts.map((f) => f.key) }]

    // ── Render ─────────────────────────────────────────────────────────────
    const partOf = (s: RecordSection): RecordPart => {
      if (s.block) {
        return ctx.blocks.has(s.block)
          ? { kind: 'block', name: s.name, ...(s.label ? { label: s.label } : {}), widget: s.block }
          : {
            kind: 'missing-block',
            name: s.name,
            widget: s.block,
            message:
              `section "${s.name}" names the block "${s.block}", which this renderer does not `
              + `publish. The section would be an empty heading.`,
          }
      }
      return {
        kind: 'facts',
        name: s.name,
        ...(s.label ? { label: s.label } : {}),
        facts: (s.facts ?? [])
          .map((k) => byKey.get(k))
          .filter((f): f is ResolvedField => f != null)
          .map((field) => ({ field, cell: cellOf(record, field, ctx) })),
      }
    }

    /* ⭐ Related lists come after the facts unless a layout places them, because
       a record's own values are what a reader came for and the collections are
       what they turn to next. */
    const relatedDecl = (contract.detail?.related ?? [])
      .filter((r) => !r.when || (current != null && r.when.includes(current)))
    const relatedParts: RecordPart[] = relatedDecl.map((r) => {
      const supplied = input.related?.[r.name]
      if (supplied == null) {
        diagnostics.push({
          severity: 'error',
          code: 'MISSING_ROWS',
          where: `detail.related.${r.name}`,
          message:
            `"${r.name}" is declared but the app supplied no rows for it. A section drawn empty `
            + `is indistinguishable from one that genuinely has nothing — so it is reported here `
            + `instead, and the process should refuse to start.`,
        })
      }
      const main = r.columns.find((f) => f.priority === 'primary') ?? r.columns[0] ?? null
      return {
        kind: 'related' as const,
        name: r.name,
        label: r.label,
        entity: r.entity,
        columns: r.columns,
        rowHeaderKey: main?.key ?? null,
        rows: (supplied ?? []).map((rec, i) => ({
          id: typeof rec.id === 'string' ? rec.id : String(rec.id ?? i),
          cells: r.columns.map((f) => cellOf(rec, f, ctx)),
        })),
      }
    })

    const tabDefs = layout?.tabs?.length ? layout.tabs : [DEFAULT_TAB]
    const tabs: RecordTab[] = tabDefs.map((t) => ({
      name: t.name,
      label: t.label,
      parts: [
        ...sections.filter((s) => (s.tab ?? tabDefs[0].name) === t.name).map(partOf),
        /* Undeclared layout means one tab, so the related lists land on it. */
        ...(t.name === tabDefs[0].name ? relatedParts : []),
      ],
    })).filter((t, i) => i === 0 || t.parts.length > 0)

    for (const t of tabs) {
      for (const p of t.parts) {
        if (p.kind === 'missing-block') {
          diagnostics.push({ severity: 'error', code: 'UNKNOWN_BLOCK', where: `sections.${p.name}`, message: p.message })
        }
        if (p.kind === 'facts') {
          for (const { cell } of p.facts) {
            if (cell.kind === 'unwired') faults.push({ kind: 'missing-key', message: cell.message })
          }
        }
      }
    }

    // ── What can be done from here ─────────────────────────────────────────
    const steps = availableActions(contract, current)
    const { facts: stepFacts, diagnostics: stepDiag } = actionFacts(steps, input.hints)
    diagnostics.push(...stepDiag)

    body = {
      title,
      badge,
      ...(hint ? { hint } : {}),
      state: current,
      tabs,
      actions: actionButtons(stepFacts),
    }
  }

  return {
    state: surfaceState<RecordBody>({
      forbidden: input.forbidden,
      error: input.error,
      loading: input.loading,
      data: body,
      /* ⚠️ `count` is 0 only when the id resolved to nothing. A record that
         exists but has no facts is still a record, not an empty screen. */
      count: record == null ? 0 : 1,
      faults,
      empty,
      surface: 'record',
    }),
    diagnostics,
    faults,
  }
}
