# `@dqa-ai-solutions/ontology-view`

**A screen is a lens over the ontology, not a substrate of its own.**

The app declares *which lens to open and how to lay it out*. This package resolves
that declaration into a **`ViewContract`** — a flat, fully-answered description a
renderer can draw without asking anything else. Field types, wording, enum labels,
which steps are available and what each step's form contains are all read from the
**ontology** and the **process** that already declare them.

No React here, and no HTML. A contract, so one declaration can drive a web table,
a print sheet, or a terminal list.

```
ontology.yaml ─┐
workflow.yaml ─┼─▶ resolveView() ─▶ ViewContract ─▶ (renderer)
views/*.yaml  ─┘                 └─▶ Diagnostic[]  ─▶ (build check)
```

## Why this exists

Counted on a shipped app — five entities, twenty-seven use cases:

| | |
|---|---:|
| Hand-written screen code | **4,122 lines** |
| List screens that were the same shape, written separately | **7** |
| Cross-cutting changes in one sprint *(pagination · status legend · provenance)* | **3**, touching 10 · 4 · 16 files |

Seven list screens differing only in their columns is seven places to edit for
one decision. The shape repeats; only the vocabulary changes. That is what a lens
is for.

## Use

An app reaches this through **`@dqa-ai-solutions/app-runtime`**, the app façade — one door to
the kernel, not several.

```ts
import { loadViewContracts } from '@dqa-ai-solutions/app-runtime'

const contracts = await loadViewContracts({
  viewsDir: 'app/views',
  workflowDir: 'app/workflow',
  ontology,
  // the only three things the app alone can answer:
  slots: ['list.above', 'detail.after'],   // slots its renderer publishes
  components: ['equipment-status'],     // components it can resolve
  maxWidgets: 2,                           // bespoke blocks per entity
})
```

Reading the directory, parsing, resolving each declaration and refusing to start
on a broken one is kernel work — same shape as `loadOntology` / `loadRules` in
`@dqa-ai-solutions/core-runtime`. Left in the app it gets rewritten, slightly
differently, by every app; and the differences are exactly where one of them
quietly decides to ignore a diagnostic.

Two entry points, and the asymmetry is deliberate:

| | Throws? | For |
|---|---|---|
| `loadViewContracts()` | **yes**, on an error | start-up — a broken declaration should stop the process while someone is watching |
| `resolveViewPack()` | no | a build check that wants every problem at once |
| `resolveView()` | no | one declaration, full control |

Resolution **never throws on a bad declaration and never silently drops a field**.
Both are ways for a screen to go quietly wrong: the first stops the whole app
because one column is misspelled; the second ships a screen with a column missing
and nobody notices until a user asks where it went. Everything is collected, and
the caller decides.

## What the app declares

```yaml
entity: Equipment
cluster: logistics
sub: Register held by the local command

list:
  columns: [equipmentName, unit, quantity, condition, availability]
  main: equipmentName
  search: [equipmentName]
  sort: [{ by: equipmentName, collate: vi }]

detail: { facts: [equipmentName, quantity, condition, unit] }
row:    { main: equipmentName, badge: condition }

widgets:
  list.above: equipment-status      # bespoke block — BY NAME
```

Fifteen lines. Everything else — that `quantity` is a number and aligns right,
that `condition` is an enum and which words its values carry, that `unit` is
followed through a link, which buttons appear in which state and who may press
them — is already written down elsewhere and is read from there.

## Three additions to the ontology

**A label, separate from the description.** `PropertyDef` has `description` —
which the SDK itself calls *"living documentation — chatbot/AI reads this"*. That
is a sentence explaining what a property means; a column heading is two or three
words. Reusing one as the other gives a table whose columns are sentences, and it
breaks the moment someone improves the documentation.

```yaml
labels:
  equipmentName: Name
  quantity: Quantity
```

Missing a label is a **warning**, not an error: the screen still renders, from a
mechanical fallback, and the warning says so. A generated label is always worse
than a written one — and for users reading Vietnamese it is not merely clumsy, it
is English leaking onto the screen.


**Enum wording, declared where the value is declared.** `PropertyDef.enumValues`
is `string[]` — machine codes with no human wording. Every app so far therefore
kept a second, parallel table of labels inside its UI code, which is how a screen
ends up printing `needs_repair` at a user.

```yaml
- name: condition
  type: enum
  enumValues: [serviceable, needs_repair]
  values:
    - { value: serviceable,  label: Serviceable,  tone: done }
    - { value: needs_repair, label: Needs repair, tone: warn }
```

`tone` is visual weight, not colour — the renderer maps it to its own palette.

**Derived properties — values that are followed, not stored.**

```yaml
derived:
  - { name: unit,      kind: linked,     via: heldByUnit, show: unitName }
  - { name: caseCount, kind: countLinks, via: usedInCase }
```

Only two kinds, deliberately. A third — *"the newest linked record"* — was
considered and rejected: it is an argmax rather than an aggregation, and the
honest fix is to have the write set a 1:1 link at the moment it happens.
Computing it at read time buys a slow query and a sort that stops working once
the table is large.

Anything needing arithmetic, a calendar, or a lookup table is **not** a derived
property. It is a function, and functions belong in code.

## Step forms come from the step

