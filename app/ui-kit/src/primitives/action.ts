// What a button LOOKS like is decided by what the action DOES.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ THE MEASUREMENT THIS FILE EXISTS BECAUSE OF
//
//   The reference app declared five button tiers in its stylesheet on 25/8. It
//   measured the call sites on 26/8:
//
//       .secondary  137        .quiet  4  (all four inside the shared library)
//       .danger       2        .ctl    0
//
//   The specification was in the file. The screens were exactly as before.
//
//   A second reading, taken at the call site rather than in the stylesheet, found
//   53 of 59 uses of `.secondary` were the word *"Huỷ"* — so in practice the app
//   had two tiers, "solid red" and "the cancel button", and one of them was
//   wearing a bordered box that made it look like an equal choice.
//
// ⭐ SO THE TIER IS NOT OFFERED AS A CHOICE. It is derived from facts the caller
//    already holds — facts that come straight out of the workflow declaration:
//    does this step advance the record, is it a decision and which way, does it
//    leave without writing, does it destroy something.
//
//    A renderer that cannot type a class name cannot get the class name wrong,
//    and `check-one-primary`, `check-button-tier` and `check-button-text` stop
//    being checks that can be failed.
// ═══════════════════════════════════════════════════════════════════════════

/** Four, because measurement found the app really had two and needed four. */
export type ActionTier = 'key' | 'normal' | 'quiet' | 'danger'

/**
 * What the action does. Every field is a fact the workflow already states —
 * `to`, `decision.outcome` — not a presentation choice someone makes here.
 */
export interface ActionFacts {
  key: string
  label: string
  /** The step has a `to`: it moves the record onward. */
  advances?: boolean
  /** A decision step's verdict. */
  outcome?: 'approve' | 'reject'
  /** Leaves the surface without writing anything — cancel, close, back. */
  exits?: boolean
  /** Irreversible, or removes a record from the roll. */
  destroys?: boolean
  /**
   * THIS is the one action the surface exists for — said out loud.
   *
   * ⭐ Only needed when the facts above leave it open: two steps that both
   *    advance, and no `decision.outcome` to tell them apart. The user ruled on
   *    26/9/2026 that a flat screen is not an answer: *"trên 1 màn hình luôn
   *    phải define button nào là chính, button còn lại nằm trong …"* — so where
   *    the workflow cannot decide, the screen's author decides, here.
   *
   * ⛔ At most one per surface. Two `primary` is the same non-answer as none.
   */
  primary?: boolean
  /**
   * Icon the renderer resolves. ⛔ NOT optional in practice — see `actionBar`.
   *
   * The package cannot ship icons: they are an application's own drawings. What
   * it can do is refuse to pretend a button without one is finished.
   */
  icon?: string
  busy?: boolean
  disabled?: DisabledReason | false
  /**
   * What this step still lacks a basis for.
   *
   * ⭐ Not a defect and not a reason to disable — the step is takeable, and
   *    somebody decided it should be. It is a caveat the person pressing the
   *    button deserves to read, and it travels with the button rather than
   *    sitting in a YAML file nobody opens.
   */
  provisional?: string
}

/**
 * ⛔ A CONTROL MAY NOT BE DISABLED WITHOUT SAYING WHY.
 *
 *   There is deliberately no `disabled: true`. A greyed-out button with no
 *   explanation is the worst thing a workflow app can show: the user's job is
 *   right there, it will not respond, and nothing on screen says whether they
 *   are too early, lack the role, or are looking at a bug. They ask a colleague,
 *   and the colleague does not know either.
 */
export interface DisabledReason {
  because: string
  /** What would make it available — a state to reach, a role to hold. */
  hint?: string
}

/**
 * What a renderer receives.
 *
 * ⛔ ONE `label`, AND THERE IS NO SECOND ONE. The pattern this forbids —
 *    `{busy ? 'Đang ghi…' : 'Lưu quyết toán'}` — was found at 62 call sites in
 *    the reference app on the day after a shared busy-button component was
 *    built. It changes the button's width under the finger that just pressed it,
 *    which reads as the button moving away. `busy` is a flag; the word stays put.
 */
