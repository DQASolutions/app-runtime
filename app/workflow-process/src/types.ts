// Vocabulary of a business process: a state machine over records.
//
// This is NOT the agent-workflow vocabulary (`pipeline` → `phases` → `tasks`
// with `depends`). The two engines answer different questions:
//
//   agent-workflow : one run walks a plan; progress = the set of tasks done
//   business-workflow: N records each sit in a state; progress = a value on the
//                    record, and which step is available follows from it
//
// A record can go backwards (returned for correction, appealed), the same step
// can run many times on many records, and every write must land in one
// transaction with an event on the ledger. None of that fits a DAG walked once.

import type { ReadersDecl, TaskDecl } from './task-vocabulary.js'

/** One fact gate: a property that must (or must not) be set, and what to tell a person who is blocked. */
export interface FactGate { property: string; message: string }

/** A record as the ontology returns it. */
export interface Record_ {
  id: string
  entityType?: string
  data: Record<string, unknown>
}

/** One step of a process — a guarded transition between states. */
export interface Transition {
  /** Action name registered with the ontology; also the step's identity. */
  action: string
  label: string
  /** Traceability back to the use case this step realises. */
  useCase?: string
  /** Legal citation. A step without one cannot be audited. */
  source_ref?: string
  /** States the record may be in. Empty = this step CREATES a record. */
  from?: string[]
  /** State after. `null` = unchanged — the outcome is derived elsewhere. */
  to?: string | null
  /** Role key, resolved through `Process.roles`. */
  role: string
  params?: { target?: string; required?: string[]; optional?: string[] }
  /**
   * Another thing must be done first — one fact, or several that must ALL hold.
   *
   * ⭐ A LIST WAS ADDED IN 5.12.0, THE SINGLE FORM IS UNCHANGED. A step that needs two things
   *    recorded before it (a supplier AND an amount) had no way to say so: one fact per step
   *    meant either inventing a marker field some earlier step sets, or checking the rest in
   *    code. Read it through `factGates`, never by `.property` — that reads only the single form.
   */
  requiresFact?: FactGate | FactGate[]
  /** …or must NOT have been done — blocks doing it twice. */
  forbidsFact?: { property: string; message: string }
  /**
   * Something must be ATTACHED to the record — at least `min` edges (default 1).
   *
   * The counterpart of {@link requiresFact} for facts that live in a relationship
   * rather than in a column. See {@link Facts.links} for why the engine grew this.
   */
  requiresLink?: { via?: string; relationship?: string; min?: number; message: string }
  /** …or must NOT be attached yet — e.g. "no signed copy has come back". */
  forbidsLink?: { via?: string; relationship?: string; message: string }
  /** This step brings a new record into being alongside the target. */
  creates?: { entity: string; via: string }
  /** Marks a step whose procedure is not yet in law — shown as provisional. */
  provisional?: string | null
  /** Consequence that runs by itself once this step lands. */
  auto?: { after: string; because?: string }
  /**
   * This step may only run once an authority decided a certain way.
   *
   * The engine owns the SHAPE, never the vocabulary: which record carries the
   * decision is `relationship`, and what counts as a go-ahead is `decision` —
   * both are the domain's words. Resolving the relationship needs the domain's
   * store, so the domain does that; see {@link latestApprovalDecision}.
   */
  requiresApproval?: { relationship: string; decision?: string }
  /**
   * Which side of a decision this step is — the go-ahead, or the refusal.
   *
   * ⭐ WHY THIS EXISTS. A gate is two branches, always. Written out by hand at
   *    every gate, one of them gets forgotten: the record walks in and cannot
   *    walk out, and nothing says so — because "there is no way to refuse" reads
   *    exactly like "nobody has written that step yet".
   *
   *    Naming the branches turns that from something you have to notice into
   *    something the loader refuses; see `findOpenGates`. Before this field the
   *    only signals were the step's NAME and a count of exits, and both are
   *    guesses: a refusal called `khongDongY` matches no English word for
   *    "reject", and counting exits calls a gate complete as soon as any second
   *    step leaves it.
   */
  outcome?: 'approve' | 'reject'

