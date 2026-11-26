import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { ActionBar, type ActionItem } from './action-bar.js'
import { setPrefix } from '../prefix/index.js'

afterEach(() => { cleanup(); setPrefix('fos') })

const I = <svg />
const START: ActionItem = { key: 'start', label: 'Bắt đầu khám', icon: I, advances: true }
const REPORT: ActionItem = { key: 'report', label: 'Báo cáo', icon: I, exits: true }
const COPY: ActionItem = { key: 'copy', label: 'Nhân bản', icon: I }
const FINISH: ActionItem = { key: 'finish', label: 'Kết thúc khám', icon: I, destroys: true }
const CANCEL: ActionItem = { key: 'cancel', label: 'Huỷ', icon: I, exits: true }

const inPlace = (c: HTMLElement) =>
  Array.from(c.querySelectorAll(':scope [role="group"] > .fos-btn:not(.fos-btn--menu), :scope [role="group"] > .fos-actions > .fos-btn'))
    .filter((b) => !b.hasAttribute('aria-haspopup'))
const inMenu = (c: HTMLElement) => Array.from(c.querySelectorAll('[role="menuitem"]')).map((e) => e.textContent)

const trigger = (c: HTMLElement) => c.querySelector('[aria-haspopup="menu"]')

/* ⛔ Đổi 27/9/2026 — thay luật 26/9 "còn lại sau ⋯": 1 việc chính + 1 việc phụ hiện
   ra; đúng hai việc phụ thì hiện cả hai; không bao giờ menu một mục. */
