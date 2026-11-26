import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { Pick, RowHeader, TBody, THead, Table, Td, Th, Tr, TreeToggle } from './table.js'
import { setPrefix } from '../prefix/index.js'

afterEach(() => { cleanup(); setPrefix('fos') })
const box = (c: React.ReactNode) => render(<>{c}</>).container

describe('bảng — hộp và khung cuộn', () => {
  it('vẽ <table> mang lớp nhân, bọc trong khung cuộn', () => {
    const c = box(<Table><TBody><Tr><Td>x</Td></Tr></TBody></Table>)
    expect(c.firstElementChild!.className).toBe('fos-table-wrap')
    expect(c.querySelector('table')!.className).toBe('fos-table')
  })

  /*
   * ⛔ MẶC ĐỊNH BẬT. Một bảng rộng không có khung cuộn riêng thì kéo CẢ TRANG
   *    trượt ngang, và người đọc mất luôn cột danh tính bên trái.
   */
  it('tắt khung cuộn được, nhưng phải nói ra', () => {
    expect(box(<Table wrap={false}><TBody><Tr><Td>x</Td></Tr></TBody></Table>)
      .firstElementChild!.tagName).toBe('TABLE')
  })

  /*
   * ⚠️ `sticky` là một CỜ, không phải chuỗi lớp người gọi tự ghép. 65 tệp của
   *    ứng dụng gốc chép `fos-table--sticky` HAI LẦN trong cùng thuộc tính —
   *    thứ chỉ xảy ra khi người ta chép chuỗi thay vì khai ý định.
   */
  it('sticky thêm đúng MỘT lần, không lặp', () => {
    const t = box(<Table sticky><TBody><Tr><Td>x</Td></Tr></TBody></Table>).querySelector('table')!
    expect(t.className).toBe('fos-table fos-table--sticky')
    expect(t.className.match(/sticky/g)!.length).toBe(1)
  })

  it('lớp của người gọi cộng thêm, cả trên bảng lẫn trên khung', () => {
    const c = box(<Table className="wh-tb" wrapClassName="tall"><TBody><Tr><Td>x</Td></Tr></TBody></Table>)
    expect(c.firstElementChild!.className).toBe('fos-table-wrap tall')
    expect(c.querySelector('table')!.className).toBe('fos-table wh-tb')
  })
})

describe('⛔ `scope` SUY RA TỪ CHỖ ĐỨNG, không do ai nhớ gõ', () => {
  it('`Th` trong `THead` tự khai scope=col', () => {
    const th = box(
      <Table><THead><Tr><Th>Nội dung</Th></Tr></THead></Table>,
    ).querySelector('th')!
    expect(th.getAttribute('scope')).toBe('col')
  })

  /*
   * ⚠️ Ngoài `<THead>` thì KHÔNG đoán hộ: một `<th>` giữa thân bảng chỉ người
   *    viết mới biết nó đứng đầu hàng hay đầu cột. Chỗ ấy dùng `RowHeader`.
   */
  it('`Th` ngoài `THead` KHÔNG tự khai scope — đoán hộ là đoán sai', () => {
    const th = box(
      <Table><TBody><Tr><Th>x</Th></Tr></TBody></Table>,
    ).querySelector('th')!
    expect(th.hasAttribute('scope')).toBe(false)
  })

  /*
   * ⛔ Ô DANH TÍNH CỦA DÒNG LÀ `<th scope="row">`. Để là `<td>` thì trình đọc
   *    màn hình đọc mỗi ô thành một con số trần không biết của ai.
   *    ⚠️ Và đây chính là chỗ đổi `<td>`→`<th>` từng làm 40 màn mất kiểu.
   */
  it('`RowHeader` là <th scope="row">, luôn luôn', () => {
    const th = box(
      <Table><TBody><Tr><RowHeader lead={<i />}>Nguyễn Văn A</RowHeader><Td>22</Td></Tr></TBody></Table>,
    ).querySelector('th')!
    expect(th.getAttribute('scope')).toBe('row')
    expect(th.textContent).toBe('Nguyễn Văn A')
  })

  it('mọi <th> trong cây đều có scope — không sót cái nào', () => {
    const c = box(
      <Table sticky>
        <THead><Tr><Th>A</Th><Th numeric>B</Th></Tr></THead>
        <TBody><Tr><RowHeader lead={<i />}>x</RowHeader><Td numeric>1</Td></Tr></TBody>
      </Table>,
    )
    for (const th of [...c.querySelectorAll('th')]) expect(th.hasAttribute('scope')).toBe(true)
  })

  it('`numeric` gắn lớp số của nhân cho cả đầu cột lẫn ô', () => {
    const c = box(
      <Table><THead><Tr><Th numeric>B</Th></Tr></THead>
        <TBody><Tr><Td numeric>1</Td></Tr></TBody></Table>,
    )
    expect(c.querySelector('th')!.className).toBe('fos-num')
    expect(c.querySelector('td')!.className).toBe('fos-num')
  })

  it('dòng đang chọn nói bằng aria-selected — thứ nhân neo vào', () => {
    const c = box(<Table><TBody><Tr selected><Td>x</Td></Tr><Tr><Td>y</Td></Tr></TBody></Table>)
    const trs = [...c.querySelectorAll('tr')]
    expect(trs[0].getAttribute('aria-selected')).toBe('true')
    expect(trs[1].hasAttribute('aria-selected')).toBe(false)
  })
})

