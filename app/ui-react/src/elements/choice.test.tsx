import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Check, Radio } from './choice.js'
import { setPrefix } from '../prefix/index.js'

afterEach(() => { cleanup(); setPrefix('fos') })
const box = (c: React.ReactNode) => render(<>{c}</>).container.firstElementChild!

describe('chọn — lớp nằm trên THẺ BỌC, vì vùng bấm là cả nhãn', () => {
  /*
   * ⛔ ĐÂY LÀ KHẲNG ĐỊNH CHÍNH, VÀ NÓ ĐO ĐƯỢC.
   *
   *   Hình học của `.fos-check` — inline-flex, gap, min-height — là hình học
   *   của thẻ bọc. Đặt lớp lên <input> thì màu đúng mà chữ rơi xuống dòng dưới;
   *   đã dựng cả hai biến thể và đo trên trình duyệt trước khi chọn.
   */
  it('ra <label class="fos-check"> bọc <input type=checkbox>', () => {
    const el = box(<Check name="doi_chieu" value="1">Đã đối chiếu</Check>)
    expect(el.tagName).toBe('LABEL')
    expect(el.className).toBe('fos-check')
    expect(el.querySelector('input')!.getAttribute('type')).toBe('checkbox')
  })

  it('Radio ra <input type=radio>, không phải checkbox đội tên', () => {
    expect(box(<Radio name="loai" value="cap-lai">Cấp lại</Radio>).querySelector('input')!.getAttribute('type'))
      .toBe('radio')
  })

  it('chữ nằm trong cùng nhãn — cả nhãn là vùng bấm', () => {
    expect(box(<Check name="doi_chieu" value="1">Đã đối chiếu</Check>).textContent).toBe('Đã đối chiếu')
  })

  /*
   * ⚠️ `disabled` PHẢI ở trên <input>, không phải trên nhãn. Nhân với tới nhãn
   *    bằng `:has(:disabled)`. Đặt `aria-disabled` lên nhãn là nói dối: trình
   *    đọc màn hình báo khoá trong khi ô vẫn trả lời.
   */
  it('disabled ở trên INPUT, nhãn không đeo aria-disabled', () => {
    const el = box(<Check name="k" value="1" disabled>Khoá</Check>)
    expect(el.querySelector('input')!.hasAttribute('disabled')).toBe(true)
    expect(el.hasAttribute('aria-disabled')).toBe(false)
  })

  it('checked, name, onChange xuống thẳng ô — nhãn không giữ lại gì', () => {
    const el = box(<Check name="doi_chieu" value="1" defaultChecked>x</Check>)
    const input = el.querySelector('input')!
    expect(input.getAttribute('name')).toBe('doi_chieu')
    expect((input as HTMLInputElement).checked).toBe(true)
  })

  it('đổi stem thì nhãn đổi theo', () => {
    setPrefix('acme')
    expect(box(<Radio name="r" value="1">x</Radio>).className).toBe('acme-radio')
  })
})
