// The MILESTONE lens — one record's whole route, and where on it the record is.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ THE LENS THAT WAS MISSING, AND THE SHAPE OF THE HOLE
//
//   `timeline` looks BACKWARD — what has already happened to this record.
//   `action`   looks AT THE PRESENT — what can be done from where it stands.
//   Nothing looked at the ROUTE. So every screen could say what a record is and
//   what you may do to it, and none could say *how far along it is, what comes
//   next, and whose move it is.*
//
//   Measured on the reference app, 7/9/2026: 125 record screens, and 11 of them
//   answered "whose move is it next". Twelve more had the answer typed by hand
//   into their own JSX — the same sentence, written twelve times, from the same
//   data the other 113 screens also had and did not use.
//
// ⛔ AND THE OBVIOUS DRAWING IS THE WRONG ONE — measured on the same app.
//
//   A strip of `states` is what everybody reaches for. On that app it would be
//   honest for 21 of 54 processes. The other 33 branch, 22 have a step that
//   walks the record BACKWARD, and — the fact that decides this file's whole
//   shape — **215 of 522 steps declare `to: null`**: they change nothing a
//   state-shaped picture can show.
//
//   Among those 215 sit **36 of the app's 40 approval gates**. A superior
//   approves by writing a verdict on a separate record; the subordinate's own
//   state is deliberately untouched, so that two commands never write one row.
//   The consequence lands on the screen: before and after the province approves,
//   a plan reads "submitted to superior", and the officer holding it cannot tell
//   whether they are waiting or clear to go.
//
// ⭐ SO A MILESTONE IS NOT A STATE. It is a state OR a gate, and the gate half is
//    the half that was invisible. Both are declared; neither is invented here.
//
// ⛔ AND NOT ONE WORD IN THIS FILE IS A LABEL. A gate has no name of its own in
//    any declaration — `planApproval` is a relationship key, not something to
//    print. Rather than invent one, a gate borrows the label of the step that
//    OPENS it: "Phê duyệt kế hoạch huấn luyện", which the domain already wrote.
//    Same law as everywhere else in this package — the shape is ours, the
//    vocabulary is the application's.
// ═══════════════════════════════════════════════════════════════════════════

import type { ResolvedAction, ViewContract } from '@dqa-ai-solutions/ontology-view'
import type { LensDiagnostic } from './diagnostic.js'

type StateDecl = NonNullable<ViewContract['states']>[number]

/**
 * Where a milestone sits relative to the record — POSITION, not truth.
 *
 * ⚠️ A gate is never `current`. A record is always in a state; it is never "in"
 *    a gate. Whether the gate has been settled is `verdict`, and whether it is
 *    the thing holding the record up is `awaiting`. Folding those into
 *    `standing` would let one field say a record is somewhere it cannot be.
 */
export type MilestoneStanding = 'past' | 'current' | 'ahead'

export interface Milestone {
  kind: 'state' | 'gate'
  /** A state name, or the gate's `via`. Machine key — never printed. */
  key: string
  /**
   * THE WORK THAT REACHES THIS POINT, not the state it leaves behind.
   *
   * ⛔ A ROUTE IS A LIST OF THINGS TO DO, AND A STATE LABEL IS THE WRONG
   *    GRAMMAR FOR ONE. States are named for a record that has already got
   *    there — "submitted", "invited", "in progress" — so a strip built from
   *    them tells the reader that work they have not done is already done.
   *    Reported by the user looking at their own route:
   *
   *      *"sao nó luôn có từ 'Đã' hoặc 'Đang' nhỉ? mấy cái từ đó thực tế
   *      không đúng"* — why is every one of these "already" or "currently"?
   *      Those words are not true.
   *
   *    They were right, and the fix was already half-built: a GATE has always
   *    been named by the step that opens it. This applies the same rule to the
   *    other kind of milestone, so the whole strip reads in one grammar.
   *
   * ⚠️ FALLS BACK TO THE STATE'S OWN LABEL when the work cannot be named without
   *    picking sides — see `stateLabel`. Measured on the reference app: 225 of
   *    253 states are reached by exactly one step and take its name; the other
   *    28 keep theirs.
   */
  label: string
  /**
   * The state's own declared label, always — "Đã trình cấp trên".
   *
   * ⭐ STILL CARRIED, because it is still the right word in other places: the
   *    badge at the top of a record says what the record IS, and that is a
   *    state, not a task. Two questions, two words, and the contract has both.
   */
  stateLabel?: string
  hint?: string
  tone?: StateDecl['tone']
  standing: MilestoneStanding
  /**
   * Roles that act here — identifiers, not words.
   *
   * ⚠️ Naming a role is the application's job: a role code means a job title,
   *    a rank and a level of command, and none of those are this package's to
   *    know. It carries the identifier so the app can look up its own word.
   */
  roles: string[]
  /** For a gate the app reported settled: the verdict it was settled with. */
  verdict?: string
  /** True when this gate, and nothing else, stands between the record and moving on. */
  awaiting?: boolean
}

