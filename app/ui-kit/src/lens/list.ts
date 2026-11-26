// The LIST lens: a contract and some rows in, everything a table needs out.
//
// ⭐ WHAT TO NOTICE: this file knows nothing about any entity. No "staff member
//    member", no "equipment", no table translating `rescue_boat`. All of it
//    arrives in the contract, which the resolver built from the ontology and the
//    process. Adding a second entity to this lens is **zero lines here**.
//
// ⚠️ The list lens already existed in the reference app and it worked: list
//    pages there are 60–130 lines against 230–1,284 for record pages, which have
//    no lens. What moves here is the DECISIONS — the three-way cell outcome, the
//    badge-versus-words rule, when a list is empty because of a filter. The
//    drawing stays in the app.

import { readValue, ABSENT } from './shape.js'
import type { ViewContract, ResolvedField } from '@dqa-ai-solutions/ontology-view'
import { surfaceState, type Fault, type SurfaceState, type EmptyCopy } from '../primitives/index.js'
import { cellOf, defectsOf, type Cell, type CellContext } from './cell.js'

export interface ListRow {
  id: string
  /** The identity cell — the contract said which property IS the name. */
  main: Cell | null
  /** A second line under it. Words, never a badge — see `CellContext.plain`. */
  sub: Cell | null
  cells: Cell[]
}

export interface ListBody {
  /** Columns to draw now. */
  columns: ResolvedField[]
  /**
   * Columns held back — draw them behind one "more columns" control.
   *
   * ⛔ THE NUMBER THAT PROMPTED THIS WAS A UNIT ERROR, MINE AS WELL AS THE
   *    REPORTER'S. "679 columns across 56 screens, one table with 31" divides
   *    `<th>` by SCREEN, and a screen holds several tables. Counted per
   *    `<table>`: 126 tables, mean 5.4 columns, two above eight.
   *
   *    Enterprise guidance does converge on six-to-eight-then-hide, and this
   *    implements it — but the application it was built for was already inside
   *    that range. This is a fence for contracts that grow, not a fix for a
   *    table that is too wide today.
   *
   * ⚠️ HELD BACK, NEVER DROPPED. A column the contract declares and the renderer
   *    silently loses is the failure this package exists to remove.
   */
  /**
   * Held back because the table ran out of room, in the contract's own order of
   * importance.
   *
   * ⭐ NOT A LEFTOVER — SOMETHING TO OFFER BACK. A column that vanishes
   *    silently leaves the reader unable to know what they are not shown; but
   *    merely SAYING so ("2 columns not shown") was the next mistake — the
   *    reader could read the names and do nothing. `choices` is what a column
   *    picker on the table draws; the wording is the app's, as wording always is.
   */
  extraColumns: ResolvedField[]
  /** See `ColumnPlan.choices`. */
  choices: ColumnChoice[]
  customised: boolean
  rows: ListRow[]
  /**
   * The column that names the row — it must carry `scope="row"`.
   *
   * ⭐ The lens already knew which column this is (`list.main`); it simply never
   *    said so, and every app had to remember. Measured on the first adopter:
   *    `scope` on 0 of 56 screens with tables, `aria-sort` on 0. GOV.UK and USWDS
   *    both require `scope` — without it a screen reader cannot work out which
   *    header belongs to which cell. For a government system it is also the kind
   *    of thing an assessor checks with an automated tool in seconds.
   */
  rowHeaderKey: string | null
  /** Per column: what a header should announce as `aria-sort`. */
  sortState: Record<string, 'ascending' | 'descending' | 'none'>
  /** Property names the contract says are searchable. */
  search: string[]
  sort: ViewContract['list'] extends { sort: infer S } ? S : never
}

export interface ListInput {
  contract: ViewContract
  rows: Record<string, unknown>[] | null
  loading: boolean
  error?: string | null
  forbidden?: string | false
  /** True while a search term or a filter is narrowing the result. */
  narrowed?: boolean
  empty: EmptyCopy
  /**
   * Total across all pages, when the server paginates. Falls back to `rows`.
   *
   * ⛔ `total: rows.length` IS NOT PAGINATION, AND IT HIDES THAT IT ISN'T.
   *
   *    Measured in the reference app: one screen drew **23,706 rows** into the
   *    DOM and its API call took **14,520ms**. Nothing threw, every render check
   *    passed, and no pager appeared — because a pager with no offset draws
   *    nothing, so the screen looked like a screen that simply had no pages.
   *    The promise concealed its own absence. Fifteen more screens were the same.
   *
   * ⚠️ AND PAGING THE SCREEN ONLY MOVES THE COST — IT DOES NOT REMOVE IT.
   *    The same screen's server was aggregating headcount across all 23,706
   *    units and then taking twenty rows. Cutting the page FIRST and aggregating
   *    for those twenty: 14,520ms → 78ms.
   *
   *    This package receives `total` from outside and cannot tell a real one
   *    from `rows.length`. That is the correct boundary — the read layer is not
   *    ours — so this is stated here, where the person passing the number is
   *    looking, and it is the only place it can be said.
   */
  total?: number
  /**
   * How many columns to draw before holding the rest back. Default 7.
   *
   * ⚠️ A default, not a law — a two-column reference table should not be padded
   *    to seven. But it is the SAME default everywhere until an app has a reason,
   *    which is the opposite of where this started.
   */
  maxColumns?: number
  /** The reader's column overrides — passed straight to `planColumns`. */
  visibility?: PlanColumnsOptions['visibility']
  hiddenByDefault?: PlanColumnsOptions['hiddenByDefault']
}

