import type {
  InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode,
} from 'react'
import { createElement } from 'react'
import { cls, cx } from '../prefix/index.js'

/**
 * THE FOUR THINGS A PERSON TYPES INTO — one box, four tags.
 *
 * ⭐ The kit gives all four the SAME box on purpose: *"every input shares ONE
 *    box, so a form does not step as the eye goes down."* So these components
 *    differ only in the tag they emit and the props that tag accepts. There is
 *    no size prop, no variant, and no place to put one.
 *
 * ⛔ WHAT THESE DELIBERATELY DO NOT DRAW
 *
 *   No label, no hint, no error sentence. Those are WORDS, and words about a
 *   field belong to the domain that knows what the field means. The kit says so
 *   in `fieldSpec`, which hands back the text ROLES (`label` · `hint` ·
 *   `error`) and no text — the screen supplies the sentence, the grammar
 *   supplies the shape.
 */

/** Shared plumbing: the two states an input owes that HTML spells oddly. */
interface FieldState {
  /**
   * ⛔ NOT a `className` the caller adds. The kit's rule targets
   *    `[aria-invalid="true"]`, and that attribute is also the one a screen
   *    reader announces — one flag, both audiences. A red border a screen
   *    reader cannot see is half a validation message.
   */
  invalid?: boolean
}

const stateProps = (invalid?: boolean) =>
  invalid ? { 'aria-invalid': true as const } : {}

// ── field: one line of anything ───────────────────────────────────────────

export interface FieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>, FieldState {
  /**
   * ⚠️ `checkbox`, `radio` and `file` are NOT reachable here, and that is the
   *    point: each is a different element in the standard, with different
   *    states, and each has its own component below. Letting `type` reach them
   *    is how one component quietly becomes three badly.
   */
  type?: 'text' | 'search' | 'tel' | 'url' | 'email' | 'number' | 'date' | 'time'
    | 'datetime-local' | 'month' | 'week' | 'password'
}

export function Field({ className, invalid, type = 'text', ...rest }: FieldProps) {
  return createElement('input', {
    ...rest, type, className: cx(cls('field'), className), ...stateProps(invalid),
  })
}

// ── select: one of a known set ────────────────────────────────────────────

export interface SelectProps
  extends SelectHTMLAttributes<HTMLSelectElement>, FieldState {
  children?: ReactNode
}

export function Select({ className, invalid, children, ...rest }: SelectProps) {
  return createElement(
    'select',
    { ...rest, className: cx(cls('select'), className), ...stateProps(invalid) },
    children,
  )
}

// ── textarea: more than a line ────────────────────────────────────────────

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldState {}

export function Textarea({ className, invalid, ...rest }: TextareaProps) {
  return createElement('textarea', {
    ...rest, className: cx(cls('textarea'), className), ...stateProps(invalid),
  })
}
