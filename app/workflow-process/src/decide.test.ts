import { describe, expect, it } from 'vitest'
import { checkTransition, latestApprovalDecision, matchesFrom } from './decide.js'
import { expandDecisionKeys } from './decision-vocabulary.js'
import type { ExtraCheck, Transition } from './types.js'

const approveStep: Transition = {
  action: 'approveTrainingPlan',
  label: 'Phê duyệt kế hoạch',
  role: 'approver',
  from: ['SUBMITTED'],
  to: null,
  creates: { entity: 'UpperLevelApproval', via: 'approvalLink' },
}

describe('matchesFrom', () => {
  it('accepts the state the step declares', () => {
    expect(matchesFrom(approveStep, 'SUBMITTED')).toBe(true)
  })

  it('rejects any other state', () => {
    expect(matchesFrom(approveStep, 'DRAFT')).toBe(false)
  })

  it('never attaches a create-step to an existing record', () => {
    expect(matchesFrom({ ...approveStep, from: [] }, 'SUBMITTED')).toBe(false)
  })
})

describe('latestApprovalDecision', () => {
  const returned = { id: 'a1', data: { decision: 'RETURNED', decidedAt: '2026-03-01T08:00:00Z' } }
  const approved = { id: 'a2', data: { decision: 'APPROVED', decidedAt: '2026-03-09T08:00:00Z' } }

  it('is null before any decision', () => {
    expect(latestApprovalDecision([])).toBeNull()
  })

  it('takes the latest by decidedAt, not the first recorded', () => {
    expect(latestApprovalDecision([returned, approved])).toBe('APPROVED')
  })

  it('does not depend on array order', () => {
    expect(latestApprovalDecision([approved, returned])).toBe('APPROVED')
  })
})

