// A gate is two branches. This file refuses the ones that only have one.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHAT WENT WRONG, AND WHY NOTHING CAUGHT IT
//
//   An equipment record went to `pending_maintenance` when a storeman raised a
//   request, and left it when the manager approved. There was no step for the
//   manager to REFUSE. So a request raised by mistake parked the item forever:
//   not available (could not be issued or assigned
//   to anything), and not disposable either, because the disposal step only
//   starts from `available`. The only way out was editing the database.
//
//   Three such gates existed in one app. Nothing caught them:
//
//     · the type checker — every field present and well typed
//     · the test suite — 36 suites green; tests walk the happy path, and the
//       refusal has no path to walk
//     · the graph analyser — it counted exits, and a second exit that happens
//       not to be a refusal makes a one-way gate look finished
//     · a human reading the YAML — `transitions:` is a flat list ordered by use
//       case, so "which steps leave this state" is nowhere on the page
//
//   Every one of those is a proxy for the real question, and the real question
//   was not written down anywhere. So this file makes the domain write it down.
//
// ⭐ THE RULE. Mark the go-ahead `outcome: approve`. Then a refusal must exist,
//    or loading fails. One annotation buys an invariant.
//
// ⚠️ NOT NAME MATCHING. An earlier attempt looked for /reject|return|dismiss/ in
//    action names. It found `dismissAlert` by luck and would miss `khongDongY`
//    entirely — a check built on the words someone happened to type is not a
//    check. `outcome` is a declaration; names stay free.
// ═══════════════════════════════════════════════════════════════════════════

import type { Process, Transition } from './types.js'

/**
 * ⚠️ THE TWO SIGNALS DO NOT CARRY THE SAME WEIGHT — the caller must not treat
 *    them alike.
 *
 *   `approve-branch`     the domain marked a step `outcome: approve`. It has
 *                        opted into this vocabulary, so a missing `reject` is a
 *                        fact about the declaration. Safe to fail a build on.
 *   `requires-approval`  only says a step waits on somebody's decision. The
 *                        refusal may well exist under a name this engine cannot
 *                        read. Report it; do NOT fail a build on it.
 *
 *   Getting this wrong was measured, not imagined: run against an app that had
 *   not yet annotated anything and the second signal convicts two gates whose
 *   refusal branches — "Trả lại để bổ sung", "Không nhất trí" — were sitting
 *   right there. A check that cries wolf during migration is a check people
 *   delete. App declares first, enforcement follows.
 */
/** A gate that lets a record in and offers it no way back out. */
export interface OpenGate {
  /** The process that declares it — `Process.process`. */
  process: string
  /** The state a record waits in. */
  state: string
  /** How the engine knows this state is a gate at all. */
  because: 'approve-branch' | 'requires-approval'
  /** The step that made it a gate. */
  via: string
  /** Every step that does leave the state, for the message. */
  exits: string[]
}

const leaving = (transitions: Transition[], state: string): Transition[] =>
  transitions.filter((t) => (t.from ?? []).includes(state))

/**
 * Gates with no declared refusal.
 *
 * A state is a gate when either signal says so:
 *
 *   `decision: { outcome: approve }`  the domain named this exit the go-ahead,
 *                                     so the other branch is owed
 *   `needsDecision`                   a step here waits on somebody's verdict.
 *                                     A verdict has more than one possible value
 *                                     — that is what makes it a verdict — so
 *                                     refusal is reachable by definition, and
 *                                     the process must say where it leads
 *
 * Either way the obligation is the same: some step leaving this state must
 * declare `decision: { outcome: reject }`.
 *
 * ⚠️ Deliberately NOT checked here: where the refusal goes. Back to the previous
 *    state, on to a closed state, or nowhere at all with only a record written
 *    (`to: null`) are all real shapes in real law. Demanding a particular one
 *    would be this engine deciding a domain's procedure for it — the exact
 *    mistake `ExtraCheck` exists to avoid. What is universal is that refusing
 *    must be POSSIBLE.
 */
export function findOpenGates(processes: Process[]): OpenGate[] {
  const open: OpenGate[] = []
  for (const p of processes) {
    const transitions = p.transitions ?? []
    // state → why it is a gate, and which step said so. First signal wins; a
    // state flagged twice is still one gate.
    const gates = new Map<string, { because: OpenGate['because']; via: string }>()
    for (const t of transitions) {
      for (const state of t.from ?? []) {
        if (gates.has(state)) continue
        if (t.outcome === 'approve') gates.set(state, { because: 'approve-branch', via: t.action })
        else if (t.requiresApproval) gates.set(state, { because: 'requires-approval', via: t.action })
      }
    }
    for (const [state, { because, via }] of gates) {
      const exits = leaving(transitions, state)
      if (exits.some((t) => t.outcome === 'reject')) continue
      open.push({
        process: String(p.process ?? p.sourceFile ?? '(chưa đặt tên)'),
        state,
        because,
        via,
        exits: exits.map((t) => t.action),
      })
    }
  }
  return open
}

/**
 * The message, written for whoever fixes it — these days usually an agent.
 *
 * ⭐ SAY WHAT TO DO, NOT JUST WHAT IS WRONG. A message that stops at the
 *    diagnosis leaves the reader to invent a fix, and the cheapest invention is
 *    always the one that silences the check. So this names the work: add the
 *    refusal step, and here is what it has to contain.
 */
