// Read an app's view declarations off disk and resolve them.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHY THIS IS KERNEL WORK, NOT APP WORK
//
//   Scanning a directory, parsing YAML, resolving each declaration, collecting
//   the diagnostics and refusing to start on a broken one — none of that is
//   specific to any domain. Left in the app it gets rewritten, slightly
//   differently, by every app; and the differences are exactly where one of them
//   quietly decides to ignore a diagnostic.
//
//   Same reasoning, same shape as `@dqa-ai-solutions/core-runtime`'s `loadOntology` /
//   `loadRules`: the loader makes the calls so the app can ship data, not code.
//
//   What stays with the app is the part only it can answer: which slots its
//   renderer publishes, which components it can resolve, and how much bespoke
//   work an entity may carry before someone should look at it again.
// ═══════════════════════════════════════════════════════════════════════════

import fs from 'fs-extra'
import path from 'node:path'
import { createHash } from 'node:crypto'
import yaml from 'js-yaml'
import { expandDecisionKeys } from '@dqa-ai-solutions/workflow-process'
import { resolveView, formatDiagnostics } from './resolve.js'
import type {
  Diagnostic, ProcessDecl, ResolveOptions, ViewContract, ViewDecl, ViewOntologyDecl,
} from './types.js'

export interface LoadViewsOptions extends ResolveOptions {
  /**
   * Directory holding `*.yaml` view declarations — one per entity.
   *
   * Accepts a LIST of directories for an app assembled from several
   * independently-owned bundles. They are merged into one set of contracts, and
   * two bundles declaring the same entity is an ERROR, not a last-one-wins:
   * entity names are the app's global keys, so a silent overwrite means one
   * team's screen quietly becomes another team's.
   */
  viewsDir: string | readonly string[]
  /** The app's ontology, already parsed. */
  ontology: ViewOntologyDecl
  /** Process declarations, already parsed. Use this or `workflowDir`. */
  processes?: ProcessDecl[]
  /** Directory holding `*.yaml` process declarations — read when `processes` is absent.
   *  Also accepts a list, for the same reason as `viewsDir`. */
  workflowDir?: string | readonly string[]
  /**
   * Where warnings go. Defaults to `console.warn`.
   *
   * ⚠️ Pass `() => {}` only in tests. A swallowed warning is a warning that does
   *    nothing, and the ones this raises — a column heading generated from a
   *    code name, wording left behind by a rename — are precisely the kind that
   *    nobody ever goes looking for on purpose.
   */
  onWarning?: (text: string) => void
}

export interface ViewPack {
  /** Resolved contracts, keyed by entity name. */
  contracts: Record<string, ViewContract>
  /** Every diagnostic raised, keyed by the file that raised it. */
  diagnostics: Record<string, Diagnostic[]>
  ok: boolean
  /**
   * Content hash of the resolved contracts — the version of "what the screens
   * are shaped like right now".
   *
   * What it is for: a runtime that caches contracts, or a second process that
   * holds its own copy, can compare this and REFUSE TO START on a mismatch.
   * Without it a stale copy renders a screen with a column missing and nothing
   * says a word — the same failure mode this loader already refuses to allow
   * for a broken declaration, just arriving later.
   *
   * Stable across runs and independent of key order and of the order the
   * directories were listed in.
   */
  version: string
}

const readYaml = async <T>(p: string): Promise<T> => yaml.load(await fs.readFile(p, 'utf-8')) as T

const yamlFiles = async (dir: string) =>
  (await fs.readdir(dir)).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml')).sort()

const asList = (v: string | readonly string[] | undefined): string[] =>
  v === undefined ? [] : typeof v === 'string' ? [v] : [...v]

/** Deterministic JSON: object keys sorted at every depth, so the hash tracks
 *  content and not the order a key happened to be written in. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}

function contractsVersion(contracts: Record<string, ViewContract>): string {
  const sorted = Object.keys(contracts).sort().map((k) => [k, contracts[k]])
  return createHash('sha256').update(stableStringify(sorted)).digest('hex').slice(0, 16)
}

/**
 * Resolve every view declaration in a directory, reporting rather than throwing.
 *
 * Use this when the caller wants to decide what to do about a bad declaration —
 * a build check that lists every problem at once, for instance. Most callers
 * want {@link loadViewContracts} instead.
 */
