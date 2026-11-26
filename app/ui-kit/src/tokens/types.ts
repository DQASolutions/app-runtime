// What an app DECLARES about how it looks, and what a renderer RECEIVES.
//
// ═══════════════════════════════════════════════════════════════════════════
// THE ONE IDEA
//
//   Every app on this kernel looks different, and none of them may fork the
//   engine to get there. So the engine owns the STRUCTURE of appearance — how
//   many grounds there are, how far ink sits from the ground it lands on, that
//   a state has a weight — and the app owns a handful of numbers.
//
//   ⭐ The test each field below has to pass, the mirror of the one in
//      `@dqa-ai-solutions/ontology-view`'s vocabulary:
//
//        Would two apps sensibly answer this DIFFERENTLY, and can the engine
//        still guarantee the result is readable?
//
//      "Which hue is our primary" passes: every app answers differently and the
//      engine can still measure the label on top of it. "How far apart are
//      surface and surface-2" fails — an app answering that is an app
//      hand-keeping a ladder, which is the thing being replaced.
//
// ⛔ WHAT IS DELIBERATELY ABSENT: individual colours. There is no `ink2:` key and
//    there will not be one. The instant an app can pin one rung, the ladder
//    stops being computed, the contrast guard stops being a guarantee, and a
//    dark or high-contrast theme goes back to being hand-drawn per app.
// ═══════════════════════════════════════════════════════════════════════════

import type { Tone } from '@dqa-ai-solutions/ontology-view'

/** A hue in degrees, or a hue with the colourfulness dialled. */
export type Hue = number | { hue: number; chroma?: number }

/**
 * A colour that may also pin its own lightness.
 *
 * ⭐ THE ESCAPE THE LADDER HAS TO HAVE, AND EXACTLY ONE REASON FOR IT.
 *
 *   Some colours are FIXED BEFORE THE SOFTWARE EXISTS: a national flag, a
 *   regulated corporate mark, a colour written into a standard. Pulling one onto
 *   a computed rung does not improve it — it produces a different colour and
 *   calls it the brand.
 *
 *   Measured, and this is why the escape exists: `#da251d` sits at L 0.572. The
 *   ladder puts the action colour at L 0.428, so the resolver returned `#990002`
 *   — 1.81:1 away from what was asked, which the eye reads as simply not the
 *   same red.
 *
 * ⚠️ PINNING LIGHTNESS DOES NOT BUY OUT OF THE GUARANTEE. The contrast check on
 *    the label stays an ERROR. `#da251d` is allowed because white on it measures
 *    4.93:1; a fixed colour that no label can be read on still fails the build.
 *    The ladder is negotiable, readability is not.
 */
export type ColourDecl = number | { hue: number; chroma?: number; l?: number }

/** @deprecated Use `ColourDecl`. Kept so 0.3.x callers keep compiling. */
export type FlairDecl = ColourDecl

export interface ThemeDecl {
  /** Which way round the ladders run. */
  scheme?: 'light' | 'dark'

  /**
   * The app's action colour — the one primary button, the focus ring, a link.
   *
   * ⛔ NOT a page ground and not a default button ground. The app this kernel
   *    was measured against shipped `.btn, button { background: var(--red) }`,
   *    so a bare `<button>` was already the loudest thing on screen; 33 screens
   *    ended up a wall of them and a check had to be written to count them.
   *    That is a palette defect wearing the costume of a discipline problem,
   *    and no amount of review fixes it.
   */
  primary: ColourDecl

  /**
   * Identity colours — a gradient, a mark. Never carries meaning, never text.
   *
   * ⭐ THE ONE PLACE A LIGHTNESS MAY BE PINNED, and the exception argues for the
   *    rule. Every other rung is computed because something is MEASURED against
   *    it; nothing is measured against flair, because nothing is ever read on it.
   *    A brand mark is chosen, not derived, and pretending otherwise would mean
   *    telling an app its logo colour is off-ladder.
   */
  flair?: ColourDecl[]

  /**
   * The hue the NEUTRAL ladder runs on. Defaults to `primary`.
   *
   * ⛔ ADDED AFTER THE DEFAULT WAS CAUGHT BEING AN ACCIDENT.
   *
   *   The greys borrowed `primary`'s hue, and that read as principled until the
   *   second app arrived. It worked because the house grey sits at 264° and the
   *   house primary at 259.7° — five degrees apart, so nobody could tell the
   *   rule from the coincidence.
   *
   *   The first app with a warm action colour broke it outright: a red primary
   *   at 28.8° meant NO value of `tint` produced a cool grey. Zero gave dead
   *   neutral, anything else gave pink, and the app's real greys (264°, blue)
   *   were simply unreachable.
   *
   *   ⭐ Cool greys with a warm accent is not an exotic taste — it is the house
   *      style of most admin software. The package was quietly forbidding it.
   *
   * ⚠️ Still a HUE, not a colour. The ladder stays computed and the contrast
   *    guard still measures it; this widens what can be asked for, it does not
   *    let anyone pin a rung.
   */
  grey?: Hue

  /**
   * How much of the grey hue bleeds into the neutrals. 0 is neutral.
   *
   * Small numbers (~0.001–0.01). The difference between a slab of grey and a
   * surface that belongs to the rest of the app. The engine tints each rung by
   * a different multiple of this — see `GREY_TINT`.
   */
  tint?: number

  /**
   * `high` pushes ink away from its ground across the board.
   *
   * ⭐ This is what the computed ladders buy. A high-contrast theme is one word
   *    here, not a second palette somebody has to keep in step with the first.
   */
  contrast?: 'normal' | 'high' | number | { min: number; on?: 'ink' | 'ink-2' | 'ink-3' | 'all' }

