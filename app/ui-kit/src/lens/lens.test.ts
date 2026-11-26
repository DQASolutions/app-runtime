import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { formatter } from './format.js'
import { registryOf, NO_BLOCKS } from './registry.js'
import { cellOf } from './cell.js'
import { listModel, planColumns, subjectOf } from './list.js'
import { readValue, fieldsOf, ABSENT } from './shape.js'
import { recordModel } from './record.js'
import { queueModel } from './queue.js'
import { timelineModel } from './timeline.js'
import { actionForm, availableActions, actionFacts, actionButtons } from './action.js'
import { CONTRACT, ROW, UNWIRED_ROW, DECISIONS, STATUS, UNIT, ALLOWANCE, JOINED, DEADLINE } from './fixture.js'
import type { EmptyCopy } from '../primitives/index.js'

const format = formatter({ locale: 'vi-VN', currency: 'VND' })
const blocks = registryOf(['claim-deadline', 'member-discipline'])
const ctx = { format, blocks }

const EMPTY: EmptyCopy = {
  noRecords: { title: 'Chưa có hồ sơ nào' },
  noMatch: { title: 'Không khớp', action: { label: 'Bỏ lọc', go: '/members' } },
}

describe('a cell has THREE outcomes, not two', () => {
  it('draws a value that is there', () => {
    /* ⚠️ `kind` is `link`, not `text`: the row carries an id for the linked
       record, so the cell can open it. The three-outcome rule is about whether
       there IS a value — that is what is asserted here. */
    const c = cellOf(ROW, UNIT, ctx)
    expect(c).toMatchObject({ kind: 'link', text: 'Tổ 1' })
  })

  it('draws a blank when the key is present and null — a record with no link', () => {
    expect(cellOf({ ...ROW, unit: null }, UNIT, ctx).kind).toBe('blank')
  })

  it('⛔ says WIRING FAULT when the key never arrived — not another blank', () => {
    const c = cellOf(UNWIRED_ROW, UNIT, ctx)
    expect(c.kind).toBe('unwired')
    if (c.kind !== 'unwired') throw new Error('narrowing')
    expect(c.message).toContain('heldByUnit')
  })
})

describe('the same enum reads two ways', () => {
  it('is a badge in a column, carrying the weight the ontology gave it', () => {
    expect(cellOf(ROW, STATUS, ctx)).toMatchObject({ kind: 'tone', label: 'Đang làm việc', tone: 'doing' })
  })

  it('⭐ is plain words on a second line — two chips per row leave the eye nowhere', () => {
    expect(cellOf(ROW, STATUS, { ...ctx, plain: true }))
      .toMatchObject({ kind: 'text', text: 'Đang làm việc' })
  })
})

describe('blocks arrive as data, never as an import', () => {
  it('hands a named block the whole record', () => {
    expect(cellOf(ROW, DEADLINE, ctx)).toMatchObject({ kind: 'block', widget: 'claim-deadline' })
  })

  it('⛔ refuses a block the renderer does not publish, instead of drawing nothing', () => {
    const c = cellOf(ROW, DEADLINE, { ...ctx, blocks: NO_BLOCKS })
    expect(c.kind).toBe('missing-block')
  })
})

describe('formatting belongs to Intl and locale belongs to the app', () => {
  it('⛔ never lets a raw ISO stamp reach a screen', () => {
    const c = cellOf(ROW, JOINED, ctx)
    if (c.kind !== 'text') throw new Error('narrowing')
    expect(c.text).toBe('15/01/2026')
    expect(c.text).not.toContain('T00:00')
  })

  it('writes money the way the declared locale writes money', () => {
    const vi = cellOf(ROW, ALLOWANCE, ctx)
    const de = cellOf(ROW, ALLOWANCE, { ...ctx, format: formatter({ locale: 'de-DE', currency: 'EUR' }) })
    if (vi.kind !== 'text' || de.kind !== 'text') throw new Error('narrowing')
    expect(vi.text).not.toBe(de.text)
    expect(vi.text).toContain('1.250.000')
  })

  it('gives back the raw value rather than the words "Invalid Date"', () => {
    const c = cellOf({ id: 'x', data: { serviceStartDate: 'không rõ' } }, JOINED, ctx)
    expect(c).toMatchObject({ kind: 'text', text: 'không rõ' })
  })
})