/**
 * A step that walks the record BACKWARD — a refusal, a hand-back for revision.
 *
 * ⛔ REPORTED APART FROM THE SPINE, deliberately. Twenty-two of the reference
 *    app's 54 processes have one, so they are normal, not exceptional. But a
 *    return laid out as another chip in the row asserts a direction the record
 *    does not travel — the strip would read as though "sent back to draft" comes
 *    after "submitted", when it goes back to a milestone already drawn.
 */
export interface MilestoneReturn {
  action: string
  label: string
  role: string
  from: string[]
  to: string
}

export interface MilestoneInput {
  contract: ViewContract
  /** Where the record stands. `null` before it exists. */
  state: string | null
  /**
   * Which line the record runs on.
   *
   * ⚠️ REQUIRED once an entity declares more than one, and not guessed. Four
   *    lines drawn end to end are not a longer route; they are four routes drawn
   *    as one, which is a picture of nothing. See the `AMBIGUOUS_LINE` branch.
   */
  process?: string
  /**
   * Gates the application knows are settled: `via` → the verdict.
   *
   * ⚠️ THE LENS NEVER RESOLVES A GATE. Whether an approval exists is a fact in
   *    the domain's store, reached by a query this package does not make and
   *    must not learn to make. Absent simply means unsettled.
   */
  settled?: Record<string, string>
}

export interface MilestoneModel {
  milestones: Milestone[]
  returns: MilestoneReturn[]
  diagnostics: LensDiagnostic[]
}

/** The line this record runs on, plus the steps that belong to it. */
function lineOf(input: MilestoneInput, diagnostics: LensDiagnostic[]) {
  const { contract, process } = input
  /* An older contract carries no `lines`. Its states are one line by definition,
     so treat them as one rather than refusing to draw for want of a field that
     did not exist when it was written. */
  const lines = contract.lines?.length
    ? contract.lines
    : contract.states?.length
      ? [{ process: '', stateProperty: contract.stateProperty ?? 'status', states: contract.states }]
      : []

  if (!lines.length) {
    diagnostics.push({
      severity: 'error',
      code: 'CONTRACT_GAP',
      where: contract.entity,
      message:
        `"${contract.entity}" declares no states, so it has no route to draw. Either it has no `
        + `lifecycle — in which case no screen should ask for one — or its process was not loaded.`,
    })
    return null
  }

  if (!process && lines.length > 1) {
    diagnostics.push({
      severity: 'error',
      code: 'AMBIGUOUS_LINE',
      where: contract.entity,
      message:
        `"${contract.entity}" runs ${lines.length} lines (${lines.map((l) => l.process).join(', ')}) `
        + `and no \`process\` was given. Drawing them end to end would assert an order none of them `
        + `declares, so nothing is drawn: pass the line the record is on.`,
    })
    return null
  }

  const line = process ? lines.find((l) => l.process === process) : lines[0]
  if (!line) {
    diagnostics.push({
      severity: 'error',
      code: 'AMBIGUOUS_LINE',
      where: `${contract.entity}.${process}`,
      message:
        `"${process}" is not a line of "${contract.entity}". It declares `
        + `${lines.map((l) => l.process).join(', ') || 'none'}.`,
    })
    return null
  }

  /* Steps carry their line since `@dqa-ai-solutions/ontology-view` 0.27. On a contract from
     before that, none of them do — and filtering on a field nothing has would
     leave every route empty. Filter only when there is something to filter on. */
  const stamped = contract.actions.some((a) => a.process)
  const steps = stamped ? contract.actions.filter((a) => a.process === line.process) : contract.actions
  return { line, steps }
}

