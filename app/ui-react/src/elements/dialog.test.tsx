import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { Dialog, DialogHead, DialogBody } from './dialog.js'
import { ActionBar } from './action-bar.js'
import { Field } from './field.js'
import { setPrefix } from '../prefix/index.js'

/* Khung bắt buộc của mọi hộp thoại mở (nhân 0.70): đúng một đầu, đúng một thân. */
const S = <><DialogHead title="t" closeLabel="Đóng" closeIcon={<svg />} /><DialogBody /></>

afterEach(() => { cleanup(); setPrefix('fos') })
const dlg = (c: React.ReactNode) =>
  render(<>{c}</>).container.querySelector('dialog') as HTMLDialogElement

/* happy-dom chưa dựng `showModal`/`close` như trình duyệt thật — thay bằng bản
   tối thiểu ĐÚNG PHẦN HỢP ĐỒNG chốt này soi: cờ `open`, và sự kiện `close`. */
beforeEachShim()
function beforeEachShim() {
  const proto = globalThis.HTMLDialogElement?.prototype as any
  if (!proto) return
  if (!proto.showModal || proto.showModal.toString().includes('native')) {
    proto.showModal = function () { this.open = true }
    proto.close = function () { this.open = false; this.dispatchEvent(new Event('close')) }
  }
}

