// HOW A STEP IS DONE — the task model of a process, beside its business rules.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHY THE KERNEL OWNS THIS
//
// A process says WHAT happens: which step moves a record from where to where,
// who may do it, what it records. It does not say how a person does it — whether
// anyone touches a screen at all, whether it is done on one record or a pile of
// them, what they must look at first, which fields they type and which the
// software fills. Every screen answers those questions. When the declaration is
// silent, whoever builds the screen answers them by guessing, and most of the
// time spent reworking a UI is spent reworking those guesses.
//
// Standard: W3C MBUI Task Models (WG Note, 2014) — task category, iteration,
// domain objects read/written. Only the part a screen-pattern selector needs to
// be TOTAL is here; layout, prominence and taste are NOT, and never will be.
// Those belong to the kit and to evaluation with real users (ISO 9241-210,
// ISO/IEC 25066).
//
// ⚠️ ABSENT MEANS UNDECLARED, not "the default". An app that says nothing about
//    `task` behaves exactly as before; a selector asked about it answers
//    "undetermined", never a guess. `[]` / `{}` are answers ("none").
// ═══════════════════════════════════════════════════════════════════════════

import type { Process, Transition } from './types.js'

/** Who does the step: a person on the software · the software alone · a person away from it. */
export const TASK_CATEGORIES = ['interaction', 'system', 'user'] as const
export type TaskCategory = (typeof TASK_CATEGORIES)[number]

/** How a field gets its value: typed by a person · filled by the software · proposed by it, confirmed by a person. */
export const ENTRY_MODES = ['interaction', 'system', 'suggested'] as const
export type EntryMode = (typeof ENTRY_MODES)[number]

/** What a step done away from the software leaves: a signed paper (number, date, scan) · only a result. */
export const OFF_SYSTEM_RECORDS = ['document', 'outcome'] as const
export type OffSystemRecord = (typeof OFF_SYSTEM_RECORDS)[number]

/** One record · many records at once · many lines of one field inside one record. */
export type TaskIteration = 'single' | 'records' | { rows: string }

export interface TaskDecl {
  category?: TaskCategory
  iteration?: TaskIteration
  /** Fields the person must see to do the step, beyond the record itself. */
  reads?: string[]
  /** Every field the step records → how it gets its value. */
  filledBy?: Record<string, EntryMode>
  /** Only for `category: user`. */
  leaves?: OffSystemRecord
}

/** Per state: roles that may see a record there without being able to act on it. */
export type ReadersDecl = Record<string, string[]>

export interface TaskFault {
  process: string
  /** `step:<action>` or `state:<name>`. */
  at: string
  problem: string
  fix: string
}

export const isRows = (v: unknown): v is { rows: string } =>
  typeof v === 'object' && v !== null && typeof (v as { rows?: unknown }).rows === 'string'

/** Fields a person can be asked for at this step — the step's parameters, minus the record it acts on. */
export function askedFields(t: Transition): string[] {
  const p = t.params ?? {}
  return [...(p.required ?? []), ...(p.optional ?? [])].filter((f) => f !== p.target)
}

/**
 * The task declaration checked against the step it describes. Pure, like `checkDecisionShape`.
 *
 * Only what is LOCAL — a step's task against that step's own parameters, a state's readers against
 * the process's roles and states. Nothing here asks whether the answers are GOOD; only whether a
 * screen could be built from them without guessing.
 *
 * ① VALUES OUTSIDE THE CLOSED SETS. YAML is cast, not parsed; a typo would otherwise ride along
 *    as an unknown string and every reader would treat it differently.
 * ② A FIELD A PERSON TYPES THAT THE STEP DOES NOT TAKE. The screen draws it, the step ignores it —
 *    measured: a hand-written form asking for a value the step's params never listed.
 * ③ A PARAMETER NOBODY SAID HOW TO FILL. Once `filledBy` is declared it must cover every parameter,
 *    or the screen is back to guessing for exactly that one.
 * ④ `rows:` over a field the step does not record, and `leaves` / `category: user` that disagree.
 * ⑤ READERS naming a role or state the process does not have.
 */