/**
 * Gates that can be placed on the spine, keyed by `via`.
 *
 * ⚠️ ONLY DECISION GATES REACH THE SPINE, and the reason is not that the others
 *    matter less. A fact or link gate ("attendance must be recorded first") is
 *    an ORDERING WITHIN a state — it does not divide the route, and it has no
 *    opening step whose label could name it. Those stay on `waitsOn`, where a
 *    screen can say why a particular step is not yet available. Putting them on
 *    the spine would turn a five-milestone route into a forty-item list, which
 *    is the list the operator already could not hold in their head.
 */
function gatesOnSpine(steps: ResolvedAction[], order: Map<string, number>, diagnostics: LensDiagnostic[]) {
  const wanted: string[] = []
  for (const s of steps) {
    for (const g of s.waitsOn ?? []) {
      if (g.kind === 'decision' && !wanted.includes(g.via)) wanted.push(g.via)
    }
  }

  const placed = new Map<string, { via: string; label: string; roles: string[]; after: number }>()
  for (const via of wanted) {
    /* The step that grants the go-ahead. `outcome: 'reject'` settles the same
       gate the other way and must not name it — a milestone called "Trả lại để
       bổ sung" would tell the reader the route ends in a refusal. */
    const openers = steps.filter((s) => s.settles === via && s.outcome === 'approve')
    if (!openers.length) {
      diagnostics.push({
        severity: 'warn',
        code: 'UNPLACED_GATE',
        where: via,
        message:
          `steps wait on "${via}" and no step declares \`decision: { via: "${via}", outcome: approve }\`. `
          + `The wait cannot be named without inventing a word for it, so it is left off the route — `
          + `it is still on those steps' \`waitsOn\`. Mark the granting step's outcome in the process.`,
      })
      continue
    }
    /* Where it can first be settled: the earliest state an opener departs from.
       An opener that CREATES a record (`from: []`) has no position on this
       route — it is a gate opened elsewhere, before this record existed. */
    const anchors = openers.flatMap((o) => o.from).map((f) => order.get(f)).filter((i): i is number => i != null)
    if (!anchors.length) {
      diagnostics.push({
        severity: 'warn',
        code: 'UNPLACED_GATE',
        where: via,
        message:
          `"${via}" is opened by ${openers.map((o) => `"${o.action}"`).join(', ')}, which departs from no `
          + `state on this line. It has no place on the route and is left off.`,
      })
      continue
    }
    placed.set(via, {
      via,
      label: openers[0]!.label,
      roles: [...new Set(openers.map((o) => o.role))],
      after: Math.min(...anchors),
    })
  }
  return placed
}

/**
 * The route, and where on it the record stands.
 *
 * @param input.settled which gates the application has already resolved.
 */
