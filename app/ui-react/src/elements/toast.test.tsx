import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup, act, fireEvent } from '@testing-library/react'
import { Toaster, toast, dismissAllToasts } from './toast.js'
import { Dialog, DialogHead, DialogBody } from './dialog.js'
import { setPrefix } from '../prefix/index.js'

/* Khung bắt buộc của mọi hộp thoại mở (nhân 0.70): đúng một đầu, đúng một thân. */
const S = <><DialogHead title="t" closeLabel="Đóng" closeIcon={<svg />} /><DialogBody /></>

afterEach(() => { act(() => dismissAllToasts()); cleanup(); setPrefix('fos'); vi.useRealTimers() })
const X = <svg />
const host = () => <Toaster label="Thông báo" closeLabel="Đóng thông báo" closeIcon={X} />

describe('⭐ lời báo ở GÓC — người dùng chốt 26/9/2026: lỗi tại chỗ thì không ai thấy', () => {
  it('hiện trong vùng có tên, ở một chỗ duy nhất', () => {
    const c = render(host()).container
    act(() => { toast('Không lưu được: mất kết nối', { tone: 'stop' }) })
    const region = c.querySelector('section.fos-toasts')!
    expect(region.getAttribute('aria-label')).toBe('Thông báo')
    expect(region.querySelector('.fos-toast--stop')?.textContent).toContain('Không lưu được')
  })

  it('⛔ lỗi là `alert` và Ở LẠI — không tự tắt', () => {
    vi.useFakeTimers()
    const c = render(host()).container
    act(() => { toast('Hỏng', { tone: 'stop' }) })
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(c.querySelector('[role="alert"]')?.textContent).toContain('Hỏng')
  })

  it('báo xong là `status` và tự tắt sau 5 giây', () => {
    vi.useFakeTimers()
    const c = render(host()).container
    act(() => { toast('Đã lưu', { tone: 'done' }) })
    expect(c.querySelector('[role="status"]')).not.toBeNull()
    act(() => { vi.advanceTimersByTime(5_100) })
    expect(c.querySelector('.fos-toast')).toBeNull()
  })

  it('nút đóng gỡ đúng lời báo ấy', () => {
    const c = render(host()).container
    act(() => { toast('Một', { tone: 'stop' }); toast('Hai', { tone: 'stop' }) })
    fireEvent.click(c.querySelector('.fos-toast button')!)
    expect([...c.querySelectorAll('.fos-toast')].map((e) => e.textContent)).toEqual(['Hai'])
  })

  it('cùng một câu bấm lại ba lần thì vẫn MỘT lời báo', () => {
    const c = render(host()).container
    act(() => { for (let i = 0; i < 3; i += 1) toast('Mất kết nối', { tone: 'stop' }) })
    expect(c.querySelectorAll('.fos-toast')).toHaveLength(1)
  })
})

describe('⚠️ hộp thoại đang mở — lời báo hiện TRONG nó, không nằm dưới lớp mờ', () => {
  it('có hộp thoại mở thì lời báo nằm trong <dialog>, không ở gốc', () => {
    const c = render(<>{host()}<Dialog open onClose={() => {}}>{S}<p>Biểu mẫu</p></Dialog></>).container
    act(() => { toast('Lỗi trong hộp', { tone: 'stop' }) })
    const t = c.querySelector('.fos-toast')!
    expect(t.closest('dialog')).not.toBeNull()
    expect(c.querySelectorAll('.fos-toast')).toHaveLength(1)
  })
})