export interface ActionView {
  key: string
  /**
   * ALWAYS present, even when it is not drawn.
   *
   * ⛔ When `showLabel` is false the label does not disappear — it becomes the
   *    accessible name and the tooltip. An icon-only control with no name is
   *    invisible to a screen reader and a guess for everyone else; the label is
   *    the thing that stops that, so it is never optional.
   */
  label: string
  tier: ActionTier
  /**
   * The action this surface exists for. Its PLACE, not its paint: a primary
   * that destroys (*"Đóng đợt khám"* in its own confirm dialog) is still the
   * primary, but its tier stays `danger` — a solid colour on an irreversible
   * step would be the one thing the eye trusts without reading.
   */
  primary: boolean
  icon?: string
  /**
   * Draw the word, or carry it as `aria-label` + `title`.
   *
   * ⭐ Words everywhere except a table row, where the data owns the words and an
   *    action is an icon with its word as name and tooltip (see `actionBar` ④).
   */
  showLabel: boolean
  busy: boolean
  disabled: false | DisabledReason
  /** A caveat to show beside the button — see `ActionFacts.provisional`. */
  provisional?: string
}

const tierOfOne = (a: ActionFacts): ActionTier =>
  a.destroys ? 'danger'
    : a.exits ? 'quiet'
      : 'normal'

/**
 * Which action a surface exists for — or `null` when the facts cannot say.
 *
 * The ladder, in order, among the actions that do not merely leave (`exits`):
 *   ⓪ exactly one `primary`           → that one (the author said so)
 *   ① exactly one `approve` decision  → that one
 *   ② exactly one advancing step      → that one (a `reject` does not count)
 *   ③ exactly one action at all       → that one (a lone step IS the point)
 *   ④ otherwise                       → `null`, and `actionBar` reports it
 *
 * ⛔ CHANGED 26/9/2026. This used to end in "otherwise none — flat beats wrong".
 *    The user ruled the other way: every screen defines its primary, the rest
 *    go behind one trigger. ④ is therefore not a quiet outcome any more; it is
 *    `missingPrimary`, and `<ActionBar>` refuses to render it in development.
 */
export function primaryOf(actions: ActionFacts[]): ActionFacts | null {
  const candidates = actions.filter((a) => !a.exits)
  const said = candidates.filter((a) => a.primary)
  if (said.length) return said.length === 1 ? said[0] : null
  const approvals = candidates.filter((a) => a.outcome === 'approve')
  if (approvals.length === 1) return approvals[0]
  const advancing = candidates.filter((a) => a.advances && a.outcome !== 'reject')
  if (advancing.length === 1) return advancing[0]
  return candidates.length === 1 ? candidates[0] : null
}

/**
 * Resolve a surface's actions: **exactly one** primary where there is anything
 * to do, and a tier for every action from what it does.
 *
 * ⭐ The primary is `key` — unless it destroys, then it stays `danger` (outlined,
 *    never filled; see `TIER_PAINT`). Nothing else is ever `key`.
 */
export function actionViews(actions: ActionFacts[]): ActionView[] {
  const winner = primaryOf(actions)
  return actions.map((a) => ({
    key: a.key,
    label: a.label,
    tier: a === winner && !a.destroys ? 'key' : tierOfOne(a),
    primary: a === winner,
    ...(a.icon ? { icon: a.icon } : {}),
    /* Set properly by `actionBar`, which knows the surface. */
    showLabel: a === winner,
    busy: a.busy ?? false,
    disabled: a.disabled ?? false,
    ...(a.provisional ? { provisional: a.provisional } : {}),
  }))
}

