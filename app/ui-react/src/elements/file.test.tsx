import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { FileField, fileSize } from './file.js'
import { setPrefix } from '../prefix/index.js'

afterEach(() => { cleanup(); setPrefix('fos') })
const box = (c: React.ReactNode) => render(<>{c}</>).container.firstElementChild as HTMLLabelElement
const pdfFile = (name = 'quyet-dinh.pdf') => new File(['x'], name, { type: 'application/pdf' })
/** Đủ chuẩn dữ liệu — ô tệp nào cũng phải khai loại, cỡ, và lời khi bác. */
const STANDARD = { name: 'scan', accept: 'application/pdf,image/*', maxBytes: 1024, refused: () => 'Bác' }

describe('vùng thả — cả vùng bấm được, hoặc kéo tệp thả vào', () => {
  /*
   * ⛔ KHẲNG ĐỊNH CHÍNH. Bản trước của app vẽ khung nét đứt mà chỉ cái NÚT bên
   *    trong mới bấm được; người dùng bấm khoảng trống, không thấy gì, kết luận
   *    màn hình hỏng. Nên phép thử hỏi thẳng: cả vùng có phải là nhãn không.
   */
  it('cả vùng là <label> trỏ vào ô tệp thật, không phải một cái nút', () => {
    const el = box(<FileField {...STANDARD} main="Chọn tệp" />)
    expect(el.tagName).toBe('LABEL')
    expect(el.className).toBe('fos-file')
    const input = el.querySelector('input')!
    expect(input.getAttribute('type')).toBe('file')
    expect(el.getAttribute('for')).toBe(input.getAttribute('id'))
  })

  it('ô tệp thật còn trong DOM — bàn phím tới được, không display:none', () => {
    const el = box(<FileField {...STANDARD} main="x" />)
    const input = el.querySelector('input')!
    expect(input.hidden).toBe(false)
    expect(input.style.display).not.toBe('none')
  })

  it('chưa chọn thì nói lời trống, không đặt lớp --has', () => {
    const el = box(<FileField {...STANDARD} main="Chọn ảnh bản đã ký" hint="Bấm hoặc kéo thả" />)
    expect(el.className).toBe('fos-file')
    expect(el.querySelector('.fos-file-main')!.textContent).toBe('Chọn ảnh bản đã ký')
    expect(el.querySelector('.fos-file-hint')!.textContent).toBe('Bấm hoặc kéo thả')
  })

  it('chọn xong thì đổi lời, đặt --has, và gọi onPick', () => {
    const onPick = vi.fn()
    const el = box(<FileField {...STANDARD} main="Chọn tệp" onPick={onPick} />)
    fireEvent.change(el.querySelector('input')!, { target: { files: [pdfFile()] } })
    expect(el.className).toContain('fos-file--has')
    expect(el.querySelector('.fos-file-main')!.textContent).toBe('quyet-dinh.pdf')
    expect(onPick).toHaveBeenCalledTimes(1)
  })

  it('đang kéo lơ lửng bên trên thì đặt --over, rời ra thì bỏ', () => {
    const el = box(<FileField {...STANDARD} main="x" />)
    fireEvent.dragOver(el)
    expect(el.className).toContain('fos-file--over')
    fireEvent.dragLeave(el)
    expect(el.className).not.toContain('fos-file--over')
  })

  /*
   * ⛔ PHÉP THỬ QUAN TRỌNG NHẤT, VÀ LÀ CÁI DỄ BỎ SÓT NHẤT.
   *
   *   Kéo-thả mà chỉ giữ tệp trong bộ nhớ màn hình thì tệp HIỆN LÊN nhưng KHÔNG
   *   được gửi: biểu mẫu đọc `input.files`, `required` cũng đọc chỗ đó. Lỗi ấy
   *   trông như lỗi máy chủ và không phải.
   */
  it('thả tệp thì tệp phải nằm trên chính ô input — không thì gửi đi rỗng', () => {
    const el = box(<FileField {...STANDARD} main="x" />)
    const f = pdfFile('bien-ban.pdf')
    const dt = new DataTransfer(); dt.items.add(f)
    fireEvent.drop(el, { dataTransfer: dt })
    const input = el.querySelector('input') as HTMLInputElement
    expect(input.files?.length).toBe(1)
    expect(input.files?.[0].name).toBe('bien-ban.pdf')
    expect(el.className).toContain('fos-file--has')
  })

  it('bỏ tệp: xoá khỏi ô, gọi onPick(null), và KHÔNG mở lại hộp chọn tệp', () => {
    const onPick = vi.fn()
    const el = box(<FileField {...STANDARD} main="x" clearLabel="Bỏ tệp" onPick={onPick} />)
    fireEvent.change(el.querySelector('input')!, { target: { files: [pdfFile()] } })
    /* ⚠️ `fireEvent` chứ không phải `dispatchEvent` trần: chỉ `fireEvent` bọc
       trong `act()`, nên React kịp vẽ lại trước khi khẳng định lớp. Bản trước
       của phép thử này dùng dispatch trần và đỏ vì đúng lý do ấy, không phải vì
       mã sai. `fireEvent` trả `false` khi sự kiện bị chặn. */
    const nut = el.querySelector('button')!
    expect(fireEvent.click(nut)).toBe(false)
    expect(onPick).toHaveBeenLastCalledWith(null)
    expect(el.className).not.toContain('fos-file--has')
  })

  it('không truyền clearLabel thì không vẽ nút bỏ tệp', () => {
    const el = box(<FileField {...STANDARD} main="x" />)
    fireEvent.change(el.querySelector('input')!, { target: { files: [pdfFile()] } })
    expect(el.querySelector('button')).toBeNull()
  })

  it('khoá thì thả tệp không ăn', () => {
    const el = box(<FileField {...STANDARD} main="x" disabled />)
    const dt = new DataTransfer(); dt.items.add(pdfFile())
    fireEvent.drop(el, { dataTransfer: dt })
    expect(el.className).not.toContain('fos-file--has')
  })

  it('cỡ tệp đọc ra được, không mang tiếng nào', () => {
    expect(fileSize(900)).toBe('1 KB')
    expect(fileSize(1024 * 1024 * 1.44)).toBe('1.4 MB')
  })
})
