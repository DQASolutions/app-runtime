import { describe, expect, it } from 'vitest'
import { actionBar, actionViews, inSightCount, primaryOf, TIER_PAINT, type ActionFacts } from './action.js'

const tier = (list: ActionFacts[]) =>
  Object.fromEntries(actionViews(list).map((v) => [v.key, v.tier]))

/* The three steps of a real approval screen, as the workflow declares them. */
const APPROVE: ActionFacts = { key: 'approve', label: 'Phê duyệt', advances: true, outcome: 'approve' }
const REJECT: ActionFacts = { key: 'reject', label: 'Trả về', advances: true, outcome: 'reject' }
const CANCEL: ActionFacts = { key: 'cancel', label: 'Huỷ', exits: true }

describe('one screen, exactly one primary', () => {
  it('gives the approval the key tier and nothing else', () => {
    expect(tier([APPROVE, REJECT, CANCEL]))
      .toEqual({ approve: 'key', reject: 'normal', cancel: 'quiet' })
  })

  /* ⛔ Đổi 26/9/2026 — người dùng: "trên 1 màn hình luôn phải define button nào
     là chính". Trước đây hai bước cùng đi tiếp thì màn PHẲNG ("flat beats
     wrong"); nay đó là một chỗ THIẾU, được nêu ra, và tác giả màn chỉ định. */
  it('⛔ two advancing steps and nobody said which: NO primary, and it is reported', () => {
    const list = [
      { key: 'select', label: 'Tuyển chọn', advances: true },
      { key: 'defer', label: 'Tạm hoãn', advances: true },
      CANCEL,
    ]
    expect(primaryOf(list)).toBeNull()
    expect(actionBar(list, { surface: 'page' }).missingPrimary).toBe(true)
  })

  it('⭐ the screen author settles it with `primary`', () => {
    const t = tier([
      { key: 'select', label: 'Tuyển chọn', advances: true, primary: true },
      { key: 'defer', label: 'Tạm hoãn', advances: true },
      CANCEL,
    ])
    expect(t).toEqual({ select: 'key', defer: 'normal', cancel: 'quiet' })
  })

  it('⛔ two `primary` is the same non-answer as none', () => {
    expect(primaryOf([
      { key: 'a', label: 'A', primary: true }, { key: 'b', label: 'B', primary: true },
    ])).toBeNull()
  })

  it('a destroying primary keeps its place but never the solid paint', () => {
    const [v] = actionViews([{ key: 'close', label: 'Đóng đợt khám', advances: true, destroys: true }])
    expect(v.primary).toBe(true)
    expect(v.tier).toBe('danger')
  })

  it('an exit is never the primary — leaving is not what a screen is for', () => {
    expect(primaryOf([CANCEL])).toBeNull()
    expect(actionBar([CANCEL], { surface: 'dialog' }).missingPrimary).toBe(false)
  })

  it('never yields two key actions, whatever it is handed', () => {
    const swarm: ActionFacts[] = [
      APPROVE, { key: 'a2', label: 'Duyệt lần hai', advances: true, outcome: 'approve' },
      REJECT, CANCEL, { key: 'del', label: 'Xoá', destroys: true },
    ]
    const keys = actionViews(swarm).filter((v) => v.tier === 'key')
    expect(keys.length).toBeLessThanOrEqual(1)
  })
})

describe('the tier says what the action does', () => {
  it('sends every exit to `quiet`, which is the 53-of-59 case', () => {
    for (const label of ['Huỷ', 'Hủy', 'Đóng', 'Bỏ chọn']) {
      expect(tier([APPROVE, { key: 'x', label, exits: true }]).x).toBe('quiet')
    }
  })

  it('marks what destroys as `danger`, never as `key`', () => {
    const t = tier([{ key: 'del', label: 'Đưa ra khỏi danh sách', advances: true, destroys: true }])
    expect(t.del).toBe('danger')
  })

  it('⭐ a lone step IS the point of its surface — it is the primary', () => {
    expect(tier([{ key: 'note', label: 'Ghi chú' }, CANCEL]))
      .toEqual({ note: 'key', cancel: 'quiet' })
  })
})

