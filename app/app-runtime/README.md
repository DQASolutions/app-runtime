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
