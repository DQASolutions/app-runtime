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
