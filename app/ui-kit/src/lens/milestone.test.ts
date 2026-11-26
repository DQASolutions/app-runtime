// The milestone lens, argued against the shapes that made it necessary.
//
// ⚠️ Every case below is a shape counted on a shipped app, not one invented to
//    make the code look clever. Where a number appears in a comment it came from
//    a command, and the command's answer is in `milestone.ts`.

import { describe, it, expect } from 'vitest'
import { milestoneModel } from './milestone.js'
import { CONTRACT, GATED_CONTRACT, GATE } from './fixture.js'

const run = (over: Parameters<typeof milestoneModel>[0]) => milestoneModel(over)
const base = { contract: GATED_CONTRACT, process: 'membership' as const }
const keys = (m: ReturnType<typeof milestoneModel>) => m.milestones.map((x) => x.key)
const codes = (m: ReturnType<typeof milestoneModel>) => m.diagnostics.map((d) => d.code)

describe('the milestone lens — the route, and where on it the record is', () => {
  it('puts the gate on the spine at the point it can first be settled', () => {
    const m = run({ ...base, state: 'REGISTERED' })
    /* The opener departs from REGISTERED, so the gate sits between REGISTERED
       and ACTIVE — which is exactly where the operator experiences the wait. */
    expect(keys(m)).toEqual(['REGISTERED', GATE, 'ACTIVE', 'COMPLETED'])
  })

  /* ⛔ THE MEASUREMENT THIS WHOLE FILE EXISTS FOR. The opener declares no `to`,
     so nothing about the record's state changes when the gate opens. A strip of
     states is identical before and after — which is the screen the operator
     could not read. */
  it('names the gate with the OPENING step’s own label, inventing no word', () => {
    const gate = run({ ...base, state: 'REGISTERED' }).milestones.find((x) => x.kind === 'gate')!
    expect(gate.label).toBe('Phê duyệt tuyển chọn')
    expect(gate.roles).toEqual(['ROLE-BRANCH'])
    /* And not the refusal branch, which settles the same gate the other way. A
       route whose milestone reads "Trả lại để bổ sung" tells the reader the
       journey ends in a refusal. */
    expect(gate.label).not.toBe('Trả lại để bổ sung')
  })

  /* ⛔ THE GRAMMAR OF A ROUTE. A state is named for a record that already got
     there — "submitted", "in progress" — so a strip built from state labels
     tells the reader that work they have not done is already done. Reported by
     the user reading their own route: *"sao nó luôn có từ 'Đã' hoặc 'Đang'?"* */
  describe('naming', () => {
    it('names a state by the work that reaches it, not by the state', () => {
      const m = run({ ...base, state: 'REGISTERED' })
      const byKey = Object.fromEntries(m.milestones.map((x) => [x.key, x.label]))
      expect(byKey.ACTIVE).toBe('Tuyển chọn')
      expect(byKey.COMPLETED).toBe('Hoàn thành hợp đồng')
      /* The state's own word is still carried — a badge saying what a record IS
         still wants it. Two questions, two words. */
      const serving = m.milestones.find((x) => x.key === 'ACTIVE')!
      expect(serving.stateLabel).toBe('Đang làm việc')
    })

    /* ⛔ NEITHER OF THESE BRINGS THE RECORD TO THE STATE, and counting them was
       the bug: `REGISTERED` has a self-loop (`amend`) and a return
       (`reinstate`) landing on it, which made three candidate names for one
       state and forced a fallback to "Đã đăng ký". */
    it('does not count a self-loop or a return as arriving', () => {
      const m = run({ ...base, state: 'REGISTERED' })
      const reg = m.milestones.find((x) => x.key === 'REGISTERED')!
      expect(reg.label).toBe('Đăng ký')
      expect(reg.label).not.toBe('Sửa hồ sơ')
      expect(reg.label).not.toBe('Đưa về sổ đăng ký')
    })

    /* ⚠️ Several different steps arriving at one state means several different
       ways to get there; naming it after one tells the reader the others do not
       exist. `discipline` has a state reached by four clause-specific steps. */
    it('keeps the state’s own label when two different steps arrive', () => {
      const two = {
        ...GATED_CONTRACT,
        actions: [
          ...GATED_CONTRACT.actions,
          {
            action: 'selectByOrder', label: 'Tuyển chọn theo lệnh', from: ['REGISTERED'],
            to: 'ACTIVE', role: 'ROLE-HR', process: 'membership', fields: [],
          },
        ],
      }
      const m = run({ contract: two, process: 'membership', state: 'REGISTERED' })
      expect(m.milestones.find((x) => x.key === 'ACTIVE')!.label).toBe('Đang làm việc')
    })

    it('carries the role that ARRIVES, not every role that mentions the state', () => {
      const m = run({ ...base, state: 'REGISTERED' })
      /* `reinstate` is ROLE-HR and lands on REGISTERED going backward — it is
         not how anyone arrives, so it must not appear as the actor there. */
      expect(m.milestones.find((x) => x.key === 'REGISTERED')!.roles).toEqual(['ROLE-HR'])
      expect(m.milestones.find((x) => x.key === 'ACTIVE')!.roles).toEqual(['ROLE-HR'])
    })
  })

  it('marks the gate as what the record is waiting on, and only while it waits', () => {
    const waiting = run({ ...base, state: 'REGISTERED' })
    expect(waiting.milestones.find((x) => x.kind === 'gate')).toMatchObject({ awaiting: true, standing: 'ahead' })

    const settled = run({ ...base, state: 'REGISTERED', settled: { [GATE]: 'approve' } })
    const g = settled.milestones.find((x) => x.kind === 'gate')!
    expect(g.verdict).toBe('approve')
    expect(g.awaiting, 'settled is not waiting').toBeUndefined()
  })

  it('stands a settled gate `past`, even when the record has not moved', () => {
    /* The case this exists for: a cross-level line where the deciding level
       writes its own approval and never touches the subordinate's record. The
       record stays in the state it was submitted from, so position alone can
       never carry the gate past — `current > i` is false forever.

       Before this, such a gate came back `ahead`: a caller drawing `ahead` as
       dim-and-dashed put "not reached yet" directly under the verdict text this
       same model emits. Dropping `awaiting` was not enough; the standing has to
       move too, or the picture keeps saying the opposite of the words. */
    const held = run({ ...base, state: 'REGISTERED', settled: { [GATE]: 'approve' } })
    expect(held.milestones.find((x) => x.kind === 'gate')!.standing).toBe('past')

    /* A rejection settles the gate just as firmly — the level above HAS ruled.
       Whether the record then goes backwards is the process's business, not the
       spine's. */
    const turned = run({ ...base, state: 'REGISTERED', settled: { [GATE]: 'reject' } })
    expect(turned.milestones.find((x) => x.kind === 'gate')!.standing).toBe('past')

    /* And the other direction still holds: no verdict, no promotion. */
    const open = run({ ...base, state: 'REGISTERED' })
    expect(open.milestones.find((x) => x.kind === 'gate')!.standing).toBe('ahead')
  })

  it('a settled gate is still a gate, not a state', () => {
    /* Standing moved to `past`; `kind` must not drift with it. Callers tell the
       two apart to draw them differently — a gate is something someone else
       decided, a state is where the record sits. */
    const m = run({ ...base, state: 'REGISTERED', settled: { [GATE]: 'approve' } })
    const g = m.milestones.find((x) => x.key === GATE)!
    expect(g.kind).toBe('gate')
    expect(m.milestones.filter((x) => x.standing === 'current').map((x) => x.kind)).toEqual(['state'])
  })

  it('never calls a gate `current` — a record is in a state, never in a gate', () => {
    for (const state of ['REGISTERED', 'ACTIVE', 'COMPLETED']) {
      const m = run({ ...base, state })
      expect(m.milestones.filter((x) => x.standing === 'current').map((x) => x.kind)).toEqual(['state'])
    }
  })

  it('reads standing off the record’s position, not off the gate', () => {
    const m = run({ ...base, state: 'ACTIVE' })
    expect(m.milestones.map((x) => `${x.key}=${x.standing}`))
      .toEqual(['REGISTERED=past', `${GATE}=past`, 'ACTIVE=current', 'COMPLETED=ahead'])
  })

  it('carries the role at each state so the app can say whose move it is', () => {
    const m = run({ ...base, state: 'REGISTERED' })
    const byKey = Object.fromEntries(m.milestones.map((x) => [x.key, x.roles]))
    expect(byKey.ACTIVE).toEqual(['ROLE-HR'])
    expect(byKey[GATE]).toEqual(['ROLE-BRANCH'])
    /* ⚠️ Identifiers, never words. Turning `ROLE-BRANCH` into a job title needs a
       job title, a level of authority and a language, none of which are ours. */
    expect(m.milestones.every((x) => x.roles.every((r) => r.startsWith('ROLE-')))).toBe(true)
  })

  /* ⛔ 22 of 54 processes have one. Drawn as another chip it would assert that
     "back to the register" comes AFTER "serving", which is not a direction the
     record travels. */
  it('reports a backward step apart from the spine', () => {
    const m = run({ ...base, state: 'ACTIVE' })
    expect(m.returns).toEqual([
      { action: 'reinstate', label: 'Đưa về sổ đăng ký', role: 'ROLE-HR', from: ['ACTIVE'], to: 'REGISTERED' },
    ])
    expect(keys(m)).not.toContain('reinstate')
  })

  /* ⛔ A step landing where it started is an EDIT, not a journey backward. The
     first cut of this file had no such step in its fixture, and a `to <= from`
     bug survived every assertion in it. */
  it('does not call a step that lands where it started a return', () => {
    const m = run({ ...base, state: 'ACTIVE' })
    expect(m.returns.map((r) => r.action)).toEqual(['reinstate'])
    expect(m.returns.map((r) => r.action)).not.toContain('amend')
  })

  describe('an entity that runs more than one line', () => {
    it('refuses to draw when nobody says which line, and says why', () => {
      const m = run({ contract: GATED_CONTRACT, state: 'REGISTERED' })
      expect(m.milestones).toEqual([])
      expect(codes(m)).toEqual(['AMBIGUOUS_LINE'])
      expect(m.diagnostics[0]!.message).toContain('would assert an order none of them declares')
    })

    it('keeps the other line’s steps and states out of this one’s route', () => {
      const m = run({ ...base, state: 'REGISTERED' })
      expect(keys(m)).not.toContain('PROVISIONAL')
      /* The other line's step names PROVISIONAL. Unfiltered it would be a stray
         state on this route — so a silent pass here means the filter is dead. */
      expect(codes(m)).not.toContain('UNKNOWN_STATE')
    })

    it('draws the other line when asked for it', () => {
      const m = run({ contract: GATED_CONTRACT, process: 'provisionalMembership', state: 'PROVISIONAL' })
      expect(keys(m)).toEqual(['REGISTERED', 'PROVISIONAL'])
      expect(m.milestones.find((x) => x.key === 'PROVISIONAL')!.standing).toBe('current')
    })

    it('names a line that does not exist rather than falling back to the first', () => {
      const m = run({ contract: GATED_CONTRACT, process: 'nosuch', state: 'REGISTERED' })
      expect(m.milestones).toEqual([])
      expect(codes(m)).toEqual(['AMBIGUOUS_LINE'])
    })
  })

  describe('what it refuses to draw', () => {
    /* ⛔ Off the route, every milestone comes back `ahead` — a strip saying a
       record in flight has not started. Drawing nothing is the honest answer. */
    it('draws nothing when the record stands somewhere this line has no name for', () => {
      const m = run({ ...base, state: 'PROVISIONAL' })
      expect(m.milestones).toEqual([])
      expect(codes(m)).toContain('UNKNOWN_STATE')
    })

    it('leaves a gate off the route when no step declares itself its opener', () => {
      const orphan = {
        ...GATED_CONTRACT,
        actions: GATED_CONTRACT.actions.filter((a) => a.outcome !== 'approve'),
      }
      const m = run({ contract: orphan, process: 'membership', state: 'REGISTERED' })
      expect(keys(m)).toEqual(['REGISTERED', 'ACTIVE', 'COMPLETED'])
      expect(codes(m)).toContain('UNPLACED_GATE')
      /* A warning, not an error: the wait is real and still reaches the screen
         through `waitsOn`. What is missing is a NAME for it. */
      expect(m.diagnostics.find((d) => d.code === 'UNPLACED_GATE')!.severity).toBe('warn')
      expect(m.milestones.length).toBeGreaterThan(0)
    })

    it('says so when an entity declares no states at all', () => {
      const m = run({ contract: { ...GATED_CONTRACT, states: undefined, lines: undefined }, state: null })
      expect(m.milestones).toEqual([])
      expect(codes(m)).toEqual(['CONTRACT_GAP'])
    })
  })

  describe('a contract written before lines existed', () => {
    /* `CONTRACT` has `lines`, so strip them: an older app's contract has states
       and no lines, and refusing to draw for want of a field that did not exist
       when it was written would break every screen on upgrade. */
    const older = {
      ...CONTRACT,
      lines: undefined,
      actions: CONTRACT.actions.map(({ process: _drop, ...rest }) => rest as typeof CONTRACT.actions[number]),
    }

    it('treats its states as the one line they are', () => {
      const m = run({ contract: older, state: 'ACTIVE' })
      expect(keys(m)).toEqual(['REGISTERED', 'ACTIVE', 'COMPLETED'])
      expect(m.milestones.find((x) => x.key === 'ACTIVE')!.standing).toBe('current')
    })

    /* ⚠️ No step carries `process`, so filtering on it would empty every route.
       The lens filters only when there is something to filter on. */
    it('does not filter steps by a line stamp none of them carry', () => {
      const m = run({ contract: older, state: 'ACTIVE' })
      expect(m.milestones.find((x) => x.key === 'COMPLETED')!.roles).toEqual(['ROLE-HR'])
    })

    /* The fixture's `defer` step goes to DEFERRED, which `states` never declares
       — an inconsistency it carries on purpose. The lens must say so rather than
       draw a route with a hole in it. */
    it('reports a step naming a state the line has not got', () => {
      expect(codes(run({ contract: older, state: 'ACTIVE' }))).toContain('UNKNOWN_STATE')
    })
  })

  it('places a record that does not exist yet before every milestone', () => {
    const m = run({ ...base, state: null })
    expect(m.milestones.every((x) => x.standing === 'ahead')).toBe(true)
    expect(m.milestones.some((x) => x.standing === 'current')).toBe(false)
  })
})