describe('dialog — một việc, chặn đường', () => {
  it('dùng thẻ <dialog> của nền tảng, không phải lớp phủ tự chế', () => {
    const el = dlg(<Dialog open onClose={() => {}}>{S}x</Dialog>)
    expect(el.tagName).toBe('DIALOG')
    expect(el.className).toBe('fos-dialog')
  })

  it('đóng thì KHÔNG vẽ gì — không để một thẻ ẩn nằm lại trong cây', () => {
    const { container } = render(<Dialog open={false} onClose={() => {}}>x</Dialog>)
    expect(container.querySelector('dialog')).toBeNull()
  })

  it('mở thì gọi showModal — bẫy tiêu điểm là của nền tảng, không tự dựng', () => {
    expect(dlg(<Dialog open onClose={() => {}}>{S}x</Dialog>).open).toBe(true)
  })

  /*
   * ⛔ TIÊU ĐIỂM VÀO Ô PHẢI ĐIỀN, KHÔNG VÀO NÚT ĐÓNG.
   *    `<dialog>` không tự làm; thiếu thì trình duyệt đặt tiêu điểm lên chính
   *    hộp thoại, và Tab đầu tiên rơi vào nút Đóng ở góc.
   */
  it('tiêu điểm rơi vào ô nhập đầu tiên trong vùng đã chỉ', () => {
    /* ⚠️ Ô Ở NGOÀI VÙNG PHẢI LÀ MỘT Ô ĐIỀN ĐƯỢC, không phải một cái nút.
       Bản đầu của phép thử này để `<button>` ở ngoài — mà bộ chọn chỉ tìm
       input/select/textarea, nên bó hay không bó cũng cùng kết quả, và phép thử
       xanh vì lý do khác lý do nó được viết ra. Chỉ phá thử mới lộ. */
    const el = dlg(
      <Dialog open onClose={() => {}} autoFocusWithin=".body">{S}
        <Field name="x" maxLength={100} id="ngoai" />
        <div className="body"><Field name="x" maxLength={100} id="a" /><Field name="x" maxLength={100} id="b" /></div>
      </Dialog>,
    )
    expect((document.activeElement as HTMLElement)?.id).toBe('a')
    expect(el.querySelector('#ngoai')).not.toBeNull()
  })

  it('bỏ qua ô đang khoá và ô ẩn khi đặt tiêu điểm', () => {
    dlg(
      <Dialog open onClose={() => {}} autoFocusWithin=".body">{S}
        <div className="body">
          <input type="hidden" id="h" />
          <Field name="x" maxLength={100} id="d" disabled />
          <Field name="x" maxLength={100} id="ok" />
        </div>
      </Dialog>,
    )
    expect((document.activeElement as HTMLElement)?.id).toBe('ok')
  })

  /*
   * ⛔ BẤM RA NỀN: đích của cú bấm là CHÍNH `<dialog>`, vì nền là phần tử giả.
   *    Bấm vào con thì không được đóng.
   */
  it('bấm ra nền thì đóng; bấm vào con thì KHÔNG', () => {
    const onClose = vi.fn()
    const el = dlg(<Dialog open onClose={onClose}>{S}<p id="c">x</p></Dialog>)
    fireEvent.click(el.querySelector('#c')!)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(el)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('chưa gõ gì thì bấm ra nền đóng thẳng, không hỏi', () => {
    const onClose = vi.fn(); const onGuard = vi.fn()
    const el = dlg(<Dialog open onClose={onClose} onGuard={onGuard}>{S}<Field name="x" maxLength={100} /></Dialog>)
    fireEvent.click(el)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onGuard).not.toHaveBeenCalled()
  })

  /*
   * ⭐ ĐO NGƯỜI DÙNG CÓ GÕ KHÔNG, KHÔNG SO GIÁ TRỊ.
   *    Bản so-giá-trị sai vì mọi ô chọn nạp danh mục TỪ KHO, tức sau nhịp vẽ
   *    đầu — mốc "sạch" còn rỗng, danh mục về là "đã đổi", và mở ra bấm Esc
   *    ngay cũng bị hỏi.
   */
  it('đã gõ rồi thì bấm ra nền HỎI, không đóng thẳng', () => {
    const onClose = vi.fn(); const onGuard = vi.fn()
    const el = dlg(<Dialog open onClose={onClose} onGuard={onGuard}>{S}<Field name="x" maxLength={100} id="f" /></Dialog>)
    fireEvent.input(el.querySelector('#f')!, { target: { value: 'a' } })
    fireEvent.click(el)
    expect(onGuard).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('chọn trong <select> cũng tính là đã gõ — nghe cả `change`', () => {
    const onGuard = vi.fn()
    const el = dlg(
      <Dialog open onClose={() => {}} onGuard={onGuard}>{S}
        <select id="s"><option value="a">A</option><option value="b">B</option></select>
      </Dialog>,
    )
    fireEvent.change(el.querySelector('#s')!, { target: { value: 'b' } })
    fireEvent.click(el)
    expect(onGuard).toHaveBeenCalledTimes(1)
  })

  it('`dirtyWithin` bó chỗ tính là đã gõ — ô ở chân hộp không kích hoạt', () => {
    const onClose = vi.fn(); const onGuard = vi.fn()
    const el = dlg(
      <Dialog open onClose={onClose} onGuard={onGuard} dirtyWithin=".body">{S}
        <div className="foot"><Field name="x" maxLength={100} id="ft" /></div>
      </Dialog>,
    )
    fireEvent.input(el.querySelector('#ft')!, { target: { value: 'a' } })
    fireEvent.click(el)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onGuard).not.toHaveBeenCalled()
  })

  /*
   * ⛔ ESC KHÔNG ĐI QUA onClick — nó nổ ra sự kiện `cancel`. Một khoá chỉ treo
   *    trên nút Đóng để Esc lọt thẳng, mà Esc là đúng đường người ta bấm khi
   *    muốn thoát nhanh, tức là lúc dễ mất dữ liệu nhất.
   */
  it('Esc đã gõ dở thì bị chặn và HỎI, không đóng', () => {
    const onClose = vi.fn(); const onGuard = vi.fn()
    const el = dlg(<Dialog open onClose={onClose} onGuard={onGuard}>{S}<Field name="x" maxLength={100} id="f" /></Dialog>)
    fireEvent.input(el.querySelector('#f')!, { target: { value: 'a' } })
    const ev = new Event('cancel', { cancelable: true })
    el.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(onGuard).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Esc chưa gõ gì thì KHÔNG chặn — để nền tảng đóng như thường', () => {
    const el = dlg(<Dialog open onClose={() => {}} onGuard={() => {}}>{S}<Field name="x" maxLength={100} /></Dialog>)
    const ev = new Event('cancel', { cancelable: true })
    el.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
  })

  it('không truyền onGuard thì không hỏi bao giờ — đóng thẳng', () => {
    const onClose = vi.fn()
    const el = dlg(<Dialog open onClose={onClose}>{S}<Field name="x" maxLength={100} id="f" /></Dialog>)
    fireEvent.input(el.querySelector('#f')!, { target: { value: 'a' } })
    fireEvent.click(el)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('`isDirty` do nơi gọi truyền thì THẮNG phép đo tự động', () => {
    const onGuard = vi.fn()
    const el = dlg(
      <Dialog open onClose={() => {}} onGuard={onGuard} isDirty={() => true}>{S}x</Dialog>,
    )
    fireEvent.click(el)
    expect(onGuard).toHaveBeenCalledTimes(1)
  })
})

describe('ba đường ra, MỘT đường xử lý', () => {
  /*
   * ⛔ CÁI NÚT DỄ BẤM NHẤT LÀ CÁI DỄ QUÊN NHẤT.
   *    Nút Đóng ở góc nằm trong bố cục của người gọi. Người gọi tự viết
   *    `onClose()` cho nó thì bấm ra nền và Esc đều hỏi, còn cái nút thì không —
   *    và đó chính là đường người ta bấm nhiều nhất.
   */
  it('nút Đóng của người gọi đi qua requestClose thì cũng bị khoá hỏi', () => {
    const onClose = vi.fn(); const onGuard = vi.fn()
    const c = render(
      <Dialog open onClose={onClose} onGuard={onGuard}>
        {({ requestClose }) => (
          <>
            {S}
            <Field name="x" maxLength={100} id="f" />
            <button type="button" id="x" onClick={requestClose}>Đóng</button>
          </>
        )}
      </Dialog>,
    ).container
    fireEvent.input(c.querySelector('#f')!, { target: { value: 'a' } })
    fireEvent.click(c.querySelector('#x')!)
    expect(onGuard).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('chưa gõ gì thì nút Đóng đóng thẳng', () => {
    const onClose = vi.fn()
    const c = render(
      <Dialog open onClose={onClose} onGuard={() => {}}>
        {({ requestClose }) => <>{S}<button type="button" id="x" onClick={requestClose}>Đóng</button></>}
      </Dialog>,
    ).container
    fireEvent.click(c.querySelector('#x')!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('vẫn nhận nội dung thường — hàm chỉ là lối thêm, không phải bắt buộc', () => {
    expect(render(<Dialog open onClose={() => {}}>{S}<p>x</p></Dialog>)
      .container.querySelector('p')!.textContent).toBe('x')
  })
})

describe('⛔ đóng bằng NỀN TẢNG phải báo được cho nơi gọi', () => {
  /*
   * Đo trên màn hình thật: Escape đóng hộp ở tầng nền tảng — `el.open` về false
   * và nó rời khỏi lớp trên cùng — mà nơi gọi KHÔNG hay biết. `open` bên nó vẫn
   * true, thành phần không tháo, và hiệu ứng mở chỉ chạy khi `open && !el.open`
   * nên không chạy lại. Hộp biến mất và KHÔNG MỞ LẠI ĐƯỢC. Không lỗi nào nổ.
   *
   * ⚠️ `close` KHÔNG nổi bọt — đúng loại sự kiện mà một khung uỷ quyền dễ bỏ sót.
   */
  it('sự kiện `close` của nền tảng gọi được onClose', () => {
    const onClose = vi.fn()
    const el = dlg(<Dialog open onClose={onClose}>{S}x</Dialog>)
    el.dispatchEvent(new Event('close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('nền tảng đóng rồi thì mở lại được — không kẹt ở trạng thái cũ', () => {
    const onClose = vi.fn()
    const { rerender, container } = render(<Dialog open onClose={onClose}>{S}x</Dialog>)
    const el = container.querySelector('dialog') as HTMLDialogElement
    el.close()
    expect(onClose).toHaveBeenCalled()
    rerender(<Dialog open={false} onClose={onClose}>x</Dialog>)
    rerender(<Dialog open onClose={onClose}>{S}x</Dialog>)
    expect((container.querySelector('dialog') as HTMLDialogElement).open).toBe(true)
  })
})

describe('⭐ đầu hộp thoại — lối ra là ✕ ở góc, không phải nút ở chân (27/9/2026)', () => {
  const X = <svg />
  const head = <><DialogHead title="Nguyễn Văn An" closeLabel="Đóng" closeIcon={X} /><DialogBody>nội dung</DialogBody></>
  const work = (extra: object[] = []) => (
    <ActionBar surface="dialog" label="Việc" actions={[
      ...extra as never[],
      { key: 'ok', label: 'Tiếp đón', icon: X, advances: true, onSelect: () => {} },
    ]} />
  )

  it('vẽ tên và một nút ✕ chỉ-hình, tên là nhãn của hộp thoại', () => {
    const el = dlg(<Dialog open onClose={() => {}}>{head}{work()}</Dialog>)
    const h = el.querySelector('.fos-dialog-head')!
    expect(h.querySelector('h2')!.textContent).toBe('Nguyễn Văn An')
    const x = h.querySelector('button')!
    expect(x.getAttribute('aria-label')).toBe('Đóng')
    expect(x.className).toContain('fos-btn--quiet')
    expect(x.className).toContain('fos-btn--icon')
    expect(el.getAttribute('aria-labelledby')).toBe(h.querySelector('h2')!.id)
  })

  it('✕ đi qua khoá "đang gõ dở" — cùng đường với Esc và bấm ra nền', () => {
    const onClose = vi.fn(); const onGuard = vi.fn()
    const el = dlg(<Dialog open onClose={onClose} onGuard={onGuard} isDirty={() => true}>{head}</Dialog>)
    fireEvent.click(el.querySelector('.fos-dialog-head button')!)
    expect(onGuard).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('✕ đóng thẳng khi chưa gõ gì', () => {
    const onClose = vi.fn()
    const el = dlg(<Dialog open onClose={onClose}>{head}</Dialog>)
    fireEvent.click(el.querySelector('.fos-dialog-head button')!)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('không cho đóng lúc này → ✕ khoá và nói vì sao', () => {
    const el = dlg(<Dialog open onClose={() => {}}><DialogHead title="Nhập" closeLabel="Đóng" closeIcon={X} closeDisabled="Đang nhập dở" /><DialogBody /></Dialog>)
    const x = el.querySelector('.fos-dialog-head button') as HTMLButtonElement
    expect(x.disabled).toBe(true)
    expect(x.title).toBe('Đang nhập dở')
  })

  it('biểu mẫu NGOÀI hộp thoại vẫn được có "Huỷ" ở chân', () => {
    const { container } = render(<ActionBar surface="form" label="Biểu mẫu" actions={[
      { key: 'c', label: 'Huỷ', icon: X, exits: true, onSelect: () => {} },
      { key: 's', label: 'Lưu', icon: X, advances: true, onSelect: () => {} },
    ]} />)
    expect([...container.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Huỷ', 'Lưu'])
  })

  it('không có ô nào để điền → tiêu điểm về chính hộp thoại, không vào cái ✕', () => {
    const el = dlg(<Dialog open onClose={() => {}}>{head}</Dialog>)
    expect(document.activeElement).toBe(el)
  })
})
