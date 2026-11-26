import { describe, expect, it } from 'vitest'
import {
  emptyTrail, moveTrail, titleTrail, backOf, returnOf, parseTrail,
  type Trail, type TrailMove,
} from './trail.js'

const at = (href: string, key: string) => ({ key, href, path: href.split('?')[0]! })

/** Walk a session: each step is [move, href, key, title?]. */
function walk(steps: [TrailMove, string, string, string?][]): Trail {
  let t = emptyTrail()
  for (const [move, href, key, title] of steps) {
    t = moveTrail(t, move, at(href, key))
    if (title) t = titleTrail(t, key, title)
  }
  return t
}

describe('trail — where the viewer came from', () => {
  it('a record opened from "my work" goes back to "my work", not to its list', () => {
    const t = walk([
      ['POP', '/work', 'a', 'My work'],
      ['PUSH', '/plans/7', 'b', 'Plan 7'],
    ])
    expect(backOf(t, 'b')).toEqual({ kind: 'history', steps: 1, href: '/work', title: 'My work' })
  })

  it('the same record opened two ways goes back two ways', () => {
    const fromClaim = walk([
      ['POP', '/claims/3', 'a', 'Claim 3'],
      ['PUSH', '/members/9', 'b', 'Person 9'],
    ])
    const fromList = walk([
      ['POP', '/members?page=4', 'a', 'People'],
      ['PUSH', '/members/9', 'b', 'Person 9'],
    ])
    expect(backOf(fromClaim, 'b')?.title).toBe('Claim 3')
    // …and the list comes back WITH its page, because href keeps the query.
    expect(backOf(fromList, 'b')?.href).toBe('/members?page=4')
  })

  it('opened cold — a pasted link, a new tab — the trail does not know', () => {
    const t = walk([['POP', '/plans/7', 'default', 'Plan 7']])
    expect(backOf(t, 'default')).toBeNull()
    expect(returnOf(t, 'default', null, { href: '/plans', title: 'Plans' }))
      .toEqual({ kind: 'parent', href: '/plans', title: 'Plans' })
  })

  it('the trail wins over any fallback when it knows', () => {
    const t = walk([
      ['POP', '/work', 'a', 'My work'],
      ['PUSH', '/plans/7', 'b'],
    ])
    expect(returnOf(t, 'b', { href: '/elsewhere' }, { href: '/plans' })?.href).toBe('/work')
  })

  it('fallbacks are taken in order, and an empty one is skipped', () => {
    const t = emptyTrail()
    expect(returnOf(t, 'x', undefined, { href: '' }, { href: '/b' }, { href: '/c' })?.href).toBe('/b')
    expect(returnOf(t, 'x')).toBeNull()
  })

  it('walks past a tab or a filter on the SAME screen', () => {
    const t = walk([
      ['POP', '/work', 'a', 'My work'],
      ['PUSH', '/plans/7', 'b', 'Plan 7'],
      ['PUSH', '/plans/7?tab=2', 'c', 'Plan 7'],
      ['PUSH', '/plans/7?tab=3', 'd', 'Plan 7'],
    ])
    expect(backOf(t, 'd')).toEqual({ kind: 'history', steps: 3, href: '/work', title: 'My work' })
  })

  it('a replaced entry — a form that became its record — is not a place to go back to', () => {
    const t = walk([
      ['POP', '/plans', 'a', 'Plans'],
      ['PUSH', '/plans/new', 'b', 'New plan'],
      ['REPLACE', '/plans/7', 'c', 'Plan 7'],
    ])
    expect(backOf(t, 'c')).toEqual({ kind: 'history', steps: 1, href: '/plans', title: 'Plans' })
    expect(t.entries.b).toBeUndefined()
  })

  it('a PUSH from a form still goes back to the form — which is why forms should replace', () => {
    // Kept as the second half of the test above: the trail records the stack
    // faithfully, so the fix for "back lands on the filled form" is the form's.
    const t = walk([
      ['POP', '/plans', 'a', 'Plans'],
      ['PUSH', '/plans/new', 'b', 'New plan'],
      ['PUSH', '/plans/7', 'c', 'Plan 7'],
    ])
    expect(backOf(t, 'c')?.href).toBe('/plans/new')
  })

  it('back then forward keeps the chain — a pop lands on a known entry', () => {
    let t = walk([
      ['POP', '/work', 'a', 'My work'],
      ['PUSH', '/claims/3', 'b', 'Claim 3'],
      ['PUSH', '/members/9', 'c', 'Person 9'],
    ])
    t = moveTrail(t, 'POP', at('/claims/3', 'b'))
    expect(backOf(t, 'b')?.title).toBe('My work')
    t = moveTrail(t, 'POP', at('/members/9', 'c'))
    expect(backOf(t, 'c')?.title).toBe('Claim 3')
  })

  it('a new branch after going back sits on the entry it left from', () => {
    let t = walk([
      ['POP', '/work', 'a', 'My work'],
      ['PUSH', '/claims/3', 'b', 'Claim 3'],
    ])
    t = moveTrail(t, 'POP', at('/work', 'a'))
    t = moveTrail(t, 'PUSH', at('/orders/5', 'd'))
    expect(backOf(t, 'd')?.title).toBe('My work')
  })

  it('a screen that names itself BEFORE the move is recorded keeps its name', () => {
    // Children run their effects before the shell that records the move.
    let t = walk([['POP', '/work', 'a', 'My work']])
    t = titleTrail(t, 'b', 'Plan 7')
    t = moveTrail(t, 'PUSH', at('/plans/7', 'b'))
    t = moveTrail(t, 'PUSH', at('/orders/5', 'c'))
    expect(backOf(t, 'c')).toEqual({ kind: 'history', steps: 1, href: '/plans/7', title: 'Plan 7' })
    expect(backOf(t, 'b')?.title).toBe('My work')
  })

  it('recording the same move twice changes nothing', () => {
    const t = walk([['POP', '/work', 'a'], ['PUSH', '/plans/7', 'b']])
    expect(moveTrail(t, 'PUSH', at('/plans/7', 'b'))).toBe(t)
    const named = titleTrail(t, 'b', 'Plan 7')
    expect(titleTrail(named, 'b', 'Plan 7')).toBe(named)
  })

  it('an unnamed previous screen still goes back — the title is simply absent', () => {
    const t = walk([['POP', '/work', 'a'], ['PUSH', '/plans/7', 'b']])
    expect(backOf(t, 'b')).toEqual({ kind: 'history', steps: 1, href: '/work' })
  })

  it('a named stub that was never visited is not a way back', () => {
    let t = titleTrail(emptyTrail(), 'ghost', 'Ghost')
    t = moveTrail(t, 'POP', at('/plans/7', 'b'))
    t = { ...t, entries: { ...t.entries, b: { ...t.entries.b!, below: 'ghost' } } }
    expect(backOf(t, 'b')).toBeNull()
  })

  it('forgets the oldest past the cap, but never the entry the viewer is on', () => {
    let t = moveTrail(emptyTrail(), 'POP', at('/start', 'k0'), 5)
    for (let i = 1; i <= 8; i++) t = moveTrail(t, 'PUSH', at(`/p/${i}`, `k${i}`), 5)
    expect(Object.keys(t.entries)).toHaveLength(5)
    expect(t.entries.k8).toBeDefined()
    expect(t.entries.k0).toBeUndefined()
    // Going back to an old entry, then pushing on, must not drop where we are.
    t = moveTrail(t, 'POP', at('/p/4', 'k4'), 5)
    for (let i = 9; i <= 14; i++) t = moveTrail(t, 'PUSH', at(`/q/${i}`, `k${i}`), 5)
    expect(t.entries[t.at!]).toBeDefined()
    expect(Object.keys(t.entries)).toHaveLength(5)
  })

  it('a chain broken by forgetting answers "unknown", not a wrong place', () => {
    let t = moveTrail(emptyTrail(), 'POP', at('/start', 'k0'), 3)
    for (let i = 1; i <= 5; i++) t = moveTrail(t, 'PUSH', at(`/same`, `k${i}`), 3)
    expect(backOf(t, 'k5')).toBeNull()
  })

  it('survives storage: a round trip is exact, and junk becomes an empty trail', () => {
    const t = walk([['POP', '/work', 'a', 'My work'], ['PUSH', '/plans/7', 'b', 'Plan 7']])
    expect(parseTrail(JSON.parse(JSON.stringify(t)))).toEqual(t)
    for (const junk of [null, undefined, 3, 'x', {}, { seq: 'a', entries: {} }, { seq: 1 }]) {
      expect(parseTrail(junk)).toEqual(emptyTrail())
    }
    const partial = parseTrail({ seq: 2, at: 'b', entries: { a: { path: '/a' }, b: { path: '/b', href: '/b', seq: 1, below: 5 } } })
    expect(partial.entries).toEqual({ b: { path: '/b', href: '/b', seq: 1 } })
  })
})