describe('the list lens', () => {
  const base = { contract: CONTRACT, loading: false, empty: EMPTY }

  it('knows nothing about any entity and still builds every column', () => {
    const m = listModel({ ...base, rows: [ROW] }, ctx)
    if (m.state.kind !== 'ready') throw new Error(m.state.kind)
    expect(m.state.data.rows[0].cells).toHaveLength(6)
    expect(m.state.data.rows[0].main).toMatchObject({ text: 'Nguyễn Văn A' })
  })

  it('tells an empty system apart from an empty filter', () => {
    expect(listModel({ ...base, rows: [] }, ctx).state).toMatchObject({ because: 'no-records' })
    const filtered = listModel({ ...base, rows: [], narrowed: true }, ctx).state
    expect(filtered).toMatchObject({ because: 'no-match' })
    if (filtered.kind !== 'empty') throw new Error('narrowing')
    expect(filtered.action?.label).toBe('Bỏ lọc')
  })

  it('⛔ raises a broken join once, not once per row', () => {
    const m = listModel({ ...base, rows: [UNWIRED_ROW, UNWIRED_ROW, UNWIRED_ROW] }, ctx)
    expect(m.faults).toHaveLength(1)
    expect(m.state.kind).toBe('partial')
  })

  it('keeps the page on screen while it refetches', () => {
    expect(listModel({ ...base, rows: [ROW], loading: true }, ctx).state.kind).toBe('ready')
  })
})

describe('the record lens — the piece that was missing', () => {
  const base = { contract: CONTRACT, loading: false, empty: EMPTY }

  it('⭐ gives a usable page with ZERO layout declared', () => {
    const m = recordModel({ ...base, record: ROW }, ctx)
    if (m.state.kind !== 'ready') throw new Error(m.state.kind)
    const [tab] = m.state.data.tabs
    /* One facts section + one declared related list. */
    expect(tab.parts.map((p) => p.kind)).toEqual(['facts', 'related'])
    expect(tab.parts[0].kind === 'facts' && tab.parts[0].facts).toHaveLength(6)
    expect(m.state.data.title).toBe('Nguyễn Văn A')
    expect(m.state.data.badge).toMatchObject({ kind: 'tone', tone: 'doing' })
  })

  it('carries the state\'s meaning, which used to live in four UI files', () => {
    const m = recordModel({ ...base, record: ROW }, ctx)
    if (m.state.kind !== 'ready') throw new Error('narrowing')
    expect(m.state.data.hint).toBe('Đã nhận vào đơn vị')
  })

  it('groups into sections when a layout is declared', () => {
    const m = recordModel({
      ...base, record: ROW,
      layout: {
        sections: [
          { name: 'who', label: 'Nhân thân', facts: ['fullName', 'employeeType'] },
          { name: 'service', label: 'Công tác', facts: ['status', 'serviceStartDate', 'allowance', 'unit'] },
        ],
      },
    }, ctx)
    if (m.state.kind !== 'ready') throw new Error('narrowing')
    expect(m.state.data.tabs[0].parts.map((p) => p.name)).toEqual(['who', 'service', 'decisions'])
    /* The one diagnostic is the related list with no rows supplied — see below. */
    expect(m.diagnostics.map((d) => d.code)).toEqual(['MISSING_ROWS'])
  })

  it('⛔ never drops a declared fact — it appends it and says so', () => {
    const m = recordModel({
      ...base, record: ROW,
      layout: { sections: [{ name: 'who', facts: ['fullName'] }] },
    }, ctx)
    if (m.state.kind !== 'ready') throw new Error('narrowing')
    const names = m.state.data.tabs[0].parts.map((p) => p.name)
    expect(names).toContain('_rest')
    const warn = m.diagnostics.find((d) => d.code === 'ORPHAN_FACTS')
    expect(warn?.severity).toBe('warn')
    expect(warn?.message).toContain('allowance')
  })

  it('refuses a section naming a fact the contract does not carry', () => {
    const m = recordModel({
      ...base, record: ROW, layout: { sections: [{ name: 'x', facts: ['bloodType'] }] },
    }, ctx)
    expect(m.diagnostics.some((d) => d.code === 'UNKNOWN_FACT')).toBe(true)
  })

  it('⭐ shows a section only in the states that declare it — on WRITTEN data', () => {
    const layout = {
      sections: [
        { name: 'all', facts: CONTRACT.detail!.facts.map((f) => f.key) },
        { name: 'discipline', block: 'member-discipline', when: ['COMPLETED'] },
      ],
    }
    const serving = recordModel({ ...base, record: ROW, layout }, ctx)
    const done = recordModel({
      ...base, layout,
      record: { ...ROW, data: { ...ROW.data, status: 'COMPLETED' } },
    }, ctx)
    const names = (m: typeof serving) =>
      m.state.kind === 'ready' ? m.state.data.tabs[0].parts.map((p) => p.name) : []
    expect(names(serving)).not.toContain('discipline')
    expect(names(done)).toContain('discipline')
  })

  it('splits sections across tabs when the layout asks', () => {
    const m = recordModel({
      ...base, record: ROW,
      layout: {
        tabs: [{ name: 'ho-so', label: 'Hồ sơ' }, { name: 'ky-luat', label: 'Kỷ luật' }],
        sections: [
          { name: 'all', facts: CONTRACT.detail!.facts.map((f) => f.key) },
          { name: 'discipline', tab: 'ky-luat', block: 'member-discipline' },
        ],
      },
    }, ctx)
    if (m.state.kind !== 'ready') throw new Error('narrowing')
    /* Related lists land on the first tab unless a layout places them. */
    expect(m.state.data.tabs.map((t) => t.parts.length)).toEqual([2, 1])
  })

  it('offers only the steps this state can take', () => {
    const m = recordModel({ ...base, record: ROW }, ctx)
    if (m.state.kind !== 'ready') throw new Error('narrowing')
    expect(m.state.data.actions.map((a) => a.key)).toEqual(['complete'])
  })

  it('⛔ an id that resolves to nothing is `empty`, not a spinner', () => {
    expect(recordModel({ ...base, record: null }, ctx).state.kind).toBe('empty')
  })
})

