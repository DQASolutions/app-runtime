// The five states every data surface must answer — as a union it cannot leave out.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ WHY THIS IS A TYPE AND NOT A CHECKLIST
//
//   Nobody forgets an empty state on purpose. They forget it because at the
//   moment of writing the screen there IS data in front of them, the list has
//   rows, and the branch that has no rows is invisible. A review does not catch
//   it either, for the same reason: the reviewer is also looking at rows.
//
//   Measured on the reference app: a checklist, a component library and roughly
//   two dozen build-time checks were all in place, and the failure mode was
//   still "the component exists but nobody calls it" — `<BusyButton>` shipped on
//   day one and had 6 call sites against 62 hand-rolled copies on day two.
//
//   So the answer cannot be another rule about code. It has to be that the code
//   DOES NOT COMPILE until every state is answered. `matchState` takes an object
//   with one handler per kind, and a missing key is a type error.
//
// ⚠️ AND `empty` IS A REQUIRED INPUT. You cannot compute a surface state without
//    having written what the screen says when there is nothing on it. That is
//    the single highest-yield line in this file.
// ═══════════════════════════════════════════════════════════════════════════

/** What a surface is made of. Decides whether a skeleton is even appropriate. */
export type SurfaceKind = 'table' | 'list' | 'card' | 'record' | 'field' | 'action'

/**
 * ⚠️ Skeletons belong to surfaces that hold DATA, and to nothing else.
 *
 *    Borrowed whole from Carbon, which states it plainly: action components —
 *    buttons, inputs, checkboxes, toggles — do not need a skeleton state. A
 *    pulsing grey rectangle where a button will be is not a loading hint, it is
 *    a control the user cannot yet see the purpose of.
 */
export type SkeletonKind = 'rows' | 'block' | null

export const skeletonFor = (surface: SurfaceKind): SkeletonKind =>
  surface === 'table' || surface === 'list' ? 'rows'
    : surface === 'card' || surface === 'record' ? 'block'
      : null

/** Why there is nothing to show. The two are different screens, not one. */
export type EmptyReason = 'no-records' | 'no-match'

/** One thing the user can do from here. */
export interface NextStep {
  label: string
  /** An action name, a route — whatever the renderer knows how to follow. */
  go: string
}

/**
 * What the screen says when it is empty.
 *
 * ⛔ `noMatch.action` IS REQUIRED, and that is the whole point of splitting the
 *    two reasons apart. A list emptied by a filter looks identical to a system
 *    with no data in it, and the user cannot tell which they are looking at —
 *    they conclude the records are gone. The way out of a filter has to be on
 *    the screen that the filter emptied, so the type will not let you ship one
 *    without it.
 *
 * ⚠️ `noRecords.action` is optional on purpose: plenty of lists are empty
 *    because the person looking has nothing to do yet, and inventing a button
 *    for them is worse than silence.
 */
export interface EmptyCopy {
  noRecords: { title: string; body?: string; action?: NextStep }
  noMatch: { title: string; body?: string; action: NextStep }
}

/**
 * Something provably wrong with the data that arrived — not with the request.
 *
 * ⭐ `missing-key` is the one the reference app bled on: a contract promises a
 *    derived property, the read layer never produced the key, and the cell drew
 *    an em dash. Identical on screen to "this record has no link", so a broken
 *    join and an empty field looked the same for weeks.
 */
export interface Fault {
  kind: 'missing-key' | 'stale' | 'clipped'
  message: string
}

export type SurfaceState<T> =
  | { kind: 'loading'; skeleton: SkeletonKind; label: string }
  | { kind: 'forbidden'; message: string }
  | { kind: 'error'; message: string; retry: boolean }
  | { kind: 'empty'; because: EmptyReason; title: string; body?: string; action?: NextStep }
  /** Data arrived AND is provably incomplete. The renderer draws both. */
  | { kind: 'partial'; data: T; faults: Fault[] }
  | { kind: 'ready'; data: T }

