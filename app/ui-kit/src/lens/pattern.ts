// WHICH SCREEN PATTERN A STEP IS — read off its task model, never guessed.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ TOTAL AND DETERMINISTIC, OR IT SAYS WHY NOT
//
//   Four axes, each one answer the declaration gives (`TransitionDecl.task`):
//
//     surface  none (the software does it)  |  action
//     review   what the person must see first — `reads`
//     input    none | fields | document (a signed paper: number, date, scan)
//     over     one record | many records at once | many lines of one field
//
//   Every step gets exactly one pattern, or an `undetermined` naming the missing
//   or contradictory answer. There is no third outcome: a selector that falls
//   back to "a form with every parameter" is the guess this exists to remove.
//
// ⚠️ DETERMINED IS NOT THE SAME AS GOOD. This proves a screen can be built
//    without guessing; whether people can use it is for the kit's design and for
//    evaluation with real users (ISO/IEC 25066). Layout, prominence and taste
//    never enter here.
//
// ⭐ THE REFERENCE is DQAFW's `task-semantics.ts`, whose criteria are proven
//    sufficient and sharp against it. Same four axes, same refusals; the one
//    difference is what counts as "what the step records": there, the ledger's
//    `writes`; here, the step's parameters plus whatever `filledBy` names.
// ═══════════════════════════════════════════════════════════════════════════

import type { ResolvedAction, ViewContract } from '@dqa-ai-solutions/ontology-view'

export type Presentation =
  | { readonly surface: 'none' }
  | {
    readonly surface: 'action'
    /** What the person must see before acting — empty means nothing beyond the record. */
    readonly review: readonly string[]
    readonly input: 'none' | 'fields' | 'document'
    /** Fields the person types · fields the software proposes and the person confirms. */
    readonly typed: readonly string[]
    readonly suggested: readonly string[]
    readonly over: 'single' | 'records' | { readonly rows: string }
  }

export type Determined<T> =
  | { readonly determined: true; readonly value: T }
  | { readonly determined: false; readonly why: string }

const no = (why: string): { determined: false; why: string } => ({ determined: false, why })
const isRows = (v: unknown): v is { rows: string } =>
  typeof v === 'object' && v !== null && typeof (v as { rows?: unknown }).rows === 'string'

export function presentationOf(action: ResolvedAction): Determined<Presentation> {
  const task = action.task
  const name = `"${action.label || action.action}"`
  if (!task) return no(`nobody has said how ${name} is done`)
  if (!task.category) return no(`nobody has said who does ${name}`)
  if (task.category === 'system') return { determined: true, value: { surface: 'none' } }

  const over = task.iteration
  if (over === undefined) return no(`nobody has said whether ${name} is done on one record or many`)
  if (over !== 'single' && over !== 'records' && !isRows(over)) return no(`${name} repeats over ${JSON.stringify(over)}, which is not a pattern`)
  if (task.reads === undefined) return no(`nobody has said what the person must see to do ${name}`)

  const asked = action.fields.filter((f) => f.fixed == null).map((f) => f.key)
  const fb = task.filledBy
  const records = fb ? Object.keys(fb) : asked
  if (!fb && (asked.length || task.category === 'user')) return no(`nobody has said who puts in what ${name} records`)
  const modes = fb ?? {}
  const orphan = asked.find((f) => !(f in modes))
  if (orphan) return no(`nobody has said who puts in "${orphan}" at ${name}`)
  const unaskable = Object.entries(modes).find(([f, m]) => m !== 'system' && !asked.includes(f))
  if (unaskable) return no(`"${unaskable[0]}" is to be put in by a person at ${name}, but the step does not take it`)
  if (isRows(over) && !records.includes(over.rows)) return no(`${name} repeats over lines of "${over.rows}", which it does not record`)

  const typed = asked.filter((f) => modes[f] === 'interaction')
  const suggested = asked.filter((f) => modes[f] === 'suggested')
  let input: 'none' | 'fields' | 'document' = typed.length || suggested.length ? 'fields' : 'none'
  if (task.category === 'user') {
    if (!records.length) return no(`${name} happens away from the software and nothing of it is recorded`)
    if (!task.leaves) return no(`nobody has said what ${name} leaves behind — a signed paper, or only a result`)
    if (task.leaves === 'document') input = 'document'
  }
  return { determined: true, value: { surface: 'action', review: task.reads, input, typed, suggested, over } }
}

/**
 * Who else may see a record at a state, on one line — REAL role codes.
 *
 * ⚠️ Intent, not enforcement. Row-level security in the host's store decides what a person can
 *    actually read; this says what the screen should show a reader who is not acting.
 */
export function readersOf(contract: ViewContract, process: string, state: string): Determined<readonly string[]> {
  const line = contract.lines?.find((l) => l.process === process)
  if (!line) return no(`"${contract.entity}" has no line "${process}"`)
  const who = line.readers?.[state]
  return who ? { determined: true, value: who } : no(`nobody has said who else may see a record at "${state}"`)
}

/**
 * Every step and state of a contract the selector could not decide — the coverage question a
 * build can ask before anyone opens a screen. Empty means every step has exactly one pattern.
 */
export function undeterminedIn(contract: ViewContract): { at: string; why: string }[] {
  const out: { at: string; why: string }[] = []
  for (const a of contract.actions) {
    const p = presentationOf(a)
    if (!p.determined) out.push({ at: `${a.process}.step:${a.action}`, why: p.why })
  }
  for (const l of contract.lines ?? []) {
    for (const s of l.states) {
      const r = readersOf(contract, l.process, s.name)
      if (!r.determined) out.push({ at: `${l.process}.state:${s.name}`, why: r.why })
    }
  }
  return out
}
