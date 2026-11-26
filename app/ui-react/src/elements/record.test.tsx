import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import {
  Avatar, Badge, Card, CardBody, CardHead, Count, Fact, Facts, Legend, Meter, Provenance, Tag,
} from './record.js'
import { setPrefix } from '../prefix/index.js'

afterEach(() => { cleanup(); setPrefix('fos') })
const box = (c: React.ReactNode) => render(<>{c}</>).container
const first = (c: React.ReactNode) => box(c).firstElementChild

describe('card — và hai bộ phận của nó', () => {
  it('thẻ trần vẫn là một thẻ, không cần bộ phận nào', () => {
    expect(first(<Card>x</Card>)!.className).toBe('fos-card')
  })

  /*
   * ⛔ ĐẦU VÀ THÂN LÀ BỘ PHẬN, KHÔNG PHẢI THẺ LỒNG THẺ.
   *
   *   Kit bỏ đệm của thẻ bằng `:has(> .card-head)` — nghĩa là đầu thẻ phải là
   *   CON TRỰC TIẾP. Bọc thêm một `<div>` giữa hai cái là luật ấy không với
   *   tới, và thẻ đeo hai lớp đệm chồng nhau. Không chốt nào thấy, vì cả hai
   *   lớp đều hợp lệ.
   */
  it('đầu và thân là CON TRỰC TIẾP của thẻ — `:has(> …)` của kit mới với tới', () => {
    const c = first(<Card><CardHead>h</CardHead><CardBody>b</CardBody></Card>)!
    expect([...c.children].map((n) => n.className))
      .toEqual(['fos-card-head', 'fos-card-body'])
  })

  /*
   * ⭐ `as` — đo trên ứng dụng gốc ra 73 chỗ thẻ là `<section>` hoặc `<form>`.
   *    Ép hết thành `<div>` là ném đi ngữ nghĩa nền tảng cho không, và chỗ gọi
   *    sẽ đi vòng bằng cách gõ lại tên lớp.
   */
  it('`as` đổi được THẺ, lớp giữ nguyên', () => {
    expect(first(<Card as="section">x</Card>)!.tagName).toBe('SECTION')
    expect(first(<Card as="section">x</Card>)!.className).toBe('fos-card')
    cleanup()
    expect(first(<Card as="form">x</Card>)!.tagName).toBe('FORM')
  })

  /* ⚠️ `as` là của khuôn, KHÔNG được chảy xuống DOM thành một thuộc tính lạ. */
  it('`as` không rò ra thuộc tính HTML', () => {
    expect(box(<Card as="section">x</Card>).innerHTML).not.toMatch(/\bas=/)
    cleanup()
    expect(box(<CardHead as="header">x</CardHead>).innerHTML).not.toMatch(/\bas=/)
  })

  it('lớp của nơi gọi đứng SAU lớp của nhân, không thay nó', () => {
    expect(first(<Card className="kh-the">x</Card>)!.className).toBe('fos-card kh-the')
  })
})

describe('facts — tên bên cạnh giá trị', () => {
  /*
   * ⛔ PHẢI LÀ `<dl>`, VÀ ĐÓ LÀ TOÀN BỘ LÝ DO NÓ TỒN TẠI.
   *   Kit tô thẳng `> dt` và `> dd`; thẻ khác thì được hình học mà không được
   *   kiểu chữ. Và `<dl>` là thứ nền tảng đã hiểu là cặp tên/giá trị.
   */
  it('dựng ra `<dl>`, không phải một lưới `<div>`', () => {
    expect(first(<Facts><Fact name="a">b</Fact></Facts>)!.tagName).toBe('DL')
  })

  /*
   * ⛔ MỘT CẶP LÀ MẢNH RỜI, KHÔNG PHẢI MỘT HỘP.
   *   Lưới nằm trên `<dl>` và các con của nó LÀ ô. Bọc mỗi cặp trong `<div>`
   *   là đặt một cái hộp giữa lưới và ô của nó — cột thôi thẳng hàng, và đó
   *   đúng là lý do người ta bỏ `<dl>` đi tự dựng lưới.
   */
  it('mỗi cặp là `<dt>` + `<dd>` ĐỨNG THẲNG trong `<dl>`, không hộp trung gian', () => {
    const dl = first(<Facts><Fact name="Số căn cước">123</Fact><Fact name="Nơi ở">Thôn Nam</Fact></Facts>)!
    expect([...dl.children].map((n) => n.tagName)).toEqual(['DT', 'DD', 'DT', 'DD'])
  })

  it('giá trị dài thì xếp dọc — biến thể của chính kit', () => {
    expect(first(<Facts stacked><Fact name="a">b</Fact></Facts>)!.className)
      .toBe('fos-facts fos-facts--stacked')
  })
})

describe('badge — một trạng thái, một chữ', () => {
  it('sắc thái ra đúng một lớp bổ nghĩa', () => {
    expect(first(<Badge tone="done">Xong</Badge>)!.className).toBe('fos-badge fos-badge--done')
  })

  it('chấm trần có `label` thì mang `--bare` và được đọc tên', () => {
    const b = first(<Badge tone="stop" label="Quá hạn" />)!
    expect(b.className).toBe('fos-badge fos-badge--stop fos-badge--bare')
    expect(b.getAttribute('aria-label')).toBe('Quá hạn')
  })

  it('có chữ thì KHÔNG mang `--bare`', () => {
    expect(first(<Badge tone="wait">Chờ</Badge>)!.className).not.toContain('bare')
  })

  it('legend là chỗ giải nghĩa những cái chấm trần', () => {
    expect(first(<Legend><Badge tone="stop" label="x" /></Legend>)!.className).toBe('fos-legend')
  })
})

