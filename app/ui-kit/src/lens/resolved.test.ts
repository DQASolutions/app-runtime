// ⛔ THE LENS HAD NEVER MET A CONTRACT THE RESOLVER ACTUALLY PRODUCED.
//
// ═══════════════════════════════════════════════════════════════════════════
//   `fixture.ts` is a contract WRITTEN BY HAND and typed as `ViewContract`.
//   Every lens test in this package argues against that shape. TypeScript
//   checks the shape is legal; nothing checked it is the shape
//   `@dqa-ai-solutions/ontology-view` emits.
//
//   That is a second source of truth for "what a contract looks like", and this
//   package has found the same defect three times this week in three other
//   places. The risk is specific and cuts both ways:
//
//     · a field the resolver ALWAYS fills that the fixture omits → the lens is
//       never exercised with it
//     · a field the fixture fills that the resolver NEVER emits → the lens is
//       tested against an input that cannot happen
//
// ⭐ WHY IT MATTERS NOW. The adopting app imports four things and none of them
//    is `recordModel`, so the largest and best-justified part of this package —
//    the one written because 48 of 50 declarations carry `detail.facts` and no
//    renderer reads it — HAS NEVER MET A REAL SCREEN. Its only evidence is
//    tests, and its tests were arguing with a fixture of my own design.
//
//    The app session put the same point sharply: they are immune to the record
//    bug "not because they did it right, but because they have not used it yet".
//
// ⚠️ The declaration below is the resolver's OWN test fixture — a real screen
//    from a shipped app. Resolved here by the real resolver, then handed to
//    every lens. `@dqa-ai-solutions/ontology-view` is a devDependency, so this never reaches
//    the browser bundle; `check-browser-safe` walks entry points, not tests.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { resolveView } from '@dqa-ai-solutions/ontology-view'
import type { ProcessDecl, ViewDecl, ViewOntologyDecl } from '@dqa-ai-solutions/ontology-view'
import { formatter } from './format.js'
import { registryOf } from './registry.js'
import { listModel, planColumns, subjectOf } from './list.js'
import { recordModel } from './record.js'
import { queueModel } from './queue.js'
import { cellOf } from './cell.js'
import type { EmptyCopy } from '../primitives/index.js'

const ontology: ViewOntologyDecl = {
  entities: [
    {
      name: 'Equipment',
      label: 'Equipment',
      properties: [
        { name: 'equipmentName', type: 'text', required: true, description: 'Name' },
        { name: 'quantity', type: 'number', required: true, description: 'Quantity' },
        { name: 'condition', type: 'enum', enumValues: ['serviceable', 'needs_repair'], description: 'Condition' },
        { name: 'availability', type: 'enum', enumValues: ['available', 'committed'], description: 'Where it is' },
      ],
      labels: { equipmentName: 'Name', quantity: 'Quantity', condition: 'Condition', availability: 'Location' },
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
      derived: [{ name: 'unit', kind: 'linked', via: 'heldByUnit', show: 'unitName', label: 'Holding unit' }],
    },
    {
      name: 'Unit', label: 'Unit', labels: { unitName: 'Unit name' },
      properties: [{ name: 'unitName', type: 'text', required: true, description: 'Unit name' }],
    },
  ],
  relationships: [
    { name: 'heldByUnit', from: 'Equipment', to: 'Unit', cardinality: '1..N', directed: true },
  ],
}

const process: ProcessDecl = {
  process: 'equipment',
  entity: 'Equipment',
  stateProperty: 'availability',
  roles: { storekeeper: 'ROLE-STORE' },
  states: [{ name: 'available', label: 'Available' }, { name: 'committed', label: 'Committed' }],
  transitions: [
    {
      action: 'sendToMaintenance', label: 'Send for repair',
      from: ['available'], to: 'committed', role: 'storekeeper',
      params: { target: 'equipmentId', required: ['equipmentId', 'reason'] },
      fields: { reason: { type: 'text', label: 'Reason' } },
    },
  ],
}

const view: ViewDecl = {
  entity: 'Equipment',
  list: {
    columns: ['equipmentName', 'unit', 'quantity', 'condition', 'availability'],
    main: 'equipmentName', search: ['equipmentName'], sort: [{ by: 'equipmentName', collate: 'vi' }],
  },
  detail: { facts: ['equipmentName', 'quantity', 'condition', 'unit'] },
  row: { main: 'equipmentName', badge: 'condition' },
}

