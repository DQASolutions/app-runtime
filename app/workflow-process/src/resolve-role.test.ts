import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createBusinessWorkflow } from './conductor.js'
import type { Hooks, Process, Record_, Session, Transition } from './types.js'

// A process whose signing authority is fixed by law according to what the record
// IS — the shape of a 6-level unit founding, a disciplinary decision
// (9 levels), an award (title × level).
const founding: Process = {
  process: 'unit',
  entity: 'Unit',
  stateProperty: 'status',
  sourceFile: 'app/workflow/unit.yaml',
  roles: { operator: 'CLERK', approver: 'FALLBACK_APPROVER' },
  transitions: [
    { action: 'establishUnit', label: 'Thành lập đơn vị', role: 'approver', from: ['DRAFT'], to: 'ACTIVE' },
    { action: 'draftUnit', label: 'Lập hồ sơ', role: 'operator', from: [], to: 'DRAFT' },
  ],
}

const BY_LEVEL: Record<string, string> = {
  district: 'REGION_MANAGER',
  branch: 'PROVINCE_MANAGER',
  team: 'COMMUNE_MANAGER',
}

// The loader reads YAML off disk, so give it real YAML — that keeps this suite
// honest about the path an app actually takes.
const DIR = mkdtempSync(join(tmpdir(), 'bw-role-'))
writeFileSync(join(DIR, 'unit.yaml'), JSON.stringify(founding), 'utf8')

function harness(over: Partial<Hooks> = {}, record: Record_ | null = null) {
  const applyAction = vi.fn(async () => [{ aggregate: 'u1' }])
  const hooks: Hooks = {
    declarationDirs: () => [DIR],
    provenance: () => ({}),
    civilDate: () => '2026-08-11',
    defaultTargetParam: 'unitId',
    ...over,
  }
  const wf = createBusinessWorkflow(hooks)
  const session = {
    actor: 'someone',
    roles: [] as string[],
    ctx: {},
    ontology: {
      get: async () => record,
      neighbors: async () => [],
      applyAction,
    },
  } as unknown as Session
  return { wf, session, applyAction }
}

describe('resolveRole', () => {
  const team: Record_ = { id: 'u1', entityType: 'Unit', data: { status: 'DRAFT', orgLevel: 'team' } }

  it('falls back to the declared role when no hook is supplied', () => {
    const { wf, session } = harness({}, team)
    session.roles = ['FALLBACK_APPROVER']
    const [offer] = wf.availableActions(session, team, 'Unit')
      .filter((o) => o.action === 'establishUnit')
    expect(offer.needsRole).toBe('FALLBACK_APPROVER')
    expect(offer.allowed).toBe(true)
  })

  it('lets the domain name the role from the record', () => {
    const resolveRole = ({ transition, record }: { transition: Transition; record: Record_ | null }) =>
      transition.role === 'approver' ? BY_LEVEL[String(record?.data?.orgLevel)] : null
    const { wf, session } = harness({ resolveRole }, team)
    session.roles = ['COMMUNE_MANAGER']
    const [offer] = wf.availableActions(session, team, 'Unit')
      .filter((o) => o.action === 'establishUnit')
    expect(offer.needsRole).toBe('COMMUNE_MANAGER')
    expect(offer.allowed).toBe(true)
  })

  it('names a different role for a different record, from the same one step', () => {
    const resolveRole = ({ transition, record }: { transition: Transition; record: Record_ | null }) =>
      transition.role === 'approver' ? BY_LEVEL[String(record?.data?.orgLevel)] : null
    const district: Record_ = { id: 'u2', entityType: 'Unit', data: { status: 'DRAFT', orgLevel: 'district' } }
    const { wf, session } = harness({ resolveRole }, district)
    session.roles = ['COMMUNE_MANAGER']
    const [offer] = wf.availableActions(session, district, 'Unit')
      .filter((o) => o.action === 'establishUnit')
    expect(offer.needsRole).toBe('REGION_MANAGER')
    // The commune manager may found a team but not a district — one step,
    // one declaration, authority following the record.
    expect(offer.allowed).toBe(false)
  })

  it('falls back when the hook stands aside for a role it does not own', () => {
    const resolveRole = ({ transition }: { transition: Transition }) =>
      transition.role === 'approver' ? 'PROVINCE_MANAGER' : null
    const { wf, session } = harness({ resolveRole }, team)
    const offer = wf.availableActions(session, team, 'Unit').find((o) => o.action === 'draftUnit')
    expect(offer).toBeUndefined()   // `from: []` is a create-step, never offered against a record
  })

  it('refuses a write when the resolved role is not held', async () => {
    const resolveRole = () => 'REGION_MANAGER'
    const { wf, session } = harness({ resolveRole }, team)
    session.roles = ['COMMUNE_MANAGER']
    await expect(wf.applyTransition(session, 'establishUnit', { unitId: 'u1' }))
      .rejects.toMatchObject({ code: 'ROLE_DENIED', needs: 'REGION_MANAGER' })
  })

  it('allows the write when it is', async () => {
    const resolveRole = () => 'COMMUNE_MANAGER'
    const { wf, session, applyAction } = harness({ resolveRole }, team)
    session.roles = ['COMMUNE_MANAGER']
    await wf.applyTransition(session, 'establishUnit', { unitId: 'u1' })
    expect(applyAction).toHaveBeenCalledOnce()
  })

  it('keeps refusal before disclosure for apps with no hook', async () => {
    // Without `resolveRole` the record is not read until after the role check, so
    // somebody without the authority never learns whether it exists.
    const { wf, session } = harness({}, null)
    session.roles = ['NOBODY']
    await expect(wf.applyTransition(session, 'establishUnit', { unitId: 'missing' }))
      .rejects.toMatchObject({ code: 'ROLE_DENIED' })
  })
})
