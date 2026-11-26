// The fixture is a real screen from a shipped app (an equipment register in a
// government workflow), reduced to the parts that matter. Testing against a
// screen that actually exists is the point: the failures below are failures
// that happened, not failures that were imagined.

import { describe, it, expect } from 'vitest'
import { resolveView } from './resolve.js'
import type { ProcessDecl, ViewDecl, ViewOntologyDecl } from './types.js'

const ontology: ViewOntologyDecl = {
  entities: [
    {
      name: 'Equipment',
      label: 'Equipment',
      properties: [
        { name: 'equipmentName', type: 'text', required: true, description: 'Name — as written on the register' },
        { name: 'quantity', type: 'number', required: true, description: 'Quantity' },
        { name: 'condition', type: 'enum', enumValues: ['serviceable', 'needs_repair'], description: 'Technical condition' },
        { name: 'availability', type: 'enum', enumValues: ['available', 'committed'], description: 'Where it is' },
        { name: 'internalRef', type: 'uuid', description: 'Row identifier' },
      ],
      labels: {
        equipmentName: 'Name',
        quantity: 'Quantity',
        condition: 'Condition',
        availability: 'Location',
        internalRef: 'Internal reference',
      },
      values: {
        condition: [
          { value: 'serviceable', label: 'Serviceable', tone: 'done' },
          { value: 'needs_repair', label: 'Needs repair', tone: 'warn' },
        ],
        availability: [
          { value: 'available', label: 'Available', tone: 'done' },
          { value: 'committed', label: 'Committed', tone: 'doing' },
        ],
      },
      derived: [
        { name: 'unit', kind: 'linked', via: 'heldByUnit', show: 'unitName', label: 'Holding unit' },
        { name: 'caseCount', kind: 'countLinks', via: 'usedInCase', label: 'Times deployed' },
      ],
    },
    {
      name: 'Unit',
      label: 'Unit',
      labels: { unitName: 'Unit name' },
      properties: [{ name: 'unitName', type: 'text', required: true, description: 'Unit name' }],
    },
    {
      name: 'SignedDecision',
      label: 'Signed decision',
      labels: { decisionNumber: 'Decision number', signedDate: 'Date signed' },
      properties: [
        { name: 'decisionNumber', type: 'text', required: true, description: 'Decision number' },
        { name: 'signedDate', type: 'date', required: true, description: 'Date signed' },
      ],
    },
  ],
  relationships: [
    { name: 'heldByUnit', from: 'Equipment', to: 'Unit', cardinality: '1..N', directed: true },
    { name: 'usedInCase', from: 'Equipment', to: 'Unit', cardinality: 'N..N', directed: true },
    { name: 'authorisedBy', from: 'Equipment', to: 'SignedDecision', cardinality: '1..N', directed: true },
  ],
}

const process: ProcessDecl = {
  process: 'equipment',
  entity: 'Equipment',
  stateProperty: 'availability',
  roles: { storekeeper: 'ROLE-STORE' },
  states: [
    { name: 'available', label: 'Available' },
    { name: 'committed', label: 'Committed' },
  ],
  transitions: [
    {
      action: 'registerEquipment',
      label: 'Add to the register',
      from: [],
      to: 'available',
      role: 'storekeeper',
      source_ref: 'QĐ-03/2027 Art.2',
      params: { target: 'equipmentId', required: ['equipmentName', 'quantity', 'unitId'], optional: ['condition'] },
    },
    {
      action: 'sendToMaintenance',
      label: 'Send for repair',
      from: ['available'],
      to: 'committed',
      role: 'storekeeper',
      params: { target: 'equipmentId', required: ['equipmentId', 'reason'] },
      fields: { reason: { type: 'text', label: 'Reason' } },
    },
  ],
}

const view: ViewDecl = {
  entity: 'Equipment',
  sub: 'Register held by the local command',
  cluster: 'logistics',
  list: {
    columns: ['equipmentName', 'unit', 'quantity', 'condition', 'availability'],
    main: 'equipmentName',
    search: ['equipmentName'],
    sort: [{ by: 'equipmentName', collate: 'vi' }],
  },
  detail: { facts: ['equipmentName', 'quantity', 'condition', 'unit'] },
  row: { main: 'equipmentName', badge: 'condition' },
}

describe('resolveView — the happy path', () => {
  const { contract, diagnostics, ok } = resolveView(view, ontology, [process])

  it('resolves with no errors', () => {
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(ok).toBe(true)
  })

  it('takes the label from `labels`, not from the code name', () => {
    const col = contract.list!.columns.find((c) => c.key === 'equipmentName')!
    expect(col.label).toBe('Name')
  })

  it('carries enum wording so a screen never prints a machine code', () => {
    const condition = contract.list!.columns.find((c) => c.key === 'condition')!
    expect(condition.enum).toEqual([
      { value: 'serviceable', label: 'Serviceable', tone: 'done' },
      { value: 'needs_repair', label: 'Needs repair', tone: 'warn' },
    ])
  })

  it('says a value is a number, and leaves alignment to whoever draws it', () => {
    expect(contract.list!.columns.find((c) => c.key === 'quantity')!.numeric).toBe(true)
  })

  it('resolves a derived column and keeps how it was derived', () => {
    const unit = contract.list!.columns.find((c) => c.key === 'unit')!
    expect(unit.kind).toBe('derived')
    expect(unit.derived).toMatchObject({ kind: 'linked', via: 'heldByUnit', show: 'unitName' })
  })

  it('reads states and their tone from the process and the enum wording', () => {
    expect(contract.states).toEqual([
      { name: 'available', label: 'Available', tone: 'done' },
      { name: 'committed', label: 'Committed', tone: 'doing' },
    ])
  })

  // A state's operational meaning belongs beside the state, not in a UI file.
  it('carries a state hint through, so a legend need not keep its own copy', () => {
    const withHints: ProcessDecl = {
      ...process,
      states: [
        { name: 'available', label: 'Available', hint: 'ready to be committed' },
        { name: 'committed', label: 'Committed' },
      ],
    }
    const { contract: c } = resolveView(view, ontology, [withHints])
    expect(c.states).toEqual([
      { name: 'available', label: 'Available', hint: 'ready to be committed', tone: 'done' },
      { name: 'committed', label: 'Committed', tone: 'doing' },
    ])
  })
})

