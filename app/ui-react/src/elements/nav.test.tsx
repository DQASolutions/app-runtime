import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { createElement } from 'react'
import { RailItem, Tab, Tabs } from './nav.js'
import { setPrefix } from '../prefix/index.js'

afterEach(() => { cleanup(); setPrefix('fos') })
const box = (c: React.ReactNode) => render(<>{c}</>).container
const RouterLink = ({ to, children, ...rest }: { to: string; children?: React.ReactNode }) =>
  createElement('a', { ...rest, href: to, 'data-router': '' }, children)

describe('tab — đổi LÁT của màn này', () => {
  it('hàng thẻ có vai và có tên', () => {
    const el = box(<Tabs label="Chọn bảng"><Tab icon={<i />}>a</Tab></Tabs>).firstElementChild!
    expect(el.getAttribute('role')).toBe('tablist')
    expect(el.getAttribute('aria-label')).toBe('Chọn bảng')
  })

  it('thẻ là <button type=button role=tab> mang lớp nhân', () => {
    const b = box(<Tabs label="x"><Tab icon={<i />}>Danh sách</Tab></Tabs>).querySelector('button')!
    expect(b.getAttribute('role')).toBe('tab')
    expect(b.getAttribute('type')).toBe('button')
    expect(b.className).toBe('fos-tab')
  })

  /*
   * ⚠️ `aria-selected`, KHÔNG phải `aria-current`. Một thẻ là lát đang xem
   *    TRONG màn này; `aria-current="page"` nói "đây là trang bạn đang đứng".
   *    Nhân vẽ ra như nhau; trình đọc màn hình thì không.
   */
  it('lát đang xem nói bằng aria-selected, và luôn khai cả khi false', () => {
    const c = box(<Tabs label="x"><Tab icon={<i />} current>a</Tab><Tab icon={<i />}>b</Tab></Tabs>)
    const bs = [...c.querySelectorAll('button')]
    expect(bs[0].getAttribute('aria-selected')).toBe('true')
    expect(bs[1].getAttribute('aria-selected')).toBe('false')
    expect(bs[0].hasAttribute('aria-current')).toBe(false)
  })

  /* ⛔ "Đã ghi 0 người" là một câu trả lời; ẩn đi thì cán bộ không biết mình đã
     mở bảng ấy ra hay chưa. */
  it('số 0 vẫn hiện', () => {
    expect(box(<Tabs label="x"><Tab icon={<i />} count={0}>a</Tab></Tabs>)
      .querySelector('.fos-count')!.textContent).toBe('0')
  })

  it('không truyền count thì không vẽ ô số', () => {
    expect(box(<Tabs label="x"><Tab icon={<i />}>a</Tab></Tabs>).querySelector('.fos-count')).toBeNull()
  })

  it('bấm gọi onClick', () => {
    const onClick = vi.fn()
    fireEvent.click(box(<Tabs label="x"><Tab icon={<i />} onClick={onClick}>a</Tab></Tabs>).querySelector('button')!)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('`as` cho thẻ sống trong đường dẫn, vẫn giữ vai và dấu chọn', () => {
    const a = box(
      <Tabs label="x"><Tab icon={<i />} as={RouterLink} {...{ to: '/x?tab=b' }} current count={2}>B</Tab></Tabs>,
    ).querySelector('a')!
    expect(a.getAttribute('href')).toBe('/x?tab=b')
    expect(a.getAttribute('role')).toBe('tab')
    expect(a.getAttribute('aria-selected')).toBe('true')
    expect(a.className).toBe('fos-tab')
  })
})

describe('rail-item — ĐI TỚI một màn khác', () => {
  it('mặc định là <a> mang lớp nhân', () => {
    const a = box(<RailItem href="/x">Nhân viên</RailItem>).firstElementChild!
    expect(a.tagName).toBe('A')
    expect(a.className).toBe('fos-rail-item')
  })

  /*
   * ⚠️ `aria-current="page"` — đây là một TRANG, và nó sống sau khi ngón tay
   *    rời đi. Nhân đã tách `current` khỏi `active` (ngón tay đang đè) trong
   *    chuẩn; gộp lại là bỏ sót một trạng thái thật.
   */
  it('màn đang đứng nói bằng aria-current=page', () => {
    expect(box(<RailItem href="/x" current>a</RailItem>).firstElementChild!
      .getAttribute('aria-current')).toBe('page')
  })

  it('không đứng ở đó thì KHÔNG ghi aria-current="false"', () => {
    expect(box(<RailItem href="/x">a</RailItem>).firstElementChild!
      .hasAttribute('aria-current')).toBe(false)
  })

  it('nhận bộ định tuyến qua `as`, lớp và dấu vẫn nguyên', () => {
    const a = box(<RailItem as={RouterLink} {...{ to: '/members' }} current>Nhân viên</RailItem>)
      .firstElementChild!
    expect(a.getAttribute('href')).toBe('/members')
    expect(a.getAttribute('data-router')).toBe('')
    expect(a.className).toBe('fos-rail-item')
    expect(a.getAttribute('aria-current')).toBe('page')
  })

  it('lớp của người gọi cộng thêm, không đè', () => {
    expect(box(<RailItem href="/x" className="on">a</RailItem>).firstElementChild!.className)
      .toBe('fos-rail-item on')
  })

  it('đổi stem thì cả ba lớp đổi theo', () => {
    setPrefix('acme')
    const c = box(<><Tabs label="x"><Tab icon={<i />} count={1}>a</Tab></Tabs><RailItem href="/y">b</RailItem></>)
    expect(c.querySelector('button')!.className).toBe('acme-tab')
    expect(c.querySelector('.acme-count')).not.toBeNull()
    expect(c.querySelector('a')!.className).toBe('acme-rail-item')
  })
})

describe('⛔ `className` có thể là MỘT HÀM — NavLink truyền trạng thái qua đó', () => {
  /*
   * `NavLink` của react-router gọi `className({ isActive })`. Ghép bằng chuỗi
   * thì hàm bị đổi thành `"(state) => ..."` và rơi nguyên vào thuộc tính
   * `class`. Không lỗi nào nổ; mục rãnh chỉ mất sạch kiểu dáng.
   */
  const NavLink = ({ to, className, children, ...rest }: any) => {
    const cn = typeof className === 'function' ? className({ isActive: true }) : className
    return createElement('a', { ...rest, href: to, className: cn }, children)
  }

  it('hàm được GỌI, không bị đổi thành chuỗi', () => {
    const a = box(
      <RailItem as={NavLink} {...{ to: '/x' }}
        className={({ isActive }: any) => (isActive ? 'on' : undefined)}>Nhân viên</RailItem>,
    ).firstElementChild!
    expect(a.className).toBe('fos-rail-item on')
    expect(a.className).not.toContain('=>')
  })

  it('hàm trả undefined thì vẫn còn lớp nhân', () => {
    const a = box(
      <RailItem as={NavLink} {...{ to: '/x' }} className={() => undefined}>a</RailItem>,
    ).firstElementChild!
    expect(a.className).toBe('fos-rail-item')
  })

  it('chuỗi thường vẫn chạy như cũ', () => {
    expect(box(<RailItem as={NavLink} {...{ to: '/x' }} className="on">a</RailItem>)
      .firstElementChild!.className).toBe('fos-rail-item on')
  })
})

describe('rãnh dày — ngoại lệ có sàn', () => {
  it('`dense` thêm đúng một lớp bổ nghĩa, giữ nguyên lớp gốc', () => {
    expect(box(<RailItem href="/x" dense>a</RailItem>).firstElementChild!.className)
      .toBe('fos-rail-item fos-rail-item--dense')
  })
  it('không dày thì không có lớp bổ nghĩa', () => {
    expect(box(<RailItem href="/x">a</RailItem>).firstElementChild!.className)
      .toBe('fos-rail-item')
  })
  it('`dense` vẫn ghép được với className hàm của NavLink', () => {
    const NavLink = ({ to, className, children, ...rest }: any) =>
      createElement('a', { ...rest, href: to,
        className: typeof className === 'function' ? className({ isActive: true }) : className },
      children)
    expect(box(<RailItem as={NavLink} {...{ to: '/x' }} dense
      className={({ isActive }: any) => (isActive ? 'on' : undefined)}>a</RailItem>)
      .firstElementChild!.className).toBe('fos-rail-item fos-rail-item--dense on')
  })

  it('có `icon` thì hình đứng TRƯỚC chữ', () => {
    const el = render(<Tabs label="x"><Tab icon={<i data-t="m" />}>Lát</Tab></Tabs>).container
    const b = el.querySelector('[role]')!.querySelector('button, a')!
    expect(b.children[0].getAttribute('data-t')).toBe('m')
  })
})
