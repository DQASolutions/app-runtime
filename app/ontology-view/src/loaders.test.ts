import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'
import { loadViewContracts, resolveViewPack } from './loaders.js'
import type { ViewOntologyDecl } from './types.js'

const ontology: ViewOntologyDecl = {
  entities: [{
    name: 'Equipment',
    label: 'Equipment',
    labels: { equipmentName: 'Name', quantity: 'Quantity' },
    properties: [
      { name: 'equipmentName', type: 'text', required: true },
      { name: 'quantity', type: 'number', required: true },
    ],
  }],
  relationships: [],
}

let dir = ''
const viewsDir = () => path.join(dir, 'views')
const workflowDir = () => path.join(dir, 'workflow')

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ontology-view-'))
  await fs.ensureDir(viewsDir())
  await fs.ensureDir(workflowDir())
  await fs.writeFile(path.join(viewsDir(), 'equipment.yaml'),
    'entity: Equipment\nlist:\n  columns: [equipmentName, quantity]\n  main: equipmentName\n')
  await fs.writeFile(path.join(workflowDir(), 'equipment.yaml'), [
    'process: equipment',
    'entity: Equipment',
    'stateProperty: status',
    'roles: { keeper: ROLE-KEEP }',
    'states: []',
    'transitions:',
    '  - action: register',
    '    label: Register',
    '    from: []',
    '    role: keeper',
    '    params: { required: [equipmentName, quantity] }',
  ].join('\n'))
})

afterAll(async () => { await fs.remove(dir) })

describe('loadViewContracts', () => {
  it('reads a directory of declarations and keys them by entity', async () => {
    const contracts = await loadViewContracts({
      viewsDir: viewsDir(), workflowDir: workflowDir(), ontology, onWarning: () => {},
    })
    expect(Object.keys(contracts)).toEqual(['Equipment'])
    expect(contracts.Equipment.list!.columns.map((c) => c.label)).toEqual(['Name', 'Quantity'])
  })

  it('picks the process up from disk and builds the step form from it', async () => {
    const contracts = await loadViewContracts({
      viewsDir: viewsDir(), workflowDir: workflowDir(), ontology, onWarning: () => {},
    })
    expect(contracts.Equipment.actions[0]).toMatchObject({ action: 'register', role: 'ROLE-KEEP' })
    expect(contracts.Equipment.actions[0].fields.map((f) => f.key)).toEqual(['equipmentName', 'quantity'])
  })

  it('is a no-op when the app declares no views at all', async () => {
    expect(await loadViewContracts({ viewsDir: path.join(dir, 'nope'), ontology })).toEqual({})
  })

  it('reports warnings rather than swallowing them', async () => {
    const seen: string[] = []
    const bare: ViewOntologyDecl = {
      ...ontology,
      entities: ontology.entities.map((e) => ({ ...e, labels: undefined })),
    }
    await loadViewContracts({ viewsDir: viewsDir(), ontology: bare, onWarning: (t) => seen.push(t) })
    expect(seen.join('\n')).toContain('MISSING_LABEL')
  })

  it('REFUSES TO START on a broken declaration, naming the file', async () => {
    const broken = path.join(dir, 'broken')
    await fs.ensureDir(broken)
    await fs.writeFile(path.join(broken, 'equipment.yaml'),
      'entity: Equipment\nlist:\n  columns: [nonsense]\n')
    await expect(loadViewContracts({ viewsDir: broken, ontology, onWarning: () => {} }))
      .rejects.toThrow(/equipment\.yaml[\s\S]*UNKNOWN_FIELD/)
  })

  it('resolveViewPack reports the same problem WITHOUT throwing, for a build check', async () => {
    const broken = path.join(dir, 'broken')
    const pack = await resolveViewPack({ viewsDir: broken, ontology, onWarning: () => {} })
    expect(pack.ok).toBe(false)
    expect(pack.diagnostics['equipment.yaml'].some((d) => d.code === 'UNKNOWN_FIELD')).toBe(true)
    // still hands back what it could resolve — a build check wants the whole picture
    expect(pack.contracts.Equipment).toBeDefined()
  })
})
