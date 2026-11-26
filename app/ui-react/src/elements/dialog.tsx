import type { DialogHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { useEffect, useId, useRef } from 'react'
import { cls, cx } from '../prefix/index.js'
import { ToastOutlet } from './toast.js'
import { Button } from './button.js'
import { InDialog, useInDialog } from './dialog-scope.js'

export interface DialogProps
  extends Omit<DialogHTMLAttributes<HTMLDialogElement>, 'open' | 'onClose' | 'children'> {
  open: boolean
  /** Called when the dialog should actually go away. */
  onClose: () => void
  /**
   * Called INSTEAD of `onClose` when there is unsaved input. The caller decides
   * what to ask; the kernel carries no sentence. Omit it and closing is direct.
   */
  onGuard?: () => void
  /**
   * Overrides the measured answer. For state the DOM cannot report — a picker
   * built from buttons, a canvas. When given, it wins.
   */
  isDirty?: () => boolean
  /**
   * Where typing counts, as a selector. Defaults to the whole dialog; pass the
   * body when a footer or a header holds controls that should not arm the guard.
   */
  dirtyWithin?: string
  /**
   * ⛔ Focus goes to the first control a person must FILL, not to the close
   *    button in the corner. `<dialog>` does not do this unless something
   *    declares `autofocus`; without it the browser focuses the dialog itself
   *    and the first Tab lands on Close.
   */
  autoFocusWithin?: string
  /**
   * ⛔ NHẬN MỘT HÀM, VÀ ĐÓ KHÔNG PHẢI SỰ TIỆN TAY.
   *
   *   Một hộp thoại có ba đường ra: bấm ra nền, Esc, và cái nút Đóng ở góc.
   *   Hai đường đầu nằm trong này. Đường thứ ba nằm ở bố cục của người gọi — và
   *   nếu người gọi tự viết `onClose()` cho nó thì cái nút DỄ BẤM NHẤT lại là
   *   cái duy nhất không đi qua khoá "đang gõ dở".
   *
   *   Nên `requestClose` đi ra ngoài: một đường duy nhất, ba lối vào.
   */
  children?: ReactNode | ((api: { requestClose: () => void }) => ReactNode)
}

const FILLABLE = 'input:not([type="hidden"]):not(:disabled), '
  + 'select:not(:disabled), textarea:not(:disabled)'

export function Dialog({
  open, onClose, onGuard, isDirty, dirtyWithin, autoFocusWithin,
  className, children, ...rest
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const typed = useRef(false)

  const dirty = () => (isDirty ? isDirty() : typed.current)
  const requestClose = () => { if (dirty() && onGuard) onGuard(); else onClose() }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      const scope = autoFocusWithin ? el.querySelector(autoFocusWithin) : el
      const first = scope?.querySelector<HTMLElement>(FILLABLE)
      /* Không có ô nào để điền (còn đang tải, hay hộp chỉ để đọc): tiêu điểm về chính
         hộp thoại. Để trình duyệt tự chọn thì nó chọn nút ĐẦU TIÊN — cái ✕ ở góc — và
         vẽ vòng focus lên đó ngay khi mở (27/9/2026). */
      if (first) first.focus()
      else el.focus()
    }
    if (!open && el.open) el.close()
    if (open) typed.current = false
  }, [open, autoFocusWithin])

  /* On the `<dialog>` itself, so controls React mounts later are covered too —
     the event bubbles up here whenever the field was created. */
  useEffect(() => {
    const el = ref.current
    if (!el || !open) return undefined
    const touch = (e: Event) => {
      const t = e.target as Element | null
      if (!dirtyWithin || t?.closest(dirtyWithin)) typed.current = true
    }
    el.addEventListener('input', touch)
    el.addEventListener('change', touch)
    return () => {
      el.removeEventListener('input', touch)
      el.removeEventListener('change', touch)
    }
  })

  /* Escape arrives as `cancel`, never as a click — see ① above. */
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const onCancel = (e: Event) => {
      if (dirty() && onGuard) { e.preventDefault(); onGuard() }
    }
    el.addEventListener('cancel', onCancel)
    return () => el.removeEventListener('cancel', onCancel)
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const onNativeClose = () => onClose()
    el.addEventListener('close', onNativeClose)
    return () => el.removeEventListener('close', onNativeClose)
  })

  if (!open) {
    return null
  }

  return (
    <InDialog.Provider value={{ requestClose }}>
    <dialog
      {...rest}
      ref={ref}
      tabIndex={-1}
      className={cx(cls('dialog'), className)}
      onClick={(e) => { if (e.target === ref.current) requestClose() }}
    >
      {typeof children === 'function' ? children({ requestClose }) : children}
      {/* Lời báo ở góc phải hiện TRONG hộp thoại đang mở — ngoài nó thì nằm dưới
          lớp mờ và bị trơ. Xem `toast.tsx`. */}
      <ToastOutlet />
    </dialog>
    </InDialog.Provider>
  )
}

/**
 * THÂN HỘP THOẠI — vùng cuộn DUY NHẤT. Đầu (`DialogHead`) và hàng nút đứng yên,
 * chính hộp thoại không cuộn. Mọi hộp có đầu phải có đúng một thân (27/9/2026:
 * "mọi dialog chỉ được có duy nhất 1 scroll content").
 */
export function DialogBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx(cls('dialog-body'), className)}>{children}</div>
}

export interface DialogHeadProps {
  /** Tên của hộp thoại — cũng là tên cho trình đọc màn hình (`aria-labelledby`). */
  title: ReactNode
  /** Chữ của nút ✕ — "Đóng". Chữ của app; nhân không mang câu chữ. */
  closeLabel: string
  /** Hình của nút ✕. Nhân không vẽ hình — bên gọi đưa vào. */
  closeIcon: ReactNode
  /** Không cho đóng lúc này — và vì sao (ví dụ đang nhập dở một lượt). */
  closeDisabled?: string | false
  /** Thứ đứng cạnh tên — một nhãn trạng thái, một mã. */
  children?: ReactNode
  className?: string
}

/**
 * ĐẦU HỘP THOẠI — tên bên trái, ✕ ở góc phải. Lối ra DUY NHẤT nhìn thấy được
 * của hộp thoại; nó đi qua `requestClose`, nên khoá "đang gõ dở" giữ cả ba lối
 * (✕, Esc, bấm ra nền). Xem ⭐ ở đầu tệp.
 */
export function DialogHead({ title, closeLabel, closeIcon, closeDisabled, children, className }: DialogHeadProps) {
  const scope = useInDialog()
  const id = useId()
  /* Tên hộp thoại cho trình đọc màn hình: gắn lên thẻ <dialog> khi nó chưa có tên. */
  const head = useRef<HTMLElement>(null)
  useEffect(() => {
    const d = head.current?.closest('dialog')
    if (d && !d.hasAttribute('aria-labelledby') && !d.hasAttribute('aria-label')) d.setAttribute('aria-labelledby', id)
  })
  return (
    <header ref={head} className={cx(cls('dialog-head'), className)}>
      <h2 id={id} className={cls('dialog-title')}>{title}</h2>
      {children}
      <Button tier="quiet" icon={closeIcon} label={closeLabel} className={cls('dialog-close')}
        disabled={closeDisabled ? true : undefined} title={closeDisabled || closeLabel}
        onClick={() => scope?.requestClose()} />
    </header>
  )
}
