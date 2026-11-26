// A STEP PARAMETER IS CHECKED BY THE SAME RULE AS THE BOX THAT ASKED FOR IT.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ THE HOLE THIS CLOSES — measured 13/9/2026.
//
//   `@dqa-ai-solutions/workflow-process` checked a step's parameters for PRESENCE only. The
//   write guard checks what reaches an entity property. Between them, a parameter
//   the step reads without storing it under its own name — a reason folded into a
//   note, an amount compared against a remaining budget, a day that sets a
//   deadline — was checked by the screen and by nothing else. The screen is the
//   one layer a direct request never goes through.
//
// ⭐ ONE RESOLUTION, TWO READERS. The contract's `fields` already carry what the
//    form draws from: the property the parameter writes, or the step's own
//    `fields:` entry with its value type merged in. Checking against that same
//    `ResolvedField` means the box and the server cannot disagree about a limit —
//    there is no second place the limit is written.
//
// ⚠️ A FORM SENDS TEXT. `FormData` has no numbers: `amount=1500000` arrives as
//    the string "1500000". One written form is accepted for it — the numeral a
//    `<input type="number">` submits — and nothing is guessed: "1.500.000",
//    "1e6", "0x10" and " 12" are refused. Human spellings are
//    `parseTypedInput`'s job, at the box, before the request.
// ═══════════════════════════════════════════════════════════════════════════

import { checkPropertyValue, type PropertyDef } from '@dqa-ai-solutions/core-runtime/input'
import type { ResolvedAction, ResolvedField } from './types.js'

/** The numeral an `<input type="number">` submits — sign, digits, one optional fraction. */
const FORM_NUMERAL = /^-?(0|[1-9]\d*)(\.\d+)?$/

/** What one parameter did wrong. `keyword`/`limit` match the write guard's `CONSTRAINT_VIOLATED`. */
export interface ParamViolation {
  param: string
  code: 'TYPE_MISMATCH' | 'CONSTRAINT_VIOLATED' | 'ENUM_VALUE_INVALID' | 'REQUIRED_PROPERTY_MISSING' | 'FIXED_VALUE_CHANGED'
  message: string
  keyword?: string
  limit?: unknown
}

/** A resolved field, as the property definition the write guard reads. */
function asProperty(f: ResolvedField): PropertyDef | null {
  if (f.kind === 'derived') return null
  return {
    name: f.key,
    type: f.kind,
    ...(f.enum ? { enumValues: f.enum.map((e) => e.value) } : {}),
    ...(f.constraints ?? {}),
  } as PropertyDef
}

/**
 * Check one submitted value against the field the step declared for it.
 * `null`, `undefined` and `''` are absent — presence is the engine's
 * `params.required` check, which runs first.
 */
export function paramViolation(field: ResolvedField, value: unknown): ParamViolation | null {
  if (value === undefined || value === null || value === '') return null
  const at = (v: Omit<ParamViolation, 'param'>): ParamViolation => ({ param: field.key, ...v })

  // The declaration already settled it; a request carrying another value is not
  // choosing, it is overriding the law the step cites.
  if (field.fixed !== undefined) {
    return String(value) === field.fixed
      ? null
      : at({ code: 'FIXED_VALUE_CHANGED', message: `"${field.key}" is fixed to "${field.fixed}" by the declaration`, keyword: 'fixed', limit: field.fixed })
  }

  // A pointer: one id, or several. Its target's existence is the store's question.
  if (field.refEntity) {
    const ids = Array.isArray(value) ? value : [value]
    const bad = ids.find((x) => typeof x !== 'string' || x.trim() === '')
    return bad === undefined ? null : at({ code: 'TYPE_MISMATCH', message: `"${field.key}" must be ${field.many ? 'a list of record ids' : 'a record id'}` })
  }

  const def = asProperty(field)
  if (!def) return null

  // ⚠️ An enum with no list reaches here only past a resolver ERROR
  //    (`ENUM_WITHOUT_VALUES`) — the declaration is refused where it is written.
  //    Refusing every value here as well would invent a rule nobody declared.
  if (def.type === 'enum' && !field.enum?.length) return null

  // A file parameter carries the stored path. Kinds and size are judged at the
  // upload, where the bytes are — see `fileViolation`.
  if (def.type === 'file') {
    return typeof value === 'string' ? null : at({ code: 'TYPE_MISMATCH', message: `"${field.key}" must be a stored file path` })
  }

  let v: unknown = value
  if (def.type === 'number' && typeof value === 'string') {
    if (!FORM_NUMERAL.test(value)) {
      return at({ code: 'TYPE_MISMATCH', message: `"${field.key}" must be a number written as digits, got ${JSON.stringify(value.slice(0, 40))}` })
    }
    v = Number(value)
  }
  const verdict = checkPropertyValue(def, v)
  return verdict ? at(verdict) : null
}

/**
 * The first parameter of a step call that breaks its declaration, or `null`.
 * Only parameters the step DECLARES are judged: values the host adds on its way
 * to the engine (a ledger number it allocated, the clock) are not the caller's.
 */
export function stepParamViolation(action: Pick<ResolvedAction, 'fields'>, params: Record<string, unknown>): ParamViolation | null {
  for (const field of action.fields) {
    if (!(field.key in params)) continue
    const v = paramViolation(field, params[field.key])
    if (v) return v
  }
  return null
}
