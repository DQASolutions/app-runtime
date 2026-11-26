import type { ReactNode } from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { cls, cx } from '../prefix/index.js'
import { placePop } from './pop.js'

/**
 * CHỌN CỘT NGAY TRÊN BẢNG — một nút ở đầu thẻ, mở ra danh sách mọi cột, mỗi
 * cột một ô tích.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ CÁI NÓ THAY, VÀ VÌ SAO CÁI CŨ SAI
 *
 *   App đầu tiên in một khối gấp trên đầu bảng: *"2 cột không bày ở bảng này"*,
 *   mở ra thì liệt kê tên cột. Người đọc BIẾT cột nào bị giấu mà KHÔNG LÀM ĐƯỢC
 *   GÌ — và khối ấy chiếm nguyên một dải ngang giữa đầu thẻ và đầu bảng. Người
 *   dùng chỉ thẳng vào nó 13/9/2026: *"UI như nay là tệ … nó nên có phần select
 *   các cột sẽ hiển thị trực tiếp trên cái data table đó."*
 *
 *   Khối cũ tự ghi lý do không cho bật lại: bảng tràn ngang. Lý do ấy hết đúng
 *   từ khi `Table` bọc sẵn khung cuộn riêng (`wrap` mặc định bật) — người chọn
 *   thêm cột thì cuộn trong khung bảng, không kéo cả trang.
 *
 * ⭐ HÌNH DẠNG MƯỢN NGUYÊN CỦA LƯỚI DỮ LIỆU ĐÃ CHÍN: MUI DataGrid (*Columns*),
 *    AG Grid (*Columns tool panel*), Airtable (*Hide fields*), GitHub Projects
 *    (*Fields*). Cả bốn cùng một khuôn:
 *
 *      nút trên thanh công cụ của bảng  →  hộp nổi  →  mỗi cột một ô tích
 *      cột tên cố định                  ·  một lối "về mặc định"
 *
 *    Airtable còn đặt SỐ CỘT ĐANG ẨN vào chính chữ trên nút ("2 hidden fields")
 *    — thứ khối cũ muốn nói, nay nói trên cái bấm được. Chữ là của app.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ Ô TÍCH, KHÔNG PHẢI `menuitemcheckbox`. Một thực đơn đóng lại sau mỗi lần
 *    chọn; ở đây người ta bật tắt ba cột liền và nhìn bảng đổi sau lưng hộp.
 *    Ô tích thật trong một nhóm có tên đi bằng Tab/Space như mọi biểu mẫu, và
 *    trình đọc màn hình nói "đã chọn / chưa chọn" mà không cần vai trò mượn.
 *
 * ⚠️ KHÔNG ĐẺ LỚP MỚI. Hộp là `menu menu--pop` của nhân, dòng là `menu-item` —
 *    cùng lớp nổi, cùng neo, cùng chỗ mở như `FilterSelect` đứng ngay cạnh nó.
 */

export interface ColumnPickerChoice {
  key: string
  label: ReactNode
  shown: boolean
  /** Cột tên của dòng — không tắt được. */
  locked?: boolean
  /** Một lời nhỏ sau tên cột, vd *"trống ở trang này"*. Chữ của app. */
  hint?: ReactNode
}

export interface ColumnPickerProps {
  /** Tên của nhóm ô tích — đọc lên khi hộp mở. Bắt buộc. */
  label: string
  /** Nội dung nút mở — hình + chữ của app, vd *"2 cột ẩn"*. */
  trigger: ReactNode
  /** Lấy thẳng `choices` của `planColumns` ở `@dqa-ai-solutions/ui-kit/lens`. */
  choices: ColumnPickerChoice[]
  /** Chỉ những gì người đọc đã đổi — `{ key: true | false }`. */
  visibility: Record<string, boolean>
  onChange: (next: Record<string, boolean>) => void
  /**
   * Lối về mặc định. Chỉ hiện khi `customised` — một nút "về mặc định" lúc đang
   * ở mặc định là một nút bấm không làm gì.
   */
  resetLabel?: ReactNode
  customised?: boolean
  className?: string
}