describe('the action lens', () => {
  const [select, , complete] = CONTRACT.actions

  it('⭐ does not ask for what the declaration already settled', () => {
    const form = actionForm(select, blocks)
    expect(form.fields.map((f) => f.field.key)).not.toContain('signedBy')
    expect(form.settled).toMatchObject([{ value: 'Chủ tịch UBND xã' }])
  })

  it('picks the control from the declared type', () => {
    const form = actionForm(select, blocks)
    expect(Object.fromEntries(form.fields.map((f) => [f.field.key, f.control])))
      .toEqual({ decisionNo: 'text', unitId: 'ref', note: 'textarea' })
    expect(form.fields.find((f) => f.field.key === 'unitId')?.refEntity).toBe('Unit')
  })

  it('⛔ refuses `json` at build time instead of mid-step in front of an officer', () => {
    const form = actionForm(complete, blocks)
    expect(form.fields[0].control).toBe('unrenderable')
    const d = form.diagnostics.find((x) => x.code === 'UNRENDERABLE_FIELD')
    expect(d?.severity).toBe('error')
    expect(d?.message).toContain('widgets')
  })

  it('says nothing when a hand-written form takes the step over', () => {
    expect(actionForm({ ...complete, widget: 'plan-attendance' }, registryOf(['plan-attendance'])).diagnostics)
      .toHaveLength(0)
  })

  it('⭐ đọc `decision.outcome` THẲNG TỪ HỢP ĐỒNG — không app nào phải mách', () => {
    const steps = availableActions(CONTRACT, 'REGISTERED')
    const { facts, diagnostics } = actionFacts(steps)
    expect(actionButtons(facts).map((b) => `${b.label}=${b.tier}`))
      .toEqual(['Tuyển chọn=key', 'Tạm hoãn=normal'])
    expect(diagnostics, 'quy trình đã trả lời thì không còn gì để cảnh báo').toHaveLength(0)
  })

  it('⭐ chở `provisional` tới tận cái nút — cảnh báo nằm trong YAML là cảnh báo không tồn tại', () => {
    const steps = availableActions(CONTRACT, 'REGISTERED')
    const { facts } = actionFacts(steps)
    const defer = actionButtons(facts).find((b) => b.key === 'defer')
    expect(defer?.provisional).toContain('chưa có văn bản hướng dẫn')
  })

  it('vẫn cảnh báo khi CHÍNH QUY TRÌNH chưa nói bước nào là bước duyệt', () => {
    const mute = {
      ...CONTRACT,
      actions: CONTRACT.actions.map((a) => ({ ...a, outcome: undefined })),
    }
    const { facts, diagnostics } = actionFacts(availableActions(mute, 'REGISTERED'))
    expect(actionButtons(facts).map((b) => b.tier)).toEqual(['normal', 'normal'])
    expect(diagnostics[0]?.code).toBe('CONTRACT_GAP')
    expect(diagnostics[0]?.message).toContain('say so in the process')
  })

  it('lời mách của app vẫn thắng, để app dùng hợp đồng cũ không gãy', () => {
    const old = { ...CONTRACT, actions: CONTRACT.actions.map((a) => ({ ...a, outcome: undefined })) }
    const { facts } = actionFacts(availableActions(old, 'REGISTERED'), { defer: { outcome: 'approve' } })
    expect(actionButtons(facts).map((b) => b.tier)).toEqual(['normal', 'key'])
  })
})

describe('the queue lens', () => {
  const base = { contracts: { StaffMember: CONTRACT }, loading: false, empty: EMPTY }

  it('answers three questions and stops', () => {
    const m = queueModel({ ...base, items: [{ entity: 'StaffMember', record: ROW }] }, ctx)
    if (m.state.kind !== 'ready') throw new Error(m.state.kind)
    const [item] = m.state.data
    expect(item.main).toMatchObject({ text: 'Nguyễn Văn A' })
    expect(item.sub).toMatchObject({ text: 'Toàn thời gian' })
    expect(item.badge).toMatchObject({ kind: 'tone', tone: 'doing' })
  })

  it('drops what it cannot name, and says which entity', () => {
    const m = queueModel({ ...base, items: [{ entity: 'Ghost', record: ROW }] }, ctx)
    expect(m.diagnostics[0]?.where).toBe('Ghost')
    expect(m.state.kind).toBe('empty')
  })
})

