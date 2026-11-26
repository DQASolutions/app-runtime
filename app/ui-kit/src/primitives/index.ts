// @dqa-ai-solutions/ui-kit/primitives — the decisions a control embodies, with no control.
//
// No React and no DOM: what is here is the part that must be identical in every
// app and every renderer — which states a data surface can be in, and what a
// button looks like given what it does. The drawing is the app's.

export {
  type SurfaceKind, type SkeletonKind, type EmptyReason, type NextStep,
  type EmptyCopy, type Fault, type SurfaceState, type SurfaceInput,
  type StateHandlers,
  skeletonFor, surfaceState, matchState, assertNever,
} from './state.js'
export {
  type ActionTier, type ActionFacts, type DisabledReason, type ActionView,
  actionViews, actionBar, primaryOf, inSightCount, VISIBLE_SECONDARY, TIER_PAINT, type ActionBar, type ActionSurface,
} from './action.js'