describe('resolveView — step forms', () => {
  const { contract } = resolveView(view, ontology, [process])
  const register = contract.actions.find((a) => a.action === 'registerEquipment')!

  it('builds the form from what the step already declares', () => {
    expect(register.fields.map((f) => f.key)).toEqual(['equipmentName', 'quantity', 'unitId', 'condition'])
  })

  it('drops the target id — it names the record, it is not a field to fill in', () => {
    const repair = contract.actions.find((a) => a.action === 'sendToMaintenance')!
    expect(repair.fields.map((f) => f.key)).toEqual(['reason'])
  })

  it('types a pointer parameter from the entity it points at', () => {
    expect(register.fields.find((f) => f.key === 'unitId')!.label).toBe('Unit')
  })

  it('resolves the role identifier, leaving the decision to the write gate', () => {
    expect(register.role).toBe('ROLE-STORE')
  })

  it('keeps the legal basis attached to the step', () => {
    expect(register.source_ref).toBe('QĐ-03/2027 Art.2')
  })

  it('types a free field from `fields`', () => {
    const repair = contract.actions.find((a) => a.action === 'sendToMaintenance')!
    expect(repair.fields[0]).toMatchObject({ key: 'reason', label: 'Reason', kind: 'text' })
  })


  it('carries type classes on a parameter that is a property of the entity', () => {
    const tagged: ViewOntologyDecl = {
      ...ontology,
      entities: ontology.entities.map((e) => e.name === 'Equipment'
        ? { ...e, typeClasses: { equipmentName: { multiline: true } } }
        : e),
    }
    const { contract: c } = resolveView(view, tagged, [process])
    const reg = c.actions.find((a) => a.action === 'registerEquipment')!
    expect(reg.fields.find((f) => f.key === 'equipmentName')!.typeClasses).toEqual({ multiline: true })
  })

  // ⛔ Found declaring a fourth entity: a free field holding a paragraph had
  //    nowhere to say so, and the resolver ACCEPTED the tag and dropped it.
  it('carries type classes on a free step field, and refuses keys it does not read', () => {
    const tagged: ProcessDecl = {
      ...process,
      transitions: [{
        ...process.transitions[1],
        fields: {
          reason: { type: 'text', label: 'Reason', typeClasses: { multiline: true } },
        },
      }],
    }
    const { contract: c, diagnostics } = resolveView(view, ontology, [tagged])
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(c.actions[0].fields[0].typeClasses).toEqual({ multiline: true })

    // A key the package does not read must be REPORTED. Accepting it silently is
    // the worst outcome: the author believes they said something, and did not.
    const bad: ProcessDecl = {
      ...process,
      transitions: [{
        ...process.transitions[1],
        fields: { reason: { type: 'text', label: 'Reason', rows: 4 } as never },
      }],
    }
    const out = resolveView(view, ontology, [bad])
    expect(out.diagnostics.some((d) => d.code === 'UNKNOWN_KEY' && d.message.includes('rows'))).toBe(true)
  })

  it('flags a parameter nothing can type, instead of guessing', () => {
    const bad: ProcessDecl = {
      ...process,
      transitions: [{ ...process.transitions[0], params: { required: ['mysteryValue'] } }],
    }
    const { diagnostics } = resolveView(view, ontology, [bad])
    expect(diagnostics.some((d) => d.code === 'UNTYPED_PARAM')).toBe(true)
  })

  // ⛔ Phát hiện khi chuyển chặng 3: nhánh `creates` trả về `kind` rồi dừng, nên
  //    một enum của bản ghi được tạo về tới hợp đồng KHÔNG có lựa chọn nào — một
  //    ô chọn rỗng, đúng kiểu, không dùng được. Hai nhánh phải trả cùng một thứ.
  it('carries enum wording and tags for a parameter of the record the step creates', () => {
    const creating: ProcessDecl = {
      ...process,
      transitions: [{
        ...process.transitions[0],
        creates: { entity: 'SignedDecision', via: 'authorisedBy' },
        params: { required: ['signedBy', 'note'] },
      }],
    }
    const withEnum: ViewOntologyDecl = {
      ...ontology,
      entities: ontology.entities.map((e) => e.name === 'SignedDecision'
        ? {
            ...e,
            properties: [...e.properties,
              { name: 'signedBy', type: 'enum' as const, enumValues: ['chairman', 'deputy'] },
              { name: 'note', type: 'text' as const }],
            labels: { ...e.labels, signedBy: 'Signed by', note: 'Note' },
            values: { signedBy: [
              { value: 'chairman', label: 'Chairman' },
              { value: 'deputy', label: 'Deputy' }] },
            typeClasses: { note: { multiline: true } },
          }
        : e),
    }
    const { contract: c, diagnostics } = resolveView(view, withEnum, [creating])
    const f = c.actions[0].fields
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(f.find((x) => x.key === 'signedBy')!.enum)
      .toEqual([{ value: 'chairman', label: 'Chairman' }, { value: 'deputy', label: 'Deputy' }])
    expect(f.find((x) => x.key === 'note')!.typeClasses).toEqual({ multiline: true })
  })

  // The runtime is a base for every domain, so the words on these two fields
  // are the app's: a step's `fields` label first, then the decision record's.
  it('lets the app name the decision fields', () => {
    const deciding = (fields?: Record<string, { label: string }>): ProcessDecl => ({
      ...process,
      transitions: [{
        ...process.transitions[0],
        creates: { entity: 'SignedDecision', via: 'authorisedBy' },
        decision: { by: 'outside' as const, via: 'authorisedBy', signedBy: 'client', legalBasis: ['clause 4', 'clause 7'] },
        params: { required: ['signedBy', 'legalBasis'] },
        ...(fields ? { fields } : {}),
      }],
    })
    const labelled: ViewOntologyDecl = {
      ...ontology,
      entities: ontology.entities.map((e) => e.name === 'SignedDecision'
        ? { ...e, labels: { ...e.labels, signedBy: 'Approved by', legalBasis: 'Contract clause' } }
        : e),
    }
    const field = (o: ViewOntologyDecl, p: ProcessDecl, key: string) =>
      resolveView(view, o, [p]).contract.actions[0].fields.find((x) => x.key === key)!

    expect(field(labelled, deciding(), 'signedBy')).toMatchObject({ label: 'Approved by', fixed: 'client' })
    expect(field(labelled, deciding(), 'legalBasis')).toMatchObject({ label: 'Contract clause', kind: 'enum' })
    expect(field(labelled, deciding({ signedBy: { label: 'Customer' } }), 'signedBy').label).toBe('Customer')
  })

  it('types a parameter belonging to the record the step creates', () => {
    const creating: ProcessDecl = {
      ...process,
      transitions: [{
        ...process.transitions[0],
        creates: { entity: 'SignedDecision', via: 'authorisedBy' },
        params: { required: ['decisionNumber', 'signedDate'] },
      }],
    }
    const { contract: c, diagnostics } = resolveView(view, ontology, [creating])
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(c.actions[0].fields.map((f) => f.kind)).toEqual(['text', 'date'])
  })
})