describe('checkTransition', () => {
  it('lets an undecided submission through', () => {
    const v = checkTransition(approveStep, { id: 'p1', data: { status: 'SUBMITTED' } }, {})
    expect(v.ready).toBe(true)
  })

  it('runs the domain\'s own rules and reports the first refusal', () => {
    // A rule naming a domain entity belongs to the domain, not here. This is the
    // shape one takes: judge, refuse in the domain's own words, or stand aside.
    const noDoubleApproval = (t: Transition, _r: unknown, f: { approvalDecision?: string | null }) =>
      t.creates?.entity === 'UpperLevelApproval' && f.approvalDecision === 'APPROVED'
        ? { ready: false, notReady: 'already decided', notReadyKind: 'done' as const, code: 'ALREADY_APPROVED' }
        : null

    const record = { id: 'p1', data: { status: 'SUBMITTED' } }
    expect(checkTransition(approveStep, record, { approvalDecision: 'APPROVED' }, [noDoubleApproval]))
      .toMatchObject({ ready: false, code: 'ALREADY_APPROVED' })
    // Returned, then resubmitted: the chain is a history, so the domain lets it through.
    expect(checkTransition(approveStep, record, { approvalDecision: 'RETURNED' }, [noDoubleApproval]).ready)
      .toBe(true)
  })

  it('stays out of the way when no domain rule applies', () => {
    expect(checkTransition(approveStep, { id: 'p1', data: { status: 'SUBMITTED' } },
      { approvalDecision: 'APPROVED' }).ready).toBe(true)
  })

  it('holds a step whose prerequisite has not happened — greyed out, not hidden', () => {
    const step: Transition = {
      ...approveStep,
      creates: undefined,
      requiresFact: { property: 'materialsConfirmed', message: 'chưa đủ vật tư' },
    }
    const v = checkTransition(step, { id: 'p1', data: {} })
    expect(v).toMatchObject({ ready: false, notReadyKind: 'waiting', code: 'FACT_MISSING' })
    expect(v.notReady).toBe('chưa đủ vật tư')
  })

  it('releases it once the prerequisite is met', () => {
    const step: Transition = {
      ...approveStep,
      creates: undefined,
      requiresFact: { property: 'materialsConfirmed', message: 'chưa đủ vật tư' },
    }
    expect(checkTransition(step, { id: 'p1', data: { materialsConfirmed: true } }).ready).toBe(true)
  })

  it('stops a step being done twice — hidden, not greyed out', () => {
    const step: Transition = {
      ...approveStep,
      creates: undefined,
      forbidsFact: { property: 'resultRecorded', message: 'đã ghi kết quả vào hồ sơ rồi' },
    }
    const v = checkTransition(step, { id: 'p1', data: { resultRecorded: true } })
    expect(v).toMatchObject({ ready: false, notReadyKind: 'done', code: 'FACT_PRESENT' })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // A permanent refusal outranks a temporary one — added 21/8/2026.
  //
  // Found in a reference app: `appliesTo` (permanent, an extraCheck) was masked by
  // `requiresFact` (temporary, in the declaration) purely because fact gates are
  // evaluated first. The record showed "the assistant has not handed the draft
  // over" for a button that could never appear on that document type — so the
  // reader waited for something that would never arrive.
  //
  // The app's only workaround was to delete the declaration and rewrite the whole
  // gate in JavaScript, to control evaluation order. Two gates went that way
  // before this fix.
  // ═══════════════════════════════════════════════════════════════════════
  it('a permanent refusal wins over a fact gate declared before it', () => {
    const t = {
      action: 'x', label: 'X', role: 'r', from: ['DRAFT'],
      requiresFact: { property: 'handedOver', message: 'chưa bàn giao' },
    } as unknown as Transition
    const notApplicable: ExtraCheck = () => (
      { ready: false, notReady: 'loại này không có bước ấy', notReadyKind: 'n/a', code: 'NOT_APPLICABLE' }
    )
    const v = checkTransition(t, { id: '1', data: { status: 'DRAFT' } }, {}, [notApplicable])
    expect(v.notReadyKind).toBe('n/a')
    expect(v.notReady).toBe('loại này không có bước ấy')
  })

  it('but a temporary refusal still wins when it is the only one', () => {
    const t = {
      action: 'x', label: 'X', role: 'r', from: ['DRAFT'],
      requiresFact: { property: 'handedOver', message: 'chưa bàn giao' },
    } as unknown as Transition
    const v = checkTransition(t, { id: '1', data: { status: 'DRAFT' } }, {}, [])
    expect(v.notReadyKind).toBe('waiting')
    expect(v.code).toBe('FACT_MISSING')
  })

  it('two temporary refusals keep declaration order — the engine does not rank them', () => {
    const t = {
      action: 'x', label: 'X', role: 'r', from: ['DRAFT'],
      requiresFact: { property: 'handedOver', message: 'chưa bàn giao' },
    } as unknown as Transition
    const alsoWaiting: ExtraCheck = () => (
      { ready: false, notReady: 'chờ thứ khác', notReadyKind: 'waiting', code: 'OTHER' }
    )
    const v = checkTransition(t, { id: '1', data: { status: 'DRAFT' } }, {}, [alsoWaiting])
    expect(v.notReady).toBe('chưa bàn giao')
  })

  // ═══════════════════════════════════════════════════════════════════════
  // Link gates — added 5.9.0, 21/8/2026.
  //
  // The condition most processes actually need is about something ATTACHED to
  // the record, not a column on it. Before this, each app denormalised such a
  // condition into a marker column that some effect had to set and — the part
  // everyone forgets — clear again on every backward path.
  // ═══════════════════════════════════════════════════════════════════════
  const linked = (extra: Partial<Transition>) => ({
    action: 'x', label: 'X', role: 'r', from: ['DRAFT'], ...extra,
  }) as unknown as Transition
  const rec = { id: '1', data: { status: 'DRAFT' } }

  it('requiresLink refuses while nothing is attached, and passes once something is', () => {
    const t = linked({ requiresLink: { relationship: 'coversTeam', message: 'chưa chọn bên nào' } })
    expect(checkTransition(t, rec, { links: { coversTeam: 0 } }).ready).toBe(false)
    expect(checkTransition(t, rec, { links: { coversTeam: 0 } }).code).toBe('LINK_MISSING')
    expect(checkTransition(t, rec, { links: { coversTeam: 1 } }).ready).toBe(true)
  })

  it('requiresLink honours `min` — one edge is not always enough', () => {
    const t = linked({ requiresLink: { relationship: 'coversTeam', min: 2, message: 'phải có ít nhất hai bên' } })
    expect(checkTransition(t, rec, { links: { coversTeam: 1 } }).ready).toBe(false)
    expect(checkTransition(t, rec, { links: { coversTeam: 2 } }).ready).toBe(true)
  })

  it('forbidsLink refuses once something IS attached — "the signed copy is already back"', () => {
    const t = linked({ forbidsLink: { relationship: 'authorizedBy', message: 'bản ký đã về rồi' } })
    expect(checkTransition(t, rec, { links: { authorizedBy: 0 } }).ready).toBe(true)
    const v = checkTransition(t, rec, { links: { authorizedBy: 1 } })
    expect(v.ready).toBe(false)
    expect(v.notReadyKind).toBe('done')
    expect(v.code).toBe('LINK_PRESENT')
  })

  // ⛔ AN UNKNOWN COUNT IS NOT ZERO. The read side may not have loaded the edges.
  //    Guessing either way makes the two directions disagree — a button hidden
  //    that works, or offered that the write path then refuses.
  it('an unknown count is skipped, not treated as zero', () => {
    const need = linked({ requiresLink: { relationship: 'coversTeam', message: 'chưa chọn bên nào' } })
    expect(checkTransition(need, rec, {}).ready).toBe(true)
    const forbid = linked({ forbidsLink: { relationship: 'authorizedBy', message: 'bản ký đã về rồi' } })
    expect(checkTransition(forbid, rec, {}).ready).toBe(true)
  })

  // The declaration says `via:` — same word as everywhere else in this vocabulary.
  it('accepts `via:` in the declaration, the word the rest of the vocabulary uses', () => {
    const t = expandDecisionKeys(linked({
      requiresLink: { via: 'coversTeam', message: 'chưa chọn bên nào' },
    }) as unknown as Record<string, unknown>) as unknown as Transition
    expect(checkTransition(t, rec, { links: { coversTeam: 0 } }).ready).toBe(false)
    expect(checkTransition(t, rec, { links: { coversTeam: 2 } }).ready).toBe(true)
  })
})

describe('requiresFact as a list — every fact must hold, the first missing one names the wait', () => {
  const submit: Transition = {
    action: 'submitOrder', label: '', role: 'buyer', from: ['draft'], to: 'submitted',
    requiresFact: [
      { property: 'supplier', message: 'chưa có nhà cung cấp' },
      { property: 'amount', message: 'chưa có số tiền' },
    ],
  }
  const at = (data: Record<string, unknown>) => ({ id: 'o1', data: { status: 'draft', ...data } })

  it('holds the step until all of them are set, naming the first one missing', () => {
    expect(checkTransition(submit, at({}))).toMatchObject({ ready: false, notReady: 'chưa có nhà cung cấp', property: 'supplier', code: 'FACT_MISSING' })
    expect(checkTransition(submit, at({ supplier: 's1' }))).toMatchObject({ ready: false, notReady: 'chưa có số tiền', property: 'amount' })
    expect(checkTransition(submit, at({ supplier: 's1', amount: 10 })).ready).toBe(true)
  })

  it('reads the single form exactly as before', () => {
    const one: Transition = { ...submit, requiresFact: { property: 'supplier', message: 'chưa có nhà cung cấp' } }
    expect(checkTransition(one, at({})).notReady).toBe('chưa có nhà cung cấp')
    expect(checkTransition(one, at({ supplier: 's1' })).ready).toBe(true)
  })
})
