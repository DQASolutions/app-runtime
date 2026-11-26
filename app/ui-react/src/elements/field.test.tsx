import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Field, Select, Textarea } from './field.js'
import { setPrefix } from '../prefix/index.js'

afterEach(() => { cleanup(); setPrefix('fos') })
const q = (c: React.ReactNode, sel: string) =>
  render(<>{c}</>).container.querySelector(sel)!

describe('bốn ô cán bộ gõ vào — một hộp, bốn thẻ', () => {
  it('mỗi cái ra đúng THẺ của nó, không phải <div> đội lốt', () => {
    expect(q(<Field name="x" maxLength={100} />, 'input').getAttribute('type')).toBe('text')
    expect(q(<Select name="x"><option/></Select>, 'select').tagName).toBe('SELECT')
    expect(q(<Textarea name="x" maxLength={1000} />, 'textarea').tagName).toBe('TEXTAREA')
  })

  it('mỗi cái mang đúng lớp của nó — bốn lớp, không dùng chung một', () => {
    expect(q(<Field name="x" maxLength={100} />, 'input').className).toBe('fos-field')
    expect(q(<Select name="x" />, 'select').className).toBe('fos-select')
    expect(q(<Textarea name="x" maxLength={1000} />, 'textarea').className).toBe('fos-textarea')
  })

  it('lớp của người gọi được cộng thêm, không đè', () => {
    expect(q(<Field name="x" maxLength={100} className="w-full" />, 'input').className).toBe('fos-field w-full')
  })

  /*
   * ⛔ MỘT CỜ, HAI NGƯỜI ĐỌC. Viền đỏ mà trình đọc màn hình không thấy chỉ là
   *    một nửa lời báo lỗi. Luật của nhân neo vào `[aria-invalid="true"]` đúng
   *    vì thuộc tính ấy vừa vẽ được vừa đọc lên được.
   */
  it('invalid ghi bằng aria-invalid, không bằng một lớp thêm', () => {
    const el = q(<Field name="x" maxLength={100} invalid />, 'input')
    expect(el.getAttribute('aria-invalid')).toBe('true')
    expect(el.className).toBe('fos-field')
  })

  it('không invalid thì KHÔNG ghi aria-invalid="false" — im lặng, không cãi', () => {
    expect(q(<Field name="x" maxLength={100} />, 'input').hasAttribute('aria-invalid')).toBe(false)
  })

  it('readonly và disabled đi thẳng xuống thẻ — nhân neo vào chúng', () => {
    const el = q(<Field name="x" maxLength={100} readOnly disabled />, 'input')
    expect(el.hasAttribute('readonly')).toBe(true)
    expect(el.hasAttribute('disabled')).toBe(true)
  })

  it('đổi stem thì cả bốn đổi theo', () => {
    setPrefix('acme')
    expect(q(<Select name="x" />, 'select').className).toBe('acme-select')
  })

  it('Select chở được các <option> của người gọi', () => {
    const el = q(<Select name="x"><option value="a">A</option></Select>, 'select')
    expect(el.querySelectorAll('option').length).toBe(1)
  })
})
