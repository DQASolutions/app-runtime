// The bespoke blocks an app publishes — as DATA handed in, never as an import.
//
// ⛔ THE ONE IMPORT THAT STARTED ALL OF THIS
//
//     libs/ui-lens/entity-list.jsx:20
//     import { BLOCKS } from '../../frontend/blocks/index.jsx'
//
//   A generic list renderer naming one application's block registry. Copy the
//   file into a second app and it fails on line 20; leave it, and the "shared"
//   layer is not shared at all.
//
// ⭐ The fix is not a smarter import. It is that the lens never reaches for the
//    registry — the app hands one in, and the lens only ever asks whether a name
//    exists. Resolving a name to a component is the renderer's business, in the
//    renderer's framework, which is exactly the boundary this package keeps.

export interface BlockRegistry {
  /** True when the renderer can draw a block by this name. */
  has(name: string): boolean
  /** Every name, for diagnostics that need to suggest one. */
  names(): string[]
}

export const registryOf = (names: readonly string[]): BlockRegistry => {
  const set = new Set(names)
  return { has: (n) => set.has(n), names: () => [...set] }
}

/** A registry that accepts nothing — the correct default for a print renderer. */
export const NO_BLOCKS: BlockRegistry = registryOf([])