  /**
   * THIS STEP IS A DECISION — somebody weighs the record and settles it.
   *
   * ⭐ WHY ONE KEY AND NOT FIVE. A decision has two families, and each family
   *    used to be spelled with two or three separate keys that had to appear
   *    together and had nothing enforcing that they did:
   *
   *      decided INSIDE the system   `outcome` + `creates: { AuthorityApproval }`
   *      signed OUTSIDE the system   `creates: { OffSystemDecision }` + a
   *                                  domain-specific "needs a scan" flag
   *
   *    Measured on a real domain before this key existed: of 23 steps carrying
   *    `outcome`, only 8 also created the approval record. The other 15 lost
   *    *who decided and why* to the event log, which no screen reads. Nothing
   *    could catch it, because nothing said the two halves belonged together.
   *
   * ⭐ `by` DECIDES THE RECORD TYPE, so nobody types an entity name and nobody
   *    can pair the wrong one. `inside` → AuthorityApproval; `outside` → the
   *    signed-paper record the domain names in `entityFor`.
   *
   * ⚠️ `via` ABSENT IS AN ANSWER, not an omission: the verdict is written on the
   *    record itself instead of a separate opinion record. That is legitimate
   *    for a one-shot gate; it is wrong for a repeatable one, where returning
   *    and approving again is a *sequence* and a single field cannot hold one.
   *    See `checkDecisionShape`.
   */
  decision?: {
    by: 'inside' | 'outside'
    /** Edge to the record carrying the verdict. Absent = written on the record. */
    via?: string
    /** Which side of the gate — only meaningful for `by: inside`. */
    outcome?: 'approve' | 'reject'
    /** Parameter carrying the reason. Required on a refusal. */
    reason?: string
    /**
     * Who is entitled to sign — `by: outside`. Domain vocabulary.
     *
     * A list when the law names more than one authority for the same paper: a
     * live-fire authorisation, for instance, may be signed by either of two
     * offices. Forcing one name there would make the declaration lie.
     */
    signedBy?: string | string[]
    /** Which citations make the paper valid — `by: outside`. One or a list. */
    legalBasis?: string | string[]
  }

  /**
   * THIS STEP WAITS ON A DECISION already made.
   *
   * One key for both families, because the question is the same either way:
   * *has the thing been settled, and settled how.* Which record carries the
   * verdict is `via`; what counts as a go-ahead is `is` for an in-system
   * decision, or the signer and citation for a signed paper.
   *
   * ⚠️ `secondCheck` MUST be stated, true or false. Left off, "nobody needs to
   *    double-check this" is indistinguishable from "somebody forgot to say" —
   *    and that difference is the whole point of a four-eyes rule.
   */
  needsDecision?: {
    via: string
    /** Verdict that opens this step — for a decision made inside the system. */
    is?: 'approve' | 'reject'
    /** One authority, or several when the law names several. */
    signedBy?: string | string[]
    legalBasis?: string | string[]
    secondCheck?: boolean
  }

  /**
   * HOW THE STEP IS DONE — who does it, on how many records, what they must see, who fills each
   * field. Absent = undeclared, never a default. See `task-vocabulary.ts`.
   */
  task?: TaskDecl

  [key: string]: unknown
}

/** A process: one entity's lifecycle, declared. */
export interface Process {
  process: string
  label?: string
  entity: string
  /** Property on the record that carries the state. */
  stateProperty: string
  /** Role key → real role code, so steps name a job, not a person. */
  roles: Record<string, string>
  states?: Array<{ name: string; label?: string; hint?: string }>
  transitions?: Transition[]
  /** Where this process was read from — goes into provenance. */
  sourceFile?: string
  /** Per state, roles that may SEE a record there without acting on it. Absent = undeclared. */
  readers?: ReadersDecl
  [key: string]: unknown
}

