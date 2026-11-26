// The two keys that describe a decision, and the one place they are expanded.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHY THIS LIVES HERE, IN THE PACKAGE THAT DEFINES WHAT A STEP IS
//
//   `decision` / `needsDecision` are what an author writes. Several packages
//   read a step declaration and each looks for something different:
//
//     · the workflow engine wants the branch marker and the approval gate
//     · the view resolver wants to know which record a step creates, so it can
//       type the parameters against that record's properties
//     · a graph analyser wants the branch marker to demand the other branch
//
//   Expanding the new keys inside any one of them leaves the others reading a
//   shape that no longer exists — which is exactly what happened the first time:
//   the engine understood `decision`, the view resolver did not, and every step
//   that recorded a signed paper suddenly had "untyped" parameters.
//
//   ⚠️ It was briefly placed in the zero-dependency utility package, because
//      that was the one both readers could import without a cycle. That is an
//      argument about the dependency graph, not about meaning — and vocabulary
//      describing a step belongs beside the definition of a step. This package
//      already owns `outcome`, `requiresApproval` and `creates`, in its types
//      and in `KNOWN_TRANSITION_KEYS`. The readers depend on it.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The record type each family of decision writes into.
 *
 * The names are the kernel's. Every domain with an authority signing something
 * has these same two shapes — one decided by somebody holding an account here,
 * one decided on paper by somebody who does not.
 */
export const DECISION_ENTITY = {
  inside: 'AuthorityApproval',
  outside: 'OffSystemDecision',
} as const

export interface DecisionDecl {
  by: 'inside' | 'outside'
  via?: string
  outcome?: 'approve' | 'reject'
  reason?: string
  signedBy?: string | string[]
  legalBasis?: string | string[]
}

export interface NeedsDecisionDecl {
  via: string
  is?: 'approve' | 'reject'
  signedBy?: string | string[]
  legalBasis?: string | string[]
  secondCheck?: boolean
}

/**
 * Expand `decision` / `needsDecision` into the fields existing readers act on.
 *
 * ⚠️ Additive only — never removes the authored keys. A reader that has learned
 *    the new shape should keep reading it; this is here so readers that have not
 *    keep working, not so the new shape can be hidden from them.
 *
 * ⚠️ `requiresDecision` is produced but NOT interpreted here. Proving a signed
 *    paper genuine needs a store and a domain's rules about who may sign; the
 *    kernel hands the declaration over rather than pretend to check it.
 */
export function expandDecisionKeys<T extends Record<string, unknown>>(t: T): T {
  const out: Record<string, unknown> = { ...t }

  // Link gates say `via:` in the declaration, like every other pointer-to-a-
  // relationship in this vocabulary, and carry `relationship` inside. One word
  // for one idea: an author who has learnt `via` for `decision:` should not have
  // to learn a second word for the same thing three lines lower.
  for (const key of ['requiresLink', 'forbidsLink'] as const) {
    const g = t[key] as { via?: string; relationship?: string } | undefined
    if (g?.via && !g.relationship) out[key] = { ...g, relationship: g.via }
  }
  const d = t.decision as DecisionDecl | undefined
  const n = t.needsDecision as NeedsDecisionDecl | undefined

  if (d) {
    if (d.outcome) out.outcome = d.outcome
    // No `via` is an answer, not an omission: the verdict is written on the
    // record itself rather than into an opinion record of its own.
    if (d.via) out.creates = { entity: DECISION_ENTITY[d.by], via: d.via }
    if (d.by === 'outside' && (d.signedBy || d.legalBasis)) {
      out.signedDecision = { relationship: d.via, signedBy: d.signedBy, legalBasis: d.legalBasis }
    }
  }

  if (n) {
    if (n.is) out.requiresApproval = { relationship: n.via, decision: n.is }
    /*
      ⚠️ ONLY A SIGNED PAPER PRODUCES THIS. Four eyes means *the person who
         recorded the paper must not be the one who acts on it* — an in-system
         verdict has no separate recorder, so the idea does not apply and
         inventing one here made a step demand a signed paper that never existed.
    */
    if (n.signedBy || n.legalBasis) {
      out.requiresDecision = {
        relationship: n.via,
        signedBy: n.signedBy,
        legalBasis: n.legalBasis,
        secondCheck: n.secondCheck,
      }
    }
  }

  return out as T
}
