// WHICH CLASS STEM THIS TREE WRITES — read, never guessed.
//
// ⛔ WHY THIS IS NOT THE STRING 'fos' TYPED INTO THIRTY-FOUR FILES
//
//   `emitComponentCss` takes a `prefix` option and defaults it to `fos`. An app
//   that passes anything else gets a stylesheet full of `.acme-btn` and a
//   renderer writing `.fos-btn` — every rule still present, reaching nothing.
//   That failure is silent: no error, no empty class, just unstyled screens.
//
//   So the renderer asks instead of assuming, and the answer has exactly one
//   home.
//
// ⚠️ Deliberately NOT a React context. A context makes the prefix a per-subtree
//    value, which invites two prefixes in one document — and the stylesheet is
//    one document-wide thing. One stylesheet, one stem, one module variable.
export type Prefix = string

const DEFAULT: Prefix = 'fos'

let current: Prefix = DEFAULT

/** Match the renderer to the stylesheet the app emitted. Call once, at boot. */
export function setPrefix(p: Prefix): void {
  if (!/^[a-z][a-z0-9-]*$/.test(p)) {
    throw new Error(`@dqa-ai-solutions/ui-react: prefix "${p}" is not a class stem (a-z, digits, dashes).`)
  }
  current = p
}

export const prefix = (): Prefix => current

/** `cls('link')` → `fos-link`. The only place the two halves are joined. */
export const cls = (stem: string): string => `${current}-${stem}`

/** Class list with the falsy entries dropped — `cx('fos-link', undefined, x)`. */
export const cx = (...parts: (string | false | null | undefined)[]): string | undefined =>
  parts.filter(Boolean).join(' ') || undefined