/**
 * A row of actions, arranged for the surface it stands on.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ EVERY RULE HAS A SCOPE — the user, 27/9/2026: *"quy tắc trên nó còn phải
 *    có phạm vi nữa, ví dụ là trên toàn 1 màn hình hay trên 1 thẻ, section hay
 *    1 table"*.
 *
 *    | scope                                   | primary (`key`)          | secondaries       |
 *    |-----------------------------------------|--------------------------|-------------------|
 *    | SCREEN — a page, or an open dialog      | EXACTLY ONE, outside cards | —               |
 *    | BAR — `page` head, `dialog`, `form`     | must hold the screen's   | ② and ③ below     |
 *    | SCOPE — `card` (a card or a section)    | its OWN one, or none     | ② and ③ below     |
 *    | REPEATED — `table` row, `item` card     | NEVER                    | ③, ④ below        |
 *
 *    A card or a section is a SCOPE of its own: its primary is the point of
 *    that card, and does not compete with the screen's. The user, 27/9/2026,
 *    shown room cards with only `normal` buttons: *"theo thiết kế của ta thì
 *    cái card hay section vẫn có thể có button với style primary"*.
 *
 *    The SCREEN rule is counted across bars by `<ActionBar>` (development
 *    only): more than one primary among the bars that are not cards, or a
 *    card with work and no primary anywhere on its screen, throws. The BAR
 *    and REPEATED rules are decided here.
 *
 * ⭐ FOUR RULES — AND WHERE EACH ONE COMES FROM
 *
 *   ① ONE PRIMARY PER SCREEN, HELD BY EMPHASIS. A page, a card, a rail, a form
 *      or a dialog paints exactly one action `key`; every other action is drawn
 *      at a lower tier. The user, 26/9/2026: *"trên 1 màn hình chỉ có 1 action
 *      chính"*. The same rule stands in Carbon, Material and Polaris.
 *
 *   ② ONE SECONDARY IN SIGHT, WITH ITS WORD. One-primary is kept by EMPHASIS,
 *      not by hiding everything else. Beside the primary stands ONE secondary
 *      action, drawn at its own lower tier. The screen's author decides which
 *      one by the order of the actions.
 *
 *      ⛔ CHANGED 27/9/2026. From 26/9 to 27/9 the rule was "the rest go behind
 *         ⋯". Room cards ended up showing only a "⋯" that held "Mở hàng chờ"
 *         and "Rời phòng", and the card with a result being entered hid "Lưu".
 *         The user: *"chỗ hiển thị button và ... thực sự có vấn đề thật"*, and
 *         asked what the rest of the world has proven:
 *           · NN/g, contextual menus: menus hold SECONDARY, non-critical
 *             actions only, and "do not use contextual menus when there are
 *             only one or two possible actions", because hiding them "saves
 *             no space, increases effort, and reduces discoverability".
 *           · Material 3, cards: supplemental actions are shown; use an
 *             overflow menu for more than two.
 *           · Shopify Polaris, page actions: a primary plus at most two
 *             secondaries in sight; the rest roll up into "More actions".
 *           · GOV.UK summary card: the card's actions are short words in its
 *             header, two to three, never hidden.
 *         The user picked the stricter end of that range after seeing both on
 *         a design canvas, *"nếu keep tối đa 2 button, 1 chính 1 phụ"*, and
 *         approved it: *"ok, nhìn hợp lý đấy"*.
 *
 *   ③ NEVER A MENU OF ONE. Exactly two secondaries: both stand in sight,
 *      because a menu holding the one left over is a click spent on nothing
 *      (NN/g). Three or more: one stands in sight and the rest, always two or
 *      more, go behind the trigger. Actions that destroy are the first to go
 *      into the menu, where the word is read before the press. The trigger
 *      shows a word (`moreLabel`, e.g. "Thêm"), not a bare "⋯". NN/g: the icon
 *      "lacks inherent meaning; include descriptions as visible labels".
 *      THE WAY OUT (`exits`: Huỷ, Đóng) never makes a fourth button:
 *        · in a DIALOG it is not in the foot at all — it is the ✕ of the
 *          dialog's head (`DialogHead` in @dqa-ai-solutions/ui-react), and an `<ActionBar>`
 *          inside a dialog refuses an exit. The foot counts like a page.
 *        · in a FORM on a page (no head to go to) it COUNTS as a secondary and
 *          is the one kept in sight, drawn `quiet`, never put in a menu: exit +
 *          one more stand side by side; exit + two or more leaves the exit in
 *          sight and the rest behind the trigger.
 *      ⛔ Until 27/9/2026 the exit was not counted, and a dialog showed
 *      "Đóng · Lưu tiền sử · Cấp lại mật khẩu · Tiếp đón" — four in a row. The
 *      user: *"lối ra chính cũng nên được tính là 1 nút phụ, để nó không bao
 *      giờ show đến 4 buttons"*, *"hoặc … đưa lối ra chính lên trên … header
 *      của dialog"* — and, shown both, chose the head: *"dùng style loại B"*.
 *
 *   ④ ROWS AND LIST ITEMS HAVE NO PRIMARY. Forty rows, each painting one `key`,
 *      would be forty primaries on one screen. A card that is a place of its
 *      own (a room you hold, a section) is a `card`, and keeps its primary.
 *        · `table` (a row): data competes with words, so actions are icons,
 *          with the word as their name and tooltip.
 *        · `item` (a card repeated in a list): actions are words, drawn
 *          `normal` / `quiet`, as on a GOV.UK summary card.
 *      Both follow the counting of ③: up to two in sight; from three, one in
 *      sight and the rest behind the trigger.
 *
 *   And EVERY ACTION HAS AN ICON: a menu item without its mark reads as
 *   unfinished, and an icon-only action without one is an unlabelled box.
 *   Reported, never guessed at.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export interface ActionBar {
  /** Drawn in place, in order. */
  inline: ActionView[]
  /** Behind one trigger — never exactly one item. Menu items always show their word. */
  menu: ActionView[]
  /** Actions with no icon to fall back on. */
  missingIcon: string[]
  /**
   * The surface offers something to do and nothing says which is the point —
   * two advancing steps, no `decision.outcome`, no `primary`. Mark one.
   */
  missingPrimary: boolean
}