describe('resolveView — what it refuses to let through', () => {
  it('catches a column that names nothing', () => {
    const { diagnostics, ok } = resolveView({ ...view, list: { columns: ['nope'] } }, ontology, [process])
    expect(ok).toBe(false)
    expect(diagnostics[0]).toMatchObject({ code: 'UNKNOWN_FIELD', where: 'list.nope' })
  })

  it('catches an enum with no wording — the cause of machine codes on screen', () => {
    const bare: ViewOntologyDecl = {
      ...ontology,
      entities: ontology.entities.map((e) => (e.name === 'Equipment' ? { ...e, values: undefined } : e)),
    }
    const { diagnostics } = resolveView(view, bare, [process])
    expect(diagnostics.some((d) => d.code === 'ENUM_WITHOUT_LABELS')).toBe(true)
  })

  it('catches an enum value that gained a code but no wording', () => {
    const drifted: ViewOntologyDecl = {
      ...ontology,
      entities: ontology.entities.map((e) =>
        e.name === 'Equipment'
          ? {
              ...e,
              properties: e.properties.map((p) =>
                p.name === 'condition' ? { ...p, enumValues: ['serviceable', 'needs_repair', 'destroyed'] } : p),
            }
          : e),
    }
    const { diagnostics } = resolveView(view, drifted, [process])
    expect(diagnostics.some((d) => d.code === 'ENUM_VALUE_UNLABELLED')).toBe(true)
  })

  it('warns about wording left behind by a rename', () => {
    const stale: ViewOntologyDecl = {
      ...ontology,
      entities: ontology.entities.map((e) =>
        e.name === 'Equipment'
          ? { ...e, values: { ...e.values, condition: [...e.values!.condition, { value: 'gone', label: 'Gone' }] } }
          : e),
    }
    const { diagnostics } = resolveView(view, stale, [process])
    expect(diagnostics.some((d) => d.code === 'ENUM_LABEL_ORPHAN')).toBe(true)
  })

  it('catches a derived property following a relationship that does not exist', () => {
    const broken: ViewOntologyDecl = {
      ...ontology,
      entities: ontology.entities.map((e) =>
        e.name === 'Equipment'
          ? { ...e, derived: [{ name: 'unit', kind: 'linked', via: 'noSuchLink', show: 'unitName' }] }
          : e),
    }
    const { diagnostics } = resolveView(view, broken, [process])
    expect(diagnostics.some((d) => d.code === 'UNKNOWN_RELATIONSHIP')).toBe(true)
  })

  it('catches a derived property showing a field the far entity has not got', () => {
    const broken: ViewOntologyDecl = {
      ...ontology,
      entities: ontology.entities.map((e) =>
        e.name === 'Equipment'
          ? { ...e, derived: [{ name: 'unit', kind: 'linked', via: 'heldByUnit', show: 'nope' }] }
          : e),
    }
    const { diagnostics } = resolveView(view, broken, [process])
    expect(diagnostics.some((d) => d.code === 'UNKNOWN_TARGET_PROPERTY')).toBe(true)
  })

  it('catches a relationship that does not touch this entity at all', () => {
    const sideways: ViewOntologyDecl = {
      ...ontology,
      relationships: [...ontology.relationships,
        { name: 'elsewhere', from: 'Unit', to: 'SignedDecision', cardinality: '1..N', directed: true }],
      entities: ontology.entities.map((e) =>
        e.name === 'Equipment'
          ? { ...e, derived: [{ name: 'x', kind: 'countLinks', via: 'elsewhere' }] }
          : e),
    }
    const { diagnostics } = resolveView({ ...view, list: { columns: ['x'] } }, sideways, [process])
    expect(diagnostics.some((d) => d.code === 'RELATIONSHIP_WRONG_END')).toBe(true)
  })
})

describe('resolveView — bespoke blocks', () => {
  const opts = { slots: ['list.above', 'detail.after'], components: ['equipment-status'], maxWidgets: 2 }

  it('accepts a named slot holding a registered component', () => {
    const { ok } = resolveView({ ...view, widgets: { 'list.above': 'equipment-status' } }, ontology, [process], opts)
    expect(ok).toBe(true)
  })

  it('rejects a positional slot — the failure mode that rots silently', () => {
    const { diagnostics } = resolveView(
      { ...view, widgets: { 'list.children[2]': 'equipment-status' } }, ontology, [process], opts)
    expect(diagnostics.some((d) => d.code === 'POSITIONAL_SLOT')).toBe(true)
  })

  it('rejects a slot the renderer never published — otherwise the block just never appears', () => {
    const { diagnostics } = resolveView(
      { ...view, widgets: { 'list.abvoe': 'equipment-status' } }, ontology, [process], opts)
    expect(diagnostics.some((d) => d.code === 'UNKNOWN_WIDGET')).toBe(true)
  })

  it('rejects an unregistered component', () => {
    const { diagnostics } = resolveView(
      { ...view, widgets: { 'list.above': 'not-built-yet' } }, ontology, [process], opts)
    expect(diagnostics.some((d) => d.code === 'UNKNOWN_WIDGET')).toBe(true)
  })

  it('warns once an entity leans on the escape hatch too often', () => {
    const { diagnostics } = resolveView({
      ...view,
      widgets: {
        'cell.quantity': 'equipment-status',
        'cell.condition': 'claim-deadline',
        'cell.availability': 'two-consents',
      },
    }, ontology, [process],
    { ...opts, components: ['equipment-status', 'claim-deadline', 'two-consents'] })
    const d = diagnostics.find((x) => x.code === 'TOO_MANY_WIDGETS')
    expect(d?.message).toContain('bespoke cells')
  })

  // ⚠️ The correction: two slots naming ONE component is one bespoke thing,
  //    shared — not two things that fell off the lens. Counting declarations
  //    called the better arrangement worse.
  it('counts distinct components, not declarations pointing at them', () => {
    const { diagnostics } = resolveView({
      ...view,
      widgets: {
        'action.registerEquipment': 'equipment-status',
        'action.sendToMaintenance': 'equipment-status',
        'action.recordCondition': 'equipment-status',
      },
    }, ontology, [process], opts)
    expect(diagnostics.some((d) => d.code === 'TOO_MANY_WIDGETS')).toBe(false)
  })

  // ⚠️ The case that corrected the measure. A table entirely on the lens except
  //    one cell, plus two steps whose forms are hand-written, is a HEALTHY
  //    screen. The first version added the two kinds together and warned — and
  //    a warning that fires on healthy screens is one people learn to ignore.
  it('does not add up bespoke cells and bespoke step forms — they answer different questions', () => {
    const { diagnostics } = resolveView({
      ...view,
      widgets: {
        'cell.quantity': 'equipment-status',
        'action.registerEquipment': 'equipment-status',
        'action.sendToMaintenance': 'equipment-status',
      },
    }, ontology, [process], opts)
    expect(diagnostics.some((d) => d.code === 'TOO_MANY_WIDGETS')).toBe(false)
  })

  it('hands a step its bespoke form instead of a generated one', () => {
    const { contract } = resolveView(
      { ...view, widgets: { 'action.registerEquipment': 'equipment-status' } }, ontology, [process], opts)
    expect(contract.actions.find((a) => a.action === 'registerEquipment')!.widget).toBe('equipment-status')
  })
})

describe('resolveView — an unknown entity', () => {
  it('reports it and still returns a contract rather than throwing', () => {
    const { ok, contract, diagnostics } = resolveView({ ...view, entity: 'Ghost' }, ontology, [process])
    expect(ok).toBe(false)
    expect(diagnostics[0].code).toBe('UNKNOWN_ENTITY')
    expect(contract.entity).toBe('Ghost')
  })
})

describe('resolveView — labels and unrenderable types', () => {
  it('takes the label from `labels`, not from the documentation sentence', () => {
    const { contract } = resolveView(view, ontology, [process])
    expect(contract.list!.columns.find((c) => c.key === 'equipmentName')!.label).toBe('Name')
  })

  it('warns rather than inventing wording when a label is missing', () => {
    const bare: ViewOntologyDecl = {
      ...ontology,
      entities: ontology.entities.map((e) => (e.name === 'Equipment' ? { ...e, labels: undefined } : e)),
    }
    const { contract, diagnostics } = resolveView(view, bare, [process])
    expect(diagnostics.some((d) => d.code === 'MISSING_LABEL')).toBe(true)
    // still usable — a warning must never stop a screen from rendering
    expect(contract.list!.columns.find((c) => c.key === 'equipmentName')!.label).toBe('Equipment name')
  })

  it('refuses an identifier as a visible column', () => {
    const { diagnostics, ok } = resolveView(
      { ...view, list: { columns: ['internalRef'] } }, ontology, [process])
    expect(ok).toBe(false)
    expect(diagnostics.some((d) => d.code === 'UNRENDERABLE_FIELD')).toBe(true)
  })

  it('reports the type so a renderer can decide how to give it room', () => {
    const withList: ViewOntologyDecl = {
      ...ontology,
      entities: ontology.entities.map((e) =>
        e.name === 'Equipment'
          ? {
              ...e,
              labels: { ...e.labels, tags: 'Tags' },
              properties: [...e.properties, { name: 'tags', type: 'text[]' as const, description: 'Tags' }],
            }
          : e),
    }
    const { contract } = resolveView({ ...view, list: { columns: ['tags'] } }, withList, [process])
    expect(contract.list!.columns[0].kind).toBe('text[]')
  })
})