export function checkTaskShape(processes: Process[]): TaskFault[] {
  const faults: TaskFault[] = []
  for (const p of processes) {
    const say = (at: string, problem: string, fix: string) => faults.push({ process: p.process, at, problem, fix })
    for (const t of p.transitions ?? []) {
      const task = t.task as TaskDecl | undefined
      if (task === undefined) continue
      const at = `step:${t.action}`
      if (typeof task !== 'object' || task === null || Array.isArray(task)) {
        say(at, '`task` is not a map', 'write `task:` as keys `category` · `iteration` · `reads` · `filledBy` · `leaves`')
        continue
      }
      for (const k of Object.keys(task)) {
        if (!['category', 'iteration', 'reads', 'filledBy', 'leaves'].includes(k)) {
          say(at, `unknown task key \`${k}\``, 'use only `category` · `iteration` · `reads` · `filledBy` · `leaves` — layout and taste do not belong here')
        }
      }
      if (task.category !== undefined && !TASK_CATEGORIES.includes(task.category)) {
        say(at, `category "${String(task.category)}"`, `use one of ${TASK_CATEGORIES.join(' · ')}`)
      }
      const it = task.iteration
      if (it !== undefined && it !== 'single' && it !== 'records' && !isRows(it)) {
        say(at, `iteration ${JSON.stringify(it)}`, 'use `single` · `records` · `{ rows: <field this step records> }`')
      }
      if (task.reads !== undefined && (!Array.isArray(task.reads) || task.reads.some((r) => typeof r !== 'string'))) {
        say(at, '`reads` is not a list of field names', 'write `reads: [fieldA, fieldB]`, or `[]` when nothing beyond the record is needed')
      }
      if (task.leaves !== undefined && !OFF_SYSTEM_RECORDS.includes(task.leaves)) {
        say(at, `leaves "${String(task.leaves)}"`, `use one of ${OFF_SYSTEM_RECORDS.join(' · ')}`)
      }
      if (task.leaves !== undefined && task.category !== undefined && task.category !== 'user') {
        say(at, '`leaves` on a step done on the software', 'only a step done away from the software (`category: user`) leaves something behind — drop `leaves` or change the category')
      }

      const fb = task.filledBy
      if (fb === undefined) continue
      if (typeof fb !== 'object' || fb === null || Array.isArray(fb)) {
        say(at, '`filledBy` is not a map', 'write `filledBy: { <field>: interaction | system | suggested }`')
        continue
      }
      const asked = askedFields(t)
      for (const [f, mode] of Object.entries(fb)) {
        if (!ENTRY_MODES.includes(mode)) say(at, `filledBy.${f} "${String(mode)}"`, `use one of ${ENTRY_MODES.join(' · ')}`)
        else if (mode !== 'system' && !asked.includes(f)) {
          say(at, `"${f}" is to be ${mode === 'interaction' ? 'typed' : 'confirmed'} by a person, but the step does not take it`,
            `add "${f}" to \`params\`, or say \`filledBy.${f}: system\` — otherwise the screen asks for a value the step throws away`)
        }
      }
      for (const f of asked) {
        if (!(f in fb)) say(at, `nobody says how "${f}" gets its value`, `add \`filledBy.${f}: interaction | system | suggested\``)
      }
      if (isRows(it) && !(it.rows in fb)) {
        say(at, `repeats over lines of "${it.rows}", which the step does not record`, `add "${it.rows}" to \`filledBy\`, or change \`iteration\``)
      }
      if (task.category === 'user' && Object.keys(fb).length === 0) {
        say(at, 'happens away from the software and records nothing', 'record at least its result — otherwise the software never learns it happened')
      }
    }

    const readers = p.readers as ReadersDecl | undefined
    if (readers === undefined) continue
    const states = new Set((p.states ?? []).map((s) => s.name))
    const roles = new Set(Object.keys(p.roles ?? {}))
    for (const [state, who] of Object.entries(readers)) {
      const at = `state:${state}`
      if (states.size && !states.has(state)) say(at, `readers for "${state}", which is not a state of this process`, 'fix the state name, or drop the line')
      if (!Array.isArray(who)) { say(at, 'readers is not a list of roles', 'write `[roleA, roleB]`, or `[]` when only whoever can act needs to see it'); continue }
      for (const r of who) if (!roles.has(r)) say(at, `reader "${r}" is not a role of this process`, `use a key of \`roles\` (${[...roles].join(' · ') || 'none declared'})`)
    }
  }
  return faults
}