export function describeOpenGate(g: OpenGate): string {
  const why = g.because === 'approve-branch'
    ? `\`${g.via}\` khai \`decision.outcome: approve\``
    : `\`${g.via}\` đòi một quyết định đã có`
  return `${g.process} · ${g.state} — ${why}, nhưng không bước nào rời chặng này `
    + `khai \`decision.outcome: reject\`.\n`
    + `   Hồ sơ vào được mà không ra được khi bị từ chối. `
    + `Bước đang có: ${g.exits.join(', ') || '(không có bước nào)'}\n`
    + '   VIỆC CẦN LÀM — bổ sung UC từ chối cho chặng này:\n'
    + `     · thêm một bước vào \`transitions\`, \`from: [${g.state}]\`\n`
    + '     · khai:  decision:\n'
    + '                by: inside\n'
    + '                outcome: reject\n'
    + '                reason: <tên ô chứa lý do>\n'
    + '                via: <cạnh>   # chỉ khi bước lặp được — một ô không chứa nổi chuỗi\n'
    + '     · chọn `to` đưa hồ sơ RA KHỎI chặng chờ: về chặng trước, sang chặng đóng,\n'
    + '       hoặc `to: null` nếu chặng ấy còn lối khác. Để nguyên là chưa đóng gì.\n'
    + '     · đăng ký hàm hiệu ứng cùng tên với bước\n'
    + '   ⛔ ĐỪNG đặt tên bước là `reject...` rồi thôi — chốt đọc `decision`, không đọc tên.\n'
    + '   ⛔ ĐỪNG khai `accepted` để cho qua — hồ sơ kẹt vĩnh viễn không phải quyết định phạm vi.'
}

// ═══════════════════════════════════════════════════════════════════════════
// A DECISION MUST BE COMPLETE — the shape rules of `decision` / `needsDecision`.
//
// `findOpenGates` above answers one question: *can this record get out.* These
// answer a different one: *is the decision itself fully stated.* Both failures
// are silent, and both were found the same way — by measuring a real domain and
// finding the same idea spelled several ways with nothing keeping them level.
// ═══════════════════════════════════════════════════════════════════════════

export interface DecisionFault {
  process: string
  action: string
  problem: string
  fix: string
}

/**
 * Four rules, each one a hole somebody actually fell into.
 *
 * ① A REFUSAL WITHOUT A REASON. Measured: every refusal in one domain did carry
 *    a reason field — but each spelled it differently (`reason`, `rejectReason`,
 *    `dismissReason`, `opinion`), so nothing could check it and the next one
 *    written would have been the first to forget. Naming the field makes it
 *    checkable and lets the UI label it the same way everywhere.
 *
 * ② A REPEATABLE VERDICT WITH NOWHERE TO KEEP THE SEQUENCE. Returning and then
 *    approving is two verdicts, not one. Written to a single field, the first
 *    disappears — and with it the only record of why the thing came back.
 *
 * ③ A SIGNED PAPER WITH NO RULE FOR WHO MAY SIGN. Measured: 7 steps recorded a
 *    signed decision, 0 checked the signer or the citation at the moment of
 *    recording — every one of them relied on a LATER step to notice. So a paper
 *    signed by the wrong authority sat in the store looking valid, and if no
 *    later step ever ran, it sat there forever.
 *
 * ④ A DOUBLE-CHECK LEFT UNSAID. `secondCheck` absent reads as "not needed", but
 *    it also reads as "nobody said" — and those must not look alike.
 */
export function checkDecisionShape(processes: Process[]): DecisionFault[] {
  const faults: DecisionFault[] = []
  const say = (p: Process, t: Transition, problem: string, fix: string) =>
    faults.push({ process: p.process, action: t.action, problem, fix })

  for (const p of processes) {
    for (const t of p.transitions ?? []) {
      const d = t.decision
      if (d) {
        if (d.outcome === 'reject' && !d.reason) {
          say(p, t, 'a refusal with no reason field',
            'add `decision.reason: <param>` — a refusal nobody explained gets resubmitted unchanged')
        }
        if (t.repeatable && !d.via) {
          say(p, t, 'a repeatable verdict written to the record instead of its own entry',
            'add `decision.via: <edge>` — returning then approving is a sequence, and one field holds one verdict')
        }
        if (d.by === 'outside' && !d.signedBy) {
          say(p, t, 'a signed paper with no rule for who may sign it',
            'add `decision.signedBy` — otherwise nothing objects until some later step happens to look')
        }
        if (d.by === 'outside' && !d.legalBasis) {
          say(p, t, 'a signed paper with no rule for which citations are valid',
            'add `decision.legalBasis` — one citation or a list when the step serves several use cases')
        }
      }
      const n = t.needsDecision
      // Only a signed paper has two people to keep apart — see `expandDecisionKeys`.
      const isSignedPaper = Boolean(n?.signedBy || n?.legalBasis)
      if (n && isSignedPaper && n.secondCheck === undefined) {
        say(p, t, 'waits on a decision without saying whether a second pair of eyes is required',
          'state `needsDecision.secondCheck: true` or `false` — silence and "not needed" must not look alike')
      }
    }
  }
  return faults
}