describe('⭐ 1 việc chính + 1 việc phụ; đúng hai phụ thì cả hai; menu "Thêm" không bao giờ một mục', () => {
  it('trên trang: việc chính tô `key`; ba việc phụ → một hiện ra, hai vào menu (việc xoá vào trước)', () => {
    const c = render(<ActionBar surface="page" label="Việc của đợt" moreIcon={I} moreLabel="Thêm" actions={[REPORT, COPY, FINISH, START]} />).container
    const here = inPlace(c)
    expect(here.map((b) => b.textContent)).toEqual(['Báo cáo', 'Bắt đầu khám'])
    expect(here[1].className).toContain('fos-btn--key')
    expect(here[0].className).not.toContain('fos-btn--key')
    expect(inMenu(c)).toEqual(['Nhân bản', 'Kết thúc khám'])
    expect(c.querySelector('[role="menuitem"][data-tier="danger"]')?.textContent).toBe('Kết thúc khám')
  })

  it('⭐ đúng hai việc phụ thì hiện cả hai — không có menu một mục', () => {
    const c = render(<ActionBar surface="card" label="Việc với mục" actions={[COPY, REPORT, { ...START, primary: true }]} />).container
    expect(inPlace(c).map((b) => b.textContent)).toEqual(['Nhân bản', 'Báo cáo', 'Bắt đầu khám'])
    expect(trigger(c)).toBeNull()
  })

  it('⭐ nút mở menu mang CHỮ, không chỉ "⋯" — và tên của nó nói menu của cái gì', () => {
    const c = render(<ActionBar surface="page" label="Việc của đợt" moreIcon={I} moreLabel="Thêm" actions={[REPORT, COPY, FINISH, START]} />).container
    expect(trigger(c)?.textContent).toBe('Thêm')
    expect(trigger(c)?.getAttribute('aria-label')).toBe('Thêm: Việc của đợt')
  })

  it('hộp thoại: lối ra đứng CẠNH việc chính, và KHÔNG mang dáng nút chính', () => {
    const c = render(<ActionBar surface="dialog" label="Tiếp đón" actions={[CANCEL, START]} />).container
    const here = inPlace(c)
    expect(here.map((b) => b.textContent)).toEqual(['Huỷ', 'Bắt đầu khám'])
    expect(here[0].className).toContain('fos-btn--quiet')
    expect(here[0].className).not.toContain('fos-btn--key')
    expect(trigger(c)).toBeNull()
  })

  it('dòng bảng: không có việc chính — hai việc là hai hình, không chữ, không menu', () => {
    const c = render(<ActionBar surface="table" label="Thao tác cho An" moreIcon={I} actions={[{ ...COPY, primary: true }, REPORT]} />).container
    expect(c.querySelector('.fos-btn--key')).toBeNull()
    expect(inMenu(c)).toEqual([])
    expect(Array.from(c.querySelectorAll('button')).map((b) => [b.getAttribute('aria-label'), b.textContent])).toEqual([['Nhân bản', ''], ['Báo cáo', '']])
  })

  /* 27/9/2026 — "style nút delete không đúng": trong dòng, việc xoá đứng cạnh việc khác
     là ô viền đỏ duy nhất của dòng. Nó vào menu — và menu không bao giờ một mục. */
  it('⛔ dòng bảng: việc xoá không đứng cạnh việc khác — cả hai vào menu, việc xoá đọc bằng mực đỏ', () => {
    const c = render(<ActionBar surface="table" label="Thao tác cho An" moreIcon={I} actions={[COPY, FINISH]} />).container
    expect(c.querySelector('.fos-btn--danger')).toBeNull()
    expect(inMenu(c)).toEqual(['Nhân bản', 'Kết thúc khám'])
    expect(c.querySelector('[role="menuitem"][data-tier="danger"]')?.textContent).toBe('Kết thúc khám')
  })

  it('⭐ thẻ lặp lại (`item`): không có việc chính, việc hiện ra có chữ', () => {
    const c = render(<ActionBar surface="item" label="Việc ở phòng" actions={[{ ...START, primary: true }, COPY]} />).container
    expect(c.querySelector('.fos-btn--key')).toBeNull()
    expect(inPlace(c).map((b) => b.textContent)).toEqual(['Bắt đầu khám', 'Nhân bản'])
  })

  it('bấm một mục trong menu thì gọi đúng việc ấy', () => {
    const onSelect = vi.fn()
    const c = render(<ActionBar surface="page" label="Việc" moreIcon={I} moreLabel="Thêm" actions={[START, REPORT, { ...COPY, onSelect }, FINISH]} />).container
    fireEvent.click(Array.from(c.querySelectorAll('[role="menuitem"]')).find((e) => e.textContent === 'Nhân bản')!)
    expect(onSelect).toHaveBeenCalledOnce()
  })
})

describe('⛔ nút khoá nói vì sao — hiện ra, không chỉ nằm trong tooltip', () => {
  it('lý do đứng cạnh nút và làm tên phụ cho trình đọc màn hình', () => {
    const c = render(<ActionBar surface="dialog" label="Tiếp đón" actions={[CANCEL,
      { ...START, disabled: { because: 'Người khám chưa đồng ý', hint: 'tích ô đồng ý' } }]} />).container
    const b = Array.from(c.querySelectorAll('button')).find((x) => x.textContent === 'Bắt đầu khám')!
    expect(b.disabled).toBe(true)
    const note = c.querySelector(`#${CSS.escape(b.getAttribute('aria-describedby')!)}`)
    expect(note?.textContent).toBe('Người khám chưa đồng ý — tích ô đồng ý')
  })
})