export async function resolveViewPack(options: LoadViewsOptions): Promise<ViewPack> {
  const { viewsDir, ontology, workflowDir, onWarning = console.warn, ...rest } = options

  // Sorted so the merge order — and therefore the version hash — does not
  // depend on the order the caller happened to list the bundles in.
  const viewDirs = (await Promise.all(
    asList(viewsDir).sort().map(async (d) => ((await fs.pathExists(d)) ? d : null)),
  )).filter((d): d is string => d !== null)

  // ⚠️ No early return when there is no view: processes are still checked below.

  const workflowDirs = (await Promise.all(
    asList(workflowDir).sort().map(async (d) => ((await fs.pathExists(d)) ? d : null)),
  )).filter((d): d is string => d !== null)

  /*
    ⚠️ EXPAND THE DECISION VOCABULARY BEFORE ANYTHING READS A STEP.

       An author writes `decision: { by: outside, via: … }`; this resolver types
       a step's parameters against the record the step CREATES, and it looks for
       `creates`. Without the expansion every step that records a signed paper
       reports its parameters as untyped — a failure that points at the
       declaration while the actual cause is a reader that has not been told.

       The expansion is imported from the package that DEFINES a step, so it is
       literally the same one the workflow engine applies. Two copies would drift, and the drift would show
       up as this same misleading error.
  */
  const processes = (options.processes
    ?? (await Promise.all(
      workflowDirs.flatMap(async (dir) =>
        Promise.all((await yamlFiles(dir)).map((f) => readYaml<ProcessDecl>(path.join(dir, f)))),
      ),
    )).flat()
  ).map((p) => ({
    ...p,
    transitions: (p.transitions ?? []).map(
      (t) => expandDecisionKeys(t as unknown as Record<string, unknown>) as unknown as typeof t,
    ),
  }))

  const contracts: Record<string, ViewContract> = {}
  const diagnostics: Record<string, Diagnostic[]> = {}
  /** entity name → the file that first declared it, for the collision message. */
  const declaredIn = new Map<string, string>()
  let ok = true

  for (const dir of viewDirs) {
    for (const file of await yamlFiles(dir)) {
      // With one bundle the bare filename is unambiguous. With several, the
      // filename alone is not — two bundles routinely hold `equipment.yaml` —
      // so the label carries the path, which is what makes a clash findable.
      const label = viewDirs.length > 1 ? path.join(dir, file) : file
      const decl = await readYaml<ViewDecl>(path.join(dir, file))
      const result = resolveView(decl, ontology, processes, rest)
      const entity = result.contract.entity

      const first = declaredIn.get(entity)
      if (first !== undefined) {
        // Entity names are the app's global keys. Letting the last bundle win
        // would hand one team's screen to another team, silently.
        ok = false
        const clash: Diagnostic = {
          severity: 'error',
          code: 'DUPLICATE_ENTITY',
          where: label,
          message:
            `Entity "${entity}" is already declared by ${first}. Two bundles ` +
            'cannot own the same entity — move the declaration into the bundle ' +
            'that owns the entity, or give one of them its own entity name.',
        }
        diagnostics[label] = [...(diagnostics[label] ?? []), clash]
        continue
      }
      declaredIn.set(entity, label)

      contracts[entity] = result.contract
      if (result.diagnostics.length) diagnostics[label] = result.diagnostics
      if (!result.ok) ok = false

      const warnings = result.diagnostics.filter((d) => d.severity === 'warn')
      if (warnings.length) onWarning(`${label}\n${formatDiagnostics(warnings)}`)
    }
  }

  /*
    ⛔ A PROCESS WITH NO VIEW WAS NEVER CHECKED — measured 13/9/2026.

       Everything above resolves a process only through the view of its entity.
       A process whose entity has no view file (a ledger, a payment slip, a
       funding request driven by a hand-written screen) had its declaration read
       by nothing at build or at start: three untyped parameters of one such
       process sat committed until a step ran and a request failed.

    ⭐ So every such process is resolved here as well, against its entity alone,
       and its errors fail the pack exactly like a view's. It adds no contract —
       there is no screen to hand one to — only the verdict.
  */
  const viewed = new Set(Object.keys(contracts))
  const orphans = new Map<string, typeof processes>()
  for (const p of processes) {
    if (!p?.entity || viewed.has(p.entity)) continue
    orphans.set(p.entity, [...(orphans.get(p.entity) ?? []), p])
  }
  for (const [entity, group] of orphans) {
    const label = `workflow:${group.map((p) => p.process ?? entity).join('+')}`
    const result = resolveView({ entity } as ViewDecl, ontology, group, rest)
    if (result.diagnostics.length) diagnostics[label] = result.diagnostics
    if (!result.ok) ok = false
    const warnings = result.diagnostics.filter((d) => d.severity === 'warn')
    if (warnings.length) onWarning(`${label}\n${formatDiagnostics(warnings)}`)
  }

  return { contracts, diagnostics, ok, version: contractsVersion(contracts) }
}

/**
 * Resolve every view declaration, and **refuse to return** if any is broken.
 *
 * ⚠️ Note the asymmetry with {@link resolveView}, which never throws. That is
 *    deliberate, and the difference is *when* each runs. `resolveView` resolves
 *    one declaration and hands back everything it found, because a caller may
 *    reasonably want to render what worked and report the rest. This loader runs
 *    at start-up, where the choice is different: a broken declaration should
 *    stop the process while someone is still watching, rather than become a
 *    screen with a column missing that nobody notices for a month.
 */
export async function loadViewContracts(options: LoadViewsOptions): Promise<Record<string, ViewContract>> {
  return (await loadViewPack(options)).contracts
}

/**
 * {@link loadViewContracts} plus the version of what it loaded.
 *
 * Reach for this when something else holds a copy of these contracts — a cache,
 * a second process, a client bundle. Compare `version` and refuse to run on a
 * mismatch, so a stale copy fails loudly at start-up instead of rendering a
 * screen with a column quietly missing.
 */
export async function loadViewPack(
  options: LoadViewsOptions,
): Promise<{ contracts: Record<string, ViewContract>; version: string }> {
  const { contracts, diagnostics, ok, version } = await resolveViewPack(options)
  if (ok) return { contracts, version }

  const broken = Object.entries(diagnostics)
    .map(([file, ds]) => [file, ds.filter((d) => d.severity === 'error')] as const)
    .filter(([, ds]) => ds.length > 0)
    .map(([file, ds]) => `${file}\n${formatDiagnostics(ds)}`)

  throw new Error(`Broken view declaration — fix before starting:\n\n${broken.join('\n\n')}`)
}