A step already declares its parameters. Measured on a real app, **96% of
parameters are typed by something already written down**: a property of the
entity, a pointer to another record, or a property of the record the step
creates. The remaining 4% — free fields that exist only for one step — are
declared inline:

```yaml
- action: sendToMaintenance
  params: { target: equipmentId, required: [equipmentId, reason] }
  fields:
    reason: { type: text, label: Reason, multiline: true }
```

The target id is dropped from the form: it names the record being acted on, it is
not something a person fills in.

> ⚠️ This package resolves **what a form contains**, not conditional display.
> A parameter list cannot say *"hide this field when that one is X"*, and pushing
> it to say so is how a declaration turns into a programming language — worse
> than the one it replaced, because it has no types, no debugger and no tests.
> A step that needs more than fields gets `widgets: { action.<step>: <name> }`
> and a component written in code.

## Bespoke blocks: named slots, never positions

```yaml
widgets:
  list.above: equipment-status
  action.commitForce: force-picker
```

Slots are **names the renderer publishes**. Patching a shared layout by position
— *"insert after the third element"* — is the single most common way these
systems rot: the shared layout moves and every patch breaks silently, with no
error to catch it. Positional-looking slots are rejected.

Escape hatches are not a concession. No platform of this kind survives without
one — every comparable system has its own, under a different name. What matters
is that the hatch is **named, registered, and counted**: `maxWidgets` warns once
an entity leans on it often enough that either the shape has repeated enough to
belong in the shared lens, or that entity wants a screen of its own.

## Where the app takes over

Not everything belongs in a declaration, and the ones that do not are not edge
cases — they are ordinary. A count of claims past their legal deadline **across
the whole territory** is neither a property nor a link: it is a tally over
working days with public holidays deducted. A status picture is assembled from
two entities with an exclusion rule. Pushing those into a declaration is how a
declaration becomes a query language, and then a bad programming language.

So there are three named points where the app takes over — and the kernel does
exactly one thing at each: **check the name exists.**

```yaml
uses:                                  # data the app computes and supplies
  - claim-deadline-counts
widgets:
  action.inviteMembers: invite-picker  # a step whose form the app owns
  cell.dueDate: claim-deadline         # a cell the app draws
hooks:
  after.payClaim: reload-summary       # what happens on screen after a step
```

### Register by discovery, never by a second list

The names an app registers should be **derived from the things themselves** — a
directory scan, a manifest — never a hand-kept array. A hand-kept array is a
second copy of a list that already exists, and two copies drift; here, drift
means a bespoke block silently stops appearing, which is the exact failure this
mechanism exists to prevent.

```js
// the block's own filename is its name
components: readdirSync('src/blocks')
  .filter((f) => f.endsWith('.jsx') && f !== 'index.jsx')
  .map((f) => f.replace(/\.jsx$/, ''))
```

This is how comparable systems do it: an extension declares its own id and the
host discovers it by scanning, or reads a manifest without loading the code at
all. Nobody maintains a parallel register.

### There is no `before` hook, on purpose

Systems that have both a *before* and an *after* hook run the before one **on the
server, inside the write**, where it can still refuse or alter what is written.
This package has no equivalent, and should not: anything that runs before a write
belongs in the Action's guard — behind the write gate, where it can be enforced
and recorded. A `before` hook in a client renderer is a place to put a rule that
nobody can enforce.

The kernel never calls these, never knows what they compute, never sees a
result. That boundary is precisely why they are allowed to hold domain logic
while the declaration is not. What it buys is that *"the screen quietly lost a
number"* becomes *"the process refuses to start"*.

⚠️ `after.<step>` runs **after the write, in the client**. Anything that decides
whether a write is allowed, or what it writes, belongs in the Action — behind the
write gate, where it can be enforced and recorded. A rule placed in `after.` is a
rule nobody can enforce.

## What it refuses to let through

| Code | Caught before it reaches a user |
|---|---|
| `UNKNOWN_ENTITY` `UNKNOWN_FIELD` | a column naming nothing |
| `ENUM_WITHOUT_LABELS` `ENUM_VALUE_UNLABELLED` | a machine code printed at a user |
| `ENUM_LABEL_ORPHAN` | wording left behind by a rename |
| `UNKNOWN_RELATIONSHIP` `RELATIONSHIP_WRONG_END` `UNKNOWN_TARGET_PROPERTY` | a derived column that silently comes back empty |
| `UNTYPED_PARAM` | a form field with a guessed type |
| `UNRENDERABLE_FIELD` | an id or a blob put in a column — `uuid` renders fine, as a machine identifier in front of a person |
| `MISSING_LABEL` | a column heading generated from a code name *(warning)* |
| `UNKNOWN_WIDGET` | a bespoke block that never appears because its slot is misspelled |
| `POSITIONAL_SLOT` | a patch that will detach silently later |
| `TOO_MANY_WIDGETS` | an entity that has outgrown the shared lens *(warning)* |
| `UNKNOWN_DATA` | a screen expecting a number the app never computes |
| `UNKNOWN_HOOK` | a callback on a step that does not exist, or a name never registered |

## Boundary

**In scope** — resolving a declaration into a contract; validating it against the
ontology and the process.

**Out of scope** — rendering; permission decisions *(they stay at the write gate,
where they can be enforced)*; querying; derived-property execution *(these belong
in the generated SQL view, where the database can index and sort them — computing
them per read is what caps comparable systems at a few hundred sortable rows)*.
