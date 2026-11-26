// The QUEUE lens — one record as it appears in somebody's work list.
//
// ⛔ 42 of 50 view declarations in the reference app carry `row: { main, sub,
//    badge }`. A search of the entire codebase for anything reading it returns
//    NOTHING. Three properties per entity, declared, reviewed, committed, and
//    never once drawn.
//
// ⭐ A queue row is not a small record page. It answers three questions and
//    stops: what is this, what kind, where has it got to. Anything more and the
//    person triaging forty items has to read instead of scan — which is why the
//    contract gives exactly three slots and this lens will not take a fourth.

import type { ViewContract } from '@dqa-ai-solutions/ontology-view'
import { surfaceState, type SurfaceState, type EmptyCopy, type Fault } from '../primitives/index.js'
import { cellOf, type Cell, type CellContext } from './cell.js'
import type { LensDiagnostic } from './diagnostic.js'

export interface QueueItem {
  id: string
  entity: string
  main: Cell
  sub: Cell | null
  badge: Cell | null
}

export interface QueueInput {
  /** A queue mixes entities, so contracts arrive keyed by entity name. */
  contracts: Record<string, ViewContract>
  items: { entity: string; record: Record<string, unknown> }[] | null
  loading: boolean
  error?: string | null
  forbidden?: string | false
  narrowed?: boolean
  empty: EmptyCopy
}

export interface QueueModel {
  state: SurfaceState<QueueItem[]>
  diagnostics: LensDiagnostic[]
  faults: Fault[]
}

export function queueModel(input: QueueInput, ctx: CellContext): QueueModel {
  const diagnostics: LensDiagnostic[] = []
  const faults: Fault[] = []
  const seen = new Set<string>()

  const rows = input.items?.flatMap(({ entity, record }, i): QueueItem[] => {
    const contract = input.contracts[entity]
    if (!contract) {
      if (!seen.has(entity)) {
        seen.add(entity)
        diagnostics.push({
          severity: 'error',
          code: 'NO_TITLE',
          where: entity,
          message:
            `the queue holds "${entity}" records and no view contract was supplied for it. `
            + `They cannot be named, so they are dropped rather than listed as blanks.`,
        })
      }
      return []
    }

    /* ⚠️ Falls back to the list's identity cell. `row` and `list.main` answer the
       same question — what is this record CALLED — and an entity that answered it
       once should not have to answer it twice to appear in a queue. */
    const main = contract.row?.main ?? contract.list?.main
    if (!main) {
      if (!seen.has(entity)) {
        seen.add(entity)
        diagnostics.push({
          severity: 'error',
          code: 'NO_TITLE',
          where: entity,
          message:
            `nothing says what a "${entity}" is called, so a queue row for it would be an id. `
            + `Mark a property \`keys: title\`, or declare \`row.main\`.`,
        })
      }
      return []
    }

    const sub = contract.row?.sub ?? null
    const badge = contract.row?.badge ?? null
    const cells: QueueItem = {
      id: typeof record.id === 'string' ? record.id : String(record.id ?? i),
      entity,
      main: cellOf(record, main, { ...ctx, plain: true }),
      sub: sub ? cellOf(record, sub, { ...ctx, plain: true }) : null,
      /* ⭐ The badge is the ONE place a queue row keeps its colour. */
      badge: badge ? cellOf(record, badge, ctx) : null,
    }

    for (const c of [cells.main, cells.sub, cells.badge]) {
      if (c?.kind === 'unwired') faults.push({ kind: 'missing-key', message: c.message })
    }
    return [cells]
  }) ?? null

  return {
    state: surfaceState<QueueItem[]>({
      forbidden: input.forbidden,
      error: input.error,
      loading: input.loading,
      data: rows,
      count: rows?.length,
      narrowed: input.narrowed,
      faults,
      empty: input.empty,
      surface: 'list',
    }),
    diagnostics,
    faults,
  }
}