describe('resolveView — list.main and list.sub', () => {
  it('resolves them into fields, not names', () => {
    const { contract } = resolveView(view, ontology, [process])
    expect(contract.list!.main).toMatchObject({ key: 'equipmentName', label: 'Name' })
  })

  it('resolves a subtitle field the table does not show as its own column', () => {
    // The normal case: a type shown UNDER the name, not beside it.
    const withSub: ViewDecl = { ...view, list: { ...view.list!, sub: 'condition' } }
    const { contract, diagnostics } = resolveView(withSub, ontology, [process])
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(contract.list!.sub).toMatchObject({ key: 'condition' })
    expect(contract.list!.sub!.enum).toBeDefined()
  })

  it('reports a main that names nothing', () => {
    const { diagnostics } = resolveView(
      { ...view, list: { ...view.list!, main: 'nope' } }, ontology, [process])
    expect(diagnostics.some((d) => d.code === 'UNKNOWN_FIELD' && d.where === 'list.main')).toBe(true)
  })
})

describe('resolveView — bespoke cells and what a number means', () => {
  const money: ViewOntologyDecl = {
    ...ontology,
    entities: ontology.entities.map((e) =>
      e.name === 'Equipment'
        ? {
            ...e,
            labels: { ...e.labels, amount: 'Amount', dueDate: 'Deadline' },
            meanings: { amount: 'currency' as const },
            properties: [...e.properties,
              { name: 'amount', type: 'number' as const },
              { name: 'dueDate', type: 'date' as const }],
          }
        : e),
  }

  it('says a number is money, so one screen cannot print 1500000 at an accountant', () => {
    const { contract } = resolveView({ ...view, list: { columns: ['amount'] } }, money, [process])
    // Normalised to the full shape: a renderer handles one form, not two.
    expect(contract.list!.columns[0]).toMatchObject({
      key: 'amount', meaning: 'currency', numeric: true,
    })
  })


  // ── Borrowed ahead of implementation ─────────────────────────────────────
  //
  // The vocabulary carries words the resolver does not read yet. The contract
  // these tests pin down is: SAYING SO, never silence. A declaration that leans
  // on an unimplemented word must fail the build, because the alternative is a
  // screen that looks declared-correct and renders wrong.

  it('refuses an aggregate it cannot compute yet, instead of rendering a blank', () => {
    const stock = {
      ...money,
      entities: money.entities.map((e) => e.name === 'Equipment'
        ? { ...e, derived: [{ name: 'onHand', kind: 'aggregate' as const, fn: 'sum' as const,
                              via: 'usedInCase', of: 'quantity', label: 'On hand' }] }
        : e),
    }
    const { diagnostics } = resolveView({ ...view, list: { columns: ['onHand'] } }, stock, [process])
    const d = diagnostics.find((x) => x.code === 'NOT_YET_RESOLVED')
    expect(d?.severity).toBe('error')
    expect(d?.message).toContain('sum')
  })

  it('still checks the operands of arithmetic it cannot compute yet', () => {
    const budget = {
      ...money,
      entities: money.entities.map((e) => e.name === 'Equipment'
        ? { ...e, derived: [{ name: 'left', kind: 'math' as const, op: '-' as const,
                              of: ['amount', 'noSuchField'], label: 'Remaining' }] }
        : e),
    }
    const { diagnostics } = resolveView({ ...view, list: { columns: ['left'] } }, budget, [process])
    // Unresolved is not unchecked — the misspelling is caught now, not in a year.
    expect(diagnostics.some((d) => d.code === 'NOT_YET_RESOLVED')).toBe(true)
    expect(diagnostics.some((d) => d.code === 'UNKNOWN_FIELD' && d.message.includes('noSuchField'))).toBe(true)
  })

  // The two shapes below are transcribed from real entity designs, and they are
  // why `math` is n-ary. The first version of the type was binary — it would
  // have covered neither.
  it('checks arithmetic over three operands, and arithmetic nested inside it', () => {
    const cases = [
      // a per-day rate × headcount × days
      { name: 'est', kind: 'math' as const, op: '*' as const, of: ['amount', 'quantity', 'noSuchField'] },
      // a budget less two separate deductions, written as a nested subtraction
      { name: 'est', kind: 'math' as const, op: '-' as const,
        of: ['amount', { op: '+' as const, of: ['quantity', 'noSuchField'] }] },
    ]
    for (const m of cases) {
      const { diagnostics } = resolveView(
        { ...view, list: { columns: ['est'] } },
        { ...money, entities: money.entities.map((e) => e.name === 'Equipment'
          ? { ...e, derived: [...(e.derived ?? []), m] } : e) },
        [process])
      // Reaches the misspelling wherever it sits in the tree.
      expect(diagnostics.some((d) => d.code === 'UNKNOWN_FIELD' && d.message.includes('noSuchField'))).toBe(true)
    }
  })

  it('refuses an operator given only one thing to operate on', () => {
    const { diagnostics } = resolveView(
      { ...view, list: { columns: ['half'] } },
      { ...money, entities: money.entities.map((e) => e.name === 'Equipment'
        ? { ...e, derived: [{ name: 'half', kind: 'math' as const, op: '/' as const, of: ['amount'] }] } : e) },
      [process])
    expect(diagnostics.some((d) => d.message.includes('fewer than two operands'))).toBe(true)
  })

  it('counts links under either spelling, old or new', () => {
    const build = (derived: object) => resolveView(
      { ...view, list: { columns: ['howMany'] } },
      { ...money, entities: money.entities.map((e) => e.name === 'Equipment'
        ? { ...e, derived: [...(e.derived ?? []), derived as NonNullable<typeof e.derived>[number]] } : e) },
      [process])

    const legacy = build({ name: 'howMany', kind: 'countLinks', via: 'usedInCase', label: 'Count' })
    const modern = build({ name: 'howMany', kind: 'aggregate', fn: 'count', via: 'usedInCase', label: 'Count' })

    for (const r of [legacy, modern]) {
      expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
      expect(r.contract.list!.columns[0]).toMatchObject({ key: 'howMany', kind: 'derived', numeric: true })
    }
  })

  it('reports property metadata it has borrowed but not yet implemented', () => {
    const marked = {
      ...money,
      entities: money.entities.map((e) => e.name === 'Equipment'
        ? { ...e, status: { amount: 'deprecated' as const } }
        : e),
    }
    const { diagnostics } = resolveView({ ...view, list: { columns: ['amount'] } }, marked, [process])
    const d = diagnostics.find((x) => x.code === 'NOT_YET_RESOLVED')
    expect(d?.severity).toBe('error')
    expect(d?.message).toContain('amount')
  })

  it('names a bespoke component for one cell, leaving the rest of the table on the lens', () => {
    const { contract, diagnostics } = resolveView(
      { ...view, list: { columns: ['equipmentName', 'dueDate'] }, widgets: { 'cell.dueDate': 'claim-deadline' } },
      money, [process], { slots: ['list.above'], components: ['claim-deadline'] })
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(contract.list!.columns.find((c) => c.key === 'dueDate')!.widget).toBe('claim-deadline')
    // the other column is untouched — that is the whole point of a per-cell hatch
    expect(contract.list!.columns.find((c) => c.key === 'equipmentName')!.widget).toBeUndefined()
  })

  it('still refuses a cell component the renderer cannot resolve', () => {
    const { diagnostics } = resolveView(
      { ...view, widgets: { 'cell.quantity': 'nope' } }, money, [process],
      { slots: ['list.above'], components: ['claim-deadline'] })
    expect(diagnostics.some((d) => d.code === 'UNKNOWN_WIDGET')).toBe(true)
  })
})

