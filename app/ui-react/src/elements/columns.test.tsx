import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup, fireEvent, act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { ColumnPicker, useColumnVisibility, type ColumnPickerChoice } from './columns.js'
import { setPrefix } from '../prefix/index.js'

afterEach(() => { cleanup(); setPrefix('fos') })

const CHOICES: ColumnPickerChoice[] = [
  { key: 'fullName', label: 'Họ và tên', shown: true, locked: true },
  { key: 'status', label: 'Trạng thái', shown: true },
  { key: 'kind', label: 'Loại', shown: true },
  { key: 'phone', label: 'Điện thoại', shown: false },
  { key: 'note', label: 'Ghi chú', shown: false, hint: 'trống' },
]
const draw = (p = {}) => render(
  <ColumnPicker label="Cột hiển thị" trigger="2 cột ẩn" choices={CHOICES}
    visibility={{}} onChange={() => {}} resetLabel="Về mặc định" {...p} />,
).container
const nut = (c: HTMLElement) => c.querySelector('button')!
const hop = (c: HTMLElement) => c.querySelector<HTMLElement>('[role="group"]')
const checkboxes = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))

describe('⭐ ĐÓNG thì chỉ là MỘT nút trên đầu thẻ', () => {
  it('đúng một nút, chữ của app, không ô tích nào hiện ra', () => {
    const c = draw()
    expect(c.querySelectorAll('button')).toHaveLength(1)
    expect(nut(c).textContent).toBe('2 cột ẩn')
    expect(checkboxes(c)).toHaveLength(0)
  })

  it('nút là `quiet`, `type=button`, nói nó đang đóng và KHÔNG hứa một thực đơn', () => {
    const b = nut(draw())
    expect(b.className).toBe('fos-btn fos-btn--quiet')
    expect(b.getAttribute('type')).toBe('button')
    expect(b.getAttribute('aria-expanded')).toBe('false')
    expect(b.hasAttribute('aria-controls')).toBe(false)
    expect(b.hasAttribute('aria-haspopup')).toBe(false)
  })
})