describe('what a renderer receives', () => {
  it('⛔ keeps ONE label while busy — the word must not move under the finger', () => {
    const [v] = actionViews([{ ...APPROVE, busy: true }])
    expect(v.busy).toBe(true)
    expect(v.label).toBe('Phê duyệt')
    /* ⚠️ Asserting THE WORD APPEARS ONCE, not an exact key list. The shape grows
       (`icon`, `showLabel`) and an exact list makes every addition look like a
       regression while never checking the thing that matters — that there is no
       second place to put a different word for the busy state. */
    expect(Object.values(v).filter((x) => x === 'Phê duyệt')).toHaveLength(1)
  })

  it('⛔ carries a reason whenever it is disabled', () => {
    const [v] = actionViews([
      { ...APPROVE, disabled: { because: 'Chưa có biên bản họp', hint: 'Ghi biên bản trước' } },
    ])
    expect(v.disabled).not.toBe(true)
    if (v.disabled === false) throw new Error('narrowing')
    expect(v.disabled.because).toBeTruthy()
  })

  it('is not disabled by default', () => {
    expect(actionViews([APPROVE])[0].disabled).toBe(false)
  })
})

describe('paint', () => {
  it('⛔ leaves the ordinary button on a surface, never on the action colour', () => {
    expect(TIER_PAINT.normal.background).toBe('var(--fos-surface)')
    expect(TIER_PAINT.key.background).toBe('var(--fos-primary)')
  })

  it('names tokens only — this package emits no CSS rules', () => {
    for (const paint of Object.values(TIER_PAINT)) {
      for (const value of [paint.background, paint.ink, paint.border]) {
        if (value == null) continue
        expect(value === 'transparent' || value.startsWith('var(--fos-')).toBe(true)
      }
    }
  })
})

/* ⛔ Đổi 27/9/2026 — 1 việc chính + 1 việc phụ hiện ra; đúng hai việc phụ thì hiện
   cả hai; không bao giờ menu một mục (NN/g, Material 3, Polaris, GOV.UK). Người
   dùng: "nếu keep tối đa 2 button, 1 chính 1 phụ" — "ok, nhìn hợp lý đấy". */
