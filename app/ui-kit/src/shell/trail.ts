// The TRAIL: where the viewer actually came from, so "back" can go there.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ WHAT THIS REPLACES
//
//   Every record screen in the reference app wrote its own way back, by hand:
//   `back={{ to: '/plans', label: 'Kế hoạch huấn luyện' }}`. Measured
//   11/9/2026: 53 of 59 record screens did, and 51 of those 53 are reachable
//   from somewhere OTHER than the list they point at. The worst, a person's
//   record, has 14 ways in — from a benefit claim, a medal, a discipline case,
//   an order… Open it from a claim, press back, land on the list of every
//   person in the commune. The claim you were working on is gone.
//
//   ⭐ And the front door itself was wrong: the "my work" screen — the first
//      screen every role opens — links into 49 kinds of record, and not one of
//      them came back to it.
//
//   A written-in target is right for exactly ONE way in. The screen cannot
//   know which one was used; the history can.
//
// ⛔ THE FIX THAT WAS TRIED FIRST, AND WHY IT DOES NOT SCALE
//
//   Let the CALLER say where back goes (`?ve=/somewhere` on the link). It is
//   correct, and three callers adopted it in two days — against more than a
//   hundred links that would each have to remember. The hundred-and-first
//   forgets, and nothing can tell. The trail needs nobody to remember.
//
// ⭐ WHY "GO BACK" AND NOT "LINK TO THE PREVIOUS ADDRESS"
//
//   Pushing the previous address as a new entry keeps the filters only if they
//   are in the address, loses the scroll position always, and leaves the
//   browser's own Back button pointing at the record again — press it and you
//   are bounced to where you just left. Stepping back through history is what
//   the browser button does; the on-screen button should agree with it.
//
// ⚠️ SAME SCREEN, DIFFERENT QUERY, IS NOT A DIFFERENT PLACE
//
//   A tab or a filter written into the address makes a history entry of its
//   own. "Back" that lands on the same record one tab to the left is not what
//   anyone meant, so `backOf` walks past entries on the same path.
//
// ⚠️ NO WORDS, NO ROUTER, NO STORAGE
//
//   The titles are the app's; so is keeping the trail across a reload. This
//   file only knows the shape of a history stack: a new entry sits on the one
//   it was pushed from, a replaced entry takes over what the old one sat on,
//   and a pop moves to an entry that is already known.
// ═══════════════════════════════════════════════════════════════════════════

/** How the viewer arrived at a place — the three moves a history stack has. */
export type TrailMove = 'PUSH' | 'REPLACE' | 'POP'

/**
 * One history entry, as the router names it.
 *
 * `key` is the router's id for the ENTRY, not for the address: the same
 * address visited twice is two entries. `path` is the address without its
 * query; `href` is the whole thing, to open it again.
 */
export interface TrailPlace {
  key: string
  path: string
  href: string
}

export interface TrailEntry {
  path: string
  href: string
  /** What the screen called itself. Given by the app, never guessed here. */
  title?: string
  /** The entry directly beneath this one in the history stack. */
  below?: string
  /** Order of first sight — used only to forget the oldest. */
  seq: number
}

export interface Trail {
  /** The entry the viewer is on. */
  at?: string
  seq: number
  entries: Record<string, TrailEntry>
}

/** Where "back" should go. */
export type TrailReturn =
  /** Step back `steps` entries through history — the viewer came from there. */
  | { kind: 'history'; steps: number; href: string; title?: string }
  /** No known way in (a link opened cold, a new tab): go to a place the app named. */
  | { kind: 'parent'; href: string; title?: string }

export const emptyTrail = (): Trail => ({ seq: 0, entries: {} })

/**
 * Enough entries for any real session, few enough to store.
 *
 * ⚠️ A forgotten entry breaks the chain beneath whatever sat on it; `backOf`
 *    then answers "unknown" and the app falls back to its parent. Wrong in a
 *    rare case, never a link into nothing.
 */
const CAP = 200

/**
 * Record one move. Pure: returns a new trail.
 *
 * ⚠️ IDEMPOTENT ON PURPOSE. Renderers run effects twice in development and
 *    re-run them on unrelated renders; a second call for the entry the viewer
 *    is already on changes nothing.
 */
