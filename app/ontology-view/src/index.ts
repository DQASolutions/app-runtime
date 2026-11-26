// @dqa-ai-solutions/ontology-view — a screen is a LENS over the ontology, not a substrate.
//
// The app declares which lens to open and how to lay it out; this package
// resolves that into a `ViewContract` by reading the ontology (what the fields
// are) and the process (what may be done, by whom, from which state). The
// renderer draws the contract and asks nothing else.

export * from './types.js'
export { resolveView, formatDiagnostics, CONSTRAINT_KEYWORDS } from './resolve.js'
// The server's half of a step form: the same `ResolvedField` the box drew from.
export { paramViolation, stepParamViolation, type ParamViolation } from './params.js'
export {
  loadViewContracts, loadViewPack, resolveViewPack,
  type LoadViewsOptions, type ViewPack,
} from './loaders.js'
// ⛔ The one invariant the resolver cannot check, because it never sees data:
//    a derived property's name must equal the key the read layer returns.
export {
  missingDerived, explainMissing,
  type MissingDerived,
} from './row.js'
