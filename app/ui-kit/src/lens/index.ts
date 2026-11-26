// @dqa-ai-solutions/ui-kit/lens — a `ViewContract` and some data in, what to draw out.
//
// ⭐ Pure functions, every one. No React, no DOM, no framework: a lens decides
//    WHAT a screen shows and a renderer decides how, which is why the same
//    contract can drive a web table, a print sheet and a terminal list.
//
// ⛔ Nothing here imports an application. Blocks arrive as a `BlockRegistry` the
//    app hands in — see `registry.ts` for the import that made that rule.

export { formatter, writeValue, LONG_TEXT, type FormatDecl, type Formatter } from './format.js'
export { readValue, fieldsOf, ABSENT } from './shape.js'
export { registryOf, NO_BLOCKS, type BlockRegistry } from './registry.js'
export { cellOf, defectsOf, type Cell, type CellContext } from './cell.js'
export {
  type LensDiagnostic, errorsIn, formatLensDiagnostics,
} from './diagnostic.js'
export {
  listModel, planColumns, subjectOf,
  type ListInput, type ListModel, type ListBody, type ListRow, type ColumnPlan,
  type ColumnChoice, type ColumnVisibility, type PlanColumnsOptions,
} from './list.js'
export {
  recordModel,
  type RecordInput, type RecordModel, type RecordBody, type RecordPart,
  type RecordSection, type RecordLayout, type RecordTab,
} from './record.js'
export { queueModel, type QueueInput, type QueueModel, type QueueItem } from './queue.js'
export {
  milestoneModel, type MilestoneInput, type MilestoneModel, type Milestone,
  type MilestoneReturn, type MilestoneStanding,
} from './milestone.js'
export {
  timelineModel,
  type TimelineInput, type TimelineModel, type TimelineEntry, type RawEvent, type EventVocabulary,
} from './timeline.js'
export {
  actionForm, availableActions, actionFacts, actionButtons,
  type ActionForm, type FormField, type Control, type ActionHints,
} from './action.js'
export {
  presentationOf, readersOf, undeterminedIn,
  type Presentation, type Determined,
} from './pattern.js'
