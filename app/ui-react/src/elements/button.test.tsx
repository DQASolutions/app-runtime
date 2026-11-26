import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { createElement } from 'react'
import { Button } from './button.js'
import { setPrefix } from '../prefix/index.js'
import { InActionBar } from './action-scope.js'

afterEach(() => { cleanup(); setPrefix('fos') })
const nut = (c: React.ReactNode) => render(<>{c}</>).container.firstElementChild!
/* Bậc `key` chỉ hợp lệ trong `<ActionBar>` — phép thử lớp đứng trong cờ ấy. */
const renderInActionBar = (c: React.ReactNode) => render(<InActionBar.Provider value>{c}</InActionBar.Provider>).container.firstElementChild!

describe('⛔ `type` KHÔNG PHẢI TRANG TRÍ', () => {
  /*
   * Một `<button>` không khai type nằm trong `<form>` là nút GỬI. Đo trên ứng
   * dụng gốc: 244 trên 394 nút không khai type — mỗi cái cách một thẻ `<form>`
   * lạc chỗ là gửi cả trang trong khi người ta chỉ định mở một hộp thoại.
   */
  it('mặc định là type=button, không phải submit', () => {
    expect(nut(<Button icon={<i />}>Ghi</Button>).getAttribute('type')).toBe('button')
  })

  it('gửi biểu mẫu thì phải NÓI RA', () => {
    expect(nut(<Button icon={<i />} type="submit">Ghi</Button>).getAttribute('type')).toBe('submit')
  })

  it('nằm trong <form> mà không khai vẫn KHÔNG gửi', () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    const c = render(<form onSubmit={onSubmit}><Button icon={<i />}>Mở hộp thoại</Button></form>).container
    fireEvent.click(c.querySelector('button')!)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('⛔ HÌNH KHÔNG CHỮ THÌ PHẢI CÓ TÊN', () => {

  it('chỉ-hình có nhãn: mang lớp --icon, có aria-label và title', () => {
    const b = nut(<Button icon={<svg data-i="" />} label="Đóng" />)
    expect(b.className).toBe('fos-btn fos-btn--normal fos-btn--icon')
    expect(b.getAttribute('aria-label')).toBe('Đóng')
    expect(b.getAttribute('title')).toBe('Đóng')
    expect(b.querySelector('svg')).not.toBeNull()
  })

  it('có chữ thì KHÔNG mang lớp --icon, dù có hình', () => {
    const b = nut(<Button icon={<svg />}>Ghi</Button>)
    expect(b.className).toBe('fos-btn fos-btn--normal')
    expect(b.textContent).toBe('Ghi')
  })

  it('hình đứng TRƯỚC chữ — mắt dò cột hình nhanh hơn cột chữ', () => {
    /* ⚠️ `firstElementChild` BỎ QUA nút văn bản, nên nó vẫn thấy `<svg>` kể cả
       khi hình bị đẩy xuống sau chữ — phép thử xanh mà không đo gì. Phải so
       trên `childNodes`, nơi chữ cũng là một nút. */
    const b = nut(<Button icon={<svg data-i="" />}>Ghi</Button>)
    const con = [...b.childNodes]
    expect((con[0] as Element).tagName?.toLowerCase()).toBe('svg')
    expect(con[1].textContent).toBe('Ghi')
  })
})

describe('bậc — bốn cái, và mặc định là `normal`', () => {
  it('không khai bậc thì là normal, không phải nút chưa ai quyết', () => {
    expect(nut(<Button icon={<i />}>x</Button>).className).toBe('fos-btn fos-btn--normal')
  })
  it('mỗi bậc ra đúng một lớp', () => {
    for (const t of ['key', 'normal', 'quiet', 'danger'] as const) {
      cleanup()
      expect(renderInActionBar(<Button icon={<i />} tier={t}>x</Button>).className).toBe(`fos-btn fos-btn--${t}`)
    }
  })
  it('lớp của người gọi cộng thêm, không đè', () => {
    expect(renderInActionBar(<Button icon={<i />} tier="key" className="w">x</Button>).className)
      .toBe('fos-btn fos-btn--key w')
  })
})

describe('đang gửi — khoá VÀ nói ra', () => {
  /*
   * ⚠️ Khoá không thôi thì trình đọc màn hình chỉ nghe "nút, không khả dụng" —
   *    không biết vì sao và không biết bao giờ xong.
   */
  it('busy đặt aria-busy và khoá nút', () => {
    const b = nut(<Button icon={<i />} busy>Ghi</Button>)
    expect(b.getAttribute('aria-busy')).toBe('true')
    expect(b.hasAttribute('disabled')).toBe(true)
  })
  it('busy thì bấm không gọi onClick', () => {
    const onClick = vi.fn()
    fireEvent.click(nut(<Button icon={<i />} busy onClick={onClick}>Ghi</Button>))
    expect(onClick).not.toHaveBeenCalled()
  })
  it('không busy thì không ghi aria-busy="false"', () => {
    expect(nut(<Button icon={<i />}>x</Button>).hasAttribute('aria-busy')).toBe(false)
  })
})

describe('nút DẪN ĐI ĐÂU ĐÓ', () => {
  const RouterLink = ({ to, children, ...rest }: { to: string; children?: React.ReactNode }) =>
    createElement('a', { ...rest, href: to, 'data-router': '' }, children)

  it('`as` giữ nguyên bậc và lớp', () => {
    const a = renderInActionBar(<Button icon={<i />} as={RouterLink} {...{ to: '/x' }} tier="key">Mở</Button>)
    expect(a.tagName).toBe('A')
    expect(a.getAttribute('href')).toBe('/x')
    expect(a.className).toBe('fos-btn fos-btn--key')
  })

  /* ⛔ `type` chỉ đặt cho NÚT — trên `<a>` nó nói về kiểu MIME của đích đến. */
  it('nhánh liên kết KHÔNG mang type', () => {
    expect(nut(<Button icon={<i />} as={RouterLink} {...{ to: '/x' }}>Mở</Button>).hasAttribute('type'))
      .toBe(false)
  })

  it('đổi stem thì lớp đổi theo', () => {
    setPrefix('acme')
    expect(nut(<Button icon={<i />} tier="danger">x</Button>).className).toBe('acme-btn acme-btn--danger')
  })
})

describe('form= phải gửi được thật — lỗ E.8, vá 1/9/2026', () => {

  it('khai submit thì qua', () => {
    const b = nut(<Button icon={<i />} form="f1" type="submit">Lưu</Button>)
    expect(b.getAttribute('form')).toBe('f1')
    expect(b.getAttribute('type')).toBe('submit')
  })

  it('reset cũng tác động lên biểu mẫu, nên cũng qua', () => {
    expect(() => render(<Button icon={<i />} form="f1" type="reset">Xoá</Button>)).not.toThrow()
  })

  it('không có form= thì không đổi gì — nút thường vẫn type=button', () => {
    expect(nut(<Button icon={<i />}>Mở</Button>).getAttribute('type')).toBe('button')
  })

  /*
   * ⛔ `label` LÀ CÁI TÊN, `title` LÀ LỜI GIẢI THÍCH — chúng không phải một thứ.
   *   Bản trước đổ cả hai từ `label` và vì nó nằm sau `...rest` nên nó xoá mất
   *   `title` bên gọi truyền vào, lặng lẽ. Một app mất câu *"việc của Trưởng phòng,
   *   tài khoản đang dùng không làm được"* trên đúng những nút đang mờ.
   */
  it('label KHÔNG đè title bên gọi đã truyền', () => {
    const b = nut(<Button icon={<span />} label="Bóc chỉ tiêu" title="Việc của Trưởng phòng" />)
    expect(b.getAttribute('aria-label')).toBe('Bóc chỉ tiêu')
    expect(b.getAttribute('title')).toBe('Việc của Trưởng phòng')
  })

  it('…nhưng vẫn ĐỠ cho title khi bên gọi không nói gì', () => {
    const b = nut(<Button icon={<span />} label="Bóc chỉ tiêu" />)
    expect(b.getAttribute('title')).toBe('Bóc chỉ tiêu')
  })
})

describe('⛔ NÚT CHÍNH CHỈ ĐẾN TỪ <ActionBar>', () => {
  it('các bậc khác vẫn gõ được — chúng không tranh việc chính', () => {
    for (const t of ['normal', 'quiet', 'danger'] as const) {
      cleanup()
      expect(() => render(<Button icon={<i />} tier={t}>x</Button>)).not.toThrow()
    }
  })
})