export interface ListModel {
  state: SurfaceState<ListBody>
  /** Everything provably wrong, whatever state the surface ended in. */
  faults: Fault[]
}

/**
 * One column as the READER can choose it — on or off, and whether it may be
 * turned off at all.
 *
 * ⭐ SHAPE BORROWED WHOLE FROM THE GRIDS PEOPLE ALREADY USE. MUI DataGrid keeps
 *    a `columnVisibilityModel` of `{ field: false }`; AG Grid, Airtable
 *    ("Hide fields") and GitHub Projects ("Fields") draw the same thing: a list
 *    of every column with a toggle each, the name column fixed.
 */
export interface ColumnChoice {
  key: string
  label: string
  shown: boolean
  /** The column that names the row. It cannot be turned off. */
  locked: boolean
  /** Hidden by the plan's own default — not by the reader. */
  hiddenByDefault: boolean
}

/**
 * The reader's overrides, and ONLY the overrides: `{ key: true | false }`.
 *
 * ⚠️ NOT THE LIST OF SHOWN KEYS. Storing "these six are shown" freezes the table
 *    on the day it was saved — a column the contract gains next month never
 *    appears for that reader, silently. Storing only what the reader changed
 *    lets every untouched column follow the contract.
 */
export type ColumnVisibility = Record<string, boolean>

/** What `planColumns` decides — no rows, no formatter, no blocks. */
export interface ColumnPlan {
  columns: ResolvedField[]
  extraColumns: ResolvedField[]
  /**
   * Every column in draw order, each with whether it is shown now — what a
   * column picker lists.
   *
   * ⛔ HELD-BACK COLUMNS ARE NOT SOMETHING TO ANNOUNCE, THEY ARE SOMETHING TO
   *    OFFER. The first adopter printed "2 columns not shown in this table" in
   *    a disclosure above the header: the reader could learn which ones and do
   *    nothing about it. Its user called that plainly bad UX, and every mature
   *    grid agrees — the choice sits ON the table.
   */
  choices: ColumnChoice[]
  /** True when a stored override actually changes what is shown. */
  customised: boolean
  rowHeaderKey: string | null
  sortState: Record<string, 'ascending' | 'descending' | 'none'>
}

export interface PlanColumnsOptions {
  /** How many columns an untouched table draws. Default 7. */
  maxColumns?: number
  /** The reader's overrides — see `ColumnVisibility`. */
  visibility?: ColumnVisibility
  /**
   * Columns the APP hides until asked — e.g. empty on every row in view.
   *
   * ⚠️ HIDDEN BY DEFAULT, STILL OFFERED. Removing them from the contract before
   *    planning — what the first adopter did — also removes them from the
   *    picker, and a reader who needs one has no way back to it.
   */
  hiddenByDefault?: readonly string[]
}

/**
 * Which columns a table shows, and what its headers must announce.
 *
 * ⭐ SPLIT OUT ON REQUEST FROM THE FIRST ADOPTER, AND THE BOUNDARY IS RIGHT.
 *    A renderer that already draws its own cells and already sits inside its own
 *    state wrapper needs the DECISION and nothing else; making it call
 *    `listModel` meant handing over a formatter and a block registry in order to
 *    receive rows it would throw away.
 *
 *    Decision separated from data assembly — the same seam as `tokens` apart
 *    from `lens`.
 */