// ── Visibility and keys ─────────────────────────────────────────────────────
//
// The point of these two: "which columns are worth showing" and "which property
// names the record" are facts about the PROPERTY. Three screens over one entity
// used to restate them three times and drift. Here the view says nothing and
// gets the right answer.

describe('resolveView — the ontology answers what the view used to repeat', () => {
  const marked: ViewOntologyDecl = {
    ...ontology,
    entities: ontology.entities.map((e) => e.name === 'Equipment'
      ? {
          ...e,
          keys: { equipmentName: 'title' as const, internalRef: 'primary' as const },
          visibility: {
            equipmentName: 'prominent' as const,
            // A DERIVED column, second — the position it actually wants. Any
            // rule of "stored properties first" would push it to the end.
            unit: 'prominent' as const,
            quantity: 'prominent' as const,
            condition: 'prominent' as const,
            availability: 'normal' as const,
            internalRef: 'hidden' as const,
          },
        }
      : e),
  }

  it('builds the columns from the ontology when the view names none', () => {
    const { contract, diagnostics } = resolveView({ entity: 'Equipment', list: {} }, marked, [process])
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(contract.list!.columns.map((c) => c.key)).toEqual(['equipmentName', 'unit', 'quantity', 'condition'])
  })

  it('takes the identity cell from the title key, in a list and in a queue row', () => {
    const { contract } = resolveView({ entity: 'Equipment', list: {}, row: {} }, marked, [process])
    expect(contract.list!.main!.key).toBe('equipmentName')
    expect(contract.row!.main.key).toBe('equipmentName')
  })

  it('still lets a view override both — the ontology is the default, not a rule', () => {
    const { contract, diagnostics } = resolveView(
      { entity: 'Equipment', list: { columns: ['quantity'], main: 'quantity' } }, marked, [process])
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(contract.list!.columns.map((c) => c.key)).toEqual(['quantity'])
    expect(contract.list!.main!.key).toBe('quantity')
  })

  it('says so when a view shows a property the ontology marks hidden', () => {
    const { contract, diagnostics } = resolveView(
      { entity: 'Equipment', list: { columns: ['equipmentName', 'internalRef'] } }, marked, [process])
    // ⚠️ A warning, not a refusal — and NOT because hiding is a permission.
    //    `hidden` keeps a property off the default set; it never controls access.
    //    Overriding it is allowed. Doing it by accident is what this catches.
    expect(diagnostics.some((d) => d.code === 'HIDDEN_SHOWN')).toBe(true)
    expect(contract.list!.columns.map((c) => c.key)).toContain('internalRef')
  })

  it('refuses a list that would render with no columns at all', () => {
    const { diagnostics } = resolveView({ entity: 'Equipment', list: {} }, ontology, [process])
    expect(diagnostics.some((d) => d.code === 'NO_COLUMNS' && d.severity === 'error')).toBe(true)
  })

  it('refuses a queue row with no way to name the record', () => {
    const { diagnostics } = resolveView({ entity: 'Equipment', row: {} }, ontology, [process])
    expect(diagnostics.some((d) => d.code === 'NO_TITLE_KEY' && d.severity === 'error')).toBe(true)
  })

  it('refuses two properties both claiming to be the record name', () => {
    const twoNames = {
      ...ontology,
      entities: ontology.entities.map((e) => e.name === 'Equipment'
        ? { ...e, keys: { equipmentName: 'title' as const, condition: 'title' as const } }
        : e),
    }
    const { diagnostics } = resolveView({ entity: 'Equipment', row: {} }, twoNames, [process])
    expect(diagnostics.some((d) => d.code === 'AMBIGUOUS_TITLE_KEY')).toBe(true)
  })

  it('catches a key naming a property the entity does not have', () => {
    const wrong = {
      ...ontology,
      entities: ontology.entities.map((e) => e.name === 'Equipment'
        ? { ...e, keys: { noSuchProp: 'title' as const } }
        : e),
    }
    const { diagnostics } = resolveView({ entity: 'Equipment', list: { columns: ['quantity'] } }, wrong, [process])
    expect(diagnostics.some((d) => d.code === 'UNKNOWN_FIELD' && d.message.includes('noSuchProp'))).toBe(true)
  })
})

describe('resolveView — virtual columns', () => {
  const opts = { slots: ['list.above'], components: ['two-consents'] }

  it('accepts a column that is a judgement, not a value', () => {
    // Two separate approvals shown side by side, where the absence of one after
    // a given step is itself the finding. No property to point at.
    const { contract, diagnostics } = resolveView({
      ...view,
      list: { columns: ['equipmentName', { name: 'consent', label: 'Approval', widget: 'two-consents' }] },
    }, ontology, [process], opts)
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(contract.list!.columns[1]).toMatchObject({ key: 'consent', label: 'Approval', widget: 'two-consents' })
  })

  it('refuses a virtual column whose component is not registered', () => {
    const { diagnostics } = resolveView({
      ...view,
      list: { columns: [{ name: 'consent', label: 'Approval', widget: 'nope' }] },
    }, ontology, [process], opts)
    expect(diagnostics.some((d) => d.code === 'UNKNOWN_WIDGET')).toBe(true)
  })
})

describe('resolveView — where the app takes over', () => {
  // Three points, and the kernel only ever checks that the name exists. It does
  // not call them, does not know what they compute, never sees a result. That
  // boundary is the reason they can hold domain logic at all.
  const opts = {
    slots: ['list.above'],
    components: ['equipment-status'],
    data: ['overdue-counts'],
    hooks: ['reload-summary'],
  }

  it('carries app-supplied data by name', () => {
    const { contract, diagnostics } = resolveView(
      { ...view, uses: ['overdue-counts'] }, ontology, [process], opts)
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(contract.uses).toEqual(['overdue-counts'])
  })

  it('refuses data the app does not supply — a blank number is worse than a stop', () => {
    const { diagnostics } = resolveView(
      { ...view, uses: ['never-computed'] }, ontology, [process], opts)
    expect(diagnostics.some((d) => d.code === 'UNKNOWN_DATA')).toBe(true)
  })

  it('carries an after-step callback', () => {
    const { contract, diagnostics } = resolveView(
      { ...view, hooks: { 'after.registerEquipment': 'reload-summary' } }, ontology, [process], opts)
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(contract.hooks).toEqual({ 'after.registerEquipment': 'reload-summary' })
  })

  it('refuses a callback on a step this entity has no transition for', () => {
    const { diagnostics } = resolveView(
      { ...view, hooks: { 'after.noSuchStep': 'reload-summary' } }, ontology, [process], opts)
    expect(diagnostics.some((d) => d.code === 'UNKNOWN_HOOK')).toBe(true)
  })

  it('refuses a hook the app has not registered', () => {
    const { diagnostics } = resolveView(
      { ...view, hooks: { 'after.registerEquipment': 'nope' } }, ontology, [process], opts)
    expect(diagnostics.some((d) => d.code === 'UNKNOWN_HOOK')).toBe(true)
  })

  it('refuses a hook that is not addressed as after.<step>', () => {
    const { diagnostics } = resolveView(
      { ...view, hooks: { whenever: 'reload-summary' } }, ontology, [process], opts)
    expect(diagnostics.some((d) => d.code === 'UNKNOWN_HOOK')).toBe(true)
  })
})

