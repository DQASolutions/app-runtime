/**
 * K13 · K14 — several declaration bundles, and a version for what was loaded.
 *
 * An app assembled from independently-owned bundles needs two things the single
 * -directory loader could not give it: a merge, and a refusal to merge when two
 * bundles claim the same entity. Plus a hash of the result, so anything holding
 * a copy of these contracts can tell that its copy is stale.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'
import { loadViewContracts, loadViewPack, resolveViewPack } from './loaders.js'
import type { ViewOntologyDecl } from './types.js'

const ontology: ViewOntologyDecl = {
  entities: [
    {
      name: 'Equipment',
      label: 'Equipment',
      labels: { equipmentName: 'Name' },
      properties: [{ name: 'equipmentName', type: 'text', required: true }],
    },
    {
      name: 'Course',
      label: 'Course',
      labels: { title: 'Title' },
      properties: [{ name: 'title', type: 'text', required: true }],
    },
  ],
  relationships: [],
}

const view = (entity: string, field: string) =>
  `entity: ${entity}\nlist:\n  columns: [${field}]\n  main: ${field}\n`

let root = ''
const bundle = (name: string) => path.join(root, name, 'views')

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'ontology-view-multi-'))
  await fs.ensureDir(bundle('alpha'))
  await fs.ensureDir(bundle('beta'))
  await fs.ensureDir(bundle('clash'))
  await fs.writeFile(path.join(bundle('alpha'), 'equipment.yaml'), view('Equipment', 'equipmentName'))
  await fs.writeFile(path.join(bundle('beta'), 'course.yaml'), view('Course', 'title'))
  // A third bundle that declares an entity alpha already owns.
  await fs.writeFile(path.join(bundle('clash'), 'equipment.yaml'), view('Equipment', 'equipmentName'))
})

afterAll(async () => { await fs.remove(root) })

const opts = (dirs: string | readonly string[]) =>
  ({ viewsDir: dirs, ontology, onWarning: () => {} }) as const

describe('K13 · merging several bundles', () => {
  it('one directory still works, unchanged', async () => {
    const contracts = await loadViewContracts(opts(bundle('alpha')))
    expect(Object.keys(contracts)).toEqual(['Equipment'])
  })

  it('merges declarations from every bundle', async () => {
    const contracts = await loadViewContracts(opts([bundle('alpha'), bundle('beta')]))
    expect(Object.keys(contracts).sort()).toEqual(['Course', 'Equipment'])
  })

  it('skips a bundle directory that does not exist, rather than failing', async () => {
    const contracts = await loadViewContracts(
      opts([bundle('alpha'), path.join(root, 'not-there', 'views')]),
    )
    expect(Object.keys(contracts)).toEqual(['Equipment'])
  })

  it('returns nothing when no bundle exists', async () => {
    const pack = await resolveViewPack(opts([path.join(root, 'nope')]))
    expect(pack.contracts).toEqual({})
    expect(pack.ok).toBe(true)
  })
})

describe('K13 · two bundles claiming one entity is an ERROR', () => {
  it('reports DUPLICATE_ENTITY instead of letting the last one win', async () => {
    const pack = await resolveViewPack(opts([bundle('alpha'), bundle('clash')]))
    expect(pack.ok).toBe(false)
    const codes = Object.values(pack.diagnostics).flat().map((d) => d.code)
    expect(codes).toContain('DUPLICATE_ENTITY')
  })

  it('names the bundle that declared it first, so the clash is findable', async () => {
    const pack = await resolveViewPack(opts([bundle('alpha'), bundle('clash')]))
    const msg = Object.values(pack.diagnostics).flat().map((d) => d.message).join('\n')
    expect(msg).toContain('alpha')
    expect(msg).toContain('Equipment')
  })

  it('keeps the FIRST declaration, and refuses to start', async () => {
    await expect(loadViewContracts(opts([bundle('alpha'), bundle('clash')])))
      .rejects.toThrow(/Broken view declaration/)
  })
})

describe('K14 · version of what was loaded', () => {
  it('is stable across runs of the same input', async () => {
    const a = await loadViewPack(opts([bundle('alpha'), bundle('beta')]))
    const b = await loadViewPack(opts([bundle('alpha'), bundle('beta')]))
    expect(a.version).toBe(b.version)
    expect(a.version).toMatch(/^[0-9a-f]{16}$/)
  })

  it('does not depend on the order the bundles were listed in', async () => {
    const a = await loadViewPack(opts([bundle('alpha'), bundle('beta')]))
    const b = await loadViewPack(opts([bundle('beta'), bundle('alpha')]))
    expect(a.version).toBe(b.version)
  })

  it('changes when the contracts change — this is the whole point', async () => {
    const before = await loadViewPack(opts([bundle('alpha')]))
    const both = await loadViewPack(opts([bundle('alpha'), bundle('beta')]))
    expect(both.version).not.toBe(before.version)
  })

  it('loadViewContracts still returns just the contracts', async () => {
    const contracts = await loadViewContracts(opts([bundle('alpha')]))
    expect(contracts.Equipment).toBeDefined()
    expect((contracts as Record<string, unknown>)['version']).toBeUndefined()
  })
})

/*
  ⛔ 13/9/2026 — a process whose entity has no view was checked by nothing, at
     build or at start. The pack now resolves it too, and its errors fail it.
*/
describe('a process with no view is still checked', () => {
  const wfDir = () => path.join(root, 'wf')
  const writeProcess = async (name: string, body: string) => {
    await fs.ensureDir(wfDir())
    await fs.writeFile(path.join(wfDir(), `${name}.yaml`), body)
  }
  const courseProcess = (fields: string, params = '[title, secret]') => `process: courseFlow
entity: Course
stateProperty: title
roles: { clerk: C }
states: [{ name: OPEN, label: Open }]
transitions:
  - action: openCourse
    label: Open
    from: []
    to: OPEN
    role: clerk
    params: { required: ${params} }
${fields}`

  it('REFUSE: an untyped parameter of a view-less process fails the pack', async () => {
    await writeProcess('course', courseProcess(''))
    const pack = await resolveViewPack({ ...opts(bundle('alpha')), workflowDir: wfDir() })
    expect(pack.ok).toBe(false)
    const [label, ds] = Object.entries(pack.diagnostics).find(([k]) => k.startsWith('workflow:'))!
    expect(label).toBe('workflow:courseFlow')
    expect(ds.some((d) => d.code === 'UNTYPED_PARAM' && d.message.includes('secret'))).toBe(true)
    // …and it hands no screen contract for an entity with no screen.
    expect(Object.keys(pack.contracts)).toEqual(['Equipment'])
  })

  it('REFUSE even when the app has no view directory at all', async () => {
    await writeProcess('course', courseProcess(''))
    const pack = await resolveViewPack({ ...opts(path.join(root, 'nope')), workflowDir: wfDir() })
    expect(pack.ok).toBe(false)
  })

  it('REFUSE: a bare enum step field (no enumValues, no valuesOf)', async () => {
    await writeProcess('course', courseProcess('    fields:\n      secret: { type: enum, label: Kind }\n'))
    const pack = await resolveViewPack({ ...opts(bundle('alpha')), workflowDir: wfDir() })
    expect(pack.ok).toBe(false)
    expect(Object.values(pack.diagnostics).flat().some((d) => d.code === 'ENUM_WITHOUT_VALUES')).toBe(true)
  })

  it('ACCEPT: the same process, every parameter typed', async () => {
    await writeProcess('course', courseProcess('    fields:\n      secret: { type: enum, enumValues: [a, b], label: Kind }\n'))
    const pack = await resolveViewPack({ ...opts(bundle('alpha')), workflowDir: wfDir() })
    expect(Object.values(pack.diagnostics).flat().filter((d) => d.severity === 'error')).toEqual([])
    expect(pack.ok).toBe(true)
  })
})
