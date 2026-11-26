// Declaration-level faults, kept separate from data-level ones on purpose.
//
// ⚠️ `Fault` (in `primitives`) is about the DATA that arrived — a join that did
//    not run, a stale page. `LensDiagnostic` is about the DECLARATION — a
//    section naming a field that does not exist, a block nobody published.
//
//    The two want different audiences and different moments. A diagnostic should
//    stop a build or a start-up, before anyone opens the screen; a fault can only
//    be known once a row is in hand. Merging them means either shipping
//    declaration errors to users or failing to start over a bad row.

export interface LensDiagnostic {
  severity: 'error' | 'warn'
  code:
    /** A layout names a fact the contract does not carry. */
    | 'UNKNOWN_FACT'
    /** Facts the contract declares that no section claimed — they would vanish. */
    | 'ORPHAN_FACTS'
    /** A block was named that the renderer does not publish. */
    | 'UNKNOWN_BLOCK'
    /** No property says what this record is CALLED to a person. */
    | 'NO_TITLE'
    /** A step's form cannot be built for a declared parameter type. */
    | 'UNRENDERABLE_FIELD'
    /** An event turned up with no wording — the machine code would be printed. */
    | 'UNLABELLED_EVENT'
    /** The contract does not yet carry something the lens needs. */
    | 'CONTRACT_GAP'
    /**
     * A step names a state its line does not declare — usually the wrong line.
     *
     * ⚠️ An error even when only one step is affected. A route drawn with the
     *    record standing nowhere on it reads as "not started yet", which is a
     *    confident lie about a record that may be nearly finished.
     */
    | 'UNKNOWN_STATE'
    /**
     * Steps wait on a gate that no step declares itself the opener of.
     *
     * A warning, not an error: the wait is real and still reaches the screen
     * through `waitsOn`. What cannot be done is NAME it — a gate borrows its
     * label from the step that opens it, and this one has none to borrow.
     */
    | 'UNPLACED_GATE'
    /** An entity runs several lines and nobody said which one this record is on. */
    | 'AMBIGUOUS_LINE'
    /**
     * A related list is declared and the app supplied no rows for it.
     *
     * ⚠️ An error, not a warning, and drawn nowhere. A section rendered as an
     *    empty table is indistinguishable from one that genuinely has nothing —
     *    so a wiring mistake would read to a user as "this record has no
     *    decisions", which is a lie the screen tells confidently.
     */
    | 'MISSING_ROWS'
  where: string
  message: string
}

export const errorsIn = (list: LensDiagnostic[]) => list.filter((d) => d.severity === 'error')

export function formatLensDiagnostics(list: LensDiagnostic[]): string {
  if (!list.length) return ''
  return list
    .map((d) => `${d.severity === 'error' ? '⛔' : '⚠️ '} [${d.code}] ${d.where}\n   ${d.message}`)
    .join('\n')
}