describe('the timeline lens', () => {
  const base = { loading: false, empty: EMPTY }
  const events = [
    { event: 'staffMember.registered', at: '2026-01-02T03:00:00Z' },
    { event: 'staffMember.selected', at: '2026-03-04T05:00:00Z' },
  ]
  const vocab = {
    'staffMember.registered': 'Đăng ký hồ sơ',
    'staffMember.selected': 'Tuyển chọn, có quyết định tuyển dụng',
  }

  it('writes the time through Intl and puts the newest first', () => {
    const m = timelineModel({ ...base, events, vocabulary: vocab }, format)
    if (m.state.kind !== 'ready') throw new Error(m.state.kind)
    expect(m.state.data[0].label).toBe('Tuyển chọn, có quyết định tuyển dụng')
    /* ⚠️ Asserting CONTAINS, not starts-with: `vi-VN` writes the clock before
       the date ("12:00 04/03/2026"), and an ordering assumption borrowed from
       one locale is the same defect this lens exists to remove. */
    expect(m.state.data[0].when).toContain('04/03/2026')
    expect(m.state.data[0].when).not.toContain('T05:00')
  })

  it('⛔ reports an event with no wording instead of printing its machine name', () => {
    const m = timelineModel({ ...base, events, vocabulary: {} }, format)
    expect(m.diagnostics).toHaveLength(2)
    expect(m.diagnostics[0].code).toBe('UNLABELLED_EVENT')
    if (m.state.kind !== 'ready') throw new Error('narrowing')
    expect(m.state.data[0].unlabelled).toBe(true)
  })

  it('keeps equal timestamps in a stable order', () => {
    const same = [
      { event: 'a', at: '2026-01-01T00:00:00Z' },
      { event: 'b', at: '2026-01-01T00:00:00Z' },
    ]
    const order = () => {
      const m = timelineModel({ ...base, events: same, vocabulary: { a: 'A', b: 'B' } }, format)
      return m.state.kind === 'ready' ? m.state.data.map((e) => e.event) : []
    }
    expect(order()).toEqual(order())
    expect(order()).toEqual(['a', 'b'])
  })
})


describe('hợp đồng cột và hợp đồng tiếp cận', () => {
  const base = { contract: CONTRACT, loading: false, empty: EMPTY, rows: [ROW] }

  it('⭐ giữ lại 7 cột, GIỮ CHỖ phần đuôi — không bao giờ vứt', () => {
    const m = listModel({ ...base, maxColumns: 3 }, ctx)
    if (m.state.kind !== 'ready') throw new Error(m.state.kind)
    expect(m.state.data.columns).toHaveLength(3)
    expect(m.state.data.extraColumns).toHaveLength(3)
    const all = [...m.state.data.columns, ...m.state.data.extraColumns].map((f) => f.key)
    expect(all.sort()).toEqual(CONTRACT.list!.columns.map((f) => f.key).sort())
  })

  it('cột NÊU TÊN bản ghi không bao giờ bị đẩy xuống', () => {
    const m = listModel({ ...base, maxColumns: 1 }, ctx)
    if (m.state.kind !== 'ready') throw new Error('narrowing')
    expect(m.state.data.columns[0].key).toBe('fullName')
  })

  it('⭐ nói ra cột nào phải mang scope="row" — 0/56 màn app tự nhớ được', () => {
    const m = listModel(base, ctx)
    if (m.state.kind !== 'ready') throw new Error('narrowing')
    expect(m.state.data.rowHeaderKey).toBe('fullName')
  })

  it('nói ra aria-sort, và im lặng ở cột không sắp xếp được', () => {
    const m = listModel(base, ctx)
    if (m.state.kind !== 'ready') throw new Error('narrowing')
    expect(m.state.data.sortState.fullName).toBe('ascending')
    expect(m.state.data.sortState.unit, 'cột suy ra không sắp xếp được').toBe('none')
  })
})


describe('planColumns — quyết định tách khỏi dựng dữ liệu', () => {
  it('⭐ trả về quyết định mà KHÔNG đòi formatter hay bảng block', () => {
    const plan = planColumns(CONTRACT, { maxColumns: 3 })
    expect(plan.columns).toHaveLength(3)
    expect(plan.extraColumns).toHaveLength(3)
    expect(plan.rowHeaderKey).toBe('fullName')
    expect(plan.sortState.fullName).toBe('ascending')
  })

  it('listModel và planColumns không được nói hai điều khác nhau', () => {
    const plan = planColumns(CONTRACT, { maxColumns: 4 })
    const m = listModel({ contract: CONTRACT, rows: [ROW], loading: false, empty: EMPTY, maxColumns: 4 }, ctx)
    if (m.state.kind !== 'ready') throw new Error('narrowing')
    expect(m.state.data.columns.map((f) => f.key)).toEqual(plan.columns.map((f) => f.key))
    expect(m.state.data.rowHeaderKey).toBe(plan.rowHeaderKey)
  })

  it('⚠️ hợp đồng thật của app KHÔNG có gì để cắt — 6 cột, ngưỡng 7', () => {
    const plan = planColumns(CONTRACT)
    expect(plan.extraColumns).toHaveLength(0)
  })
})


