// @dqa-ai-solutions/app-runtime — the app tier in one import, for apps whose records move through
// states while people do each step: the process runner, the view layer, and two libraries an app
// builds on (a calendar over its own records, and a ledger for plans cascaded down levels).
// Stands on @dqa-ai-solutions/core-runtime (concepts, rules, the view contract); never on agent-runtime.
// Server side only: the screen layer is @dqa-ai-solutions/ui-runtime, which stands on the core alone,
// so a server never loads React and a browser never loads this package.
export * from '@dqa-ai-solutions/workflow-process'
export * from '@dqa-ai-solutions/ontology-view'
// The view contract the resolver produces, again at this entry: ontology-view re-exports it from the
// core inside a nested module, which a bundler would turn into a runtime copy.
export * from '@dqa-ai-solutions/core-runtime/view'

// The two libraries are at `./calendar` and `./cascade-ledger`. They share one shape (a contract
// the app binds its records to: ROLES, SLOTS, bindOrThrow, checkBindings, degradations), so each
// keeps its own entry instead of joining this one.