/**
 * Where a bar stands — see the scope table above. `table` and `item` repeat
 * down the screen and have no primary. `page`, `dialog`, `form` and `rail`
 * must name theirs. A `card` (also a section) is its own scope: it may carry
 * its own primary, or none if another bar of its screen has one.
 */
export type ActionSurface = 'page' | 'dialog' | 'form' | 'table' | 'rail' | 'card' | 'item'

/** Secondary actions kept in sight beside the primary — see ②. */
export const VISIBLE_SECONDARY = 1

/**
 * How many of `n` secondary actions stay in sight: one, and both when there
 * are exactly two, so that the menu never holds only one (③).
 */
export const inSightCount = (n: number): number =>
  n <= VISIBLE_SECONDARY + 1 ? n : VISIBLE_SECONDARY

/** Split secondaries: destroying ones go into the menu first; otherwise the declared order holds. */
function split(views: ActionView[], facts: ActionFacts[], row = false): { sight: ActionView[]; menu: ActionView[] } {
  const destroys = (v: ActionView) => Boolean(facts.find((f) => f.key === v.key)?.destroys)
  /* ⛔ IN A ROW, WHAT DESTROYS NEVER STANDS ALONE AMONG OTHERS. A row wears no
     box (component-css, 6/9/2026), but the `danger` tier keeps its outline on
     purpose — so a danger icon standing beside a quiet one drew the one red box
     in every row. Seen 27/9/2026 on "Gói khám": "style nút delete không đúng".
     The fix is where it stands, not how it is painted: in a row with others it
     goes into the menu, where the kernel already reads it out in `tone-stop`
     ink. And ③ still holds — if that would leave a menu of one, the rest join
     it. (A row whose ONLY action destroys keeps it in place, as it always did.) */
  if (row && views.length > 1 && views.some(destroys)) {
    const safe = views.filter((v) => !destroys(v))
    const keep = Math.min(inSightCount(views.length), safe.length)
    let sight = safe.slice(0, keep)
    if (views.length - sight.length === 1) sight = sight.slice(0, -1)
    const inSight = new Set(sight.map((v) => v.key))
    return { sight, menu: views.filter((v) => !inSight.has(v.key)) }
  }
  const keep = inSightCount(views.length)
  const ranked = [...views.filter((v) => !destroys(v)), ...views.filter(destroys)]
  const sight = new Set(ranked.slice(0, keep).map((v) => v.key))
  return { sight: views.filter((v) => sight.has(v.key)), menu: views.filter((v) => !sight.has(v.key)) }
}