describe('one secondary in sight; both when exactly two; never a menu of one', () => {
  const a = (key: string, more: Partial<ActionFacts> = {}): ActionFacts => ({ key, label: key, icon: key, ...more })
  const place = (list: ActionFacts[], surface: Parameters<typeof actionBar>[1]['surface']) => {
    const bar = actionBar(list, { surface })
    return { inline: bar.inline.map((v) => v.key), menu: bar.menu.map((v) => v.key), words: bar.inline.map((v) => v.showLabel) }
  }

  it('counts: 0 · 1 · exactly 2 → both · 3+ → one in sight, the rest (≥2) in the menu', () => {
    expect([0, 1, 2, 3, 4, 7].map(inSightCount)).toEqual([0, 1, 2, 1, 1, 1])
  })

  it('⭐ a card with a primary and two secondaries shows all three, words and all — no "⋯"', () => {
    const p = place([a('submit', { advances: true, primary: true }), a('save'), a('release')], 'card')
    expect(p).toEqual({ inline: ['save', 'release', 'submit'], menu: [], words: [true, true, true] })
  })

  it('⛔ never a menu of one: three secondaries keep one in sight, two behind the trigger', () => {
    const p = place([a('main', { primary: true }), a('x'), a('y'), a('z')], 'page')
    expect(p.inline).toEqual(['x', 'main'])
    expect(p.menu).toEqual(['y', 'z'])
  })

  it('four secondaries: still ONE in sight', () => {
    const p = place([a('main', { primary: true }), a('x'), a('y'), a('z'), a('w')], 'page')
    expect(p.inline).toEqual(['x', 'main'])
    expect(p.menu).toEqual(['y', 'z', 'w'])
  })

  it('what destroys is the first to go into the menu, where the word is read before the press', () => {
    const p = place([a('main', { primary: true }), a('finish', { destroys: true }), a('x'), a('y')], 'page')
    expect(p.inline).toEqual(['x', 'main'])
    expect(p.menu).toEqual(['finish', 'y'])
  })

  it("a dialog's way out COUNTS as a secondary and is the one kept in sight — never four in a row", () => {
    const p = place([a('cancel', { exits: true }), a('save', { advances: true }), a('x')], 'dialog')
    expect(p).toEqual({ inline: ['cancel', 'x', 'save'], menu: [], words: [true, true, true] })
    const three = place([a('cancel', { exits: true }), a('save', { advances: true }), a('x'), a('y')], 'dialog')
    expect(three.inline).toEqual(['cancel', 'save'])
    expect(three.menu).toEqual(['x', 'y'])
    const more = place([a('cancel', { exits: true }), a('save', { advances: true }), a('del', { destroys: true }), a('x'), a('y')], 'form')
    expect(more.inline).toEqual(['cancel', 'save'])
    expect(more.menu).toEqual(['x', 'y', 'del'])
  })

  it('⭐ `item` — a card repeated in a list: no primary, words in sight', () => {
    const bar = actionBar([a('queue', { advances: true }), a('leave')], { surface: 'item' })
    expect(bar.inline.map((v) => [v.key, v.primary, v.tier, v.showLabel]))
      .toEqual([['queue', false, 'normal', true], ['leave', false, 'normal', true]])
    expect(bar.menu).toEqual([])
    expect(bar.missingPrimary).toBe(false)
  })

  it('`table` — a row: no primary, icons in sight up to two, then the menu', () => {
    expect(place([a('open'), a('edit')], 'table')).toEqual({ inline: ['open', 'edit'], menu: [], words: [false, false] })
    const three = place([a('open'), a('edit'), a('del', { destroys: true })], 'table')
    expect(three.inline).toEqual(['open'])
    expect(three.menu).toEqual(['edit', 'del'])
  })

  it('⭐ scope: a card may leave the primary to another bar; a page head may not', () => {
    const two = [a('save'), a('release')]
    expect(actionBar(two, { surface: 'card' }).missingPrimary).toBe(false)
    expect(actionBar(two, { surface: 'page' }).missingPrimary).toBe(true)
    expect(actionBar(two, { surface: 'dialog' }).missingPrimary).toBe(true)
  })

  /* 27/9/2026 — "style nút delete không đúng": nút xoá đứng cạnh một nút khác trong
     dòng thì là ô viền đỏ duy nhất của dòng. Nó vào menu; menu không bao giờ một mục. */
  it('⛔ a row: what destroys never stands beside another action — and never a menu of one', () => {
    expect(place([a('edit'), a('unpublish', { destroys: true })], 'table'))
      .toEqual({ inline: [], menu: ['edit', 'unpublish'], words: [] })
    expect(place([a('open'), a('edit'), a('del', { destroys: true })], 'table'))
      .toEqual({ inline: ['open'], menu: ['edit', 'del'], words: [false] })
    expect(place([a('del', { destroys: true })], 'table'))
      .toEqual({ inline: ['del'], menu: [], words: [false] })
    expect(place([a('open'), a('edit')], 'table'))
      .toEqual({ inline: ['open', 'edit'], menu: [], words: [false, false] })
  })

  it('never more than one `key` on a surface, whatever the count', () => {
    for (const surface of ['page', 'card', 'dialog', 'form', 'rail', 'item', 'table'] as const) {
      const bar = actionBar([a('m', { primary: true }), a('x'), a('y'), a('z'), a('w')], { surface })
      expect([...bar.inline, ...bar.menu].filter((v) => v.tier === 'key').length).toBeLessThanOrEqual(1)
    }
  })
})