export function ColumnPicker({
  label, trigger, choices, visibility, onChange, resetLabel, customised, className,
}: ColumnPickerProps) {
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState({ up: false, end: false })
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) { setPlace({ up: false, end: false }); return undefined }
    setPlace(placePop(button.current))

    const boxes = () => Array.from(
      box.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:not(:disabled)') ?? [])
    /* Tiêu điểm vào ô tích ĐẦU TIÊN bật tắt được — cột tên khoá thì bỏ qua. */
    boxes()[0]?.focus()

    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      /* ⛔ Escape TRẢ TIÊU ĐIỂM VỀ NÚT — không thì nó rơi về đầu trang. */
      if (e.key === 'Escape') { setOpen(false); button.current?.focus(); return }
      const items = boxes()
      const at = items.indexOf(document.activeElement as HTMLInputElement)
      if (at < 0) return
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(at + 1) % items.length]?.focus() }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(at - 1 + items.length) % items.length]?.focus() }
      else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus() }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus() }
    }
    /* ⚠️ Tab ra khỏi hộp thì đóng hộp. Để mở thì một hộp nổi đứng đè lên bảng
       trong khi tiêu điểm đã đi tận ô tìm kiếm — người dùng bàn phím không thấy
       mình đang ở đâu. */
    const leave = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null
      if (next && !box.current?.contains(next)) setOpen(false)
    }
    const el = box.current
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key)
    el?.addEventListener('focusout', leave)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', key)
      el?.removeEventListener('focusout', leave)
    }
  }, [open])

  const toggle = (c: ColumnPickerChoice) => {
    if (c.locked) return
    onChange({ ...visibility, [c.key]: !c.shown })
  }

  return (
    <div className={cx(cls('menu-anchor'), className)} ref={box}>
      {/* ⚠️ `quiet`, như nút *Lọc* bên cạnh: chưa ai hỏi tới thì nó không tranh
          chỗ với tiêu đề thẻ. Và KHÔNG `aria-haspopup` — giá trị nào của nó cũng
          hứa một thực đơn/hộp danh sách; đây là nút gấp mở một nhóm ô tích. */}
      <button
        ref={button} type="button" className={cx(cls('btn'), cls('btn--quiet'))}
        aria-expanded={open} aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>

      {open && (
        <div
          id={panelId} role="group" aria-label={label}
          className={cx(cls('menu'), cls('menu--pop'),
            place.up && cls('menu--pop-up'), place.end && cls('menu--pop-end'))}
        >
          {choices.map((c) => (
            <label key={c.key} className={cls('menu-item')}>
              {/* ⛔ Cột KHOÁ vẫn hiện, đánh dấu và mờ — giấu nó đi thì người
                  đọc tưởng bảng này không có cột tên, hoặc tìm mãi chỗ tắt. */}
              <input
                type="checkbox" checked={c.shown || Boolean(c.locked)}
                disabled={c.locked} onChange={() => toggle(c)}
              />
              {c.label}
              {c.hint != null && <span className={cls('count')}>{c.hint}</span>}
            </label>
          ))}
          {customised && resetLabel != null && (
            <>
              <div role="separator" />
              <button type="button" className={cls('menu-item')} onClick={() => onChange({})}>
                {resetLabel}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Lựa chọn cột của NGƯỜI XEM, nhớ qua lần mở sau trên chính máy ấy.
 *
 * ⭐ Chỉ lưu CÁI ĐÃ ĐỔI (`{ key: bool }`), không lưu danh sách cột đang hiện —
 *    xem `ColumnVisibility` ở `@dqa-ai-solutions/ui-kit/lens`: hợp đồng thêm cột tháng sau
 *    thì cột ấy vẫn tới được người chưa từng chạm vào nó.
 *
 * ⚠️ `localStorage` có thể ném (cửa sổ riêng tư, bị chặn) hoặc trả rác. Cả hai
 *    đường đều về `{}` — bảng vẫn vẽ đúng mặc định, chỉ không nhớ.
 *
 * @param storageKey  khoá riêng cho MỘT bảng, vd `cols:StaffMember:list`.
 *                    `null` thì chỉ nhớ trong phiên đang mở.
 */
export function useColumnVisibility(storageKey: string | null):
  [Record<string, boolean>, (next: Record<string, boolean>) => void] {
  const read = useCallback((): Record<string, boolean> => {
    if (!storageKey) return {}
    try {
      const raw: unknown = JSON.parse(globalThis.localStorage?.getItem(storageKey) ?? '{}')
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
      return Object.fromEntries(
        Object.entries(raw).filter(([, v]) => typeof v === 'boolean')) as Record<string, boolean>
    } catch {
      return {}
    }
  }, [storageKey])

  /* ⚠️ Khoá đổi (cùng một phần tử, sang bảng khác) thì đọc lại NGAY trong lượt
     vẽ, không đợi `useEffect` — đợi thì bảng mới vẽ một nhịp bằng lựa chọn của
     bảng cũ. */
  const [held, setHeld] = useState(() => ({ key: storageKey, value: read() }))
  const current = held.key === storageKey ? held.value : read()
  if (held.key !== storageKey) setHeld({ key: storageKey, value: current })

  const set = useCallback((next: Record<string, boolean>) => {
    setHeld({ key: storageKey, value: next })
    if (!storageKey) return
    try {
      if (Object.keys(next).length) globalThis.localStorage?.setItem(storageKey, JSON.stringify(next))
      else globalThis.localStorage?.removeItem(storageKey)
    } catch { /* không nhớ được thì thôi — bảng vẫn đúng */ }
  }, [storageKey])

  return [current, set]
}
