import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { FilterSelect } from './filter.js'
import { setPrefix } from '../prefix/index.js'

afterEach(() => { cleanup(); setPrefix('fos') })

const OPTS = [
  { value: '', label: 'Tất cả', count: 4 },
  { value: 'PROPOSED', label: 'Đang lập', count: 1 },
  { value: 'SUBMITTED', label: 'Đã trình', count: 1 },
  { value: 'VOID', label: 'Đã huỷ', count: 0 },
]
const draw = (p = {}) => render(
  <FilterSelect label="Trạng thái" value="" options={OPTS} onPick={() => {}}
    addLabel="+ Bộ lọc" clearLabel="Bỏ lọc trạng thái" {...p} />,
).container
const nut = (c: HTMLElement) => c.querySelector('button')!

describe('⭐ CHƯA LỌC thì gần như không chiếm chỗ', () => {
  /*
   * ⛔ ĐÂY LÀ KHẲNG ĐỊNH CHÍNH CỦA CẢ PHẦN TỬ NÀY, và là chỗ hai bản trước sai.
   *    Dải vòng đời và hàng lát đều bày MỌI lựa chọn ra trước khi ai hỏi. Trên
   *    một danh sách 12 trạng thái, đó là một bức tường.
   */
  it('chưa lọc: đúng MỘT nút, và KHÔNG lựa chọn nào hiện ra', () => {
    const c = draw()
    expect(c.querySelectorAll('button').length).toBe(1)
    expect(c.querySelectorAll('[role="option"]').length).toBe(0)
    expect(nut(c).textContent).toBe('+ Bộ lọc')
  })

  it('nút nói nó mở ra một hộp danh sách, và đang đóng', () => {
    const b = nut(draw())
    expect(b.getAttribute('aria-haspopup')).toBe('listbox')
    expect(b.getAttribute('aria-expanded')).toBe('false')
    expect(b.hasAttribute('aria-controls')).toBe(false)
  })
})

describe('ĐÃ LỌC — một viên đọc ra được, gỡ được ngay tại chỗ', () => {
  it('viên in tên trục và giá trị đang chọn', () => {
    const c = draw({ value: 'PROPOSED' })
    expect(c.querySelectorAll('button')[0].textContent).toBe('Trạng thái: Đang lập')
  })

  /* ⭐ Bỏ lọc là việc làm nhiều thứ hai sau đặt lọc; bắt mở popover ra để bỏ là
     thêm một bước cho việc thường xuyên nhất. */
  it('cái × gỡ lọc nằm NGAY TRONG viên, không phải trong popover', () => {
    const onPick = vi.fn()
    const c = draw({ value: 'PROPOSED', onPick })
    const x = c.querySelectorAll('button')[1]
    expect(x.getAttribute('aria-label')).toBe('Bỏ lọc trạng thái')
    fireEvent.click(x)
    expect(onPick).toHaveBeenCalledWith('')
  })

  it('mục "Tất cả" (value rỗng) KHÔNG biến thành một viên', () => {
    expect(draw({ value: '' }).querySelectorAll('button').length).toBe(1)
  })
})

describe('POPOVER — hộp danh sách, không phải thực đơn', () => {
  /*
   * ⚠️ `listbox`, KHÔNG phải `menu`. Thực đơn chứa VIỆC; đây là chọn một GIÁ
   *    TRỊ. Trình đọc màn hình nói hai thứ ấy khác nhau.
   */
  it('mở ra <ul role=listbox> có tên, mỗi dòng là một option', () => {
    const c = draw()
    fireEvent.click(nut(c))
    const list = c.querySelector('ul')!
    expect(list.getAttribute('role')).toBe('listbox')
    expect(list.getAttribute('aria-label')).toBe('Trạng thái')
    expect(c.querySelectorAll('[role="option"]').length).toBe(4)
  })

  it('hộp mang lớp lớp-nổi của nhân — không thì bị ô cuộn cắt mất', () => {
    const c = draw()
    fireEvent.click(nut(c))
    expect(c.querySelector('ul')!.className).toBe('fos-menu fos-menu--pop')
  })

  it('nút nối với hộp bằng aria-controls khi mở', () => {
    const c = draw()
    fireEvent.click(nut(c))
    expect(nut(c).getAttribute('aria-expanded')).toBe('true')
    expect(nut(c).getAttribute('aria-controls')).toBe(c.querySelector('ul')!.id)
  })

  it('đúng MỘT option mang aria-selected=true, là cái đang chọn', () => {
    const c = draw({ value: 'SUBMITTED' })
    fireEvent.click(c.querySelectorAll('button')[0])
    const on = [...c.querySelectorAll('[role="option"]')].filter((o) => o.getAttribute('aria-selected') === 'true')
    expect(on.length).toBe(1)
    expect(on[0].textContent).toContain('Đã trình')
  })

  it('số 0 vẫn hiện — nói trạng thái ấy CÓ và đang rỗng', () => {
    const c = draw()
    fireEvent.click(nut(c))
    expect([...c.querySelectorAll('.fos-count')].map((x) => x.textContent)).toEqual(['4', '1', '1', '0'])
  })

  it('chọn một mục thì gọi onPick và ĐÓNG hộp', () => {
    const onPick = vi.fn()
    const c = draw({ onPick })
    fireEvent.click(nut(c))
    fireEvent.click([...c.querySelectorAll('[role="option"]')][1])
    expect(onPick).toHaveBeenCalledWith('PROPOSED')
    expect(c.querySelector('ul')).toBeNull()
  })

  it('bấm ra ngoài thì đóng', () => {
    const c = draw()
    fireEvent.click(nut(c))
    expect(c.querySelector('ul')).not.toBeNull()
    fireEvent.mouseDown(document.body)
    expect(c.querySelector('ul')).toBeNull()
  })
})

