// Reading process declarations off disk.
//
// A process is data (`workflow/*.yaml`), never code: adding a step is a block of
// YAML plus a write effect, and this file does not change. The engine knows
// nothing about any domain.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import yaml from 'js-yaml'
import { expandDecisionKeys } from './decision-vocabulary.js'
import type { Process, Transition } from './types.js'

export class ProcessError extends Error {
  code?: string
  [key: string]: unknown

  constructor(message: string, detail: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ProcessError'
    Object.assign(this, detail)
  }
}

/**
 * Load every declared process, once.
 *
 * Cached for the life of the process: declarations do not change while running.
 * Editing a YAML means restarting — say so out loud rather than let someone lose
 * an afternoon wondering why their new step is invisible.
 */
export function makeLoader(declarationDirs: () => string[]) {
  let cache: Process[] | null = null

  function loadProcesses(): Process[] {
    if (cache) return cache
    const processes: Process[] = []
    for (const dir of declarationDirs()) {
      for (const name of readdirSync(dir).sort()) {
        if (!name.endsWith('.yaml')) continue
        const doc = yaml.load(readFileSync(join(dir, name), 'utf8')) as Process
        processes.push({
          ...doc,
          // One expansion, shared with every other reader — see `expandDecisionKeys`.
          transitions: (doc.transitions ?? []).map((t) => expandDecisionKeys(t as Transition)),
          sourceFile: `app/workflow/${name}`,
        })
      }
    }
    cache = processes
    return cache
  }

  /** Which step is this action, and which process owns it. */
  function findTransition(actionName: string): { process: Process; transition: Transition } {
    for (const p of loadProcesses()) {
      const t = (p.transitions ?? []).find((x) => x.action === actionName)
      if (t) return { process: p, transition: t }
    }
    throw new ProcessError(`Hành động "${actionName}" chưa khai trong app/workflow/`)
  }

  /** Steps that declare themselves a consequence of `actionName`. */
  function followUpsAfter(actionName: string): Array<{ process: Process; transition: Transition }> {
    const out: Array<{ process: Process; transition: Transition }> = []
    for (const p of loadProcesses()) {
      for (const t of p.transitions ?? []) {
        if (t.auto?.after === actionName) out.push({ process: p, transition: t })
      }
    }
    return out
  }

  /** Forget the cache — tests that write declarations on the fly need this. */
  function reload(): void {
    cache = null
  }

  return { loadProcesses, findTransition, followUpsAfter, reload }
}

/**
 * Which parameter carries the id of the record being acted on.
 *
 * The fallback is the domain's naming convention, so the domain supplies it —
 * a kernel guessing `memberId` would be guessing about somebody else's model.
 */
export function targetIdParam(transition: Transition, fallback: string): string {
  return transition.params?.target ?? fallback
}

/**
 * The step vocabulary this engine owns and validates.
 *
 * Exported so a domain can work out which keys are ITS OWN — everything in a
 * declaration that is not in this list — and validate those itself. Neither side
 * keeps a copy of the other's list, so neither can drift out of step with it.
 */
export const KNOWN_TRANSITION_KEYS: readonly string[] = [
  'action', 'label', 'useCase', 'source_ref', 'from', 'to', 'role', 'params',
  'requiresFact', 'forbidsFact', 'creates', 'provisional', 'auto',
  // Link gates — the relationship-shaped twin of the fact gates. Added 5.9.0.
  'requiresLink', 'forbidsLink',
  // Approval gates. `requiresApproval` lived inside one app for a while, and
  // that was the wrong home: every process with a superior authority in it has
  // the same shape, so each app reinventing it means each app forgets the
  // refusal branch in its own way. The engine owns the shape; the domain keeps
  // the words — which record carries the decision, what its values mean, and
  // where a refusal leads. See `gates.ts`.
  'requiresApproval', 'outcome',
  // The authoring vocabulary. `outcome` / `requiresApproval` / `creates` above
  // stay because everything already reads them — these two expand into those at
  // load, so a declaration says a thing once and every reader still finds it
  // where it looks. See `expandDecisionKeys`.
  'decision', 'needsDecision',
  // How the step is done — the task model. Added 5.12.0. See `task-vocabulary.ts`.
  'task',
]
