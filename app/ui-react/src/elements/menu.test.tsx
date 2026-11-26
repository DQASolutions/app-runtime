import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { Menu, MenuItem, MenuSeparator } from './menu.js'
import { setPrefix } from '../prefix/index.js'

afterEach(() => { cleanup(); setPrefix('fos') })
const box = (c: React.ReactNode) => render(<>{c}</>).container

describe('menu — một danh sách, không phải một chồng nút', () => {
  /*
   * ⛔ MỘT CHỒNG <button> TRONG <div> đọc lên là "nút, nút, nút" — không nói
   *    có bao nhiêu cái và đang ở cái thứ mấy. Hai con số ấy là thứ làm một
   *    thực đơn dùng được khi không nhìn.
   */
  it('vẽ ra <ul role=menu> có tên, và các mục là <li>', () => {
    const el = box(<Menu label="Việc của dòng"><MenuItem icon={<i />}>Xem</MenuItem></Menu>).firstElementChild!
    expect(el.tagName).toBe('UL')
    expect(el.getAttribute('role')).toBe('menu')
    expect(el.getAttribute('aria-label')).toBe('Việc của dòng')
    expect(el.className).toBe('fos-menu')
    expect(el.querySelector('li')).not.toBeNull()
  })

  it('<li> mang role=none — không thì trình đọc đếm cả nó thành một mục', () => {
    const li = box(<Menu label="x"><MenuItem icon={<i />}>a</MenuItem></Menu>).querySelector('li')!
    expect(li.getAttribute('role')).toBe('none')
  })

  it('mục là <button role=menuitem> mang lớp nhân', () => {
    const b = box(<Menu label="x"><MenuItem icon={<i />}>Xem</MenuItem></Menu>).querySelector('button')!
    expect(b.getAttribute('role')).toBe('menuitem')
    expect(b.className).toBe('fos-menu-item')
    expect(b.textContent).toBe('Xem')
  })

  /*
   * ⛔ `type="button"` KHÔNG PHẢI TUỲ CHỌN. Một `<button>` không khai type nằm
   *    trong `<form>` là nút GỬI — thực đơn mở từ biểu mẫu sẽ gửi biểu mẫu ấy
   *    trên đường đi làm việc của mục.
   */
  it('mục luôn là type=button, kể cả khi nằm trong <form>', () => {
    const b = box(
      <form><Menu label="x"><MenuItem icon={<i />}>a</MenuItem></Menu></form>,
    ).querySelector('button')!
    expect(b.getAttribute('type')).toBe('button')
  })

  it('`current` nói bằng aria-current=page — thứ nhân neo vào', () => {
    const b = box(<Menu label="x"><MenuItem icon={<i />} current>a</MenuItem></Menu>).querySelector('button')!
    expect(b.getAttribute('aria-current')).toBe('page')
  })

  it('không `current` thì KHÔNG ghi aria-current="false" — im lặng, không cãi', () => {
    const b = box(<Menu label="x"><MenuItem icon={<i />}>a</MenuItem></Menu>).querySelector('button')!
    expect(b.hasAttribute('aria-current')).toBe(false)
  })

  it('khoá đi thẳng xuống nút, và nút khoá không gọi onClick', () => {
    const onClick = vi.fn()
    const b = box(
      <Menu label="x"><MenuItem icon={<i />} disabled onClick={onClick}>a</MenuItem></Menu>,
    ).querySelector('button')!
    expect(b.hasAttribute('disabled')).toBe(true)
    fireEvent.click(b)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('bấm mục thì gọi đúng onClick', () => {
    const onClick = vi.fn()
    const b = box(<Menu label="x"><MenuItem icon={<i />} onClick={onClick}>a</MenuItem></Menu>)
      .querySelector('button')!
    fireEvent.click(b)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  /*
   * ⚠️ Đường phân cách neo vào VAI TRÒ, không vào một lớp riêng. Nhân vẽ nó
   *    bằng `.fos-menu > [role="separator"]` — chỗ nào vẽ được cũng là chỗ đã
   *    khai đúng vai.
   */
  it('đường phân cách mang role=separator và KHÔNG có lớp riêng', () => {
    const li = box(
      <Menu label="x"><MenuItem icon={<i />}>a</MenuItem><MenuSeparator /><MenuItem icon={<i />}>b</MenuItem></Menu>,
    ).querySelectorAll('li')[1]
    expect(li.getAttribute('role')).toBe('separator')
    expect(li.className).toBe('')
  })

  it('nhiều mục thì đếm được — trình đọc nói "mục 2 trên 3"', () => {
    const items = box(
      <Menu label="x"><MenuItem icon={<i />}>a</MenuItem><MenuItem icon={<i />}>b</MenuItem><MenuItem icon={<i />}>c</MenuItem></Menu>,
    ).querySelectorAll('[role="menuitem"]')
    expect(items.length).toBe(3)
  })

  it('đổi stem thì cả hai đổi theo', () => {
    setPrefix('acme')
    const c = box(<Menu label="x"><MenuItem icon={<i />}>a</MenuItem></Menu>)
    expect(c.querySelector('ul')!.className).toBe('acme-menu')
    expect(c.querySelector('button')!.className).toBe('acme-menu-item')
  })
})

describe('mục thực đơn DẪN ĐI ĐÂU ĐÓ là một liên kết', () => {
  it('`as="a"` ra <a role=menuitem>, giữ lớp nhân', () => {
    const a = box(<Menu label="x"><MenuItem icon={<i />} as="a" href="/y">Đi</MenuItem></Menu>)
      .querySelector('a')!
    expect(a.getAttribute('role')).toBe('menuitem')
    expect(a.getAttribute('href')).toBe('/y')
    expect(a.className).toBe('fos-menu-item')
  })

  /*
   * ⛔ `type="button"` chỉ đặt cho NÚT. Trên `<a>` thuộc tính `type` nói về
   *    kiểu MIME của đích đến — sai hẳn nghĩa, và trình duyệt có thể đổi cách
   *    xử lý đường dẫn theo nó.
   */
  it('nhánh liên kết KHÔNG mang type="button"', () => {
    expect(box(<Menu label="x"><MenuItem icon={<i />} as="a" href="/y">Đi</MenuItem></Menu>)
      .querySelector('a')!.hasAttribute('type')).toBe(false)
  })

  it('vẫn nằm trong <li role=none>', () => {
    expect(box(<Menu label="x"><MenuItem icon={<i />} as="a" href="/y">Đi</MenuItem></Menu>)
      .querySelector('li')!.getAttribute('role')).toBe('none')
  })

  it('có `icon` thì hình đứng TRƯỚC chữ', () => {
    const el = render(<Menu label="x"><MenuItem icon={<i data-t="m" />}>Việc</MenuItem></Menu>).container
    const b = el.querySelector('[role]')!.querySelector('button, a')!
    expect(b.children[0].getAttribute('data-t')).toBe('m')
  })
})
