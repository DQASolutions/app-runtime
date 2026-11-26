import type { InputHTMLAttributes, ReactNode } from 'react'
import { useId, useRef, useState } from 'react'
import { cls, cx } from '../prefix/index.js'
import { acceptItems } from './field-attributes.js'

/**
 * TAKES A DOCUMENT — the whole area, click or drop.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ WHY A BARE `<input type="file">` IS NOT AN OPTION
 *
 *   It renders the BROWSER's label — "Choose File / No file chosen" on an
 *   English machine — and no attribute changes it. A form in any other language
 *   ends up with one English button in the middle of it. So the real input is
 *   hidden (visually, not from the keyboard or a screen reader) and the label
 *   around it is what a person sees.
 *
 * ⚠️ AND THE MISTAKE THE EARLIER VERSION MADE, KEPT HERE SO IT IS NOT REMADE
 *
 *   A dashed frame is a settled convention: *drop a file here, or click here*.
 *   The earlier cut drew that frame but only the BUTTON INSIDE it was
 *   clickable. People clicked the empty space, nothing happened, and concluded
 *   the screen was broken. The frame promised one thing and did another.
 *
 *   So the whole area is the `<label>`: a click anywhere in the frame opens the
 *   picker, and a dropped file is accepted. There is no button.
 *
 * ⛔ THE PICKER'S `accept` IS A SUGGESTION, AND A DROP SKIPS IT ENTIRELY.
 *    The file dialog greys out other kinds (and a person can switch it to "All
 *    files"); a dropped file never meets the attribute at all. There is no
 *    HTML attribute for size. So this box judges every file it is handed —
 *    picked or dropped — by `accept` and `maxBytes`, with the same rule
 *    `@dqa-ai-solutions/core-runtime`'s `fileViolation` applies at the upload (the parity
 *    test holds them together). A file turned away is not put on the input,
 *    and `refused` says why: silence here is the dashed-frame mistake again.
 *
 * ⛔ NO WORDS OF ITS OWN. `main`, `hint` and `clear` are required props with no
 *    defaults: the kernel is language-neutral, and a default English string
 *    would ship silently into every screen that forgot to pass one.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export interface FileFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'children'> {
  /** What the empty area says. */
  main: ReactNode
  /** What it says once a file is chosen — receives the file. */
  chosenMain?: (file: File) => ReactNode
  /** The line under it, empty state. */
  hint?: ReactNode
  /** The line under it, once a file is chosen. */
  chosenHint?: ReactNode
  /** Label for the remove control. Omit it and no remove control is drawn. */
  clearLabel?: ReactNode
  /** The two glyphs. Given by the app: the kernel draws no icons. */
  mark?: ReactNode
  chosenMark?: ReactNode
  /** Called with the picked file, or `null` when it is cleared. */
  onPick?: (file: File | null) => void
  /** The largest file taken, in bytes — the property's `maxBytes`. */
  maxBytes?: number
  /** What the hint line says when a file is turned away. Required once `accept` or `maxBytes` is set. */
  refused?: (why: FileRefusal) => ReactNode
  /** Told when a file is turned away. */
  onRefuse?: (why: FileRefusal) => void
  invalid?: boolean
  className?: string
}

/** Why a file was turned away — the keyword and limit `fileViolation` reports. */
export type FileRefusal =
  | { keyword: 'maxBytes'; limit: number; file: File }
  | { keyword: 'accept'; limit: string[]; file: File }

/**
 * Is this file one the box takes? Same order and same matching as
 * `fileViolation` in `@dqa-ai-solutions/core-runtime`: size first; then `.ext` by name,
 * `type/*` by MIME family, `type/subtype` exactly. A file with no MIME type is
 * judged by its extension alone — and refused if no listed extension fits.
 */