export function milestoneModel(input: MilestoneInput): MilestoneModel {
  const diagnostics: LensDiagnostic[] = []
  const found = lineOf(input, diagnostics)
  if (!found) return { milestones: [], returns: [], diagnostics }
  const { line, steps } = found

  const order = new Map(line.states.map((s, i) => [s.name, i]))

  /* A step naming a state this line has not got is a wiring fault worth saying
     out loud — most often the wrong line was asked for. Reported once per state,
     not once per step, or one stray name fills the log. */
  const strays = new Set<string>()
  for (const s of steps) {
    for (const n of [...s.from, ...(s.to ? [s.to] : [])]) if (!order.has(n)) strays.add(n)
  }
  for (const n of strays) {
    diagnostics.push({
      severity: 'error',
      code: 'UNKNOWN_STATE',
      where: `${input.contract.entity}.${line.process || 'line'}`,
      message:
        `a step names the state "${n}", which this line does not declare. Either the state is `
        + `missing from the process, or the record belongs to a different line.`,
    })
  }

  /* ⛔ WHERE THE RECORD STANDS MUST BE ON THIS ROUTE. Off it, every milestone
     would come back `ahead` — a strip that says a record in flight has not
     started. Better to draw nothing and say why. */
  const current = input.state == null ? -1 : order.get(input.state) ?? null
  if (current === null) {
    diagnostics.push({
      severity: 'error',
      code: 'UNKNOWN_STATE',
      where: `${input.contract.entity}.${line.process || 'line'}`,
      message:
        `the record is in "${input.state}", which is not a state of this line `
        + `(${line.states.map((s) => s.name).join(', ')}). Nothing is drawn rather than drawing it `
        + `as not yet started.`,
    })
    return { milestones: [], returns: [], diagnostics }
  }

  /*
    ⭐ WHAT ARRIVES AT A STATE — and "arrives" is narrower than "ends up there".

    ⛔ TWO KINDS OF STEP LAND ON A STATE WITHOUT BRINGING THE RECORD TO IT:

         a self-loop  `DRAFT → DRAFT` — an edit. It keeps the record where it
                      already was; 90 steps on the source app are declared like
                      this.
         a return     `SUBMITTED → DRAFT` — it brings the record BACK.

       Counting either as an arrival is how "Bản nháp" ended up with three
       candidate names and fell back to the state label. Neither answers *how do
       you get here going forward*, which is the only question a route asks.

    ⚠️ A step with no `from` is a CREATION and does arrive — it is how the
       record comes into being at that state.
  */
  const arrivalsAt = new Map<string, ResolvedAction[]>()
  for (const s of steps) {
    if (!s.to) continue
    const to = order.get(s.to)
    if (to == null) continue
    const before = s.from.map((f) => order.get(f)).filter((i): i is number => i != null && i < to)
    if (s.from.length && !before.length) continue
    arrivalsAt.set(s.to, [...(arrivalsAt.get(s.to) ?? []), s])
  }
  const rolesAt = (name: string) =>
    [...new Set((arrivalsAt.get(name) ?? []).map((s) => s.role))]
  /* ⚠️ ONE DISTINCT LABEL, OR NONE. Several different steps arriving at one
     state means several different ways to get there, and naming the state after
     any one of them tells the reader the others do not exist. `discipline` has
     a state reached by four clause-specific steps; calling it "…(khoản 1)"
     would be a confident lie about the other three. */
  const workAt = (name: string) => {
    const labels = [...new Set((arrivalsAt.get(name) ?? []).map((s) => s.label))]
    return labels.length === 1 ? labels[0]! : null
  }

  const gates = gatesOnSpine(steps, order, diagnostics)
  const milestones: Milestone[] = []
  line.states.forEach((s, i) => {
    milestones.push({
      kind: 'state',
      key: s.name,
      label: workAt(s.name) ?? s.label,
      stateLabel: s.label,
      ...(s.hint ? { hint: s.hint } : {}),
      ...(s.tone ? { tone: s.tone } : {}),
      standing: i < current ? 'past' : i === current ? 'current' : 'ahead',
      roles: rolesAt(s.name),
    })
    for (const g of gates.values()) {
      if (g.after !== i) continue
      const verdict = input.settled?.[g.via]
      milestones.push({
        kind: 'gate',
        key: g.via,
        label: g.label,
        /* A gate is `past` when the record has walked past it — OR when the app
           says it has been settled.

           The second half was added 2026-09-09, after the first half turned out
           to be unreachable on the case it matters most. On a cross-level line
           the record deliberately does NOT move when the level above decides:
           the approving level writes its own approval record and never touches
           the subordinate's file, so the file sits in `SUBMITTED` forever. With
           position alone, `current > i` is never true and an approved gate stays
           `ahead` — drawn dim, dashed, unreached, directly underneath the words
           "already approved" that this same model emits. Text and picture then
           contradict each other, and a reader believes the picture.

           `verdict` is the stronger evidence here: it is the app telling us the
           gate is closed. A gate can be settled without the record moving; it
           cannot be unsettled once a verdict exists. */
        standing: current > i || verdict ? 'past' : 'ahead',
        roles: g.roles,
        ...(verdict ? { verdict } : {}),
        ...(current === i && !verdict ? { awaiting: true } : {}),
      })
    }
  })

  const returns: MilestoneReturn[] = steps.flatMap((s) => {
    if (!s.to) return []
    const to = order.get(s.to)
    const froms = s.from.map((f) => order.get(f)).filter((i): i is number => i != null)
    if (to == null || !froms.length || to >= Math.min(...froms)) return []
    return [{ action: s.action, label: s.label, role: s.role, from: s.from, to: s.to }]
  })

  return { milestones, returns, diagnostics }
}
