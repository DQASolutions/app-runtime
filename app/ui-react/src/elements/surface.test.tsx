import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Empty, Icon, Notice, Skeleton, SrOnly } from './surface.js'
import { setPrefix } from '../prefix/index.js'

afterEach(() => { cleanup(); setPrefix('fos') })
const box = (c: React.ReactNode) => render(<>{c}</>).container
const first = (c: React.ReactNode) => box(c).firstElementChild

describe('notice — nói về CẢ MÀN HÌNH', () => {
  it('không sắc thái thì chỉ mang lớp gốc', () => {
    expect(first(<Notice>x</Notice>)!.className).toBe('fos-notice')
  })

  it('mỗi sắc thái của nhân ra đúng một lớp bổ nghĩa', () => {
    for (const t of ['wait', 'doing', 'done', 'warn', 'stop'] as const) {
      cleanup()
      expect(first(<Notice tone={t}>x</Notice>)!.className).toBe(`fos-notice fos-notice--${t}`)
    }
  })

  /*
   * ⛔ KHÔNG NỘI DUNG THÌ KHÔNG VẼ GÌ — không phải vẽ một cái hộp rỗng.
   *    Một dải có viền mà bên trong trống đọc như lỗi vẽ, và ứng dụng gốc đã
   *    giao đúng cái ấy ở mọi chỗ lời nhắn là có điều kiện.
   */
  it('không có nội dung thì KHÔNG vẽ hộp rỗng', () => {
    for (const c of [null, undefined, false, '']) {
      cleanup()
      expect(box(<Notice>{c}</Notice>).firstElementChild).toBeNull()
    }
  })

  it('số 0 VẪN là nội dung — đừng nuốt mất nó', () => {
    expect(box(<Notice>{0}</Notice>).textContent).toBe('0')
  })

  it('lớp của người gọi cộng thêm, thuộc tính đi thẳng xuống', () => {
    const el = first(<Notice tone="stop" className="mt" id="n1" role="alert">x</Notice>)!
    expect(el.className).toBe('fos-notice fos-notice--stop mt')
    expect(el.getAttribute('role')).toBe('alert')
    expect(el.id).toBe('n1')
  })
})

describe('empty — chưa có gì, và làm gì tiếp', () => {
  it('một lớp duy nhất cho khái niệm ấy', () => {
    expect(first(<Empty>x</Empty>)!.className).toBe('fos-empty')
  })
  it('KHÔNG tự nghĩ ra câu chữ nào — chỉ chở lời của màn hình', () => {
    expect(box(<Empty />).textContent).toBe('')
  })
  it('đổi stem thì đổi theo', () => {
    setPrefix('acme')
    expect(first(<Empty>x</Empty>)!.className).toBe('acme-empty')
  })
})

describe('skeleton — dữ liệu đang tới, và phải NÓI RA', () => {
  /*
   * ⛔ KHỐI XÁM NHẤP NHÁY KHÔNG NÓI GÌ VỚI NGƯỜI KHÔNG NHÌN.
   *    Không vùng sống, không nhãn, thì họ nghe im lặng rồi đột ngột nghe cả
   *    bảng. `role=status` + `aria-live` + một nhãn chỉ đọc-lên là bắt buộc.
   */
  it('vùng sống có vai, có nhãn đọc lên được, và báo đang bận', () => {
    const el = first(<Skeleton label="Đang tải danh sách" />)!
    expect(el.getAttribute('role')).toBe('status')
    expect(el.getAttribute('aria-live')).toBe('polite')
    expect(el.getAttribute('aria-busy')).toBe('true')
    expect(el.querySelector('.fos-sr-only')!.textContent).toBe('Đang tải danh sách')
  })

  it('các thanh xám ẨN khỏi cây trợ năng — chúng là hình, không phải tin', () => {
    const bars = [...box(<Skeleton label="x" />).querySelectorAll('.fos-skeleton')]
    expect(bars.length).toBe(3)
    for (const b of bars) expect(b.getAttribute('aria-hidden')).toBe('true')
  })

  it('số thanh do nơi gọi quyết — nó biết chỗ trống cao bao nhiêu', () => {
    expect(box(<Skeleton label="x" lines={7} />).querySelectorAll('.fos-skeleton').length).toBe(7)
  })
})

describe('icon — không bao giờ đứng một mình mà không có tên', () => {
  it('đứng cạnh chữ: ẩn khỏi cây trợ năng, không đọc hai lần', () => {
    const el = first(<Icon decorative />)!
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(el.getAttribute('focusable')).toBe('false')
    expect(el.hasAttribute('role')).toBe(false)
  })

  it('đứng một mình: mang vai và tên của chính nó', () => {
    const el = first(<Icon label="Đóng" />)!
    expect(el.getAttribute('role')).toBe('img')
    expect(el.getAttribute('aria-label')).toBe('Đóng')
    expect(el.hasAttribute('aria-hidden')).toBe(false)
  })

  it('mang lớp nhân và lớp người gọi', () => {
    expect(first(<Icon decorative className="big" />)!.className.toString())
      .toBe('fos-icon big')
  })
})

describe('sr-only — khuất mắt, vẫn nghe được', () => {
  it('vẽ ra span mang lớp nhân', () => {
    const el = first(<SrOnly>Đang tải</SrOnly>)!
    expect(el.tagName).toBe('SPAN')
    expect(el.className).toBe('fos-sr-only')
    expect(el.textContent).toBe('Đang tải')
  })
})

describe('empty — MỘT khái niệm, hai chỗ đứng, không ba lớp', () => {
  it('bậc gọn thêm đúng một lớp bổ nghĩa, không thay lớp gốc', () => {
    expect(first(<Empty compact>x</Empty>)!.className).toBe('fos-empty fos-empty--compact')
  })
  it('không gọn thì không có lớp bổ nghĩa', () => {
    expect(first(<Empty>x</Empty>)!.className).toBe('fos-empty')
  })
  /* ⚠️ Một câu rỗng nằm trong `<ul>` phải là `<li>`, không thì cây danh sách vỡ
     và trình đọc màn hình đếm sai số mục. */
  it('đổi được thẻ cho hợp chỗ đứng — <p> trong thẻ, <li> trong danh sách', () => {
    expect(first(<Empty as="p">x</Empty>)!.tagName).toBe('P')
    expect(first(<Empty as="li">x</Empty>)!.tagName).toBe('LI')
  })
})