describe('⭐ người đọc TỰ CHỌN cột — cột bị giữ lại là thứ để MỜI, không phải để KỂ', () => {
  /* Người dùng một app thật 13/9/2026: khối *"2 cột không bày ở bảng này"* là UX
     sai — đọc được tên cột mà không làm gì được. Lưới dữ liệu chín nào cũng đặt
     lựa chọn ngay trên bảng. */
  const keys = (fs: { key: string }[]) => fs.map((f) => f.key)
  const all = keys(planColumns(CONTRACT).columns)

  it('không ai chạm vào: đúng nhát cắt cũ, và `choices` liệt kê ĐỦ mọi cột', () => {
    const plan = planColumns(CONTRACT, { maxColumns: 3 })
    expect(all.length).toBeGreaterThanOrEqual(5)
    expect(keys(plan.columns)).toEqual(all.slice(0, 3))
    expect(plan.choices.map((c) => c.key)).toEqual(all)
    expect(plan.choices.map((c) => c.shown)).toEqual(all.map((_, i) => i < 3))
    expect(plan.choices.filter((c) => c.hiddenByDefault).map((c) => c.key)).toEqual(all.slice(3))
    expect(plan.customised).toBe(false)
  })

  it('bật một cột bị cắt: nó hiện, ĐÚNG CHỖ theo thứ hạng, và KHÔNG bị trần maxColumns chặn', () => {
    const last = all[all.length - 1]
    const plan = planColumns(CONTRACT, { maxColumns: 3, visibility: { [last]: true } })
    expect(keys(plan.columns)).toEqual([...all.slice(0, 3), last])
    expect(plan.customised).toBe(true)
    const everything = Object.fromEntries(all.map((k) => [k, true]))
    expect(planColumns(CONTRACT, { maxColumns: 3, visibility: everything }).columns).toHaveLength(all.length)
  })

  it('tắt một cột: nó sang `extraColumns`, và KHÔNG có cột khác nhảy lên lấp chỗ', () => {
    const plan = planColumns(CONTRACT, { maxColumns: 3, visibility: { [all[1]]: false } })
    expect(keys(plan.columns)).toEqual([all[0], all[2]])
    expect(keys(plan.extraColumns)).toEqual([all[1], ...all.slice(3)])
  })

  it('⛔ cột TÊN không tắt được — dù kho lưu `false` cho nó', () => {
    const plan = planColumns(CONTRACT, { visibility: { fullName: false } })
    const name = plan.choices.find((c) => c.key === 'fullName')!
    expect(name).toMatchObject({ locked: true, shown: true })
    expect(keys(plan.columns)).toContain('fullName')
    expect(plan.customised).toBe(false)
    expect(plan.choices.filter((c) => c.locked)).toHaveLength(1)
  })

  it('⚠️ ghi đè TRÙNG mặc định, hoặc nói về cột không còn khai, KHÔNG phải "đã tuỳ chỉnh"', () => {
    expect(planColumns(CONTRACT, { visibility: { [all[1]]: true } }).customised).toBe(false)
    expect(planColumns(CONTRACT, { visibility: { khongCon: false } }).customised).toBe(false)
  })

  it('⭐ cột app ẩn mặc định (trống) VẪN được mời, và KHÔNG ăn mất một chỗ của nhát cắt', () => {
    const plan = planColumns(CONTRACT, { maxColumns: 3, hiddenByDefault: [all[1]] })
    expect(keys(plan.columns)).toEqual([all[0], all[2], all[3]])
    expect(plan.choices.find((c) => c.key === all[1])).toMatchObject({ shown: false, hiddenByDefault: true })
    const back = planColumns(CONTRACT, { maxColumns: 3, hiddenByDefault: [all[1]], visibility: { [all[1]]: true } })
    expect(keys(back.columns)).toContain(all[1])
  })

  it('⛔ cột TÊN vẫn hiện dù hợp đồng xếp nó CUỐI, ngoài nhát cắt', () => {
    const cols = CONTRACT.list!.columns
    const name = cols.find((c) => c.key === 'fullName')!
    const tail = { ...CONTRACT, list: { ...CONTRACT.list!, columns: [
      ...cols.filter((c) => c !== name), { ...name, priority: 'extra' as const }] } }
    const plan = planColumns(tail, { maxColumns: 2 })
    expect(keys(plan.columns)).toContain('fullName')
    expect(plan.choices.find((c) => c.key === 'fullName')).toMatchObject({ locked: true, hiddenByDefault: false })
  })

  it('⛔ cột TÊN không bị app ẩn mặc định', () => {
    const plan = planColumns(CONTRACT, { hiddenByDefault: ['fullName'] })
    expect(keys(plan.columns)).toContain('fullName')
  })

  it('listModel chuyển thẳng lựa chọn — hai hàm không được nói hai điều khác nhau', () => {
    const opts = { maxColumns: 2, visibility: { [all[4]]: true }, hiddenByDefault: [all[1]] }
    const plan = planColumns(CONTRACT, opts)
    const m = listModel({ contract: CONTRACT, rows: [ROW], loading: false, empty: EMPTY, ...opts }, ctx)
    if (m.state.kind !== 'ready') throw new Error('narrowing')
    expect(keys(m.state.data.columns)).toEqual(keys(plan.columns))
    expect(m.state.data.rows[0].cells).toHaveLength(plan.columns.length)
    expect(m.state.data.choices).toEqual(plan.choices)
  })
})


