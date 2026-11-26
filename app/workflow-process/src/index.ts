// @dqa-ai-solutions/workflow-process — a business-process runner.
//
// Its peer is @dqa-ai-solutions/agent-orchestrator, which runs agent plans. Both are declarative
// and both are driven by the caller (ask what is next, do it, ask again). They
// differ where it counts: what "progress" means, and what a write guarantees.
//
//   agent-workflow  a run walks a plan; a task is done when its output exists;
//                   state is files under a run directory
//   business-workflow  a record sits in a state, possibly for years; a step is
//                   available when the state and the evidence allow it; every
//                   write lands in one transaction with a ledger event, under
//                   row-level security
//
// Neither is a variant of the other. Business processes go backwards — returned
// for correction, appealed — and the same step runs on thousands of records at
// once. A DAG walked once cannot say that.
//
// The engine knows no domain. Everything a domain decides — statutory deadlines,
// locality codes, what counts as evidence — is plugged in through `Hooks`.

export { createBusinessWorkflow } from './conductor.js'
export type { BusinessWorkflow, FollowUpRunner } from './conductor.js'
export { checkTransition, matchesFrom, latestApprovalDecision, factGates } from './decide.js'
export { ProcessError, targetIdParam, makeLoader, KNOWN_TRANSITION_KEYS } from './load.js'
export { findOpenGates, describeOpenGate, checkDecisionShape } from './gates.js'
export type { OpenGate, DecisionFault } from './gates.js'
export type { ExtraCheck,
  Facts, FactGate, Hooks, Offer, ParamRefusal, Process, Record_, Session, StepResult, Transition, Verdict,
} from './types.js'

/*
  THE DECISION VOCABULARY — exported because this package DEFINES what a step
  declaration is, and three other packages read one.

  ⚠️ Before this, `outcome` / `requiresApproval` / `creates` were declared
     independently in THREE packages, each with its own copy of the step type.
     That is how the two halves of a decision drifted apart with nothing to
     object: no single place said they belonged together. One definition, and
     the readers import it.
*/
export { DECISION_ENTITY, expandDecisionKeys } from './decision-vocabulary.js'
export type { DecisionDecl, NeedsDecisionDecl } from './decision-vocabulary.js'

/*
  THE TASK VOCABULARY — how each step is done, for whoever builds its screen. Same rule as the
  decision vocabulary: one definition here, readers (ontology-view, ui-kit) import it.
*/
export { TASK_CATEGORIES, ENTRY_MODES, OFF_SYSTEM_RECORDS, isRows, askedFields, checkTaskShape } from './task-vocabulary.js'
export type { TaskCategory, EntryMode, OffSystemRecord, TaskIteration, TaskDecl, ReadersDecl, TaskFault } from './task-vocabulary.js'
