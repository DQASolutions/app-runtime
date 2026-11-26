import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { Suggest } from './suggest.js'

afterEach(() => cleanup())

const GROUPS = ['Khối văn phòng', 'Khối sản xuất', 'Điều dưỡng']

function Box({ onValue = () => {} }: { onValue?: (v: string) => void }) {
  const [v, setV] = useState('')
  return <Suggest aria-label="Nhóm khách" maxLength={100} options={GROUPS} value={v} onValue={(x) => { setV(x); onValue(x) }} />
}

describe('⭐ gõ tự do, gợi ý chỉ để khỏi gõ lại', () => {
  it('ô là .fos-field mang vai combobox; danh sách là menu nổi, mỗi dòng là option', () => {
    const c = render(<Box />).container
    const input = c.querySelector('input')!
    expect(input.className).toBe('fos-field')
    expect(input.getAttribute('role')).toBe('combobox')
    fireEvent.focus(input)
    const list = c.querySelector('[role="listbox"]')!
    expect(list.className).toContain('fos-menu--pop')
    expect(list.closest('.fos-suggest')).not.toBeNull()
    expect(c.querySelectorAll('[role="option"].fos-menu-item')).toHaveLength(3)
  })

  it('lọc không dấu: gõ "dieu" ra "Điều dưỡng"', () => {
    const c = render(<Box />).container
    const input = c.querySelector('input')!
    fireEvent.change(input, { target: { value: 'dieu' } })
    expect(Array.from(c.querySelectorAll('[role="option"]')).map((o) => o.textContent)).toEqual(['Điều dưỡng'])
  })

  it('bàn phím: ↓ trỏ dòng, Enter chọn, Esc chỉ cất danh sách', () => {
    const onValue = vi.fn()
    const c = render(<Box onValue={onValue} />).container
    const input = c.querySelector('input')!
    fireEvent.change(input, { target: { value: 'khối' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(c.querySelector('[aria-selected="true"]')?.textContent).toBe('Khối văn phòng')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onValue).toHaveBeenLastCalledWith('Khối văn phòng')
    fireEvent.change(input, { target: { value: 'k' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(c.querySelector('[role="listbox"]')).toBeNull()
  })

  it('bấm chuột vào một gợi ý thì chọn nó', () => {
    const onValue = vi.fn()
    const c = render(<Box onValue={onValue} />).container
    fireEvent.focus(c.querySelector('input')!)
    fireEvent.click(c.querySelectorAll('[role="option"]')[2])
    expect(onValue).toHaveBeenLastCalledWith('Điều dưỡng')
  })
})