/**
 * One more rule a domain wants a step judged by. Return a refusal, or null to
 * stay out of the way.
 *
 * This is where anything naming a domain's own entities belongs — "do not
 * approve the same submission twice" is a rule about an approval record this
 * kernel has never heard of.
 */
export type ExtraCheck = (
  transition: Transition,
  record: Record_ | null | undefined,
  facts: Facts,
) => Verdict | null

/** Facts about a record that cannot be read off the record itself. */
export interface Facts {
  /** Latest decision of the authority — `APPROVED` · `RETURNED` · `REJECTED`. */
  approvalDecision?: string | null
  /**
   * How many edges the record has on a given relationship, by relationship name.
   *
   * ⭐ WHY THE ENGINE NEEDED THIS. `requiresFact`/`forbidsFact` read a PROPERTY of
   *    the record. But most real conditions are about something ATTACHED to it:
   *    "has a signed decision come back", "has anyone been named to co-sign".
   *    With only property gates, every such condition has to be denormalised into
   *    a marker column that some effect must remember to set — and, worse, to
   *    clear again on every path that walks the record backwards.
   *
   * ⛔ MEASURED, NOT GUESSED. In a reference app on 21/8/2026: 357 steps, 98 fact
   *    gates, and **52 marker properties that exist for no reason but to give a
   *    gate something to read**. In one day, four of them were found holding a
   *    stale value — including one that let a training plan be approved on the
   *    live-ammunition permit issued for a DIFFERENT version of that plan.
   *
   *    A count of edges cannot go stale. The marker is a copy; the edge is the
   *    fact.
   */
  links?: Record<string, number>
}

/** Whether a step can run, and if not, why — in words an officer reads. */
export interface Verdict {
  ready: boolean
  notReady: string | null
  /**
   * `waiting` — not yet its turn, something else must finish → show the button
   *             greyed out with the reason.
   * `done`    — already happened, cannot repeat → hide the button entirely.
   * `n/a`     — does not apply to this record AT ALL, and never will → hide it,
   *             and never say "not yet" about it.
   *
   * Three different things: one is "coming up", one is "over", one was never
   * this record's business. ⭐ `n/a` was added 21/8/2026 after an app had been
   * returning it for months while this type said only two kinds existed — so
   * every consumer that switched on the kind had an unhandled case, silently.
   * A refusal kind the engine does not name is a refusal every screen renders
   * by guesswork.
   *
   * ⛔ Only `n/a` outranks the others in {@link checkTransition}: a permanent
   *    refusal must not be masked by a temporary one, whatever order they were
   *    declared in.
   */
  notReadyKind: 'waiting' | 'done' | 'n/a' | null
  code: string | null
  /** The fact that blocked it, when a fact gate did — with several declared, only this one names the wait. */
  property?: string
}

/** One offer in the answer to "what can this person do with this record". */
export interface Offer {
  action: string
  label: string
  useCase?: string
  to?: string | null
  source_ref?: string
  provisional: string | null
  /** Does the signed-in person hold the role this step needs. */
  allowed: boolean
  needsRole: string
  ready: boolean
  notReady: string | null
  notReadyKind: 'waiting' | 'done' | 'n/a' | null
}

/** The session the app hands in — already scoped (row-level security). */
export interface Session {
  actor: string
  roles: string[]
  ontology: {
    get(id: string, ctx: unknown): Promise<Record_ | null>
    neighbors(id: string, relationship: string, ctx: unknown): Promise<Record_[]>
    applyAction(
      action: string, args: unknown, provenance: unknown, ctx: unknown, uow?: unknown,
    ): Promise<unknown[]>
  }
  ctx: unknown
  /** Set when the engine itself is running a consequence — no human pressed. */
  auto?: { after: string }
  [key: string]: unknown
}

