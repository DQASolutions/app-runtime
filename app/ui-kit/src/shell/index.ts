// @dqa-ai-solutions/ui-kit/shell — who may go where, and where they are now.
//
// Reads a navigation declaration and a viewer's roles; returns what the rail
// should hold and which entry is current. No React, no router: the app's router
// is BUILT from `routesOf()` rather than written beside it.

export {
  navModel, routesOf, domainOf,
  type NavDecl, type NavDomain, type NavCluster, type NavItem,
  type ItemState, type ResolvedNavItem, type ResolvedNavCluster, type Route,
  type Viewer, type NavModel,
} from './nav.js'

export {
  emptyTrail, moveTrail, titleTrail, backOf, returnOf, parseTrail,
  type Trail, type TrailEntry, type TrailMove, type TrailPlace, type TrailReturn,
} from './trail.js'