export function moveTrail(trail: Trail, move: TrailMove, place: TrailPlace, cap = CAP): Trail {
  if (trail.at === place.key && trail.entries[place.key]) return trail
  const entries = { ...trail.entries }
  const known = entries[place.key]
  const from = trail.at !== undefined ? entries[trail.at] : undefined
  let below: string | undefined
  if (move === 'PUSH') {
    below = from ? trail.at : undefined
  } else if (move === 'REPLACE') {
    // The replaced entry is gone from the stack; the new one sits where it sat.
    below = from?.below
    if (trail.at !== undefined) delete entries[trail.at]
  } else {
    // A pop lands on an entry that already has its place in the stack.
    below = known?.below
  }
  const seq = trail.seq + 1
  entries[place.key] = {
    path: place.path,
    href: place.href,
    // The screen may have named itself before the move was recorded — a child
    // runs its effects before the shell that records the move.
    ...(known?.title !== undefined ? { title: known.title } : {}),
    ...(below !== undefined ? { below } : {}),
    seq: known?.seq ?? seq,
  }
  return { at: place.key, seq, entries: forget(entries, cap, place.key) }
}

/**
 * The screen at `key` names itself. Creates a stub when the move has not been
 * recorded yet (see `moveTrail`).
 */
export function titleTrail(trail: Trail, key: string, title: string): Trail {
  const known = trail.entries[key]
  if (known?.title === title) return trail
  const seq = trail.seq + 1
  return {
    ...trail,
    seq,
    entries: { ...trail.entries, [key]: known ? { ...known, title } : { path: '', href: '', title, seq } },
  }
}

/**
 * The nearest entry beneath `key` that is a DIFFERENT screen, and how many
 * steps back it is. `null` when the trail does not know — the entry was opened
 * cold, or the chain was forgotten.
 */
export function backOf(trail: Trail, key: string | undefined): Extract<TrailReturn, { kind: 'history' }> | null {
  if (key === undefined) return null
  const here = trail.entries[key]
  if (!here || !here.path) return null
  let cur = here
  for (let steps = 1; steps <= CAP; steps++) {
    const b = cur.below !== undefined ? trail.entries[cur.below] : undefined
    // A stub (named, never visited) is not a place to go back to.
    if (!b || !b.path) return null
    if (b.path !== here.path) {
      return { kind: 'history', steps, href: b.href, ...(b.title !== undefined ? { title: b.title } : {}) }
    }
    cur = b
  }
  return null
}

/**
 * Where "back" goes: through history when the trail knows, else the first
 * fallback the app offers.
 *
 * ⭐ The fallbacks are in order of how much they know. An app typically passes
 *    a target the CALLER wrote into the link first, then the parent the screen
 *    itself declares. Neither is used when the trail knows better.
 */
export function returnOf(
  trail: Trail,
  key: string | undefined,
  ...fallbacks: ({ href: string; title?: string } | null | undefined)[]
): TrailReturn | null {
  const back = backOf(trail, key)
  if (back) return back
  for (const f of fallbacks) if (f?.href) return { kind: 'parent', href: f.href, ...(f.title !== undefined ? { title: f.title } : {}) }
  return null
}

/**
 * Read a trail back from storage. Anything that is not a trail — a stale
 * shape, a hand edit, `null` — becomes an empty one rather than an error: a
 * lost trail costs a fallback link, a thrown error costs the screen.
 */
export function parseTrail(value: unknown): Trail {
  if (!value || typeof value !== 'object') return emptyTrail()
  const v = value as Partial<Trail>
  if (typeof v.seq !== 'number' || !v.entries || typeof v.entries !== 'object') return emptyTrail()
  const entries: Record<string, TrailEntry> = {}
  for (const [k, e] of Object.entries(v.entries)) {
    if (e && typeof e === 'object' && typeof e.path === 'string' && typeof e.href === 'string' && typeof e.seq === 'number') {
      entries[k] = {
        path: e.path, href: e.href, seq: e.seq,
        ...(typeof e.title === 'string' ? { title: e.title } : {}),
        ...(typeof e.below === 'string' ? { below: e.below } : {}),
      }
    }
  }
  return { ...(typeof v.at === 'string' ? { at: v.at } : {}), seq: v.seq, entries }
}

function forget(entries: Record<string, TrailEntry>, cap: number, keep: string): Record<string, TrailEntry> {
  // The entry the viewer is on is never forgotten, however old its first sight.
  const keys = Object.keys(entries).filter((k) => k !== keep)
  if (keys.length < cap) return entries
  keys.sort((a, b) => entries[a]!.seq - entries[b]!.seq)
  const out = { ...entries }
  for (const k of keys.slice(0, keys.length - (cap - 1))) delete out[k]
  return out
}