describe('resolveView — a `fields` entry that only renames', () => {
  /* ⛔ Measured 1/10/2026 on a real app: three enum properties of the record a
     step CREATES, given only a label at the step, reached the contract with no
     kind and no choices — the label-only entry shadowed the typed property. */
  const withRequest: ViewOntologyDecl = {
    ...ontology,
    entities: [...ontology.entities, {
      name: 'RepairRequest', label: 'Repair request',
      properties: [{ name: 'ground', type: 'enum', enumValues: ['wear', 'damage'], description: 'Ground' }],
      values: { ground: [{ value: 'wear', label: 'Wear' }, { value: 'damage', label: 'Damage' }] },
    }],
    relationships: [...ontology.relationships, { name: 'requestFor', from: 'Equipment', to: 'RepairRequest', cardinality: '1..N', directed: true }],
  }
  const step = (fields: Record<string, { label: string }>, names: string[]): ProcessDecl => ({
    ...process,
    transitions: [{
      ...process.transitions[1],
      creates: { entity: 'RepairRequest', via: 'requestFor' },
      params: { target: 'equipmentId', required: names },
      fields,
    }],
  })

  it('keeps the type and choices of a created record\'s property, and takes the label', () => {
    const { contract, diagnostics } = resolveView(view, withRequest, [step({ ground: { label: 'Căn cứ' } }, ['ground'])])
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(contract.actions[0].fields[0]).toMatchObject({
      key: 'ground', label: 'Căn cứ', kind: 'enum', required: true,
      enum: [{ value: 'wear', label: 'Wear' }, { value: 'damage', label: 'Damage' }],
    })
  })

  it('renames a property of the entity itself instead of ignoring the label', () => {
    const { contract } = resolveView(view, withRequest, [step({ condition: { label: 'Tình trạng' } }, ['condition'])])
    expect(contract.actions[0].fields[0]).toMatchObject({ key: 'condition', label: 'Tình trạng', kind: 'enum' })
    expect(contract.actions[0].fields[0].enum?.length).toBe(2)
  })

  it('renames an inferred pointer, keeping what it points at', () => {
    const { contract } = resolveView(view, withRequest, [step({ unitId: { label: 'Đơn vị nhận' } }, ['unitId'])])
    expect(contract.actions[0].fields[0]).toMatchObject({ key: 'unitId', label: 'Đơn vị nhận', refEntity: 'Unit' })
  })

  it('still refuses a label-only entry for a name nothing types, and says what is missing', () => {
    const { diagnostics } = resolveView(view, withRequest, [step({ note: { label: 'Ghi chú' } }, ['note'])])
    const d = diagnostics.find((x) => x.code === 'UNTYPED_PARAM')!
    expect(d.message).toContain('only a label')
  })
})

describe('resolveView — pointer parameters', () => {
  it('says WHICH entity a pointer points at, so a generated form can fill the picker', () => {
    const { contract } = resolveView(view, ontology, [process])
    const unitId = contract.actions[0].fields.find((f) => f.key === 'unitId')!
    expect(unitId).toMatchObject({ refEntity: 'Unit', label: 'Unit' })
    expect(unitId.many).toBeUndefined()
  })

  it('marks a many-valued pointer', () => {
    const many: ProcessDecl = {
      ...process,
      transitions: [{ ...process.transitions[0], params: { required: ['unitIds'] } }],
    }
    const { contract } = resolveView(view, ontology, [many])
    expect(contract.actions[0].fields[0]).toMatchObject({ refEntity: 'Unit', many: true })
  })

  /* ⛔ The guess used to take the FIRST entity whose name contained the stem, so
     reordering `entities` silently re-pointed fields (1/10/2026: 22/113 on a real
     app after splitting its ontology into files). */
  const crowded: ViewOntologyDecl = {
    ...ontology,
    entities: [
      ...ontology.entities,
      { name: 'StaffMember', label: 'Member', properties: [] },
      { name: 'MemberBadge', label: 'Badge', properties: [] },
      { name: 'StaffUnit', label: 'StaffUnit', properties: [] },
      { name: 'AdministrativeUnit', label: 'Admin unit', properties: [] },
      { name: 'UnitTransfer', label: 'Transfer', properties: [] },
    ],
    relationships: [
      ...ontology.relationships,
      { name: 'wornBy', from: 'Equipment', to: 'StaffMember', cardinality: '1..N', directed: true },
    ],
  }
  const stepTaking = (...names: string[]): ProcessDecl => ({
    ...process,
    transitions: [{ ...process.transitions[0], params: { required: names } }],
  })
  const refsOf = (o: ViewOntologyDecl, p: ProcessDecl) =>
    Object.fromEntries(resolveView(view, o, [p]).contract.actions[0].fields.map((f) => [f.key, f.refEntity]))

  it('gives the same answer whatever order the entities are declared in', () => {
    const p = stepTaking('unitId', 'memberIds')
    const want = refsOf(crowded, p)
    expect(want).toEqual({ unitId: 'Unit', memberIds: undefined })
    for (let i = 0; i < 20; i++) {
      const shuffled = [...crowded.entities].sort(() => Math.random() - 0.5)
      expect(refsOf({ ...crowded, entities: shuffled }, p)).toEqual(want)
      expect(refsOf({ ...crowded, entities: [...crowded.entities].reverse() }, p)).toEqual(want)
    }
  })

  /* ⛔ No cleverer guess: a relationship or a head noun narrowing the list is
     still a guess, and on a real app it re-pointed 19 fields silently. */
  it('refuses even when only one candidate is linked by a relationship', () => {
    const { diagnostics } = resolveView(view, crowded, [stepTaking('memberId')])
    const d = diagnostics.find((x) => x.code === 'AMBIGUOUS_POINTER')!
    expect(d.message).toContain('MemberBadge, StaffMember')
  })

  it('refuses to guess between several candidates, and says how to choose', () => {
    const o = { ...crowded, entities: crowded.entities.filter((e) => e.name !== 'Unit') }
    const { contract, diagnostics } = resolveView(view, o, [stepTaking('unitId')])
    const d = diagnostics.find((x) => x.code === 'AMBIGUOUS_POINTER')!
    expect(d.severity).toBe('error')
    expect(d.message).toContain('AdministrativeUnit, StaffUnit, UnitTransfer')
    expect(d.message).toContain('ref:')
    expect(contract.actions[0].fields[0].refEntity).toBeUndefined()
  })

  it('takes an explicit `ref`, keeping the picker and many', () => {
    const o = { ...crowded, entities: crowded.entities.filter((e) => e.name !== 'Unit') }
    const p: ProcessDecl = {
      ...process,
      transitions: [{
        ...process.transitions[0],
        params: { required: ['unitIds', 'chiefId'] },
        fields: { unitIds: { ref: 'StaffUnit' }, chiefId: { ref: 'StaffMember', label: 'Chief' } },
      }],
    }
    const { contract, diagnostics } = resolveView(view, o, [p])
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(contract.actions[0].fields).toEqual([
      expect.objectContaining({ key: 'unitIds', refEntity: 'StaffUnit', many: true, label: 'StaffUnit', required: true }),
      expect.objectContaining({ key: 'chiefId', refEntity: 'StaffMember', label: 'Chief' }),
    ])
    expect(contract.actions[0].fields[1].many).toBeUndefined()
  })

  it('refuses a `ref` to an entity that does not exist, and keys that do not apply', () => {
    const p: ProcessDecl = {
      ...process,
      transitions: [{
        ...process.transitions[0],
        params: { required: ['xId', 'yId'] },
        fields: { xId: { ref: 'Nope' }, yId: { ref: 'Unit', type: 'text' } },
      }],
    }
    const { diagnostics } = resolveView(view, ontology, [p])
    expect(diagnostics.some((d) => d.code === 'UNKNOWN_ENTITY' && d.message.includes('Nope'))).toBe(true)
    expect(diagnostics.some((d) => d.code === 'UNKNOWN_KEY' && d.message.includes('"type"'))).toBe(true)
  })
})