export function planColumns(
  contract: ViewContract,
  options: PlanColumnsOptions = {},
): ColumnPlan {
  const list = contract.list
  const columns = list?.columns ?? []

  /* Order: what names the record first, then the ordinary columns, then the
     tail. Within a band the declared order is untouched — the contract already
     decided that and the lens has no better information. */
  const RANK = { primary: 0, normal: 1, extra: 2 } as const
  const ranked = [...columns].sort(
    (a, b) => RANK[a.priority ?? 'normal'] - RANK[b.priority ?? 'normal'])
  const limit = Math.max(1, options.maxColumns ?? 7)
  const rowHeaderKey = list?.main?.key ?? null

  /* ⭐ THE DEFAULT IS THE SAME CUT AS BEFORE — `maxColumns` over the ranked
     order — taken AFTER the app's default-hidden columns are set aside, so an
     empty column does not use up a place. */
  const quiet = new Set(options.hiddenByDefault ?? [])
  const byDefault = new Set(
    ranked.filter((f) => f.key === rowHeaderKey || !quiet.has(f.key))
      .slice(0, limit).map((f) => f.key))
  if (rowHeaderKey) byDefault.add(rowHeaderKey)
  const visibility = options.visibility ?? {}

  const choices: ColumnChoice[] = ranked.map((f) => {
    const locked = f.key === rowHeaderKey
    const own = visibility[f.key]
    return {
      key: f.key,
      label: f.label,
      /* ⛔ THE NAME COLUMN IS SHOWN WHATEVER WAS STORED. A table without it is
         rows of values belonging to nobody, and a stored `false` for it can
         only come from an older picker or a hand-edited store. */
      shown: locked || (typeof own === 'boolean' ? own : byDefault.has(f.key)),
      locked,
      hiddenByDefault: !byDefault.has(f.key),
    }
  })
  /* ⚠️ An override that repeats the default, or names a column the contract no
     longer declares, is not a customisation — offering "reset" for it resets
     nothing the reader can see. */
  const customised = choices.some((c) => !c.locked && c.shown === c.hiddenByDefault)
  const shownKeys = new Set(choices.filter((c) => c.shown).map((c) => c.key))

  const sorted = list?.sort ?? []
  const sortState: ColumnPlan['sortState'] = {}
  for (const f of ranked) {
    const hit = sorted.find((x) => x.by === f.key)
    /* ⚠️ A column the store cannot order by announces nothing — a sort control
       on it offers something the system cannot do. */
    sortState[f.key] = f.sortable === false ? 'none'
      : hit ? (hit.dir === 'desc' ? 'descending' : 'ascending')
        : 'none'
  }

  /* ⚠️ A READER'S CHOICE IS NOT CAPPED BY `maxColumns`. The cap is a default
     for a table nobody has touched; someone who ticks a ninth column asked for
     it, and the table's own scroll frame carries the width. */
  return {
    columns: ranked.filter((f) => shownKeys.has(f.key)),
    extraColumns: ranked.filter((f) => !shownKeys.has(f.key)),
    choices,
    customised,
    rowHeaderKey,
    sortState,
  }
}

/**
 * What NAMES this record to a person.
 *
 * ⭐ WRITTEN BY THE FIRST ADOPTER BEFORE IT EXISTED HERE, WHICH IS THE ARGUMENT
 *    FOR IT BEING HERE.
 *
 *    Their work queue stored a STEP LABEL in its title column, so a screen
 *    officers open first every morning showed thirteen bare verbs — "Add
 *    target", "Edit target" — and not one line said which record it was about.
 *    The fix needs the record's own name, and the contract already says which
 *    property that is (`list.main.key`). They had to reach for it by hand.
 *
 * ⚠️ ASKS THE CONTRACT, NEVER GUESSES BY FIELD NAME. A hand-written
 *    `['fullName', 'unitName', 'title']` is right on the day it is written and
 *    wrong on the day an entity is added — and wrong silently, because a
 *    missing name looks like a record with no name.
 *
 * ⚠️ And it reads the record through the same two-shape lookup as every cell,
 *    so an envelope beside top-level store columns behaves identically here and
 *    in a table. Two readers of one record shape is how they drift.
 */
export function subjectOf(
  contract: ViewContract,
  row: Record<string, unknown>,
  options: {
    /**
     * Which surface is asking.
     *
     * ⚠️ The contract resolves TWO names — `list.main` and `row.main` — and
     *    both fall back to the property the ontology marks `title`, so they
     *    agree unless an app deliberately declared different ones. When it did,
     *    the caller has to say which surface it is drawing; guessing picks the
     *    wrong one exactly on the app that took the trouble to distinguish them.
     */
    as?: 'record' | 'queue'
  } = {},
): { key: string; text: string } | null {
  const order = options.as === 'queue'
    ? [contract.row?.main?.key, contract.list?.main?.key]
    : [contract.list?.main?.key, contract.row?.main?.key]
  for (const key of order) {
    if (!key) continue
    const raw = readValue(row, key)
    if (raw === ABSENT || raw == null || raw === '') continue
    return { key, text: String(raw) }
  }
  return null
}

const idOf = (row: Record<string, unknown>, i: number) =>
  typeof row.id === 'string' ? row.id : String(row.id ?? i)