export function actionBar(facts: ActionFacts[], where: { surface: ActionSurface }): ActionBar {
  const views = actionViews(facts)
  const missingIcon = views.filter((v) => !v.icon).map((v) => v.key)

  if (where.surface === 'table' || where.surface === 'item') {
    /* ④ No primary on a repeating surface: its `key` paint goes back to what the step does. */
    const words = where.surface === 'item'
    const flat = views.map((v) => ({
      ...v, primary: false, tier: v.tier === 'key' ? 'normal' as const : v.tier,
    }))
    const { sight, menu } = split(flat, facts, where.surface === 'table')
    return {
      inline: sight.map((v) => ({ ...v, showLabel: words })),
      menu: menu.map((v) => ({ ...v, showLabel: true })),
      missingIcon,
      missingPrimary: false,
    }
  }

  const keepsExit = where.surface === 'dialog' || where.surface === 'form'
  const exitsHere = (v: ActionView) => keepsExit && Boolean(facts.find((f) => f.key === v.key)?.exits)
  const primary = views.filter((v) => v.primary)
  const ways = views.filter(exitsHere)
  const others = views.filter((v) => !v.primary && !exitsHere(v))
  /* ③ The exit is a secondary that never leaves sight. With it, one more fits
     only when that makes exactly two; otherwise the rest go behind "Thêm" —
     unless only one is left over, since a menu never holds one. */
  const { sight, menu } = ways.length === 0 ? split(others, facts)
    : ways.length + others.length <= VISIBLE_SECONDARY + 1 || others.length === 1
      ? { sight: others, menu: [] }
      : { sight: [], menu: [...others.filter((v) => !facts.find((f) => f.key === v.key)?.destroys), ...others.filter((v) => facts.find((f) => f.key === v.key)?.destroys)] }
  const doing = facts.filter((f) => !f.exits)
  return {
    /* The way out first, then the secondaries, the primary last — the primary sits
       at the end of the row, where the eye finishes reading. */
    inline: [...ways, ...sight, ...primary].map((v) => ({ ...v, showLabel: true })),
    menu: menu.map((v) => ({ ...v, showLabel: true })),
    missingIcon,
    /* A card may leave the primary to another bar of its screen — that is
       counted across bars, where the whole screen is visible. */
    missingPrimary: where.surface !== 'card' && doing.length > 0 && !views.some((v) => v.primary),
  }
}

/**
 * Which tokens paint a tier. Names only — this package emits no CSS rules.
 *
 * ⛔ `normal` sits on `--fos-surface`, NOT on the action colour. The reference
 *    app's stylesheet declared `.btn, button { background: var(--red) }`, so a
 *    bare `<button>` was already the loudest thing on the page; 33 screens ended
 *    up a wall of red that nobody chose, and a build check had to be written to
 *    count them. The default has to be quiet or the discipline never holds.
 */
export const TIER_PAINT: Record<ActionTier, { background: string; ink: string; border: string | null }> = {
  key: { background: 'var(--fos-primary)', ink: 'var(--fos-primary-contrast)', border: null },
  normal: { background: 'var(--fos-surface)', ink: 'var(--fos-ink)', border: 'var(--fos-line)' },
  quiet: { background: 'transparent', ink: 'var(--fos-ink-2)', border: null },
  /* Outlined, never filled — a second solid red is a second primary. */
  danger: { background: 'transparent', ink: 'var(--fos-tone-stop)', border: 'var(--fos-tone-stop)' },
}