describe('what the contract had been dropping', () => {
  /* ⛔ Both of these were declared in real processes and carried nowhere. One
     application grafted `provisional` back on by hand after every load; the
     other gap left renderers guessing which step was the approval. */
  const proc = {
    process: 'p', entity: 'E', stateProperty: 'status',
    roles: { clerk: 'AC-1' },
    states: [{ name: 'NEW', label: 'Mới' }, { name: 'OK', label: 'Xong' }],
    transitions: [
      {
        action: 'approve', label: 'Phê duyệt', from: ['NEW'], to: 'OK', role: 'clerk',
        decision: { outcome: 'approve' as const },
      },
      {
        action: 'reject', label: 'Trả về', from: ['NEW'], to: 'NEW', role: 'clerk',
        decision: { outcome: 'reject' as const },
      },
      {
        action: 'shrug', label: 'Ghi nhận', from: ['NEW'], role: 'clerk',
        provisional: 'Chưa có văn bản hướng dẫn cho bước này',
      },
    ],
  }
  const ontology = {
    entities: [{ name: 'E', properties: [{ name: 'status', type: 'enum' as const, enumValues: ['NEW', 'OK'] }],
      values: { status: [{ value: 'NEW', label: 'Mới' }, { value: 'OK', label: 'Xong' }] } }],
    relationships: [],
  }

  it('carries `decision.outcome`, so nobody has to read it off a button label', () => {
    const { contract } = resolveView({ entity: 'E' }, ontology as never, [proc] as never)
    const by = Object.fromEntries(contract.actions.map((a) => [a.action, a.outcome]))
    expect(by).toEqual({ approve: 'approve', reject: 'reject', shrug: undefined })
  })

  it('carries `provisional`, so a warning in a YAML file can reach a screen', () => {
    const { contract } = resolveView({ entity: 'E' }, ontology as never, [proc] as never)
    expect(contract.actions.find((a) => a.action === 'shrug')?.provisional)
      .toContain('Chưa có văn bản')
  })
})

