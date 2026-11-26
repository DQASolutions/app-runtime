import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { fileViolation, type PropertyDef } from '@dqa-ai-solutions/core-runtime/input'
import { FileField, fileRefusal } from './file.js'

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.resetModules() })

const pdf = (ten = 'qd.pdf', size = 10, type = 'application/pdf') => new File(['x'.repeat(size)], ten, { type })
const STANDARD = { name: 'scan', accept: 'application/pdf,image/*', maxBytes: 100, refused: (w: { keyword: string }) => `Bác: ${w.keyword}` }
const label = (props: Record<string, unknown>) =>
  render(<FileField main="Chọn tệp" hint="Kéo thả" {...props} />).container.firstElementChild as HTMLLabelElement

describe('ô tệp BÁC tệp sai — chọn hay thả đều thế', () => {
  it.each([
    ['quá cỡ', pdf('qd.pdf', 101), 'maxBytes'],
    ['sai loại', pdf('phim.mp4', 10, 'video/mp4'), 'accept'],
    ['không MIME, đuôi lạ', pdf('a.exe', 10, ''), 'accept'],
    ['đuôi .pdf mà MIME là html', pdf('a.pdf', 10, 'text/html'), 'accept'],
  ])('CHỌN %s → không nằm lại trên ô, nói lý do, báo onRefuse', (_, file, keyword) => {
    const onPick = vi.fn(); const onRefuse = vi.fn()
    const el = label({ ...STANDARD, onPick, onRefuse })
    const input = el.querySelector('input')!
    fireEvent.change(input, { target: { files: [file] } })
    expect(input.value).toBe('')
    expect(el.className).not.toContain('fos-file--has')
    expect(el.getAttribute('aria-invalid')).toBe('true')
    expect(el.querySelector('[role="alert"]')!.textContent).toBe(`Bác: ${keyword}`)
    expect(onRefuse).toHaveBeenCalledWith(expect.objectContaining({ keyword, file }))
    expect(onPick).not.toHaveBeenCalled()
  })

  it('THẢ tệp sai → KHÔNG gán vào input.files (không thì biểu mẫu vẫn gửi nó)', () => {
    const el = label(STANDARD)
    const dt = new DataTransfer(); dt.items.add(pdf('phim.mp4', 10, 'video/mp4'))
    fireEvent.drop(el, { dataTransfer: dt })
    expect((el.querySelector('input') as HTMLInputElement).files?.length ?? 0).toBe(0)
    expect(el.querySelector('[role="alert"]')!.textContent).toBe('Bác: accept')
  })

  it('đã có tệp đúng rồi thả tệp sai → tệp cũ rời ô, onPick(null), không để hình "đã chọn" nói dối', () => {
    const onPick = vi.fn()
    const el = label({ ...STANDARD, onPick })
    fireEvent.change(el.querySelector('input')!, { target: { files: [pdf()] } })
    expect(el.className).toContain('fos-file--has')
    fireEvent.change(el.querySelector('input')!, { target: { files: [pdf('to.pdf', 5000)] } })
    expect(onPick).toHaveBeenLastCalledWith(null)
    expect(el.className).not.toContain('fos-file--has')
  })

  it.each([
    pdf('qd.pdf', 100),
    pdf('anh.JPG', 10, 'image/jpeg'),
  ])('ACCEPT %s — đúng loại, đúng cỡ (đúng bằng trần vẫn nhận)', (file) => {
    const onPick = vi.fn()
    const el = label({ ...STANDARD, onPick })
    fireEvent.change(el.querySelector('input')!, { target: { files: [file] } })
    expect(onPick).toHaveBeenCalledWith(file)
    expect(el.getAttribute('aria-invalid')).toBeNull()
    expect(el.querySelector('[role="alert"]')).toBeNull()
  })

  it('bác xong chọn lại tệp đúng → lời bác biến mất', () => {
    const el = label(STANDARD)
    const input = el.querySelector('input')!
    fireEvent.change(input, { target: { files: [pdf('to.pdf', 5000)] } })
    fireEvent.change(input, { target: { files: [pdf()] } })
    expect(el.querySelector('[role="alert"]')).toBeNull()
    expect(el.querySelector('.fos-file-hint')!.textContent).toBe('Kéo thả')
  })
})

describe('⭐ MỘT LUẬT, HAI LỚP — ô và cổng tải lên không được lệch nhau', () => {
  const accept = ['application/pdf', 'image/*', '.docx']
  const def = { name: 'scan', type: 'file', accept, maxBytes: 1000 } as PropertyDef
  const files = [
    pdf('a.pdf', 1000), pdf('a.pdf', 1001), pdf('movie.mp4', 10, 'video/mp4'), pdf('a.exe', 10, ''),
    pdf('a.pdf', 10, 'text/html'), pdf('scan', 10, ''), pdf('photo.JPG', 10, 'image/jpeg'),
    pdf('Report.DOCX', 10, ''), pdf('x.png', 10, 'IMAGE/PNG'),
  ]
  it.each(files.map((f) => [f.name, f.size, f.type, f] as const))('%s · %i B · %j', (_n, _s, _t, f) => {
    const kernel = fileViolation(def, f)
    const box = fileRefusal(f, accept.join(','), 1000)
    expect(box?.keyword ?? null).toBe(kernel?.keyword ?? null)
  })
})