describe('count và tag — KHÔNG phải trạng thái', () => {
  /*
   * ⚠️ Kit nói rõ trong chính tệp kiểu dáng: vẽ "bao nhiêu" bằng một sắc thái
   *    là bắt người đọc đi tìm một nghĩa không tồn tại — và đó là cách một màn
   *    hình có mười bốn thứ có màu mà không có tín hiệu nào.
   */
  it('count không nhận sắc thái, và không mượn chấm của badge', () => {
    const c = first(<Count>12</Count>)!
    expect(c.className).toBe('fos-count')
    expect(c.className).not.toContain('badge')
  })

  it('tag cũng vậy', () => {
    const t = first(<Tag>Lưu động</Tag>)!
    expect(t.className).toBe('fos-tag')
    expect(t.className).not.toContain('badge')
  })
})

describe('meter — bao xa rồi, so với đích', () => {
  /*
   * ⛔ MỘT CON SỐ, HAI NƠI ĐỌC, VÀ CHÚNG KHÔNG ĐƯỢC LỆCH NHAU.
   *    Bề rộng vệt tô và `aria-valuenow` phải sinh ra từ CÙNG cặp số. Tính
   *    riêng hai chỗ là có ngày thanh vẽ một đằng, trình đọc màn hình đọc một
   *    nẻo — và không ai thấy, vì mỗi bên tự nó đều đúng.
   */
  it('vệt tô và lời đọc ra từ cùng cặp số', () => {
    const m = first(<Meter value={3} max={4} label="Nhân lực" />)!
    expect(m.getAttribute('role')).toBe('meter')
    expect(m.getAttribute('aria-valuenow')).toBe('3')
    expect(m.getAttribute('aria-valuemax')).toBe('4')
    expect((m.firstElementChild as HTMLElement).style.width).toBe('75%')
  })

  /* ⚠️ Đích chưa ai đặt thì KHÔNG phải lỗi, và không được chia cho 0. */
  it('đích bằng 0 thì đọc là rỗng, không ném và không ra NaN', () => {
    const m = first(<Meter value={5} max={0} label="x" />)!
    expect((m.firstElementChild as HTMLElement).style.width).toBe('0%')
  })

  it('vượt đích thì kẹp lại ở đầy, không tràn ra ngoài thanh', () => {
    const m = first(<Meter value={9} max={4} label="x" />)!
    expect((m.firstElementChild as HTMLElement).style.width).toBe('100%')
  })

  it('số âm kẹp về 0', () => {
    const m = first(<Meter value={-2} max={4} label="x" />)!
    expect((m.firstElementChild as HTMLElement).style.width).toBe('0%')
  })
})

describe('avatar — ai', () => {
  /*
   * ⚠️ CHỮ CÁI KHÔNG TỰ SUY RA Ở ĐÂY. Lấy chữ nào thay cho một con người là
   *    một quy ước đặt tên, và quy ước ấy không giống nhau ở mọi thứ tiếng —
   *    tên tiếng Việt lấy hai âm tiết CUỐI, không lấy chữ đầu của hai từ đầu.
   */
  it('vẽ đúng chữ nơi gọi đưa vào, không tự cắt từ tên', () => {
    const a = first(<Avatar initials="NB" label="Nguyễn Văn B" />)!
    expect(a.textContent).toBe('NB')
    expect(a.getAttribute('aria-label')).toBe('Nguyễn Văn B')
  })

  /* ⚠️ `alt=""` khi đã có `aria-label` ở vòng ngoài: hai cái tên cho một thứ
     thì trình đọc màn hình đọc lên hai lần. */
  it('có ảnh thì ảnh câm, tên nằm ở vòng ngoài', () => {
    const a = first(<Avatar src="/x.png" label="Nguyễn Văn B" />)!
    expect(a.querySelector('img')!.getAttribute('alt')).toBe('')
    expect(a.getAttribute('aria-label')).toBe('Nguyễn Văn B')
  })
})

describe('provenance — con số này ở đâu ra', () => {
  it('mang lớp của nhân', () => {
    expect(first(<Provenance>Dữ liệu khởi tạo của xã</Provenance>)!.className)
      .toBe('fos-provenance')
  })
})

/*
 * ⛔ TIỀN TỐ ĐỔI ĐƯỢC, VÀ CẢ NHÓM PHẢI ĐỔI THEO.
 *   Một phần tử gõ cứng chữ `fos-` chỉ lộ ra ở ứng dụng thứ hai — chỗ không ai
 *   trong nhóm này chạy thử. Nên hỏi ngay tại đây.
 */
describe('tiền tố', () => {
  it('mọi phần tử của nhóm đều đi qua `cls()`, không gõ cứng `fos-`', () => {
    setPrefix('zz')
    const hasText = (n: React.ReactNode, expected: string) => {
      cleanup()
      expect(first(n)!.className.split(' ')[0]).toBe(expected)
    }
    hasText(<Card>x</Card>, 'zz-card')
    hasText(<CardHead>x</CardHead>, 'zz-card-head')
    hasText(<CardBody>x</CardBody>, 'zz-card-body')
    hasText(<Facts><Fact name="a">b</Fact></Facts>, 'zz-facts')
    hasText(<Badge tone="done">x</Badge>, 'zz-badge')
    hasText(<Legend>x</Legend>, 'zz-legend')
    hasText(<Count>1</Count>, 'zz-count')
    hasText(<Tag>x</Tag>, 'zz-tag')
    hasText(<Meter value={1} max={2} label="x" />, 'zz-meter')
    hasText(<Avatar initials="AB" label="x" />, 'zz-avatar')
    hasText(<Provenance>x</Provenance>, 'zz-provenance')
    hasText(<Card as="section">x</Card>, 'zz-card')
  })
})