const { contract, ok } = resolveView(view, ontology, [process])
const ctx = { format: formatter({ locale: 'vi-VN', currency: 'VND' }), blocks: registryOf([]) }
const EMPTY: EmptyCopy = {
  noRecords: { title: 'Chưa có gì' },
  noMatch: { title: 'Không khớp', action: { label: 'Bỏ lọc', go: '/equipment' } },
}

/* The shape a store actually returns: an envelope AND top-level columns. */
const ROW = {
  id: 'e-1',
  availability: 'available',
  data: { equipmentName: 'Máy phát điện', quantity: 4, condition: 'serviceable' },
  unit: { id: 'u-1', unitName: 'Tổ 1' },
}

describe('⛔ mọi lens, trên hợp đồng do BỘ PHÂN GIẢI THẬT sinh ra', () => {
  it('bản khai phân giải sạch — nếu không thì mọi khẳng định dưới đây vô nghĩa', () => {
    expect(ok).toBe(true)
  })

  it('`listModel` dựng được bảng, và không ô nào là `unwired`', () => {
    const m = listModel({ contract, rows: [ROW], loading: false, empty: EMPTY }, ctx)
    if (m.state.kind !== 'ready') throw new Error(`${m.state.kind}: ${JSON.stringify(m.faults)}`)
    const cells = m.state.data.rows[0].cells
    expect(cells.map((c) => c.kind)).not.toContain('unwired')
    expect(cells.map((c) => c.kind)).not.toContain('missing-block')
    expect(m.state.data.rowHeaderKey).toBe('equipmentName')
  })

  it('`recordModel` dựng được trang hồ sơ, và ĐỌC ĐƯỢC TRẠNG THÁI', () => {
    const m = recordModel({ contract, record: ROW, loading: false, empty: EMPTY }, ctx)
    if (m.state.kind !== 'ready') throw new Error(`${m.state.kind}: ${JSON.stringify(m.diagnostics)}`)
    /* ⛔ Đúng cái `stateOf` từng đánh rơi: `availability` nằm ở TẦNG TRÊN CÙNG
       còn `data` chứa phần còn lại. */
    expect(m.state.data.state).toBe('available')
    expect(m.state.data.title).toBe('Máy phát điện')
    expect(m.state.data.badge?.kind).toBe('tone')
    expect(m.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(m.state.data.tabs.flatMap((t) => t.parts).length).toBeGreaterThan(0)
  })

  it('`queueModel` dựng được hàng đợi', () => {
    const m = queueModel({
      contracts: { Equipment: contract },
      items: [{ entity: 'Equipment', record: ROW }],
      loading: false, empty: EMPTY,
    }, ctx)
    expect(['ready', 'partial']).toContain(m.state.kind)
  })

  it('`subjectOf` và `planColumns` đọc đúng hợp đồng thật', () => {
    expect(subjectOf(contract, ROW)?.text).toBe('Máy phát điện')
    expect(subjectOf(contract, ROW, { as: 'queue' })?.text).toBe('Máy phát điện')
    const plan = planColumns(contract)
    expect(plan.columns.length).toBe(5)
    expect(plan.rowHeaderKey).toBe('equipmentName')
  })

  it('⭐ hành động khả dụng lọc theo trạng thái đọc được từ tầng trên cùng', () => {
    /* Nếu `stateOf` trả null thì danh sách hành động rỗng, và trang trông như
       một hồ sơ chưa vào quy trình nào — không lỗi, không cảnh báo. */
    const m = recordModel({ contract, record: ROW, loading: false, empty: EMPTY }, ctx)
    if (m.state.kind !== 'ready') throw new Error(m.state.kind)
    expect(m.state.data.actions.map((a) => a.label)).toContain('Send for repair')
  })

  it('mọi cột hợp đồng khai đều vẽ được từ bản ghi hai-hình-dạng', () => {
    for (const col of contract.list!.columns) {
      const cell = cellOf(ROW, col, ctx)
      expect(cell.kind, `${col.key} → ${cell.kind}`).not.toBe('unwired')
    }
  })
})
