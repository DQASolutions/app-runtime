import type { ReactNode } from 'react'
import { useEffect, useId, useSyncExternalStore } from 'react'
import { cls, cx } from '../prefix/index.js'
import { Button } from './button.js'
import type { Tone } from './surface.js'

/**
 * LỜI BÁO Ở GÓC — kết quả của việc người dùng VỪA LÀM, đến chỗ mắt đã quen nhìn.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ VÌ SAO NHÂN PHẢI CÓ CÁI NÀY — người dùng chốt 26/9/2026:
 *
 *   *"các lỗi đang hiển thị ngay trên màn hình, dẫn đến nhiều khi người dùng
 *   không nhìn thấy, cái này phải show thành popup show ở right down corner"*.
 *
 *   Đo ở một app thật: 30 chỗ in lỗi của một thao tác NGAY TẠI CHỖ — cuối một biểu
 *   mẫu dài, dưới nếp gấp của màn, trong thân cuộn của một hộp thoại. Người
 *   dùng nhìn vào cái nút mình vừa bấm; câu lỗi nằm ở chỗ khác. Bấm lần nữa,
 *   vẫn không thấy gì, kết luận là máy treo.
 *
 * ⭐ MỘT GÓC CỐ ĐỊNH, GÓC PHẢI DƯỚI, TRÊN MỌI MÀN. Mắt học chỗ ấy một lần.
 *
 *   · LỖI (`stop`) và CẢNH BÁO (`warn`) Ở LẠI tới khi người dùng đóng — một lời
 *     lỗi tự biến mất là một lời lỗi người đi nghe điện thoại không bao giờ đọc.
 *   · Báo xong (`done` …) tự tắt sau 5 giây, và NGỪNG ĐẾM khi chuột hay tiêu
 *     điểm đang ở trong đống lời báo — ai đang đọc thì không bị giật mất.
 *   · Lỗi là `role="alert"` (trình đọc màn hình đọc ngay); còn lại `status`.
 *     Không lời báo nào cướp tiêu điểm.
 *
 * ⛔ KHÔNG PHẢI CHỖ CHO MỌI LỖI.
 *   · Lỗi NẠP một vùng (bảng không tải được) ở lại TRONG vùng ấy — `surfaceState`
 *     trả `error`; không thì vùng trống trơn còn lời giải thích bay đi mất.
 *   · Lỗi của MỘT Ô nhập ở lại cạnh ô ấy — người ta phải biết sửa ô nào.
 *   · Lý do một nút bị khoá ở lại cạnh nút (`ActionBar`).
 *
 * ⚠️ HỘP THOẠI. Một `<dialog>` modal đưa mọi thứ bên ngoài nó vào trạng thái
 *    trơ (inert) và phủ một lớp mờ lên trên — một đống lời báo đứng ngoài thì
 *    nằm DƯỚI lớp mờ và nút đóng không bấm được. Nên `Dialog` của nhân tự mở một
 *    chỗ cắm (`ToastOutlet`) bên trong nó; lời báo luôn hiện ở chỗ cắm TRÊN CÙNG.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type ToastTone = Tone

export interface ToastOptions {
  tone?: ToastTone
  /** Một dòng phụ — số liệu, mốc giờ, mã lỗi: thứ người ta cần để tin. */
  detail?: ReactNode
  /** Tự tắt sau bao lâu (ms). Mặc định: lỗi/cảnh báo 0 (ở lại), còn lại 5000. */
  ms?: number
}

interface Item { id: number; tone: ToastTone; title: ReactNode; detail?: ReactNode; ms: number; left: number; since: number }
interface Labels { label: string; closeLabel: string; closeIcon: ReactNode }

