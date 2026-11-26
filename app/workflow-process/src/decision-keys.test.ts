/**
 * `decision` / `needsDecision` — one key per side of a gate.
 *
 * The value being tested is not the expansion itself; it is that an author now
 * states a decision ONCE and every existing reader still finds what it looks
 * for. Before this, the two halves of a decision were separate keys that had to
 * appear together with nothing enforcing it — measured on a real domain, 15 of
 * 23 gates were missing their other half.
 */

import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeLoader } from './load.js'
import { checkDecisionShape } from './gates.js'
import type { Process } from './types.js'

function loadYaml(doc: string) {
  const dir = mkdtempSync(join(tmpdir(), 'wf-'))
  writeFileSync(join(dir, 'p.yaml'), doc)
  return makeLoader(() => [dir]).loadProcesses()
}

const HEAD = `process: t
entity: Thing
stateProperty: status
roles: { op: R1, boss: R2 }
states: [{ name: OPEN }, { name: DONE }]
transitions:
`

describe('decision — the writing side', () => {
  it('inside: expands to the branch marker and the opinion record', () => {
    const [p] = loadYaml(HEAD + `
  - action: approveIt
    label: Approve
    from: [OPEN]
    to: null
    role: boss
    decision: { by: inside, via: thingApproval, outcome: approve }
`)
    const t = p!.transitions![0]!
    expect(t.outcome).toBe('approve')
    // The author never typed an entity name — `by` chose it.
    expect(t.creates).toEqual({ entity: 'AuthorityApproval', via: 'thingApproval' })
  })

  it('outside: chooses the signed-paper record, and hands the signing rules on', () => {
    const [p] = loadYaml(HEAD + `
  - action: recordSigned
    label: Record signed paper
    from: [OPEN]
    to: null
    role: op
    decision:
      by: outside
      via: thingAuthorizedBy
      signedBy: chairman
      legalBasis: ["Law A", "Law B"]
`)
    const t = p!.transitions![0]!
    expect(t.creates).toEqual({ entity: 'OffSystemDecision', via: 'thingAuthorizedBy' })
    expect(t.signedDecision).toEqual({
      relationship: 'thingAuthorizedBy', signedBy: 'chairman', legalBasis: ['Law A', 'Law B'],
    })
  })

  /**
   * A verdict written straight onto the record. Legitimate for a one-shot gate —
   * and the absence of `via` is the statement, not an omission.
   */
  it('no via: creates nothing, writes the verdict on the record', () => {
    const [p] = loadYaml(HEAD + `
  - action: dismissIt
    label: Dismiss
    from: [OPEN]
    to: DONE
    role: boss
    decision: { by: inside, outcome: reject, reason: whyNot }
`)
    const t = p!.transitions![0]!
    expect(t.outcome).toBe('reject')
    expect(t.creates).toBeUndefined()
  })
})

describe('needsDecision — the reading side', () => {
  it('in-system verdict becomes the approval gate the engine already checks', () => {
    const [p] = loadYaml(HEAD + `
  - action: proceed
    label: Proceed
    from: [OPEN]
    to: DONE
    role: op
    needsDecision: { via: thingApproval, is: approve, secondCheck: false }
`)
    expect(p!.transitions![0]!.requiresApproval).toEqual({
      relationship: 'thingApproval', decision: 'approve',
    })
  })

  it('signed paper is handed to the domain — proving it genuine needs the domain store', () => {
    const [p] = loadYaml(HEAD + `
  - action: useIt
    label: Use the signed paper
    from: [OPEN]
    to: DONE
    role: boss
    needsDecision:
      via: thingAuthorizedBy
      signedBy: chairman
      legalBasis: "Law A"
      secondCheck: true
`)
    expect(p!.transitions![0]!.requiresDecision).toEqual({
      relationship: 'thingAuthorizedBy', signedBy: 'chairman',
      legalBasis: 'Law A', secondCheck: true,
    })
  })
})

describe('checkDecisionShape — four holes somebody fell into', () => {
  const run = (t: Record<string, unknown>) =>
    checkDecisionShape([{ process: 't', entity: 'Thing', transitions: [
      { action: 'x', role: 'op', ...t },
    ] } as unknown as Process]).map((f) => f.problem)

  it('catches a refusal with no reason', () => {
    expect(run({ decision: { by: 'inside', outcome: 'reject' } })
      .some((m) => m.includes('no reason'))).toBe(true)
  })

  it('catches a repeatable verdict with nowhere to keep the sequence', () => {
    expect(run({ repeatable: true, decision: { by: 'inside', outcome: 'approve' } })
      .some((m) => m.includes('repeatable'))).toBe(true)
  })

  it('catches a signed paper with no signer rule and no citation rule', () => {
    const m = run({ decision: { by: 'outside', via: 'e' } })
    expect(m.some((x) => x.includes('who may sign'))).toBe(true)
    expect(m.some((x) => x.includes('citations'))).toBe(true)
  })

  it('catches a double-check left unsaid on a signed paper', () => {
    expect(run({ needsDecision: { via: 'e', signedBy: 's' } })
      .some((m) => m.includes('second pair of eyes'))).toBe(true)
  })

  /**
   * Four eyes keeps two PEOPLE apart: whoever recorded the signed paper, and
   * whoever acts on it. An in-system verdict has one person and no paper, so
   * demanding the field there made steps ask for a document that never existed.
   */
  it('does not demand it of an in-system verdict — there is no second person', () => {
    expect(run({ needsDecision: { via: 'e', is: 'approve' } })).toEqual([])
  })

  it('stays quiet when every rule is met', () => {
    expect(run({
      decision: { by: 'outside', via: 'e', signedBy: 's', legalBasis: 'L' },
      needsDecision: { via: 'e', secondCheck: true },
    })).toEqual([])
  })
})
