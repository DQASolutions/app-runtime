# @dqa-ai-solutions/app-runtime

The app tier of the DQA runtime, for apps whose records move through states while people do each
step: the process runner, the view layer, and the screen layer. Stands on
`@dqa-ai-solutions/core-runtime`, which the app installs alongside, so the app has one core.

```bash
npm i @dqa-ai-solutions/core-runtime @dqa-ai-solutions/app-runtime
```

| Import | What |
|---|---|
| `@dqa-ai-solutions/app-runtime` | process runner (`createBusinessWorkflow`, `checkTransition`, `findOpenGates`…), view layer (`resolveView`, `loadViewContracts`, `missingDerived`…) |
| `@dqa-ai-solutions/app-runtime/calendar` | a calendar over the app's own records: anything with a planned date and an owner |
| `@dqa-ai-solutions/app-runtime/cascade-ledger` | a ledger for plans cascaded down levels: targets, allocations, actuals, funding |
| `@dqa-ai-solutions/app-runtime/ui-kit` (`/tokens`, `/primitives`, `/lens`, `/shell`) | what a screen element must be; theme stylesheets at `/ui-kit/tokens.css` and siblings |
| `@dqa-ai-solutions/app-runtime/ui-react` | the React half of a screen (`react` is an optional peer) |

`./ui-kit` and `./ui-react` load in a browser; the root entry is for the server.

ES modules only.

## This repository

The source of `@dqa-ai-solutions/app-runtime`. One package is published; the others are its parts and are bundled into it.

| Folder | | |
|---|---|---|
| `app/app-runtime` | **published** | The app tier in one package: process runner, view layer, calendar and cascade-ledger libraries; screens at ./ui-kit and ./ui-react |
| `app/ontology-view` | inside | View-contract resolver: turns an app's view declaration + ontology + process into a flat, renderer-agnostic contract (columns, facts, queue rows, step forms) so a screen is a lens over the ontology instead of hand-written code. |
| `app/ui-kit` | inside | The runtime half of a screen: token TYPES, the CSS a theme was generated into (tokens*.css), the five states every data surface must answer, action tiers, and view-models that turn a ViewContract into what to draw. |
| `app/ui-react` | inside | The React half of a screen |
| `app/workflow-process` | inside | Business-process runner: a state machine over records, not a DAG over a run |

Examples, each installing only published names: `examples/cascade-4-levels`.

Companion repositories: [core-runtime](https://github.com/DQASolutions/core-runtime) · [agent-runtime](https://github.com/DQASolutions/agent-runtime).

## Build from source

```sh
npm install
npm run build
npm test
npm run lint
```

This repository builds against the published `@dqa-ai-solutions/core-runtime`, installed from the registry as a dev dependency.

## License

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).