export interface SurfaceInput<T> {
  /** Set to the reason when the viewer may not see this at all. */
  forbidden?: string | false
  error?: string | null
  loading: boolean
  data?: T | null
  /** How many records `data` holds, when it is a collection. */
  count?: number
  /** True while a search or filter is narrowing the result. */
  narrowed?: boolean
  faults?: Fault[]
  /** Required — see `EmptyCopy`. */
  empty: EmptyCopy
  surface?: SurfaceKind
  /** Whether the error is worth offering a retry for. */
  retry?: boolean
  loadingLabel?: string
}

/**
 * One place the order of precedence is decided, so fifty screens cannot each
 * decide it differently.
 *
 * ⭐ THE TWO RULINGS WORTH READING
 *
 *   ① Loading with data already in hand stays `ready`. Re-fetching must not
 *      blank the screen the user is reading — the reference app got this right
 *      by hand (`loading && !data ? <Loading/> : …`) on some screens and wrong
 *      on others, which is exactly what a shared decision is for.
 *
 *   ② An error with data already in hand is a FAULT, not a state. Throwing away
 *      a page of records because a background refresh failed tells the user the
 *      data is gone when it is merely old.
 */
export function surfaceState<T>(input: SurfaceInput<T>): SurfaceState<T> {
  const {
    forbidden, error, loading, data, count, narrowed, empty,
    surface = 'list', retry = true, loadingLabel = 'Đang tải…',
  } = input
  const faults = [...(input.faults ?? [])]
  const hasData = data != null

  if (forbidden) return { kind: 'forbidden', message: forbidden }
  if (!hasData && loading) return { kind: 'loading', skeleton: skeletonFor(surface), label: loadingLabel }
  if (!hasData && error) return { kind: 'error', message: error, retry }

  /* ⛔ FETCH FINISHED AND NOTHING CAME BACK IS `empty`, NOT `loading`.
     An earlier cut returned `loading` here, and it read as harmless until the
     record lens used it: open a record whose id no longer exists and the page
     spins forever. Nothing is loading — the answer arrived and the answer was
     "there is no such record". A spinner for a settled question is the worst of
     both, because the user waits instead of acting. */
  if (!hasData) return asEmpty(empty, narrowed)

  if (error) faults.push({ kind: 'stale', message: error })

  if (count === 0) {
    return asEmpty(empty, narrowed)
  }

  if (faults.length) return { kind: 'partial', data: data as T, faults }
  return { kind: 'ready', data: data as T }
}

function asEmpty<T>(empty: EmptyCopy, narrowed?: boolean): SurfaceState<T> {
  const copy = narrowed ? empty.noMatch : empty.noRecords
  return {
    kind: 'empty',
    because: narrowed ? 'no-match' : 'no-records',
    title: copy.title,
    ...(copy.body ? { body: copy.body } : {}),
    ...(copy.action ? { action: copy.action } : {}),
  }
}

/** Every state, answered. A missing key is a type error, not a blank screen. */
export interface StateHandlers<T, R> {
  loading: (s: Extract<SurfaceState<T>, { kind: 'loading' }>) => R
  forbidden: (s: Extract<SurfaceState<T>, { kind: 'forbidden' }>) => R
  error: (s: Extract<SurfaceState<T>, { kind: 'error' }>) => R
  empty: (s: Extract<SurfaceState<T>, { kind: 'empty' }>) => R
  partial: (s: Extract<SurfaceState<T>, { kind: 'partial' }>) => R
  ready: (s: Extract<SurfaceState<T>, { kind: 'ready' }>) => R
}

/**
 * ⭐ THE ENFORCEMENT. Generic in `R`, so the same call works for a React node, an
 *    HTML string, or a line of terminal output — the states are a fact about the
 *    data, not about the framework drawing it.
 */
export function matchState<T, R>(state: SurfaceState<T>, on: StateHandlers<T, R>): R {
  switch (state.kind) {
    case 'loading': return on.loading(state)
    case 'forbidden': return on.forbidden(state)
    case 'error': return on.error(state)
    case 'empty': return on.empty(state)
    case 'partial': return on.partial(state)
    case 'ready': return on.ready(state)
    default: return assertNever(state, 'SurfaceState')
  }
}

/** Compile-time proof a union was handled; a loud failure if it was not. */
export function assertNever(value: never, where: string): never {
  throw new Error(`${where}: unhandled variant ${JSON.stringify(value)}`)
}
