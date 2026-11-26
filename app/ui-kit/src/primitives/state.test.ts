import { describe, expect, it } from 'vitest'
import {
  surfaceState, matchState, skeletonFor,
  type EmptyCopy, type SurfaceState, type StateHandlers,
} from './state.js'
import type { ActionFacts } from './action.js'

const EMPTY: EmptyCopy = {
  noRecords: { title: 'Chưa có hồ sơ nào' },
  noMatch: { title: 'Không có hồ sơ nào khớp', action: { label: 'Bỏ bộ lọc', go: '/members' } },
}

const base = { loading: false, empty: EMPTY }

describe('precedence — decided once, not fifty times', () => {
  it('refuses before it loads: no point fetching what may not be seen', () => {
    const s = surfaceState({ ...base, loading: true, forbidden: 'Bạn không phụ trách địa bàn này' })
    expect(s.kind).toBe('forbidden')
  })

  it('shows a skeleton only while there is nothing to read', () => {
    expect(surfaceState({ ...base, loading: true }).kind).toBe('loading')
  })

  it('⭐ keeps the page the user is reading while it re-fetches', () => {
    const s = surfaceState({ ...base, loading: true, data: [1, 2], count: 2 })
    expect(s.kind).toBe('ready')
  })

  it('⭐ turns a failed refresh into a fault, not into a blank screen', () => {
    const s = surfaceState({ ...base, error: 'Mất kết nối', data: [1], count: 1 })
    expect(s.kind).toBe('partial')
    if (s.kind !== 'partial') throw new Error('narrowing')
    expect(s.faults[0].kind).toBe('stale')
    expect(s.data).toEqual([1])
  })

  it('⛔ calls a finished fetch that returned nothing `empty`, never `loading`', () => {
    // The record-not-found case: the answer arrived, and the answer was "no".
    expect(surfaceState({ ...base, loading: false, data: null }).kind).toBe('empty')
  })

  it('is an error only when there is nothing to fall back on', () => {
    expect(surfaceState({ ...base, error: 'Hỏng' }).kind).toBe('error')
  })
})

describe('empty is two screens, not one', () => {
  it('says the system is empty when it is', () => {
    const s = surfaceState({ ...base, data: [], count: 0 })
    expect(s).toMatchObject({ kind: 'empty', because: 'no-records', title: 'Chưa có hồ sơ nào' })
  })

  it('⭐ says the FILTER is empty, and offers the way out', () => {
    const s = surfaceState({ ...base, data: [], count: 0, narrowed: true })
    if (s.kind !== 'empty') throw new Error('narrowing')
    expect(s.because).toBe('no-match')
    expect(s.action?.label).toBe('Bỏ bộ lọc')
  })
})

describe('a wiring fault is drawn, not swallowed', () => {
  it('renders the data AND says what is missing', () => {
    const s = surfaceState({
      ...base, data: [1], count: 1,
      faults: [{ kind: 'missing-key', message: 'row does not carry "unit"' }],
    })
    expect(s.kind).toBe('partial')
  })
})

describe('skeletons belong to data, not to controls', () => {
  it.each([
    ['table', 'rows'], ['list', 'rows'], ['card', 'block'], ['record', 'block'],
    ['field', null], ['action', null],
  ] as const)('%s → %s', (surface, expected) => {
    expect(skeletonFor(surface)).toBe(expected)
  })
})

describe('matchState is the enforcement', () => {
  const handlers: StateHandlers<number[], string> = {
    loading: (s) => `loading:${s.skeleton}`,
    forbidden: (s) => `forbidden:${s.message}`,
    error: (s) => `error:${s.message}`,
    empty: (s) => `empty:${s.because}`,
    partial: (s) => `partial:${s.faults.length}`,
    ready: (s) => `ready:${s.data.length}`,
  }

  it('is generic in the return type — the same states drive any renderer', () => {
    const s = surfaceState({ ...base, data: [1, 2, 3], count: 3 })
    expect(matchState(s, handlers)).toBe('ready:3')
    const asNumber = matchState<number[], number>(s, {
      loading: () => 0, forbidden: () => 0, error: () => 0,
      empty: () => 0, partial: () => 0, ready: (x) => x.data.length,
    })
    expect(asNumber).toBe(3)
  })

  it('covers every member of the union', () => {
    const all: SurfaceState<number[]>['kind'][] =
      ['loading', 'forbidden', 'error', 'empty', 'partial', 'ready']
    expect(Object.keys(handlers).sort()).toEqual([...all].sort())
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   THE GUARANTEES, ASSERTED AT THE TYPE LEVEL

   ⭐ `npm run lint` typechecks this file, so every `@ts-expect-error` below FAILS
      THE BUILD the day the rule above it stops being enforced. Without that,
      "it does not compile" is a claim nobody ever checks.
   ═══════════════════════════════════════════════════════════════════════════ */
/**
 * ⚠️ NEVER CALLED, and that is required rather than tidy: `@ts-expect-error`
 *    silences the compiler, not the runtime, and an earlier cut ran these lines
 *    inside an `it()` — where the first one duly threw on the missing argument
 *    it was written to prove could not be passed. A compile-time assertion that
 *    executes is a runtime test of the wrong thing.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function willNotCompile() {
  // @ts-expect-error — a surface state cannot be computed without empty copy
  surfaceState({ loading: false, data: [], count: 0 })

  // @ts-expect-error — a filtered-empty screen must carry a way out of the filter
  const noEscape: EmptyCopy = { noRecords: { title: 'a' }, noMatch: { title: 'b' } }
  void noEscape

  const s = surfaceState({ ...base, data: [1], count: 1 })
  // @ts-expect-error — a handler map missing `empty` is a type error, not a blank screen
  matchState(s, {
    loading: () => '', forbidden: () => '', error: () => '',
    partial: () => '', ready: () => '',
  })

  // @ts-expect-error — `disabled: true` does not exist; a reason is compulsory
  const mute: ActionFacts = { key: 'a', label: 'Ghi', disabled: true }
  void mute
}

describe('what will not compile', () => {
  it('is asserted by `npm run lint`, which typechecks this file', () => {
    expect(typeof willNotCompile).toBe('function')
  })
})