describe('pick — chọn chính dòng nó ngồi trong', () => {
  it('ra <td class=fos-pick-cell> bọc <label class=fos-pick> bọc ô tích', () => {
    const td = box(<Table><TBody><Tr><Pick label="Chọn Nguyễn Văn A" /></Tr></TBody></Table>)
      .querySelector('td')!
    expect(td.className).toBe('fos-pick-cell')
    const lab = td.querySelector('label')!
    expect(lab.className).toBe('fos-pick')
    expect(lab.querySelector('input')!.getAttribute('type')).toBe('checkbox')
  })

  /* ⛔ Một ô tích trần trong bảng không nói nó chọn dòng NÀO. */
  it('tên trợ năng nằm trên chính ô tích', () => {
    expect(box(<Table><TBody><Tr><Pick label="Chọn Nguyễn Văn A" /></Tr></TBody></Table>)
      .querySelector('input')!.getAttribute('aria-label')).toBe('Chọn Nguyễn Văn A')
  })

  it('bỏ vỏ <td> được khi đặt ở chỗ khác', () => {
    expect(box(<Pick label="x" cell={false} />).firstElementChild!.tagName).toBe('LABEL')
  })

  it('checked, disabled, onChange xuống thẳng ô tích', () => {
    const onChange = vi.fn()
    const c = box(<Pick label="x" cell={false} defaultChecked onChange={onChange} />)
    const i = c.querySelector('input') as HTMLInputElement
    expect(i.checked).toBe(true)
    fireEvent.click(i)
    expect(onChange).toHaveBeenCalled()
  })
})

describe('tree-toggle — mở các dòng bên dưới dòng này', () => {
  it('nút nói ra đang mở hay đóng', () => {
    expect(box(<TreeToggle open label="Mở việc con" />).firstElementChild!
      .getAttribute('aria-expanded')).toBe('true')
    cleanup()
    expect(box(<TreeToggle open={false} label="x" />).firstElementChild!
      .getAttribute('aria-expanded')).toBe('false')
  })

  /* ⛔ Nút chỉ có một hình thì cái tên là thứ DUY NHẤT đọc lên được. */
  it('luôn có tên trợ năng, và là type=button', () => {
    const b = box(<TreeToggle open label="Mở việc con" />).firstElementChild!
    expect(b.getAttribute('aria-label')).toBe('Mở việc con')
    expect(b.getAttribute('type')).toBe('button')
    expect(b.className).toBe('fos-tree-toggle')
  })

  it('đổi stem thì mọi lớp đổi theo', () => {
    setPrefix('acme')
    const c = box(
      <Table sticky><TBody><Tr><Pick label="x" /><Td numeric>1</Td></Tr></TBody></Table>,
    )
    expect(c.firstElementChild!.className).toBe('acme-table-wrap')
    expect(c.querySelector('table')!.className).toBe('acme-table acme-table--sticky')
    expect(c.querySelector('td')!.className).toBe('acme-pick-cell')
  })

  /*
   * ⛔ DẤU ĐỨNG TRƯỚC TÊN PHẢI LÀ MỘT KHE RIÊNG, không phải chữ đầu của
   *   `children`. Nhét inline thì chỉ DÒNG ĐẦU né nó — dòng thứ hai của một tên
   *   dài bắt đầu từ mép ô. Người dùng của app tham chiếu chỉ ra hai lần trong một
   *   ngày, và cả hai lần bản vá đều ở tầng app nên chỉ chữa được một màn.
   */
  describe('RowHeader lead', () => {

    it('có `lead` thì dựng BA KHE, và chữ nằm trong khe co giãn', () => {
      const { container } = render(
        <table><tbody><tr>
          <RowHeader lead={<span data-t="ico" />}>Tên việc rất dài</RowHeader>
        </tr></tbody></table>)
      const head = container.querySelector('.fos-row-head')!
      expect(head).not.toBeNull()
      expect(head.querySelector('.fos-row-head-lead [data-t="ico"]')).not.toBeNull()
      expect(head.querySelector('.fos-row-head-text')!.textContent).toBe('Tên việc rất dài')
    })
  })
})