/**
 * Derived properties the contract promises that this row does not carry.
 *
 * ⛔ THE SAME RULE AS `missingDerived` IN `@dqa-ai-solutions/ontology-view`, DELIBERATELY NOT
 *    IMPORTED FROM IT — and the duplication is the smaller of two evils.
 *
 *   Importing it made `@dqa-ai-solutions/ontology-view` a RUNTIME dependency of the lens
 *   layer, and that package is server code: it reaches for `js-yaml`, `fs-extra`
 *   and `node:path` to load declarations off disk. One value import dragged all
 *   of it into the browser bundle, and a browser bundler refused with two dozen
 *   unresolved builtins.
 *
 *   ⚠️ It was invisible in the kernel's own gate because peer dependencies were
 *      treated as external — which hides exactly this: a runtime edge into a
 *      package that cannot run here. The gate no longer externalises anything
 *      for a browser-safe package, so the whole reachable graph has to be clean.
 *
 * ⭐ Twenty lines duplicated against a package that must stay renderer-agnostic.
 *    The rule itself is the load-bearing part and it is stated once more, here:
 *    `in`, not truthiness — a present-but-null key is a record with no link; an
 *    ABSENT key is a join that never ran.
 */
function missingDerived(contract: ViewContract, row: Record<string, unknown>) {
  const declared = [
    ...(contract.list?.columns ?? []),
    ...(contract.list?.main ? [contract.list.main] : []),
    ...(contract.list?.sub ? [contract.list.sub] : []),
    ...(contract.detail?.facts ?? []),
    ...(contract.row ? [contract.row.main, contract.row.sub, contract.row.badge] : []),
  ].filter((f): f is ResolvedField => f != null && f.kind === 'derived' && f.derived != null)

  const seen = new Set<string>()
  const out: { key: string; label: string; via?: string }[] = []
  for (const f of declared) {
    if (seen.has(f.key)) continue
    seen.add(f.key)
    if (f.key in row) continue
    const via = f.derived && 'via' in f.derived ? f.derived.via : undefined
    out.push({ key: f.key, label: f.label, ...(via ? { via } : {}) })
  }
  return out
}

export function listModel(input: ListInput, ctx: CellContext): ListModel {
  const { contract, rows, empty } = input
  const list = contract.list
  const columns = list?.columns ?? []

  const faults: Fault[] = []
  /* One decision, one place — the renderer can call this on its own. */
  const plan = planColumns(contract, {
    maxColumns: input.maxColumns,
    visibility: input.visibility,
    hiddenByDefault: input.hiddenByDefault,
  })
  const shown = plan.columns

  const body: ListBody | null = rows == null ? null : {
    ...plan,
    search: list?.search ?? [],
    sort: (list?.sort ?? []) as ListBody['sort'],
    rows: rows.map((row, i) => {
      /* ⛔ Asked ONCE PER ROW, not once per table. A read layer that produced the
         key for the first page and not the second is a real shape of failure —
         a join that only fires when a filter is applied. */
      for (const m of missingDerived(contract, row)) {
        const already = faults.some((f) => f.message.includes(`"${m.key}"`))
        if (!already) {
          faults.push({
            kind: 'missing-key',
            message:
              `"${contract.entity}" promises the derived property "${m.key}"`
              + (m.via ? ` through "${m.via}"` : '')
              + ', but the rows do not carry it. The column is blank for a reason no user can see.',
          })
        }
      }
      const cells = shown.map((f) => cellOf(row, f, ctx))
      return {
        id: idOf(row, i),
        main: list?.main ? cellOf(row, list.main, ctx) : null,
        /* ⭐ `plain` — a status under a name is an aside, not a second badge. */
        sub: list?.sub ? cellOf(row, list.sub, { ...ctx, plain: true }) : null,
        cells,
      }
    }),
  }

  /* A block the renderer does not publish is a defect of the same weight as a
     missing key: the column draws nothing and nobody is told. */
  for (const row of body?.rows ?? []) {
    for (const c of defectsOf(c_all(row))) {
      if (c.kind !== 'missing-block') continue
      if (faults.some((f) => f.message.includes(`"${c.widget}"`))) continue
      faults.push({ kind: 'missing-key', message: c.message })
    }
  }

  const count = input.total ?? rows?.length
  return {
    state: surfaceState<ListBody>({
      forbidden: input.forbidden,
      error: input.error,
      loading: input.loading,
      data: body,
      count,
      narrowed: input.narrowed,
      faults,
      empty,
      surface: 'table',
    }),
    faults,
  }
}

const c_all = (row: ListRow): Cell[] =>
  [...row.cells, ...(row.main ? [row.main] : []), ...(row.sub ? [row.sub] : [])]