describe('BÀN PHÍM — mở ra là dùng được mà không cần chuột', () => {
  /* ⚠️ Tiêu điểm vào lựa chọn ĐANG CHỌN, không vào cái đầu — người ta mở ra để
     đổi từ chỗ đang đứng. */
  it('mở ra thì tiêu điểm rơi vào mục đang chọn', () => {
    const c = draw({ value: 'SUBMITTED' })
    fireEvent.click(c.querySelectorAll('button')[0])
    expect(document.activeElement!.textContent).toContain('Đã trình')
  })

  it('chưa chọn gì thì tiêu điểm rơi vào mục đầu', () => {
    const c = draw()
    fireEvent.click(nut(c))
    expect(document.activeElement!.textContent).toContain('Tất cả')
  })

  it('mũi tên xuống/lên chạy vòng trong danh sách', () => {
    const c = draw()
    fireEvent.click(nut(c))
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(document.activeElement!.textContent).toContain('Đang lập')
    fireEvent.keyDown(document, { key: 'ArrowUp' })
    expect(document.activeElement!.textContent).toContain('Tất cả')
    fireEvent.keyDown(document, { key: 'ArrowUp' })
    expect(document.activeElement!.textContent).toContain('Đã huỷ')
  })

  it('Home và End nhảy đầu/cuối', () => {
    const c = draw()
    fireEvent.click(nut(c))
    fireEvent.keyDown(document, { key: 'End' })
    expect(document.activeElement!.textContent).toContain('Đã huỷ')
    fireEvent.keyDown(document, { key: 'Home' })
    expect(document.activeElement!.textContent).toContain('Tất cả')
  })

  /*
   * ⛔ Esc PHẢI TRẢ TIÊU ĐIỂM VỀ NÚT. Thiếu bước ấy thì tiêu điểm rơi về đầu
   *    trang và người dùng bàn phím phải Tab lại từ đầu — đúng lúc họ vừa nói
   *    "thôi, không lọc nữa".
   */
  it('Esc đóng hộp VÀ trả tiêu điểm về nút', () => {
    const c = draw()
    const b = nut(c)
    fireEvent.click(b)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(c.querySelector('ul')).toBeNull()
    expect(document.activeElement).toBe(b)
  })

  it('chọn bằng chuột cũng trả tiêu điểm về nút', () => {
    const c = draw({ onPick: () => {} })
    const b = nut(c)
    fireEvent.click(b)
    fireEvent.click([...c.querySelectorAll('[role="option"]')][1])
    expect(document.activeElement).toBe(b)
  })
})

describe('linh tinh nhưng phải đúng', () => {
  it('mọi nút là type=button — trong <form> không được gửi biểu mẫu', () => {
    const c = draw({ value: 'PROPOSED' })
    fireEvent.click(c.querySelectorAll('button')[0])
    for (const b of c.querySelectorAll('button')) expect(b.getAttribute('type')).toBe('button')
  })
  it('đổi stem thì lớp đổi theo', () => {
    setPrefix('acme')
    const c = draw()
    fireEvent.click(nut(c))
    expect(c.querySelector('ul')!.className).toBe('acme-menu acme-menu--pop')
    expect(c.firstElementChild!.className).toBe('acme-menu-anchor')
  })
})

describe('⛔ viên dựng bằng NÚT THẬT, không phải span đội lớp điều khiển', () => {
  /*
   * Bản đầu bọc hai nút trong `<span className="fos-btn fos-btn--normal">`:
   * trông đúng, mà là gắn lớp ĐIỀU KHIỂN lên một thứ không phải điều khiển —
   * nó ăn `cursor: pointer`, ăn `:hover`, và trình đọc màn hình nghe MỘT cái
   * nút chứa HAI cái nút.
   */
  it('vỏ viên là hàng việc, KHÔNG mang lớp nút', () => {
    const c = draw({ value: 'PROPOSED' })
    const shell = c.firstElementChild!.firstElementChild!
    expect(shell.tagName).toBe('SPAN')
    expect(shell.className).toBe('fos-actions')
    expect(shell.className).not.toContain('fos-btn')
  })

  it('hai nút bên trong là <button> thật, mỗi cái một bậc', () => {
    const c = draw({ value: 'PROPOSED' })
    const bs = [...c.querySelectorAll('button')]
    expect(bs.length).toBe(2)
    expect(bs[0].className).toBe('fos-btn fos-btn--normal')
    expect(bs[1].className).toBe('fos-btn fos-btn--quiet fos-btn--icon')
  })

  /* ⛔ Nhân KHÔNG vẽ hình. Bên gọi đưa hình của bộ icon nó đang dùng; `×` chỉ là
     lối lui để cái nút không bao giờ vô hình. */
  it('hình của nút gỡ do bên gọi đưa vào', () => {
    const c = draw({ value: 'PROPOSED', clearIcon: <svg data-icon="" /> })
    expect(c.querySelectorAll('button')[1].querySelector('svg')).not.toBeNull()
  })

  it('không đưa hình thì vẫn có `×`, không để nút rỗng', () => {
    const c = draw({ value: 'PROPOSED' })
    expect(c.querySelectorAll('button')[1].textContent).toBe('×')
  })

  it('chưa lọc thì nút ở bậc quiet — không tranh chỗ với tiêu đề thẻ', () => {
    expect(nut(draw()).className).toBe('fos-btn fos-btn--quiet')
  })
})
