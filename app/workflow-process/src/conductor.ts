// CaseConductor — the runner for a business process.
//
// Peer to `Orchestrator` in @dqa-ai-solutions/agent-orchestrator, and deliberately not a variant
// of it:
//
//   Orchestrator    one run walks a plan. Progress = which tasks are done.
//                   State lives in files under a run directory.
//   CaseConductor   N records each sit in a state, for months or years.
//                   Progress = a value on the record. Every write lands in one
//                   transaction with an event on the ontology ledger.
//
//   next(record)          what this person may do with this record, and why not
//   do(action, params)    run one step
//   inbox(records)        raw material for a "my work" queue
//
// There is no `approve()`, and that is a conclusion rather than an omission. In
// a plan, a gate is not a task, so approving needs its own entry point. In a
// state machine, approving IS a step like any other — `do()` already covers it.
// A second door to the same room only invites the two to drift.

import { makeLoader, ProcessError, targetIdParam } from './load.js'
import { checkTransition, latestApprovalDecision, matchesFrom } from './decide.js'
import type {
  Facts, Hooks, Offer, Process, Record_, Session, StepResult, Transition,
} from './types.js'

/**
 * The ontology wraps a guard's rejection in its own sentence, in English, with
 * the internal action name in it:
 *
 *   Action "reportTrainingResult" rejected by submission criteria: báo cáo kết
 *   quả quá ngắn — ghi rõ nội dung đã huấn luyện
 *
 * The whole string used to reach the officer's dialog. What they need is the
 * part after the colon — their own language, written for them. Unwrapped here,
 * in one place, because every business write comes through this module. Making
 * each screen trim the string means every screen has to remember the rule.
 */
const GUARD_WRAPPER = /^Action "[^"]+" rejected by submission criteria:?\s*/

async function unwrapGuard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const raw = String((err as Error)?.message ?? '').replace(/^\[[A-Z_]+\]\s*/, '')
    if (!GUARD_WRAPPER.test(raw)) throw err
    const reason = raw.replace(GUARD_WRAPPER, '').trim()
    throw new ProcessError(
      reason
        ? `Không ghi được: ${reason}`
        : 'Không ghi được: dữ liệu chưa đạt điều kiện của bước này',
      { code: 'GUARD_FAILED' },
    )
  }
}

export type FollowUpRunner = (session: Session, params: Record<string, unknown>) => Promise<{ id?: string } | void>