  /** Scales spacing only. Never type size, never hit targets. */
  density?: Density

  radius?: 'sharp' | 'soft' | 'round'

  font?: { sans?: string; mono?: string }

  /**
   * The body size the whole type ladder is computed around.
   *
   * ⭐ The app declares the ONE number it has a reason for. Everything else is
   *    derived — see `TEXT_RATIO`. `base: 14` reproduces the table that shipped.
   *
   * ⚠️ SCREEN ONLY. A print sheet is laid out in `pt` against a paper standard
   *    and must not follow a screen's body size, the same way `density` scales
   *    spacing and never touches hit targets.
   */
  text?: { base?: number }

  /**
   * What each tone LOOKS like. The ontology declares a state's weight (`Tone`);
   * the app declares which hue carries that weight here.
   *
   * ⚠️ The engine keeps the ladder inside a tone — ground, ink, and the distance
   *    between them. An app picks the hue and cannot pick an unreadable chip.
   */
  tones?: Partial<Record<Tone, Hue>>

  /**
   * How many chart colours to emit.
   *
   * ⚠️ A NUMBER, not a list of colours. The app knows how many series its
   *    busiest chart has; it does not get to pick what they look like, for the
   *    same reason it does not pick a surface — the moment it can, the
   *    distinguishability guarantee stops being one.
   */
  chart?: {
    /** Categorical series. Default 6, hard-reported past 8. */
    series?: number
    /** Steps in the ordered scale. Default 5. */
    levels?: number
    /** Hue the ordered scale runs on. Defaults to `primary`. */
    levelHue?: number
    /**
     * Hue arcs the series palette must walk around.
     *
     * ⭐ A brand colour is not a data series. An application whose identity red
     *    also came out as `series-1` had to keep its own chart palette — which is
     *    exactly what this package exists to delete. Reserving the arc lets the
     *    series ladder stay computed AND stay off the brand.
     *
     * ⚠️ Arcs, not a start offset. A start offset moves the collision rather than
     *    removing it: with six series the wheel is walked anyway and the reserved
     *    hue comes back around at position four.
     */
    avoid?: { from: number; to: number }[]
  }
}

/** Semantic names only. No `red`, no `gray3`, nothing an app has to interpret. */
export type ThemeColors = Record<string, string>

export interface TextStep {
  size: number
  line: number
  weight: number
  tracking: number
}

export type Density = 'compact' | 'cosy' | 'roomy'

export interface ResolvedTheme {
  scheme: 'light' | 'dark'
  /** Which density `space` and `row` were computed at. */
  density: Density
  colors: ThemeColors
  /** Categorical chart colours, in order. `--fos-series-1…n`. */
  series: string[]
  /** One ordered scale — low to high. `--fos-level-1…n`. */
  levels: string[]
  space: Record<string, number>
  /** Table row geometry for the declared density. */
  row: { h: number; padX: number; padY: number }
  /** How tall a control is DRAWN, per density. */
  controlHeight: number
  /** Minimum interactive target in px — fixed, never scaled by density. */
  /**
   * ⛔ The smallest a target may ever be — WCAG 2.2 §2.5.8.
   *
   *   It became a TOKEN the day the grammar needed it in a rule: a `24px`
   *   literal tripped this package's own "no raw pixel sizes" check, which was
   *   right to trip. A floor written as a number in one rule is a floor the
   *   next rule does not know about.
   */
  targetFloor: number
  touchTarget: number
  radius: Record<string, number>
  text: Record<string, TextStep>
  font: { sans: string; mono: string }
  static: Record<string, string>
}

/**
 * ⚠️ Resolution never throws on a bad theme and never silently substitutes.
 *    Same rule as the view resolver, for the same reason: throwing kills an app
 *    over one number; substituting ships a screen nobody can read while
 *    reporting success. Collect everything, then let the caller decide.
 */
export interface ThemeDiagnostic {
  severity: 'error' | 'warn'
  code:
    /** Text does not reach WCAG AA against a ground it can land on. */
    | 'CONTRAST_FAIL'
    /** No label reaches AA on the primary — the one button that must be read. */
    | 'PRIMARY_UNREADABLE'
    /** Two tones too close in hue to tell apart — `done` and `doing` both green. */
    | 'TONE_COLLISION'
    /**
     * The action colour is the same hue as a state.
     *
     * ⛔ WARN, NOT ERROR, AND THE DISTINCTION IS THE POINT. Two tones colliding
     *    is a pure defect: both are states, and a user who cannot tell them apart
     *    has lost information with nothing to fall back on. A primary button
     *    colliding with a state is different — a button and a chip differ in
     *    shape and in position, and an organisation may have a fixed identity
     *    colour that lands there on purpose. Reported, never blocked.
     */
    | 'PRIMARY_TONE_COLLISION'
    /** More series than a person can hold apart. A chart problem, not a palette one. */
    | 'SERIES_TOO_MANY'
    /** Two adjacent series separable only by hue — invisible to some readers. */
    | 'SERIES_INDISTINCT'
    /** Asked for more colourfulness than sRGB holds; chroma was reduced. */
    | 'CHROMA_CLIPPED'
    /** A key the theme vocabulary does not have. Accepted-and-ignored is worse. */
    | 'UNKNOWN_KEY'
    /** A number outside the range the ladders were built for. */
    | 'OUT_OF_RANGE'
    /** `contrast: { min }` asked for more separation than the ladder can reach. */
    | 'CONTRAST_UNREACHABLE'
  where: string
  message: string
}

export interface ThemeResult {
  theme: ResolvedTheme
  diagnostics: ThemeDiagnostic[]
  /** True when no diagnostic has severity `error`. */
  ok: boolean
}
