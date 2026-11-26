import { describe, expect, it } from 'vitest'
import { findOpenGates } from './gates.js'
import type { Process } from './types.js'

const proc = (transitions: Process['transitions']): Process[] => [
  { process: 'thu-nghiem', transitions } as Process,
]

describe('findOpenGates', () => {
  it('flags a gate whose only marked branch is the go-ahead', () => {
    const open = findOpenGates(proc([
      { action: 'submit', label: '', role: 'a', from: ['draft'], to: 'pending' },
      { action: 'approve', label: '', role: 'b', from: ['pending'], to: 'done', outcome: 'approve' },
    ]))
    expect(open).toHaveLength(1)
    expect(open[0]).toMatchObject({ state: 'pending', because: 'approve-branch', via: 'approve' })
  })

  it('stays quiet once the refusal is declared', () => {
    const open = findOpenGates(proc([
      { action: 'approve', label: '', role: 'b', from: ['pending'], to: 'done', outcome: 'approve' },
      { action: 'khongDongY', label: '', role: 'b', from: ['pending'], to: 'draft', outcome: 'reject' },
    ]))
    expect(open).toEqual([])
  })

  // The name says nothing. This is the case a /reject|return/ search gets wrong
  // in both directions, and the reason `outcome` exists at all.
  it('reads the declaration, not the action name', () => {
    const namedLikeRefusal = findOpenGates(proc([
      { action: 'approve', label: '', role: 'b', from: ['pending'], to: 'done', outcome: 'approve' },
      { action: 'rejectSomething', label: '', role: 'b', from: ['pending'], to: 'draft' },
    ]))
    expect(namedLikeRefusal).toHaveLength(1)
  })

  it('treats a step waiting on a decision as a gate too', () => {
    const open = findOpenGates(proc([
      { action: 'record', label: '', role: 'b', from: ['pending'], to: null },
      {
        action: 'confirm', label: '', role: 'c', from: ['pending'], to: 'retired',
        requiresApproval: { relationship: 'approvalOf', decision: 'APPROVED' },
      },
    ]))
    expect(open).toHaveLength(1)
    expect(open[0]).toMatchObject({ state: 'pending', because: 'requires-approval' })
  })

  // A second exit is not a refusal. Counting exits called this gate finished and
  // that is exactly how the real one shipped.
  it('is not satisfied by a second exit that merely exists', () => {
    const open = findOpenGates(proc([
      {
        action: 'confirm', label: '', role: 'c', from: ['pending'], to: 'retired',
        requiresApproval: { relationship: 'approvalOf', decision: 'APPROVED' },
      },
      { action: 'recordDecision', label: '', role: 'b', from: ['pending'], to: null },
      { action: 'editNote', label: '', role: 'b', from: ['pending'], to: null },
    ]))
    expect(open).toHaveLength(1)
  })

  // Refusing may write a record and leave the record standing — real law does
  // this. The engine must not insist the refusal moves the record anywhere.
  it('accepts a refusal that changes no state', () => {
    const open = findOpenGates(proc([
      { action: 'approve', label: '', role: 'b', from: ['awaiting'], to: null, outcome: 'approve' },
      { action: 'refuse', label: '', role: 'b', from: ['awaiting'], to: null, outcome: 'reject' },
    ]))
    expect(open).toEqual([])
  })

  it('leaves ordinary states alone', () => {
    const open = findOpenGates(proc([
      { action: 'edit', label: '', role: 'a', from: ['draft'], to: null },
      { action: 'submit', label: '', role: 'a', from: ['draft'], to: 'pending' },
    ]))
    expect(open).toEqual([])
  })

  it('reports one gate per state, not one per marked step', () => {
    const open = findOpenGates(proc([
      { action: 'approveA', label: '', role: 'b', from: ['pending'], to: 'a', outcome: 'approve' },
      { action: 'approveB', label: '', role: 'b', from: ['pending'], to: 'b', outcome: 'approve' },
    ]))
    expect(open).toHaveLength(1)
  })
})