/*
  ═══════════════════════════════════════════════════════════════════════════
  WHAT A STEP IS WAITING FOR, AND WHICH LINE IT BELONGS TO.

  Both were declared, both were dropped, and the application had built a reader
  of its own for each — re-parsing the same YAML this resolver had just read.
  The tests below are written against the shapes that made those grafts
  necessary, not against invented ones.
  ═══════════════════════════════════════════════════════════════════════════
*/
describe('gates and lines', () => {
  const gated = {
    process: 'training',
    entity: 'Plan',
    stateProperty: 'status',
    roles: { clerk: 'ROLE-ADMIN', chief: 'ROLE-HEAD', province: 'ROLE-BRANCH' },
    states: [
      { name: 'DRAFT', label: 'Bản nháp' },
      { name: 'SUBMITTED', label: 'Đã trình cấp trên' },
      { name: 'INVITED', label: 'Đã mời' },
    ],
    transitions: [
      { action: 'draft', label: 'Lập kế hoạch', from: [], to: 'DRAFT', role: 'clerk' },
      { action: 'submit', label: 'Trình cấp trên', from: ['DRAFT'], to: 'SUBMITTED', role: 'chief' },
      /* The step that opens the gate — and, note, `to` is absent. The superior
         records a verdict without touching the subordinate's record. */
      {
        action: 'approve', label: 'Phê duyệt kế hoạch', from: ['SUBMITTED'], role: 'province',
        decision: { by: 'inside' as const, via: 'planApproval', outcome: 'approve' as const },
      },
      {
        action: 'returnPlan', label: 'Trả lại để bổ sung', from: ['SUBMITTED'], role: 'province',
        decision: { by: 'inside' as const, via: 'planApproval', outcome: 'reject' as const },
      },
      /* …and the step that waits on it. */
      {
        action: 'invite', label: 'Mời tham gia', from: ['SUBMITTED'], to: 'INVITED', role: 'clerk',
        needsDecision: { via: 'planApproval', is: 'approve' as const },
      },
      {
        action: 'fourFamilies', label: 'Bốn họ cùng lúc', from: ['INVITED'], role: 'clerk',
        needsDecision: { via: 'planApproval' },
        requiresApproval: { relationship: 'ministryNod', decision: 'APPROVED' },
        requiresFact: { property: 'invitedAt', message: 'Chưa mời thì chưa có nhân lực' },
        requiresLink: { relationship: 'invites', message: 'Chưa ai được gọi' },
      },
    ],
  }
  const ont = {
    entities: [{
      name: 'Plan',
      properties: [{ name: 'status', type: 'enum' as const, enumValues: ['DRAFT', 'SUBMITTED', 'INVITED', 'CO_SIGNED'] }],
      values: { status: [{ value: 'DRAFT', label: 'Bản nháp', tone: 'wait' as const }] },
    }],
    relationships: [],
  }
  const resolve = (procs: unknown[]) => resolveView({ entity: 'Plan' }, ont as never, procs as never).contract

  it('folds all four gate families into `waitsOn`, in the order they were declared', () => {
    const a = resolve([gated]).actions.find((x) => x.action === 'fourFamilies')!
    expect(a.waitsOn).toEqual([
      { kind: 'decision', via: 'planApproval' },
      { kind: 'decision', via: 'ministryNod', is: 'APPROVED' },
      { kind: 'fact', via: 'invitedAt', message: 'Chưa mời thì chưa có nhân lực' },
      { kind: 'link', via: 'invites', message: 'Chưa ai được gọi' },
    ])
  })

  /* ⚠️ The engine accepts `via` OR `relationship` on a link gate and both are in
     use. Reading one and ignoring the other drops half of them in silence —
     which is the class of bug `waitsOn` exists to end, so it must not be the
     bug `waitsOn` ships with. */
  it('reads a link gate under either spelling', () => {
    const oneStep = (requiresLink: Record<string, string>) => resolve([{
      ...gated,
      transitions: [{ action: 'x', label: 'X', from: ['DRAFT'], role: 'clerk', requiresLink }],
    }]).actions[0]!.waitsOn

    const expected = [{ kind: 'link', via: 'invites', message: 'Chưa ai được gọi' }]
    /* ⛔ BOTH, and separately. Asserting only the spelling the resolver happens
       to read first is how a test named for two cases passes while one of them
       is silently dropped — which is what this test did on its first writing. */
    expect(oneStep({ via: 'invites', message: 'Chưa ai được gọi' })).toEqual(expected)
    expect(oneStep({ relationship: 'invites', message: 'Chưa ai được gọi' })).toEqual(expected)
  })

  it('carries `settles`, so the wait can be paired with the step that ends it', () => {
    const actions = resolve([gated]).actions
    const approve = actions.find((a) => a.action === 'approve')!
    const invite = actions.find((a) => a.action === 'invite')!

    expect(approve.settles).toBe('planApproval')
    expect(approve.outcome).toBe('approve')
    expect(invite.waitsOn?.[0]).toEqual({ kind: 'decision', via: 'planApproval', is: 'approve' })

    /* The pairing a renderer can now make, and could not before: the wait is
       named with the granting step's own declared label. No word is invented. */
    const opener = actions.find((a) => a.settles === invite.waitsOn![0]!.via && a.outcome === 'approve')
    expect(opener?.label).toBe('Phê duyệt kế hoạch')
    /* ⛔ And the reason a state-shaped screen could never show it: the opener
       does not move the record. Before and after, the plan reads SUBMITTED. */
    expect(opener?.to).toBeUndefined()
  })

  it('leaves `waitsOn` and `settles` off a step that declared neither', () => {
    const submit = resolve([gated]).actions.find((a) => a.action === 'submit')!
    expect(submit.waitsOn).toBeUndefined()
    expect(submit.settles).toBeUndefined()
  })

  it('stamps every step with the line it came from', () => {
    expect(resolve([gated]).actions.every((a) => a.process === 'training')).toBe(true)
  })

  /* ⛔ THE FOUR-LINE ENTITY. Two lines, one state each that the other has not
     got. `mine[0]` alone loses one of them, and losing it is what put
     "unknown state: CO_SIGNED" in front of an officer. */
  describe('an entity that runs more than one line', () => {
    const communeLine = {
      ...gated,
      process: 'planCommune',
      states: [{ name: 'DRAFT', label: 'Bản nháp' }, { name: 'CO_SIGNED', label: 'Đã ký liên tịch' }],
      transitions: [{ action: 'coSign', label: 'Ký liên tịch', from: ['DRAFT'], to: 'CO_SIGNED', role: 'chief' }],
    }

    it('unions `states` across lines, so no line loses its own', () => {
      const names = resolve([gated, communeLine]).states!.map((s) => s.name)
      expect(names).toContain('INVITED')
      expect(names).toContain('CO_SIGNED')
      expect(new Set(names).size).toBe(names.length)
    })

    it('keeps each line whole in `lines`, in declared order', () => {
      const lines = resolve([gated, communeLine]).lines!
      expect(lines.map((l) => l.process)).toEqual(['training', 'planCommune'])
      expect(lines[0]!.states.map((s) => s.name)).toEqual(['DRAFT', 'SUBMITTED', 'INVITED'])
      expect(lines[1]!.states.map((s) => s.name)).toEqual(['DRAFT', 'CO_SIGNED'])
    })

    /* ⚠️ The union is for LOOKING A STATE UP. It cannot carry a route, and this
       is the measurement that says so: read end to end it claims the plan goes
       INVITED → CO_SIGNED, an order neither line declares. */
    it('gives a single line its own states, once the steps are filtered by line', () => {
      const c = resolve([gated, communeLine])
      const commune = c.lines!.find((l) => l.process === 'planCommune')!
      expect(commune.states.map((s) => s.name)).toEqual(['DRAFT', 'CO_SIGNED'])
      expect(c.actions.filter((a) => a.process === 'planCommune').map((a) => a.action)).toEqual(['coSign'])
    })
  })
})

describe('resolveView — the task model: carried as declared, every name checked, nothing guessed', () => {
  const withTask = (task: Record<string, unknown>, extra: Partial<ProcessDecl> = {}): ProcessDecl => ({
    ...process,
    ...extra,
    transitions: process.transitions.map((t) => (t.action === 'registerEquipment' ? { ...t, task } as typeof t : t)),
  })
  const complete = {
    category: 'interaction', iteration: 'single', reads: [],
    filledBy: { equipmentName: 'interaction', quantity: 'interaction', unitId: 'suggested', condition: 'interaction' },
  }

  it('changes nothing for a process that declares no task', () => {
    const { contract } = resolveView(view, ontology, [process])
    expect(contract.actions.some((a) => 'task' in a)).toBe(false)
    expect(contract.lines?.[0] && 'readers' in contract.lines[0]).toBe(false)
  })

  it('carries a complete task onto the action, and readers onto the line as real role codes', () => {
    const { contract, diagnostics } = resolveView(view, ontology, [withTask(complete, { readers: { committed: ['storekeeper'], available: [] } })])
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(contract.actions.find((a) => a.action === 'registerEquipment')?.task).toEqual(complete)
    expect(contract.lines?.[0]?.readers).toEqual({ committed: ['ROLE-STORE'], available: [] })
  })

  it('reports, through the vocabulary owner, a typed field the step does not take', () => {
    const { diagnostics } = resolveView(view, ontology, [withTask({ ...complete, filledBy: { ...complete.filledBy, serial: 'interaction' } })])
    const d = diagnostics.filter((x) => x.code === 'TASK_SHAPE')
    expect(d).toHaveLength(1)
    expect(d[0]!.where).toBe('equipment.step:registerEquipment')
  })

  it('reports a field to be read that the entity does not have — the screen would have nothing to show', () => {
    const { diagnostics } = resolveView(view, ontology, [withTask({ ...complete, reads: ['serialNumber'] })])
    expect(diagnostics.some((x) => x.code === 'TASK_SHAPE' && x.where === 'equipment.registerEquipment.task.reads')).toBe(true)
  })

  it('warns about a hand-written screen for a step nobody does on a screen', () => {
    const { diagnostics } = resolveView(
      { ...view, widgets: { 'action.registerEquipment': 'custom-register' } }, ontology,
      [withTask({ category: 'system' })], { components: ['custom-register'] })
    expect(diagnostics.some((x) => x.code === 'SCREEN_FOR_SYSTEM_STEP' && x.severity === 'warn')).toBe(true)
  })
})

describe('resolveView — a list of required facts is a list of waits', () => {
  it('carries one gate per fact, in declared order', () => {
    const p: ProcessDecl = {
      ...process,
      transitions: process.transitions.map((t) => (t.action === 'sendToMaintenance'
        ? { ...t, requiresFact: [{ property: 'condition', message: 'chưa đánh giá' }, { property: 'quantity' }] }
        : t)),
    }
    const a = resolveView(view, ontology, [p]).contract.actions.find((x) => x.action === 'sendToMaintenance')
    expect(a?.waitsOn).toEqual([{ kind: 'fact', via: 'condition', message: 'chưa đánh giá' }, { kind: 'fact', via: 'quantity' }])
  })
})