export function createBusinessWorkflow(hooks: Hooks) {
  const { loadProcesses, findTransition, followUpsAfter, reload } = makeLoader(hooks.declarationDirs)

  // A consequence step needs a domain function to carry it out. Domains register
  // their own; this engine must never learn any of their names.
  const followUpRunners = new Map<string, FollowUpRunner>()

  /**
   * Register the function that carries out a consequence step.
   *
   * Register it in the very file that owns the triggering step, so the module is
   * certainly loaded when that step runs. A separate wiring file is the thing a
   * test calling the domain function directly forgets to import — and then the
   * consequence silently does not run.
   */
  function registerFollowUp(actionName: string, run: FollowUpRunner): void {
    followUpRunners.set(actionName, run)
  }

  function requiredRole(process: Process, transition: Transition, record: Record_ | null = null): string {
    // Ask the domain first: some authority is fixed by law according to what the
    // record is, not according to which step is being taken.
    const resolved = hooks.resolveRole?.({ process, transition, record })
    if (resolved) return resolved

    const role = process.roles?.[transition.role]
    if (!role) {
      throw new ProcessError(`Quy trình "${process.process}" chưa khai vai "${transition.role}"`)
    }
    return role
  }

  /**
   * What this person may do with this record — so a screen shows the buttons
   * that work, instead of showing all of them and failing after the click.
   */
  function availableActions(
    session: Session,
    record: Record_ | null | undefined,
    entity: string,
    facts: Facts = {},
  ): Offer[] {
    const status = record?.data?.status
    const out: Offer[] = []
    for (const proc of loadProcesses()) {
      if (proc.entity !== entity) continue
      for (const t of proc.transitions ?? []) {
        if (!matchesFrom(t, status)) continue
        const verdict = checkTransition(t, record, facts, hooks.extraChecks ?? [])
        const needsRole = requiredRole(proc, t, record ?? null)
        out.push({
          action: t.action,
          label: t.label,
          useCase: t.useCase,
          to: t.to,
          source_ref: t.source_ref,
          provisional: t.provisional ?? null,
          allowed: session.roles.includes(needsRole),
          needsRole,
          ready: verdict.ready,
          notReady: verdict.notReady,
          notReadyKind: verdict.notReadyKind,
        })
      }
    }
    return out
  }

  /** Run the consequences of a step that just landed. */
  async function runFollowUps(session: Session, actionName: string, result: StepResult) {
    const chain: NonNullable<StepResult['followUps']> = []
    for (const { transition: t } of followUpsAfter(actionName)) {
      const line = { action: t.action, label: t.label, because: t.auto?.because ?? null }
      const run = followUpRunners.get(t.action)
      if (!run) {
        chain.push({ ...line, ok: false, error: `Bước "${t.action}" khai auto nhưng chưa đăng ký hàm chạy` })
        continue
      }
      try {
        const done = await run(
          { ...session, auto: { after: actionName } },
          { [targetIdParam(t, hooks.defaultTargetParam)]: result.id },
        )
        chain.push({ ...line, ok: true, id: done?.id ?? result.id ?? undefined })
      } catch (err) {
        const e = err as ProcessError
        chain.push({ ...line, ok: false, error: e.message, code: e.code ?? null })
      }
    }
    return chain
  }

  /**
   * Run one step.
   *
   * Order of checks is deliberate: role → parameters → state → evidence. Someone
   * without the authority need not learn where the record stands.
   */
  async function applyTransition(
    session: Session,
    actionName: string,
    params: Record<string, unknown>,
    /**
     * ⭐ `uow` — chạy bước này TRONG giao dịch bên gọi đã mở (`ontology-sdk`
     *    5.10.0). Cần khi host phải ghép một phép đọc-rồi-ghi của mình vào cùng
     *    giao dịch với hiệu ứng — ví dụ trừ phần còn lại của một chỉ tiêu bằng
     *    so-rồi-đặt rồi mới tạo bản giao. Hai việc ấy ở hai giao dịch là có khe
     *    hở, và khe ấy đo được: hai người chia cùng lúc thì cả hai qua cửa.
     *
     * ⛔ Lấy `uow` từ `ontology.withUnitOfWork`, đừng tự mở giao dịch — hook đặt
     *    hàng rào phạm vi theo hàng chỉ bắn khi adapter mở.
     */
    opts: { sourceRef?: string; uow?: unknown } = {},
  ): Promise<StepResult> {
    const { process: proc, transition } = findTransition(actionName)
    const { ontology, ctx } = session

    // ── 1. Role ─────────────────────────────────────────────────────────────
    // A self-running consequence has nobody pressing, so there is no role to
    // check. Still resolve it, so a declaration naming a role that does not
    // exist fails loudly at startup; only the refusal is skipped.
    // ⚠️ ORDER MATTERS, AND ONE CASE HAS TO BEND IT
    //
    // Checks run role → parameters → state → evidence, so that somebody without
    // the authority never learns where the record stands. When authority follows
    // the record itself, that order cannot hold: there is nothing to resolve the
    // role against until the record has been read.
    //
    // So the record is fetched early ONLY when a domain has supplied
    // `resolveRole`. Every app without it keeps the original order, and keeps
    // the property that refusal comes before disclosure.
    let target: Record_ | null = null
    const fromStates = transition.from ?? []
    if (hooks.resolveRole && fromStates.length) {
      target = await ontology.get(String(params[targetIdParam(transition, hooks.defaultTargetParam)]), ctx)
      if (!target) {
        throw new ProcessError('Không tìm thấy hồ sơ — hoặc hồ sơ nằm ngoài phạm vi của bạn',
          { code: 'NOT_FOUND' })
      }
    }

    const role = requiredRole(proc, transition, target)
    if (!session.auto && !session.roles.includes(role)) {
      throw new ProcessError(
        `Vai ${session.roles.join(', ') || '(không có)'} không được phép "${transition.label}" — cần ${role}`,
        { code: 'ROLE_DENIED', needs: role },
      )
    }

    // ── 2. Required parameters ──────────────────────────────────────────────
    for (const key of transition.params?.required ?? []) {
      const v = params[key]
      if (v === undefined || v === null || v === '') {
        throw new ProcessError(`Thiếu tham số bắt buộc "${key}" cho "${transition.label}"`,
          { code: 'PARAM_MISSING', param: key })
      }
    }

    // ── 2b. …and each one is what its declaration says ──────────────────────
    // Presence is not validity. See `Hooks.checkParams` for the hole this closes.
    const refused = hooks.checkParams?.({ process: proc, transition, params })
    if (refused) {
      throw new ProcessError(`Tham số "${refused.param}" của "${transition.label}" không hợp lệ: ${refused.message}`, {
        code: 'PARAM_INVALID',
        param: refused.param,
        ...(refused.code !== undefined ? { reason: refused.code } : {}),
        ...(refused.keyword !== undefined ? { keyword: refused.keyword } : {}),
        ...(refused.limit !== undefined ? { limit: refused.limit } : {}),
      })
    }

    // Read the clock ONCE and pass it down. Write effects never call `new Date()`
    // themselves: keeping them pure is what lets a test pin the moment, and it
    // stops two stamps written by one step from differing by milliseconds.
    const clock = new Date()
    const args: Record<string, unknown> = {
      ...params,
      today: hooks.civilDate(clock),
      now: clock.toISOString(),
    }

    // ── 3. Current state — empty `from` means this creates a record ─────────
    if (fromStates.length) {
      target ??= await ontology.get(String(params[targetIdParam(transition, hooks.defaultTargetParam)]), ctx)
      if (!target) {
        throw new ProcessError('Không tìm thấy hồ sơ — hoặc hồ sơ nằm ngoài phạm vi của bạn',
          { code: 'NOT_FOUND' })
      }
      if (target.entityType !== proc.entity) {
        throw new ProcessError(`Hồ sơ là ${target.entityType}, không phải ${proc.entity}`,
          { code: 'WRONG_TYPE' })
      }
      const current = target.data[proc.stateProperty]
      if (!fromStates.includes(String(current))) {
        throw new ProcessError(
          `Không chuyển được: hồ sơ đang ở "${current}", bước này chỉ nhận ${fromStates.join(' hoặc ')}`,
          { code: 'BAD_STATE', current, expected: fromStates },
        )
      }
    }

    // ── 4. The same verdict the read side shows ─────────────────────────────
    //
    // The latest decision is derived HERE rather than taken from the caller. The
    // read side is handed it because the screen has already loaded the approvals;
    // a write path must never trust a caller's parameter for a control gate.
    const facts: Facts = {}
    if (transition.creates?.via && target) {
      facts.approvalDecision = latestApprovalDecision(
        await ontology.neighbors(target.id, transition.creates.via, ctx),
      )
    }
    // Link gates are counted HERE, from the store, for the same reason the
    // decision above is: a control gate must never be judged on a number the
    // caller supplied. The read side may pass counts it already loaded — those
    // only decide whether a button looks available, and this path re-derives
    // them before anything is written.
    for (const rel of [
      transition.requiresLink?.relationship ?? transition.requiresLink?.via,
      transition.forbidsLink?.relationship ?? transition.forbidsLink?.via,
    ]) {
      if (!rel || !target) continue
      facts.links ??= {}
      facts.links[rel] ??= (await ontology.neighbors(target.id, rel, ctx)).length
    }
    const verdict = checkTransition(transition, target, facts, hooks.extraChecks ?? [])
    if (!verdict.ready) {
      throw new ProcessError(`Không làm được bước này: ${verdict.notReady}`, {
        code: verdict.code,
        property: verdict.property,
      })
    }

    // ── 5. What the domain owns ─────────────────────────────────────────────
    // Statutory deadlines, locality codes, approver scope — the app decides all
    // of those. So does evidence: a scan of the signed original, an off-system
    // decision matched a second time, an authority's approval.
    await hooks.enrichArgs?.({ session, process: proc, transition, target, params, args, clock })
    await hooks.verifyEvidence?.({ session, process: proc, transition, target, params, args })

    // ── 6. Write — one transaction, with an event on the ledger ─────────────
    //
    // A self-running turn must be legible in the ledger afterwards. Provenance
    // carries the step that triggered it, so no record is orphaned and a later
    // reader can tell "an officer pressed this" from "this followed from what an
    // officer pressed".
    const sourceRef = opts.sourceRef ?? (session.auto
      ? `${proc.sourceFile}#${actionName} · tự chạy sau ${session.auto.after}`
      : `${proc.sourceFile}#${actionName}`)

    const events = await unwrapGuard(() =>
      ontology.applyAction(
        actionName, args, hooks.provenance({ sourceRef, confirmedBy: session.actor }), ctx, opts.uow))

    const result: StepResult = {
      action: actionName,
      useCase: transition.useCase,
      from: (target?.data?.[proc.stateProperty] as string | undefined) ?? null,
      to: transition.to ?? (target?.data?.[proc.stateProperty] as string | undefined) ?? null,
      id: (events[0] as { aggregate?: string } | undefined)?.aggregate ?? null,
      events,
    }

    // ── 7. Consequences ─────────────────────────────────────────────────────
    //
    // OUTSIDE the main step's transaction, on purpose: once the main step has
    // landed it must not fall over because a consequence did. The error travels
    // back in the result, and the work returns to its owner's queue because the
    // blocking fact was never set.
    //
    // A self-running turn does NOT trigger further self-running turns. Chains
    // several levels deep are what a reader of the declaration cannot predict —
    // declare `after` on the root step instead, one level, visible.
    if (!session.auto) {
      const followUps = await runFollowUps(session, actionName, result)
      if (followUps.length) result.followUps = followUps
    }

    return result
  }

  class CaseConductor {
    readonly #session: Session

    constructor(session: Session) {
      this.#session = session
    }

    /** What may be done with one record. */
    next(record: Record_ | null | undefined, entity: string, facts: Facts = {}): Offer[] {
      return availableActions(this.#session, record, entity, facts)
    }

    /** Run one step. Every control gate is here, never in a screen. */
    do(actionName: string, params: Record<string, unknown>, opts: { sourceRef?: string; uow?: unknown } = {}) {
      return applyTransition(this.#session, actionName, params, opts)
    }

    /**
     * Each record with what may be done to it — the raw material for a work
     * queue.
     *
     * Returns only "which record, which step". Grouping by kind of work, wording
     * it for an officer, enriching it with an id number or a decision reference —
     * that belongs to the domain, because those are business decisions.
     */
    inbox(
      records: Record_[],
      entity: string,
      factsOf: (record: Record_) => Facts = () => ({}),
    ): Array<{ record: Record_; actions: Offer[] }> {
      return records.map((record) => ({ record, actions: this.next(record, entity, factsOf(record)) }))
    }
  }

  return {
    CaseConductor,
    conductorFor: (session: Session) => new CaseConductor(session),
    applyTransition,
    availableActions,
    registerFollowUp,
    followUpsAfter,
    loadProcesses,
    findTransition,
    reload,
  }
}

export type BusinessWorkflow = ReturnType<typeof createBusinessWorkflow>
