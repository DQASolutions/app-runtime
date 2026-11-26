// A STEP, turned into a form — and into the facts that decide its button.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ EXPECTATIONS SET LOW, DELIBERATELY, WITH A PRECEDENT
//
//   Camunda 7 generated forms from metadata in the BPMN. Camunda 8 dropped it
//   entirely, and the feature they added on the way out says why: CONDITIONAL
//   VISIBILITY. A list of parameters cannot express "hide this field when that
//   field is X".
//
//   So this resolves what a form HAS, never when it shows what. A step needing
//   more declares `widgets: { action.<step>: <name> }` and is written in code.
//   Measured on a real app: 24 of 34 dialogs generated, 10 hand-written. That is
//   the right number, not a failure.
//
// ⛔ AND IT REFUSES RATHER THAN GUESSES. A parameter type it cannot build a
//    control for comes back `unrenderable`, reported at start-up. The reference
//    app's earlier renderer printed *"Chưa dựng được ô nhập cho kiểu json"* in
//    the middle of a step, in front of the officer trying to take it — the
//    failure arrived at the worst possible moment and to the wrong person.
// ═══════════════════════════════════════════════════════════════════════════

import type { ResolvedAction, ResolvedField, ViewContract } from '@dqa-ai-solutions/ontology-view'
import { actionViews, type ActionFacts, type ActionView } from '../primitives/index.js'
import type { BlockRegistry } from './registry.js'
import type { LensDiagnostic } from './diagnostic.js'

export type Control =
  | 'text' | 'textarea' | 'number' | 'date' | 'datetime'
  | 'select' | 'tags' | 'ref' | 'refs' | 'file' | 'unrenderable'

export interface FormField {
  field: ResolvedField
  control: Control
  required: boolean
  /** Which entity a picker should be filled from. */
  refEntity?: string
  /**
   * `suggested` — the software proposes a value, the person confirms or changes it. Present only
   * when the step declares `task.filledBy`; absent means nobody said, not "typed".
   */
  entry?: 'interaction' | 'suggested'
}

export interface ActionForm {
  action: string
  label: string
  /** Set when the step wants a hand-written form instead of a generated one. */
  widget?: string
  fields: FormField[]
  /**
   * Values the declaration already settled — the form must NOT ask for them.
   *
   * ⭐ A step that names the only authority who may sign, or the single citation
   *    that makes its paper valid, has already answered. Asking an operator to
   *    retype a written-down fact buys nothing and costs a class of typo that
   *    surfaces later, in somebody else's step.
   */
  settled: { field: ResolvedField; value: string }[]
  /**
   * Parameters the declaration says THE SOFTWARE fills (`task.filledBy: system`) — not asked.
   *
   * ⚠️ Not `settled`: no value is written down, so the app supplies it when the step is taken.
   *    A form that asked for it anyway would put a person in charge of a value nobody meant them
   *    to decide. Present only when non-empty.
   */
  bySoftware?: ResolvedField[]
  diagnostics: LensDiagnostic[]
}

/**
 * ⚠️ `multiline` is NOT a contract key and deliberately never will be. Choosing
 *    `<textarea>` over `<input>` is HTML's business; the ontology tags the
 *    property and a renderer that understands the tag reads it.
 */
const isMultiline = (f: ResolvedField) =>
  Boolean(f.typeClasses?.multiline) || Boolean(f.typeClasses?.paragraph)

function controlFor(f: ResolvedField): Control {
  if (f.enum?.length) return 'select'
  switch (f.kind) {
    case 'text': return isMultiline(f) ? 'textarea' : 'text'
    case 'number': return 'number'
    case 'date': return 'date'
    case 'datetime': return 'datetime'
    case 'text[]': return 'tags'
    case 'file': return 'file'
    case 'uuid': return f.many ? 'refs' : 'ref'
    /* ⛔ `json` and `derived` are the honest refusals. A text box that accepts
       JSON is how unparseable data enters a store; a derived value is computed
       and was never anyone's to type. */
    default: return 'unrenderable'
  }
}