describe('bộ ba của trang hồ sơ — related · note · link', () => {
  const base = { contract: CONTRACT, loading: false, empty: EMPTY, record: ROW }

  it('⭐ ô trỏ sang bản ghi khác mang { entity, id }, KHÔNG mang tên', () => {
    const c = cellOf(ROW, UNIT, ctx)
    expect(c.kind).toBe('link')
    if (c.kind !== 'link') throw new Error('narrowing')
    expect(c.to).toEqual({ entity: 'Unit', id: 'u-7' })
    expect(c.text).toBe('Tổ 1')
  })

  it('không có id thì KHÔNG dựng liên kết — thà một ô chữ còn hơn một liên kết đoán', () => {
    const c = cellOf({ ...ROW, unit: { unitName: 'Tổ 1' } }, UNIT, ctx)
    expect(c.kind).toBe('text')
  })

  it('⭐ căn cứ đi THEO FIELD, nên mọi màn hiện nó đều hiện cùng một câu', () => {
    const m = recordModel(base, ctx)
    if (m.state.kind !== 'ready') throw new Error('narrowing')
    const part = m.state.data.tabs[0].parts[0]
    if (part.kind !== 'facts') throw new Error('narrowing')
    const allowance = part.facts.find((x) => x.field.key === 'allowance')
    expect(allowance?.field.note?.text).toContain('Điều 34')
    expect(allowance?.field.note?.ref).toBe('L-34-1-a')
  })

  it('⭐ danh sách liên quan dựng được — phần lớn một trang hồ sơ', () => {
    const m = recordModel({ ...base, related: { decisions: DECISIONS } }, ctx)
    if (m.state.kind !== 'ready') throw new Error('narrowing')
    const rel = m.state.data.tabs[0].parts.find((p) => p.kind === 'related')
    if (rel?.kind !== 'related') throw new Error('không dựng được related')
    expect(rel.label).toBe('Quyết định ký ngoài hệ thống')
    expect(rel.entity).toBe('OffSystemDecision')
    expect(rel.rows).toHaveLength(2)
    expect(rel.rowHeaderKey, 'cột nêu tên dòng, cho scope="row"').toBe('decisionNumber')
    const [first] = rel.rows
    expect(first.cells[0]).toMatchObject({ kind: 'text', text: '12/QĐ-UBND' })
    expect(first.cells[1]).toMatchObject({ kind: 'text', text: '01/02/2026' })
  })

  it('⛔ khai mà app không đưa dòng nào là LỖI, không phải một bảng rỗng', () => {
    const m = recordModel(base, ctx)
    const d = m.diagnostics.find((x) => x.code === 'MISSING_ROWS')
    expect(d?.severity).toBe('error')
    expect(d?.message).toContain('indistinguishable')
  })

  it('ẩn theo trạng thái như mọi section khác', () => {
    const gated = {
      ...CONTRACT,
      detail: {
        ...CONTRACT.detail!,
        related: [{ ...CONTRACT.detail!.related![0], when: ['COMPLETED'] }],
      },
    }
    const m = recordModel({ ...base, contract: gated, related: { decisions: DECISIONS } }, ctx)
    if (m.state.kind !== 'ready') throw new Error('narrowing')
    expect(m.state.data.tabs[0].parts.some((p) => p.kind === 'related')).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ⛔ A RECORD CAN CARRY BOTH SHAPES AT ONCE, AND THE LOOKUP ASSUMED IT COULD NOT.
//
//   `row.data ?? row` reads the envelope when there is one and the row when
//   there is not. A record with an envelope AND top-level store columns — a
//   tenant key, a province code — lost every top-level property to an em dash.
//
//   Reported indirectly: the first adopter wrote
//   `record.data?.provinceCode ?? record.provinceCode` in their own code, which
//   is the shape stated out loud.
// ═══════════════════════════════════════════════════════════════════════════
describe('⛔ một bản ghi mang CẢ envelope lẫn cột trên cùng', () => {
  /* Two plain columns off the fixture's own resolved fields, so the shapes are
     real rather than hand-typed. */
  const pick = (k: string) => CONTRACT.list!.columns.find((c) => c.key === k)!
  const cols = [pick('fullName'), { ...pick('fullName'), key: 'provinceCode', label: 'Tỉnh' }]
  const contract = { ...CONTRACT, list: { ...CONTRACT.list!, columns: cols, main: undefined } }
  const base = { contract, loading: false, empty: EMPTY }
  const cellsOf = (row: Record<string, unknown>) => {
    const m = listModel({ ...base, rows: [row] }, ctx)
    /* `partial` is fine here: the fixture contract also promises derived fields
       these minimal rows do not carry, and that fault is not what is under
       test. What matters is the cells for the two plain columns. */
    if (m.state.kind !== 'ready' && m.state.kind !== 'partial') throw new Error(m.state.kind)
    return m.state.data.rows[0].cells
  }

  it('cột trên cùng KHÔNG còn vẽ thành gạch ngang', () => {
    const cells = cellsOf({ id: 'r1', provinceCode: '01', data: { fullName: 'Trần A' } })
    expect(cells.find((c) => c.field.key === 'provinceCode')?.kind).not.toBe('blank')
    expect(cells.find((c) => c.field.key === 'fullName')?.kind).not.toBe('blank')
  })

  it('envelope thắng khi trùng tên — nó giữ thuộc tính của ontology', () => {
    const c = cellsOf({ id: 'r1', fullName: 'của kho', data: { fullName: 'của ontology' } })
      .find((x) => x.field.key === 'fullName')
    expect(c && 'text' in c ? c.text : null).toBe('của ontology')
  })

  it('và bản ghi phẳng, không envelope, vẫn chạy như cũ', () => {
    const cells = cellsOf({ id: 'r1', fullName: 'Trần A', provinceCode: '01' })
    expect(cells.every((c) => c.kind !== 'blank')).toBe(true)
  })
})

describe('⭐ `subjectOf` — cái tên gọi bản ghi ấy, hỏi hợp đồng chứ không đoán', () => {
  it('lấy đúng thuộc tính hợp đồng nêu là tên', () => {
    expect(subjectOf(CONTRACT, ROW)?.text).toBe('Nguyễn Văn A')
  })

  it('đọc được cả hai hình dạng bản ghi, y như một ô bảng', () => {
    const key = CONTRACT.list!.main!.key
    expect(subjectOf(CONTRACT, { id: 'r1', [key]: 'phẳng' })?.text).toBe('phẳng')
    expect(subjectOf(CONTRACT, { id: 'r1', data: { [key]: 'trong bọc' } })?.text).toBe('trong bọc')
  })

  it('không có tên thì trả `null`, không trả một chuỗi rỗng trông như tên', () => {
    const key = CONTRACT.list!.main!.key
    expect(subjectOf(CONTRACT, { id: 'r1' })).toBe(null)
    expect(subjectOf(CONTRACT, { id: 'r1', [key]: '' })).toBe(null)
    const noMain = {
      ...CONTRACT,
      list: { ...CONTRACT.list!, main: undefined },
      row: undefined,
    }
    expect(subjectOf(noMain, ROW)).toBe(null)
  })

  it('⭐ lùi sang `row.main` khi hợp đồng chỉ khai tên cho hàng đợi', () => {
    /* Hợp đồng phân giải HAI tên — `list.main` và `row.main` — và cả hai cùng
       lùi về thuộc tính ontology đánh dấu `title`. Một màn khai một cái thôi
       vẫn phải gọi được tên bản ghi. */
    const onlyRow = { ...CONTRACT, list: { ...CONTRACT.list!, main: undefined } }
    expect(subjectOf(onlyRow, ROW)?.text).toBe('Nguyễn Văn A')
  })

  it('khoá ưu tiên không có giá trị thì lùi tiếp, chứ không trả null', () => {
    /* Một cái tên thiếu trông y như một bản ghi không có tên; đưa được tên nào
       vẫn hơn không đưa gì. */
    const ghost = { ...CONTRACT, row: { ...CONTRACT.row!, main: { ...CONTRACT.list!.main!, key: 'khongCo' } } }
    expect(subjectOf(ghost, ROW, { as: 'queue' })?.text).toBe('Nguyễn Văn A')
  })

  it('⚠️ và hàng đợi hỏi `row.main` TRƯỚC — đoán là chọn sai đúng app đã phân biệt', () => {
    const split = {
      ...CONTRACT,
      row: { ...CONTRACT.row!, main: { ...CONTRACT.list!.main!, key: 'employeeType' } },
    }
    expect(subjectOf(split, ROW, { as: 'queue' })?.key).toBe('employeeType')
    expect(subjectOf(split, ROW)?.key).toBe(CONTRACT.list!.main!.key)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ⛔ ONE READER OF THE RECORD SHAPE. THE CHECK, NOT THE CONVENTION.
//
//   Three files spelled `record.data ?? record` independently, and the third
//   was written hours after warning someone else about second sources of truth.
//   A two-token expression does not feel like duplicating a decision, so a
//   convention will not hold. This will.
// ═══════════════════════════════════════════════════════════════════════════
describe('⛔ chỉ MỘT người đọc hình dạng bản ghi', () => {
  it('không tệp nào trong `lens/` tự đọc `.data ??` nữa', () => {
    const dir = new URL('.', import.meta.url).pathname
    const offenders: string[] = []
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.ts') || file.includes('.test.') || file.startsWith('fixture')) continue
      /* Chú thích bỏ trước khi đọc — kể cả khối ngay trên đây, vốn TRÍCH DẪN
         chính biểu thức bị cấm. Kho này đã ba lần đọc một đoạn kể lại thành
         hiện trường. */
      const bare = readFileSync(dir + file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
      if (/\.data\s*\?\?/.test(bare)) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })

  it('và ba mặt — ô bảng, trạng thái hồ sơ, tên bản ghi — trả lời như nhau', () => {
    /* Cùng một bản ghi hai-hình-dạng, ba đường đọc khác nhau trong gói. Lỗi
       trước đây khác nhau ở cả ba: ô vẽ gạch ngang, trạng thái biến mất, tên
       thì đúng. */
    const key = CONTRACT.list!.main!.key
    const state = CONTRACT.stateProperty!
    const both = { id: 'r1', [state]: 'ACTIVE', data: { [key]: 'Trần A' } }

    const m = recordModel({ contract: CONTRACT, record: both, loading: false, empty: EMPTY }, ctx)
    if (m.state.kind !== 'ready' && m.state.kind !== 'partial') throw new Error(m.state.kind)
    expect(m.state.data.state, 'trạng thái đọc từ tầng trên cùng').toBe('ACTIVE')
    expect(subjectOf(CONTRACT, both)?.text, 'tên đọc từ trong bọc').toBe('Trần A')
    expect(cellOf(both, CONTRACT.list!.main!, ctx).kind).not.toBe('blank')
  })
})

describe('⭐ `readValue` · `fieldsOf` — xuất ra để app XOÁ bản sao, không phải để CANH', () => {
  const both = { id: 'r1', provinceCode: '01', signedBy: 'CT-UBND', data: { fullName: 'Trần A', signedBy: 'ontology' } }

  it('đọc được cả hai tầng, bọc thắng khi trùng tên', () => {
    expect(readValue(both, 'provinceCode')).toBe('01')
    expect(readValue(both, 'fullName')).toBe('Trần A')
    expect(readValue(both, 'signedBy')).toBe('ontology')
  })

  it('vắng ở CẢ HAI chỗ thì trả `ABSENT`, không trả `undefined` trông như rỗng', () => {
    expect(readValue(both, 'khongCo')).toBe(ABSENT)
    /* Một khoá CÓ mà giá trị null là bản ghi không có liên kết — khác hẳn. */
    expect(readValue({ id: 'r', a: null }, 'a')).toBe(null)
  })

  it('`fieldsOf` gộp phẳng cho người đọc NHIỀU trường một lúc', () => {
    const f = fieldsOf(both)
    expect(f.provinceCode).toBe('01')
    expect(f.fullName).toBe('Trần A')
    expect(f.signedBy).toBe('ontology')
  })

  it('⚠️ và `data` bị bỏ khỏi kết quả — một bản phẳng còn `data` lồng trong là mời lại đúng cái nhầm này', () => {
    expect('data' in fieldsOf(both)).toBe(false)
    expect(fieldsOf({ id: 'r', a: 1 })).toEqual({ id: 'r', a: 1 })
  })

  it('⛔ BẢN CŨ `row.data ?? row` CẮT MẤT trường tầng trên cùng', () => {
    /*
     * ⭐ VẾ NÀY DO PHIÊN APP NGHĨ RA, VÀ NÓ TỐT HƠN CÁCH TÔI LÀM.
     *
     *   Mọi phép phá của tôi trong đợt này đều là THAO TÁC TAY: sửa tệp, chạy,
     *   trả lại — nên bằng chứng "cái cũ hỏng" chỉ còn trong lời commit, không
     *   còn trong kho. Giữ bản cũ ngay tại đây thì phép thử nói được CẢ HAI vế:
     *   bản mới đúng, VÀ cái cũ hỏng ở đâu.
     *
     *   Người sửa lần sau cần vế thứ hai hơn vế thứ nhất.
     */
    const oldRead = (row: Record<string, unknown>, key: string) =>
      ((row.data ?? row) as Record<string, unknown>)[key]

    expect(oldRead(both, 'provinceCode'), 'giá trị CÓ THẬT, bản cũ trả undefined').toBe(undefined)
    expect(readValue(both, 'provinceCode')).toBe('01')

    /* Và vì sao nó không ai thấy: `undefined` thành `blank` hai hàm sau đó —
       một dấu gạch ngang, y như một trường rỗng thật. */
    expect(oldRead(both, 'fullName'), 'trường trong bọc thì bản cũ vẫn đúng').toBe('Trần A')
  })

  it('bản ghi phẳng, không bọc, đi qua cả hai hàm không đổi', () => {
    const flat = { id: 'r', a: 1, b: 2 }
    expect(readValue(flat, 'b')).toBe(2)
    expect(fieldsOf(flat)).toEqual(flat)
  })
})