describe('MỞ — một nhóm ô tích có tên, mỗi cột một dòng', () => {
  it('nhóm có tên, được nút trỏ tới, mang lớp nổi của nhân', () => {
    const c = draw()
    fireEvent.click(nut(c))
    const g = hop(c)!
    expect(g.getAttribute('aria-label')).toBe('Cột hiển thị')
    expect(nut(c).getAttribute('aria-expanded')).toBe('true')
    expect(nut(c).getAttribute('aria-controls')).toBe(g.id)
    expect(g.className).toBe('fos-menu fos-menu--pop')
  })

  it('⭐ liệt kê ĐỦ mọi cột, kể cả cột đang ẩn — theo đúng thứ tự, đúng dấu tích', () => {
    const c = draw()
    fireEvent.click(nut(c))
    const labels = Array.from(c.querySelectorAll('label')).map((l) => l.firstChild?.nextSibling?.textContent)
    expect(labels).toEqual(['Họ và tên', 'Trạng thái', 'Loại', 'Điện thoại', 'Ghi chú'])
    expect(checkboxes(c).map((i) => i.checked)).toEqual([true, true, true, false, false])
  })

  it('ô tích nằm TRONG nhãn — bấm chữ cũng bật tắt, ô chạm to bằng cả dòng', () => {
    const c = draw()
    fireEvent.click(nut(c))
    for (const l of c.querySelectorAll('label')) {
      expect(l.className).toBe('fos-menu-item')
      expect(l.querySelector('input[type="checkbox"]')).not.toBeNull()
    }
  })

  it('⛔ cột KHOÁ vẫn hiện, đã tích và bị tắt — không giấu, không bấm được', () => {
    const onChange = vi.fn()
    const c = draw({ onChange })
    fireEvent.click(nut(c))
    const name = checkboxes(c)[0]
    expect(name.checked).toBe(true)
    expect(name.disabled).toBe(true)
    fireEvent.click(name)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('lời gợi ý của app đứng sau tên cột', () => {
    const c = draw()
    fireEvent.click(nut(c))
    expect(c.querySelectorAll('label')[4].querySelector('.fos-count')?.textContent).toBe('trống')
  })

  it('đổi `prefix` thì mọi lớp đổi theo', () => {
    setPrefix('acme')
    const c = draw()
    fireEvent.click(nut(c))
    expect(hop(c)!.className).toBe('acme-menu acme-menu--pop')
    expect(c.querySelector('label')!.className).toBe('acme-menu-item')
  })
})

describe('BẬT TẮT — chỉ gửi CÁI ĐÃ ĐỔI, và hộp KHÔNG đóng sau mỗi lần tích', () => {
  it('tích một cột đang ẩn → `{ phone: true }`, giữ nguyên các ghi đè cũ', () => {
    const onChange = vi.fn()
    const c = draw({ onChange, visibility: { kind: false } })
    fireEvent.click(nut(c))
    fireEvent.click(checkboxes(c)[3])
    expect(onChange).toHaveBeenCalledWith({ kind: false, phone: true })
  })

  it('bỏ tích một cột đang hiện → `false`', () => {
    const onChange = vi.fn()
    const c = draw({ onChange })
    fireEvent.click(nut(c))
    fireEvent.click(checkboxes(c)[1])
    expect(onChange).toHaveBeenCalledWith({ status: false })
  })

  it('⭐ bật liền ba cột mà hộp vẫn mở — đây không phải một thực đơn', () => {
    function Live() {
      const [vis, setVis] = useState<Record<string, boolean>>({})
      const choices = CHOICES.map((ch) => ({ ...ch, shown: vis[ch.key] ?? ch.shown }))
      return <ColumnPicker label="Cột" trigger="Cột" choices={choices} visibility={vis} onChange={setVis} />
    }
    const c = render(<Live />).container
    fireEvent.click(nut(c))
    fireEvent.click(checkboxes(c)[3])
    fireEvent.click(checkboxes(c)[4])
    fireEvent.click(checkboxes(c)[1])
    expect(hop(c)).not.toBeNull()
    expect(checkboxes(c).map((i) => i.checked)).toEqual([true, false, true, true, true])
  })
})

describe('VỀ MẶC ĐỊNH — chỉ hiện khi có gì để về', () => {
  it('chưa tuỳ chỉnh: không có nút về mặc định', () => {
    const c = draw({ customised: false })
    fireEvent.click(nut(c))
    expect(hop(c)!.querySelectorAll('button')).toHaveLength(0)
    expect(hop(c)!.querySelector('[role="separator"]')).toBeNull()
  })

  it('đã tuỳ chỉnh: có vạch ngăn + nút, bấm là gửi `{}`', () => {
    const onChange = vi.fn()
    const c = draw({ customised: true, onChange, visibility: { phone: true } })
    fireEvent.click(nut(c))
    const reset = hop(c)!.querySelector('button')!
    expect(reset.textContent).toBe('Về mặc định')
    expect(reset.getAttribute('type')).toBe('button')
    expect(hop(c)!.querySelector('[role="separator"]')).not.toBeNull()
    fireEvent.click(reset)
    expect(onChange).toHaveBeenCalledWith({})
  })

  it('app không đưa chữ thì không có nút — nhân không mang một chữ nào', () => {
    const c = draw({ customised: true, resetLabel: undefined })
    fireEvent.click(nut(c))
    expect(hop(c)!.querySelectorAll('button')).toHaveLength(0)
  })
})

describe('BÀN PHÍM VÀ TIÊU ĐIỂM', () => {
  it('mở ra thì tiêu điểm vào ô tích ĐẦU TIÊN bật tắt được — bỏ qua cột khoá', () => {
    const c = draw()
    fireEvent.click(nut(c))
    expect(document.activeElement).toBe(checkboxes(c)[1])
  })

  it('mũi tên xuống/lên đi vòng qua các ô bật tắt được; Home/End về hai đầu', () => {
    const c = draw()
    fireEvent.click(nut(c))
    const [, s, k, p, n] = checkboxes(c)
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(k)
    fireEvent.keyDown(document, { key: 'End' })
    expect(document.activeElement).toBe(n)
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(s)
    fireEvent.keyDown(document, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(n)
    fireEvent.keyDown(document, { key: 'Home' })
    expect(document.activeElement).toBe(s)
    expect(p).toBeDefined()
  })

  it('⛔ Escape đóng hộp VÀ trả tiêu điểm về nút', () => {
    const c = draw()
    fireEvent.click(nut(c))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(hop(c)).toBeNull()
    expect(document.activeElement).toBe(nut(c))
  })

  it('bấm ra ngoài thì đóng; bấm trong hộp thì không', () => {
    const c = draw()
    fireEvent.click(nut(c))
    fireEvent.mouseDown(hop(c)!)
    expect(hop(c)).not.toBeNull()
    fireEvent.mouseDown(document.body)
    expect(hop(c)).toBeNull()
  })

  it('⚠️ Tab ra khỏi hộp thì đóng; đi giữa các ô trong hộp thì không', () => {
    const outside = document.createElement('input')
    document.body.appendChild(outside)
    const c = draw()
    fireEvent.click(nut(c))
    fireEvent.focusOut(checkboxes(c)[1], { relatedTarget: checkboxes(c)[2] })
    expect(hop(c)).not.toBeNull()
    fireEvent.focusOut(checkboxes(c)[2], { relatedTarget: outside })
    expect(hop(c)).toBeNull()
    outside.remove()
  })

  it('bấm nút lần hai thì đóng', () => {
    const c = draw()
    fireEvent.click(nut(c))
    fireEvent.click(nut(c))
    expect(hop(c)).toBeNull()
  })
})

describe('useColumnVisibility — nhớ lựa chọn của NGƯỜI XEM', () => {
  beforeEach(() => localStorage.clear())

  it('chưa có gì: `{}`', () => {
    const { result } = renderHook(() => useColumnVisibility('cols:A'))
    expect(result.current[0]).toEqual({})
  })

  it('ghi rồi dựng lại vẫn còn — và chỉ lưu cái đã đổi', () => {
    const a = renderHook(() => useColumnVisibility('cols:A'))
    act(() => a.result.current[1]({ phone: true }))
    expect(a.result.current[0]).toEqual({ phone: true })
    expect(JSON.parse(localStorage.getItem('cols:A')!)).toEqual({ phone: true })
    a.unmount()
    const b = renderHook(() => useColumnVisibility('cols:A'))
    expect(b.result.current[0]).toEqual({ phone: true })
  })

  it('về mặc định (`{}`) thì XOÁ khoá, không để lại một `{}` rác', () => {
    const a = renderHook(() => useColumnVisibility('cols:A'))
    act(() => a.result.current[1]({ phone: true }))
    act(() => a.result.current[1]({}))
    expect(localStorage.getItem('cols:A')).toBeNull()
  })

  it('⛔ rác trong kho (chuỗi hỏng, mảng, giá trị không phải bool) → bỏ, không ném', () => {
    localStorage.setItem('cols:A', '{hỏng')
    expect(renderHook(() => useColumnVisibility('cols:A')).result.current[0]).toEqual({})
    localStorage.setItem('cols:B', '["phone"]')
    expect(renderHook(() => useColumnVisibility('cols:B')).result.current[0]).toEqual({})
    localStorage.setItem('cols:C', '{"phone":true,"note":"yes"}')
    expect(renderHook(() => useColumnVisibility('cols:C')).result.current[0]).toEqual({ phone: true })
  })

  it('⛔ kho ném (cửa sổ riêng tư) → vẫn chạy, chỉ không nhớ', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const { result } = renderHook(() => useColumnVisibility('cols:A'))
    expect(result.current[0]).toEqual({})
    act(() => result.current[1]({ phone: true }))
    expect(result.current[0]).toEqual({ phone: true })
    get.mockRestore(); set.mockRestore()
  })

  it('⚠️ đổi khoá thì đọc NGAY bảng mới — không vẽ một nhịp bằng lựa chọn bảng cũ', () => {
    localStorage.setItem('cols:A', '{"phone":true}')
    localStorage.setItem('cols:B', '{"note":true}')
    const seen: Record<string, boolean>[] = []
    const { rerender } = renderHook(({ k }) => {
      const [v] = useColumnVisibility(k)
      seen.push(v)
      return v
    }, { initialProps: { k: 'cols:A' } })
    seen.length = 0
    rerender({ k: 'cols:B' })
    expect(seen.every((v) => v.note === true && !('phone' in v))).toBe(true)
  })

  it('`null` thì nhớ trong phiên, không đụng kho', () => {
    const { result } = renderHook(() => useColumnVisibility(null))
    act(() => result.current[1]({ phone: false }))
    expect(result.current[0]).toEqual({ phone: false })
    expect(localStorage.length).toBe(0)
  })
})
