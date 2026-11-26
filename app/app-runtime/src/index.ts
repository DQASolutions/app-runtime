// @dqa-ai-solutions/app-runtime — the app tier in one import, for apps whose records move through
// states while people do each step: the process runner, the view layer, and two libraries an app
// builds on (a calendar over its own records, and a ledger for plans cascaded down levels).
// Stands on @dqa-ai-solutions/core-runtime (ontology, rules, storage); never on agent-runtime.
// The screen layer is at `./ui-kit` and `./ui-react`, so a server never loads React and a browser
// never loads a database driver.
export * from '@dqa-ai-solutions/workflow-process'
export * from '@dqa-ai-solutions/ontology-view'

// The two libraries are at `./calendar` and `./cascade-ledger`. They share one shape (a contract
// the app binds its records to: ROLES, SLOTS, bindOrThrow, checkBindings, degradations), so each
// keeps its own entry instead of joining this one.
