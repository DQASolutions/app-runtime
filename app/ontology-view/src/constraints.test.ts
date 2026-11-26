/**
 * The limit a property declares reaches the `<input>` — every road a field
 * takes into the contract carries it, and a limit written only as a view tag
 * is called out.
 *
 * Before 12/9/2026 the contract had no slot for it. The reference app wrote
 * `typeClasses: { maxLength: 500 }` so its form had something to read — and the
 * server, which never reads view tags, stored whatever came by any other road.
 */
import { describe, it, expect } from 'vitest'
import { resolveView } from './resolve.js'
import type { ProcessDecl, ViewDecl, ViewOntologyDecl } from './types.js'

const ontology: ViewOntologyDecl = {
  entities: [
    {
      name: 'BudgetLine',
      label: 'Khoản dự toán',
      labels: { title: 'Nội dung', amount: 'Số tiền', note: 'Ghi chú', planId: 'Kế hoạch' },
      properties: [
        { name: 'title', type: 'text', required: true, maxLength: 200 },
        { name: 'amount', type: 'number', required: true, minimum: 0, maximum: 100_000_000_000, multipleOf: 1 },
        { name: 'note', type: 'text' },
      ],
      typeClasses: { note: { multiline: true, maxLength: 500 } },
    },
    {
      name: 'Payment',
      label: 'Chi trả',
      labels: { paidAmount: 'Số tiền chi' },
      properties: [{ name: 'paidAmount', type: 'number', exclusiveMinimum: 0, multipleOf: 1 }],
    },
  ],
  relationships: [],
}

const process: ProcessDecl = {
  process: 'budget',
  entity: 'BudgetLine',
  stateProperty: 'title',
  roles: { clerk: 'AC-1' },
  states: [{ name: 'draft', label: 'Nháp' }],
  transitions: [
    {
      action: 'addLine',
      label: 'Thêm khoản',
      from: [],
      to: 'draft',
      role: 'clerk',
      params: { required: ['title', 'amount'], optional: ['note'] },
    },
    {
      action: 'pay',
      label: 'Chi trả',
      from: ['draft'],
      to: 'draft',
      role: 'clerk',
      params: { target: 'budgetLineId', required: ['budgetLineId', 'paidAmount', 'reason'] },
      creates: { entity: 'Payment', via: 'paidFrom' },
      fields: { reason: { type: 'text', label: 'Lý do', maxLength: 300 } },
    },
  ],
}

const view: ViewDecl = {
  entity: 'BudgetLine',
  list: { columns: ['title', 'amount'], main: 'title' },
}

describe('constraints travel with the field', () => {
  const { contract, diagnostics } = resolveView(view, ontology, [process])
  const add = contract.actions.find((a) => a.action === 'addLine')!
  const pay = contract.actions.find((a) => a.action === 'pay')!

  it('a list column carries them', () => {
    const amount = contract.list!.columns.find((c) => c.key === 'amount')!
    expect(amount.constraints).toEqual({ minimum: 0, maximum: 100_000_000_000, multipleOf: 1 })
  })

  it('a step parameter that is the entity\'s own property carries them', () => {
    expect(add.fields.find((f) => f.key === 'title')!.constraints).toEqual({ maxLength: 200 })
    expect(add.fields.find((f) => f.key === 'amount')!.constraints).toMatchObject({ multipleOf: 1 })
  })

  it('a property of the record a step creates carries them', () => {
    expect(pay.fields.find((f) => f.key === 'paidAmount')!.constraints).toEqual({ exclusiveMinimum: 0, multipleOf: 1 })
  })

  it('a step-only field may declare them, and they are carried — not refused as unknown keys', () => {
    expect(pay.fields.find((f) => f.key === 'reason')!.constraints).toEqual({ maxLength: 300 })
    expect(diagnostics.filter((d) => d.code === 'UNKNOWN_KEY')).toEqual([])
  })

  it('a property that declares nothing gets no `constraints` key (the kernel floor still applies)', () => {
    expect('constraints' in add.fields.find((f) => f.key === 'note')!).toBe(false)
  })

  it('a length written as a view tag is called out — only the browser reads it', () => {
    const d = diagnostics.find((x) => x.code === 'CONSTRAINT_IN_VIEW')
    expect(d).toMatchObject({ severity: 'warn', where: 'BudgetLine.typeClasses.note' })
  })
})

describe('a step-only field names a value type', () => {
  const withTypes: ViewOntologyDecl = {
    ...ontology,
    valueTypes: [
      { name: 'soTien', type: 'number', minimum: 0, maximum: 10_000_000_000_000, multipleOf: 1 },
      { name: 'doanVan', type: 'text', maxLength: 4000 },
    ],
  }
  const step = (fields: NonNullable<ProcessDecl['transitions'][number]['fields']>): ProcessDecl => ({
    ...process,
    transitions: [{ ...process.transitions[1]!, params: { target: 'budgetLineId', required: ['budgetLineId', 'paidAmount', 'reason', 'extra'] }, fields }],
  })
  const field = (p: ProcessDecl, key: string) => {
    const r = resolveView(view, withTypes, [p])
    return { f: r.contract.actions[0]!.fields.find((x) => x.key === key), errors: r.diagnostics.filter((d) => d.severity === 'error') }
  }

  it('inherits the value type\'s constraints', () => {
    const { f, errors } = field(step({ reason: { type: 'text', label: 'Lý do', valueType: 'doanVan' }, extra: { type: 'number', label: 'Phí', valueType: 'soTien' } }), 'extra')
    expect(errors).toEqual([])
    expect(f!.constraints).toEqual({ minimum: 0, maximum: 10_000_000_000_000, multipleOf: 1 })
  })

  it('its own keyword narrows the value type', () => {
    const { f } = field(step({ reason: { type: 'text', label: 'Lý do', valueType: 'doanVan', maxLength: 300 }, extra: { type: 'number', label: 'x', valueType: 'soTien' } }), 'reason')
    expect(f!.constraints).toEqual({ maxLength: 300 })
  })

  it('an unknown name is an error, not an empty set', () => {
    const { errors } = field(step({ reason: { type: 'text', label: 'Lý do', valueType: 'doanvan' }, extra: { type: 'number', label: 'x', valueType: 'soTien' } }), 'reason')
    expect(errors.map((e) => e.code)).toContain('UNKNOWN_VALUE_TYPE')
  })

  it('a value type of another type is an error', () => {
    const { errors } = field(step({ reason: { type: 'text', label: 'Lý do', valueType: 'soTien' }, extra: { type: 'number', label: 'x', valueType: 'soTien' } }), 'reason')
    expect(errors.map((e) => e.code)).toContain('UNKNOWN_VALUE_TYPE')
  })
})