export function fileRefusal(file: File, accept: string | string[] | undefined, maxBytes: number | undefined): FileRefusal | null {
  if (maxBytes !== undefined && file.size > maxBytes) return { keyword: 'maxBytes', limit: maxBytes, file }
  const items = acceptItems(accept)
  if (items.length) {
    const name = file.name.toLowerCase()
    const mime = (file.type ?? '').toLowerCase()
    const ok = items.some((a) => {
      const k = a.toLowerCase()
      if (k.startsWith('.')) return name.endsWith(k)
      if (k.endsWith('/*')) return mime !== '' && mime.startsWith(k.slice(0, -1))
      return mime === k
    })
    if (!ok) return { keyword: 'accept', limit: items, file }
  }
  return null
}

export function FileField({
  main, chosenMain, hint, chosenHint, clearLabel, mark, chosenMark,
  onPick, maxBytes, refused, onRefuse, invalid, className, id: idProp, disabled, ...rest
}: FileFieldProps) {
  const auto = useId()
  const id = idProp ?? `file-${auto}`
  const input = useRef<HTMLInputElement>(null)
  const [chosen, setChosen] = useState<File | null>(null)
  const [turnedAway, setTurnedAway] = useState<FileRefusal | null>(null)
  const [over, setOver] = useState(false)

  const take = (file: File | null) => { setTurnedAway(null); setChosen(file); onPick?.(file) }

  /** `true` when the file may go on the input; otherwise the input is emptied and the reason shown. */
  const judge = (file: File): boolean => {
    const why = fileRefusal(file, rest.accept, maxBytes)
    if (!why) return true
    /* ⛔ EMPTY THE INPUT, don't just skip the state. A picked file is already on
       `input.files`; left there, the form sends the very file it just refused. */
    if (input.current) input.current.value = ''
    if (chosen) onPick?.(null)
    setChosen(null)
    setTurnedAway(why)
    onRefuse?.(why)
    return false
  }

  const drop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setOver(false)
    if (disabled) return
    const file = e.dataTransfer?.files?.[0]
    if (!file || !input.current) return
    if (!judge(file)) return
    /* ⛔ THE FILE MUST BE PUT ON THE INPUT, not merely held in state. The form
       reads `input.files` when it submits, and `required` validates the same
       place. Skip this and a dropped file appears on screen and is never sent —
       the failure looks like a server bug and is not one. */
    const box = new DataTransfer()
    box.items.add(file)
    input.current.files = box.files
    take(file)
  }

  const clear = (e: React.MouseEvent) => {
    /* This control sits INSIDE the `<label>`, and a click anywhere in a label
       opens the picker. Without stopping it, removing a file immediately opens
       the file dialog — which reads as a bug. */
    e.preventDefault()
    e.stopPropagation()
    if (input.current) input.current.value = ''
    take(null)
  }

  const said = turnedAway && refused ? refused(turnedAway) : chosen ? chosenHint ?? hint : hint
  return (
    <label
      className={cx(cls('file'), chosen && cls('file--has'), over && cls('file--over'), className)}
      htmlFor={id}
      {...(invalid || turnedAway ? { 'aria-invalid': true as const } : {})}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <input
        {...rest} ref={input} id={id} type="file" disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null
          if (file && !judge(file)) return
          take(file)
        }}
      />
      <span className={cls('file-mark')} aria-hidden="true">
        {chosen ? (chosenMark ?? mark) : mark}
      </span>
      <span className={cls('file-main')}>
        {chosen ? (chosenMain?.(chosen) ?? chosen.name) : main}
      </span>
      {said != null && (
        <span className={cls('file-hint')} {...(turnedAway ? { role: 'alert' } : {})}>{said}</span>
      )}
      {chosen && clearLabel != null && (
        <button type="button" className={cx(cls('btn'), cls('btn--normal'), cls('file-clear'))}
          onClick={clear}>{clearLabel}</button>
      )}
    </label>
  )
}

/** `1.4 MB` · `812 KB` — a magnitude, not a sentence. No locale in it. */
export const fileSize = (bytes: number): string => (bytes >= 1024 * 1024
  ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
  : `${Math.ceil(bytes / 1024)} KB`)