export function actionForm(action: ResolvedAction, blocks: BlockRegistry): ActionForm {
  const diagnostics: LensDiagnostic[] = []

  if (action.widget && !blocks.has(action.widget)) {
    diagnostics.push({
      severity: 'error',
      code: 'UNKNOWN_BLOCK',
      where: `action.${action.action}`,
      message:
        `step "${action.label}" names the form "${action.widget}", which this renderer does not `
        + `publish. The step would open an empty dialog.`,
    })
  }

  const settled: ActionForm['settled'] = []
  const fields: FormField[] = []
  const bySoftware: ResolvedField[] = []
  // Only a DECLARED answer changes the form — see `TransitionDecl.task`.
  const modes = action.task?.filledBy

  for (const f of action.fields) {
    if (f.fixed != null) {
      settled.push({ field: f, value: f.fixed })
      continue
    }
    const mode = modes?.[f.key]
    if (mode === 'system') {
      bySoftware.push(f)
      continue
    }
    const control = controlFor(f)
    if (control === 'unrenderable' && !action.widget) {
      diagnostics.push({
        severity: 'error',
        code: 'UNRENDERABLE_FIELD',
        where: `action.${action.action}.${f.key}`,
        message:
          `no control can be generated for "${f.label}" (type ${f.kind}). Declare `
          + `\`widgets: { action.${action.action}: <name> }\` and write the form, or the step `
          + `refuses in front of whoever is taking it.`,
      })
    }
    fields.push({
      field: f,
      control,
      required: Boolean(f.required),
      ...(f.refEntity ? { refEntity: f.refEntity } : {}),
      ...(mode === 'interaction' || mode === 'suggested' ? { entry: mode } : {}),
    })
  }

  return {
    action: action.action,
    label: action.label,
    ...(action.widget ? { widget: action.widget } : {}),
    fields,
    settled,
    ...(bySoftware.length ? { bySoftware } : {}),
    diagnostics,
  }
}

/** Steps this record can actually take from where it stands. */
export const availableActions = (contract: ViewContract, state: string | null): ResolvedAction[] =>
  contract.actions.filter((a) => (state == null ? a.from.length === 0 : a.from.includes(state)))

/**
 * The two facts about a step that NO declaration states.
 *
 * ⭐ `outcome` USED TO BE HERE AND IS GONE — the contract carries it now
 *    (`@dqa-ai-solutions/ontology-view` ≥ 0.24.0). What remains is genuinely outside the
 *    workflow's vocabulary:
 *
 *      exits    — leaves without writing. A workflow has no word for "cancel",
 *                 because cancelling is not a step: nothing happens.
 *      destroys — irreversible. `to` says where the record goes, never whether
 *                 the journey can be walked back.
 *
 * ⚠️ Passing `outcome` here still works and still wins, so an app on an older
 *    contract keeps running. But it is no longer the way — the workflow already
 *    knows, and two places knowing is two places to drift.
 */
export interface ActionHints {
  [action: string]: { outcome?: 'approve' | 'reject'; exits?: boolean; destroys?: boolean }
}

export function actionFacts(
  actions: ResolvedAction[],
  hints: ActionHints = {},
): { facts: ActionFacts[]; diagnostics: LensDiagnostic[] } {
  const diagnostics: LensDiagnostic[] = []
  const facts = actions.map((a) => {
    const hint = hints[a.action] ?? {}
    /* The hint still wins, so an app on an older contract keeps working. */
    const outcome = hint.outcome ?? a.outcome
    return {
      key: a.action,
      label: a.label,
      advances: a.to != null,
      ...(outcome ? { outcome } : {}),
      ...(hint.exits ? { exits: true } : {}),
      ...(hint.destroys ? { destroys: true } : {}),
      ...(a.provisional ? { provisional: a.provisional } : {}),
    } satisfies ActionFacts
  })

  /* ⚠️ Still reported, and the message changed with the cause. Before, the
     contract could not carry the answer; now it can, so silence here means the
     PROCESS never said which step is the approval — and that is a question for
     whoever wrote the workflow, not a gap in the kernel. */
  const undecided = facts.filter((f) => f.advances && !f.outcome)
  if (undecided.length > 1) {
    diagnostics.push({
      severity: 'warn',
      code: 'CONTRACT_GAP',
      where: 'actions',
      message:
        `${undecided.length} steps advance the record and none declares \`decision.outcome\`, so `
        + `no button can be the primary one. If one of them IS the approval, say so in the process; `
        + `otherwise the screen must still name one (\`primary: true\`) — a flat screen is not an answer `
        + `(ruled 26/9/2026: "trên 1 màn hình luôn phải define button nào là chính").`,
    })
  }
  return { facts, diagnostics }
}

export const actionButtons = (facts: ActionFacts[]): ActionView[] => actionViews(facts)
