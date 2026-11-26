# @dqa-ai-solutions/app-runtime

The app tier of the DQA runtime, server side, for apps whose records move through states while people
do each step: the process runner, the view resolver (a view declaration + ontology + process → the
`ViewContract` a renderer draws), and two libraries an app builds on. Stands on
`@dqa-ai-solutions/core-runtime`, which the app installs alongside, so the app has one core. The
screens are `@dqa-ai-solutions/ui-runtime`.

```bash
npm i @dqa-ai-solutions/core-runtime @dqa-ai-solutions/app-runtime
```

| Import | What |
|---|---|
| `@dqa-ai-solutions/app-runtime` | process runner (`createBusinessWorkflow`, `checkTransition`, `findOpenGates`…), view resolver (`resolveView`, `loadViewContracts`, `missingDerived`…) |
| `@dqa-ai-solutions/app-runtime/calendar` | a calendar over the app's own records: anything with a planned date and an owner |
| `@dqa-ai-solutions/app-runtime/cascade-ledger` | a ledger for plans cascaded down levels: targets, allocations, actuals, funding |

ES modules only.

## This repository

The source of `@dqa-ai-solutions/app-runtime`. One package is published; the others are its parts and are bundled into it.

| Folder | | |
|---|---|---|
| `app/app-runtime` | **published** | The app tier, server side: process runner, view resolver and loaders, calendar and cascade-ledger libraries |
| `app/ontology-view` | inside | View-contract resolver: turns an app's view declaration + ontology + process into a flat, renderer-agnostic contract (columns, facts, queue rows, step forms) so a screen is a lens over the ontology instead of hand-written code. |
| `app/workflow-process` | inside | Business-process runner: a state machine over records, not a DAG over a run |

Examples, each installing only published names: `examples/cascade-4-levels`.

Companion repositories: [core-runtime](https://github.com/DQASolutions/core-runtime) · [ontology-runtime](https://github.com/DQASolutions/ontology-runtime) · [ui-runtime](https://github.com/DQASolutions/ui-runtime) · [agent-runtime](https://github.com/DQASolutions/agent-runtime).

## Build from source

```sh
npm install
npm run build
npm test
npm run lint
```

This repository builds against the published `@dqa-ai-solutions/core-runtime`, `@dqa-ai-solutions/ontology-runtime`, installed from the registry as dev dependencies.

## License

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).
