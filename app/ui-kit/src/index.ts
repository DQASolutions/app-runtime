// @dqa-ai-solutions/ui-kit — the renderer-agnostic half of a screen.
//
// ═══════════════════════════════════════════════════════════════════════════
// FOUR LAYERS, ONE DIRECTION
//
//   tokens → primitives → lens → shell
//
//   The rule is kept as data in `layers.json` and enforced by
//   `infra/scripts/check-ui-layers.mjs`. It is checked ON PURPOSE because the
//   four layers deliberately share ONE package: merging them removes the npm
//   boundary that would otherwise catch a wrong-way import by accident.
//
//   ⛔ Nothing here may import an application. The library this was extracted
//      from had a generic list renderer that began
//      `import { BLOCKS } from '../../frontend/blocks/index.jsx'`
//      — a shared lens naming one app's block registry. That is the defect this
//      package exists to make impossible.
//
// ⚠️ NO REACT, NO DOM. Not an oversight and not a stage: the kernel's release
//    step bundles for `platform: node`, and a framework adapter cannot pass
//    through it. More importantly, a framework is a STYLE decision and this
//    package holds the decisions that must be the same everywhere. Renderers
//    live in the app, or in a separate adapter package, and read what is here.
// ═══════════════════════════════════════════════════════════════════════════

export * from './tokens/index.js'
export * from './primitives/index.js'
export * from './lens/index.js'
export * from './shell/index.js'