describe('⭐ nhiều nút cùng khoá: lý do gom về MỘT chỗ sau hàng nút, không chen giữa các nút', () => {
  it('dưới hàng nút, mỗi nút một dòng theo thứ tự các nút, mang tên nút; nút nào cũng trỏ tới dòng của mình', () => {
    const c = render(<ActionBar surface="card" label="Việc với Khám sức khoẻ" actions={[
      { key: 'save', label: 'Lưu', icon: I, disabled: { because: 'Chưa có thay đổi nào để lưu' } },
      { key: 'submit', label: 'Submit kết quả', icon: I, advances: true, primary: true, disabled: { because: 'Còn thiếu: Chiều cao' } },
    ]} />).container
    const group = c.querySelector('[role="group"]')!
    const kids = Array.from(group.children)
    expect(kids.map((k) => k.tagName)).toEqual(['BUTTON', 'BUTTON', 'UL'])
    expect(group.className).toContain('fos-actions--noted')
    expect(Array.from(kids[2].querySelectorAll('li')).map((li) => li.textContent))
      .toEqual(['Lưu — Chưa có thay đổi nào để lưu', 'Submit kết quả — Còn thiếu: Chiều cao'])
    for (const b of Array.from(group.querySelectorAll('button'))) {
      expect(c.querySelector(`#${CSS.escape(b.getAttribute('aria-describedby')!)}`)?.textContent).toContain(b.textContent!)
    }
  })
})

describe('⛔ một MẶT một việc chính — đếm qua mọi thanh', () => {

  it('dòng bảng không có việc chính — trăm dòng cũng không đụng việc chính của trang', () => {
    expect(() => render(<>
      <ActionBar surface="page" label="Đầu trang" actions={[START]} />
      <table><tbody>
        {[1, 2, 3].map((n) => <tr key={n}><td><ActionBar surface="table" label={`Dòng ${n}`} actions={[{ ...COPY, advances: true }]} /></td></tr>)}
      </tbody></table>
    </>)).not.toThrow()
  })

  it('trong dòng bảng, lý do khoá KHÔNG in giữa dòng — chỉ là tên phụ ẩn', () => {
    const c = render(<ActionBar surface="table" label="Dòng" actions={[{ ...COPY, disabled: { because: 'Chưa ngồi phòng' } }]} />).container
    expect(c.querySelector('.fos-hint')).toBeNull()
    expect(c.querySelector('.fos-sr-only')?.textContent).toBe('Chưa ngồi phòng')
  })
})

describe('⭐ PHẠM VI: màn một việc chính; mỗi thẻ / section là phạm vi riêng', () => {
  const SAVE: ActionItem = { key: 'save', label: 'Lưu', icon: I }
  const RELEASE: ActionItem = { key: 'release', label: 'Trả về hàng chờ', icon: I }

  it('một thẻ có việc mà không có việc chính — được, nếu đầu trang có việc chính', () => {
    expect(() => render(<>
      <ActionBar surface="page" label="Đầu trang" actions={[START]} />
      <ActionBar surface="card" label="Thẻ" actions={[SAVE, RELEASE]} />
    </>)).not.toThrow()
  })
  it('⭐ thẻ là phạm vi riêng: hai thẻ, mỗi thẻ một việc chính, cùng việc chính của trang — được', () => {
    const c = render(<>
      <ActionBar surface="page" label="Đầu trang" actions={[START]} />
      <ActionBar surface="card" label="Phòng A" actions={[{ ...SAVE, primary: true }, RELEASE]} />
      <ActionBar surface="card" label="Phòng B" actions={[{ ...SAVE, primary: true }, RELEASE]} />
    </>).container
    expect(c.querySelectorAll('.fos-btn--key')).toHaveLength(3)
  })
})

describe('⛔ menu là MỘT khung', () => {
  /* Bản đầu bọc <Menu> trong một khối nổi cũng mang lớp `menu`: hai viền, hai bóng
     lồng nhau. Người dùng chụp lại 26/9/2026 — "cái popup này tệ quá". */
  it('đúng một phần tử mang lớp menu, và chính nó là hộp nổi', () => {
    const c = render(<ActionBar surface="page" label="Việc" moreIcon={I} moreLabel="Thêm" actions={[START, COPY, REPORT, FINISH]} />).container
    const menus = c.querySelectorAll('.fos-menu')
    expect(menus).toHaveLength(1)
    expect(menus[0].getAttribute('popover')).toBe('auto')
    expect(menus[0].getAttribute('role')).toBe('menu')
  })
})