let seq = 0
let items: Item[] = []
let paused = false
const outlets: string[] = []
let labels: Labels | null = null
const timers = new Map<number, ReturnType<typeof setTimeout>>()
const subs = new Set<() => void>()
let snapshot: { items: Item[]; top: string | undefined; labels: Labels | null } = { items, top: undefined, labels }
const emit = () => {
  snapshot = { items, top: outlets[outlets.length - 1], labels }
  for (const f of subs) f()
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
const read = () => snapshot

const arm = (it: Item) => {
  if (it.ms <= 0 || paused) return
  it.since = Date.now()
  timers.set(it.id, setTimeout(() => dismissToast(it.id), it.left))
}

/**
 * Báo kết quả của một việc vừa làm.
 *
 *   toast(e.message, { tone: 'stop' })            // lỗi — ở lại tới khi đóng
 *   toast('Đã lưu hồ sơ', { tone: 'done' })       // xong — tự tắt sau 5 giây
 *
 * @returns id — để `dismissToast(id)` khi việc được làm lại thành công.
 */
export function toast(title: ReactNode, opts: ToastOptions = {}): number {
  const tone = opts.tone ?? 'done'
  const ms = opts.ms ?? (tone === 'stop' || tone === 'warn' ? 0 : 5000)
  const it: Item = { id: ++seq, tone, title, detail: opts.detail, ms, left: ms, since: 0 }
  /* Cùng một câu đang hiện thì thay, không chồng: bấm lại ba lần mà lỗi y hệt
     thì ba lời báo giống nhau xếp tầng đọc ra là ba lỗi khác nhau. */
  const same = items.find((x) => x.tone === tone && typeof x.title === 'string' && x.title === title)
  if (same) dismissToast(same.id)
  items = [...items, it]
  arm(it)
  emit()
  return it.id
}

export function dismissToast(id: number): void {
  const t = timers.get(id)
  if (t) clearTimeout(t)
  timers.delete(id)
  if (!items.some((x) => x.id === id)) return
  items = items.filter((x) => x.id !== id)
  emit()
}

/** Gỡ mọi lời báo — khi đăng xuất, hay khi đổi hẳn sang một người dùng khác. */
export function dismissAllToasts(): void {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
  paused = false
  if (!items.length) return
  items = []
  emit()
}

const pause = (on: boolean) => {
  if (paused === on) return
  paused = on
  for (const it of items) {
    if (it.ms <= 0) continue
    if (on) {
      const t = timers.get(it.id)
      if (t) { clearTimeout(t); timers.delete(it.id); it.left = Math.max(800, it.left - (Date.now() - it.since)) }
    } else arm(it)
  }
}

/** Chỗ cắm lời báo. Mở một lần ở gốc bằng `Toaster`; `Dialog` tự mở một cái bên trong nó. */
function useOutlet(): boolean {
  const id = useId()
  useEffect(() => {
    outlets.push(id)
    emit()
    return () => { const at = outlets.lastIndexOf(id); if (at >= 0) outlets.splice(at, 1); emit() }
  }, [id])
  const s = useSyncExternalStore(subscribe, read, read)
  return s.top === id
}

function Stack() {
  const s = useSyncExternalStore(subscribe, read, read)
  if (!s.items.length || !s.labels) return null
  const { label, closeLabel, closeIcon } = s.labels
  return (
    <section aria-label={label} className={cls('toasts')}
      onMouseEnter={() => pause(true)} onMouseLeave={() => pause(false)}
      onFocus={() => pause(true)} onBlur={() => pause(false)}>
      {s.items.map((it) => (
        <div key={it.id} role={it.tone === 'stop' ? 'alert' : 'status'}
          className={cx(cls('toast'), cls(`toast--${it.tone}`))}>
          <div className={cls('toast-body')}>
            <span>{it.title}</span>
            {it.detail != null && <span className={cls('hint')}>{it.detail}</span>}
          </div>
          <Button tier="quiet" icon={closeIcon} label={closeLabel} onClick={() => dismissToast(it.id)} />
        </div>
      ))}
    </section>
  )
}

export interface ToasterProps {
  /** Tên của vùng lời báo — trình đọc màn hình đọc lên. Chữ của app. */
  label: string
  /** Tên của nút đóng một lời báo. Chữ của app. */
  closeLabel: string
  /** Hình của nút đóng. Nhân không vẽ hình. */
  closeIcon: ReactNode
}

/** Mở ĐÚNG MỘT LẦN ở gốc ứng dụng. */
export function Toaster({ label, closeLabel, closeIcon }: ToasterProps) {
  labels = { label, closeLabel, closeIcon }
  const mine = useOutlet()
  return mine ? <Stack /> : null
}

/** Chỗ cắm bên trong một hộp thoại đang mở — `Dialog` tự đặt, app không gọi. */
export function ToastOutlet() {
  const mine = useOutlet()
  return mine ? <Stack /> : null
}
