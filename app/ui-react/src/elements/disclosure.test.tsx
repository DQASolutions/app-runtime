import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Disclosure } from './disclosure.js'
import { setPrefix } from '../prefix/index.js'

afterEach(() => { cleanup(); setPrefix('fos') })
const box = (c: React.ReactNode) => render(<>{c}</>).container.firstElementChild!

describe('disclosure — mở thêm phần đã có ở đây, không đi đâu cả', () => {
  it('dùng <details>/<summary> của nền tảng, không tự dựng trạng thái', () => {
    const el = box(<Disclosure summary="Căn cứ">nội dung</Disclosure>)
    expect(el.tagName).toBe('DETAILS')
    expect(el.querySelector('summary')!.textContent).toBe('Căn cứ')
  })

  /*
   * ⛔ LỚP NẰM TRÊN <summary>, KHÔNG TRÊN <details>.
   *    Luật của nhân chở `hover` · `active` · `focus-visible` — ba trạng thái
   *    của THỨ BỊ BẤM. Đặt lên <details> thì cả ba treo trên cái hộp mở ra.
   */
  it('lớp nhân nằm trên <summary>, không trên <details>', () => {
    const el = box(<Disclosure summary="Căn cứ">x</Disclosure>)
    expect(el.querySelector('summary')!.className).toBe('fos-disclosure')
    expect(el.className).toBe('')
  })

  it('nội dung nằm ngoài <summary> — không thì mở ra vẫn thấy trước khi mở', () => {
    const el = box(<Disclosure summary="Căn cứ"><p>Điều 5</p></Disclosure>)
    expect(el.querySelector('summary')!.querySelector('p')).toBeNull()
    expect(el.querySelector('p')!.textContent).toBe('Điều 5')
  })

  it('open đi xuống <details>', () => {
    expect(box(<Disclosure summary="x" open>y</Disclosure>).hasAttribute('open')).toBe(true)
  })
})
