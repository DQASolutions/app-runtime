// ⛔ The seam that had no guard, pinned.
//
// A derived property's name in the ontology must equal the key the read layer
// puts on the row. Nothing enforced that; three entities matched by coincidence
// and the fourth did not, and its column rendered blank with no error anywhere.

import { describe, it, expect } from 'vitest'
import { resolveView } from './resolve.js'
import { missingDerived, explainMissing } from './row.js'
import type { ProcessDecl, ViewDecl, ViewOntologyDecl } from './types.js'

const ontology: ViewOntologyDecl = {
  entities: [
    {
      name: 'Equipment',
      label: 'Equipment',
      properties: [{ name: 'equipmentName', type: 'text', required: true, description: 'Name' }],
      labels: { equipmentName: 'Name' },
      derived: [{ name: 'unit', kind: 'linked', via: 'heldByUnit', show: 'unitName', label: 'Unit' }],
    },
    {
      name: 'Unit',
      label: 'Unit',
      labels: { unitName: 'Unit name' },
      properties: [{ name: 'unitName', type: 'text', required: true, description: 'Unit name' }],
    },
  ],
  relationships: [{ name: 'heldByUnit', from: 'Equipment', to: 'Unit', cardinality: '1..N', directed: true }],
}
const process: ProcessDecl = {
  process: 'equipment', entity: 'Equipment', stateProperty: 'equipmentName',
  roles: {}, states: [], transitions: [],
}
const decl: ViewDecl = {
  entity: 'Equipment',
  list: { columns: ['equipmentName', 'unit'], main: 'equipmentName' },
}
const { contract } = resolveView(decl, ontology, [process])

describe('missingDerived — the read layer kept its promise, or it did not', () => {
  it('says nothing when the row carries the derived key', () => {
    expect(missingDerived(contract, { data: {}, unit: { unitName: 'Team 1' } })).toEqual([])
  })

  // ⭐ The distinction that makes this useful. Conflating these two is exactly
  //    why the bug hid: a broken join looked identical to an empty field.
  it('treats a NULL derived value as fine — the record simply has no link', () => {
    expect(missingDerived(contract, { data: {}, unit: null })).toEqual([])
  })

  it('reports an ABSENT key — the read layer never ran the join', () => {
    const missing = missingDerived(contract, { data: {} })
    expect(missing.map((m) => m.key)).toEqual(['unit'])
    expect(missing[0]).toMatchObject({ via: 'heldByUnit', show: 'unitName' })
  })

  it('explains which two names have to match, and that either may be the wrong one', () => {
    const [m] = missingDerived(contract, { data: {} })
    const text = explainMissing('Equipment', m)
    expect(text).toContain('"unit"')
    expect(text).toContain('heldByUnit')
    expect(text).toContain('the same word')
  })

  it('ignores a virtual column — it is drawn by code and promises no key', () => {
    const virtual: ViewDecl = {
      entity: 'Equipment',
      list: { columns: ['equipmentName', { name: 'judgement', label: 'Note', widget: 'x' }] },
    }
    const { contract: c } = resolveView(virtual, ontology, [process], { components: ['x'] })
    expect(missingDerived(c, { data: {} })).toEqual([])
  })

  it('reports each key once, however many places name it', () => {
    const twice: ViewDecl = {
      entity: 'Equipment',
      list: { columns: ['unit'], sub: 'unit' },
      detail: { facts: ['unit'] },
    }
    const { contract: c } = resolveView(twice, ontology, [process])
    expect(missingDerived(c, { data: {} }).length).toBe(1)
  })
})