/** What the app plugs in. Everything here is a business decision, not a mechanism. */
export interface Hooks {
  /** Directories holding `*.yaml` process declarations. */
  declarationDirs(): string[]
  /** Provenance stamped onto every write. */
  provenance(opts: { sourceRef: string; confirmedBy?: string }): unknown
  /** Civil date in the app's own timezone — never a bare `Date`. */
  civilDate(clock: Date): string
  /**
   * Which parameter carries the target id when a step does not say. The naming
   * convention belongs to the domain, so there is no default here.
   */
  defaultTargetParam: string
  /** Extra rules a step is judged by — see {@link ExtraCheck}. */
  extraChecks?: ExtraCheck[]
  /**
   * Resolve the role a step needs from the record itself, when a fixed one in
   * `Process.roles` cannot say it.
   *
   * Some authority is assigned by law according to what the record IS, not
   * which step is being taken: who may sign the founding of a unit depends on
   * the unit's level; who may issue a disciplinary decision depends on its
   * severity. Declaring one step per level would mean several near-identical
   * blocks differing in a single line — and nothing to keep them in step with
   * each other, while the screen is left to guess which one to offer.
   *
   * Return null to fall back to `Process.roles[transition.role]`, which is what
   * happens when this hook is absent altogether.
   *
   * The engine asks a neutral question — "this step declares role X, here is the
   * record, what is the real role" — and never learns that a key called
   * `approver` means anything in particular.
   */
  resolveRole?(input: {
    process: Process
    transition: Transition
    record: Record_ | null
  }): string | null | undefined
  /**
   * Is each submitted parameter what its declaration says it is — type, bounds,
   * enum, fixed value? Return the first that is not, or null.
   *
   * ⛔ WITHOUT THIS, A PARAMETER IS CHECKED FOR PRESENCE ONLY. The write guard
   *    judges what reaches an entity property; a parameter the step reads without
   *    storing under its own name — a reason folded into a note, an amount
   *    compared against what is left, a day that sets a deadline — was judged by
   *    the screen and by nothing else, and a direct request never meets the screen.
   *
   * The engine does not know what a field declaration looks like, so it asks.
   * `@dqa-ai-solutions/ontology-view`'s `stepParamViolation` answers from the same resolved
   * contract the form draws — one limit, read by the box and by the server.
   *
   * Runs after the required check and BEFORE the record is read, so a caller who
   * sends junk learns nothing about where the record stands.
   */
  checkParams?(input: {
    process: Process
    transition: Transition
    params: Record<string, unknown>
  }): ParamRefusal | null | undefined
  /**
   * Last chance to add arguments before the write: statutory deadlines,
   * locality codes, approver scope. The app owns all of those — a kernel that
   * decided them would be wrong for half the apps using it.
   */
  enrichArgs?(input: {
    session: Session
    process: Process
    transition: Transition
    target: Record_ | null
    params: Record<string, unknown>
    args: Record<string, unknown>
    clock: Date
  }): Promise<void> | void
  /**
   * Evidence checks that belong to the domain: a scan of the signed original,
   * an off-system decision matched a second time, an authority's approval.
   * Throw to block; the thrown message reaches the officer.
   */
  verifyEvidence?(input: {
    session: Session
    process: Process
    transition: Transition
    target: Record_ | null
    params: Record<string, unknown>
    args: Record<string, unknown>
  }): Promise<void> | void
}

/** A parameter that breaks its declaration — what `checkParams` returns. */
export interface ParamRefusal {
  param: string
  message: string
  /** The validator's code: `TYPE_MISMATCH`, `CONSTRAINT_VIOLATED`, `ENUM_VALUE_INVALID`… */
  code?: string
  /** The broken keyword (`maxLength`, `multipleOf`…) — so the host can word it under the right box. */
  keyword?: string
  limit?: unknown
}

/** What a step returns once it has landed. */
export interface StepResult {
  action: string
  useCase?: string
  from: string | null
  to: string | null
  id: string | null
  events: unknown[]
  followUps?: Array<{
    action: string
    label: string
    because: string | null
    ok: boolean
    id?: string
    error?: string
    code?: string | null
  }>
}
