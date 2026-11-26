// Resolve a view declaration into a contract a renderer can draw.
//
// The whole job: answer, for every field the app names, "what type is it, what
// is it called, and where did that answer come from" — using the ontology and
// the process declaration, so the app never repeats itself.

import type { PropertyDef } from '@dqa-ai-solutions/core-runtime'
import { checkTaskShape, type Process } from '@dqa-ai-solutions/workflow-process'
import type {
  Diagnostic, DerivedDecl, EnumValueDecl, ProcessDecl, ResolveOptions, ResolveResult,
  MathNode, ResolvedAction, ResolvedField, ResolvedGate, TransitionDecl, ViewDecl,
  ValueConstraints, ViewOntologyDecl,
} from './types.js'

type Entity = ViewOntologyDecl['entities'][number]

const isNumeric = (t: PropertyDef['type']) => t === 'number'

/**
 * The value constraints a property declares, carried to the renderer as they
 * are written — JSON Schema's keywords, so an `<input>` maps them one-to-one
 * (`maxLength`, `min`/`max`, `step` from `multipleOf`, `pattern`).
 *
 * ⭐ The SAME numbers the write guard enforces. Declared once on the property,
 *    read on both sides: the box stops the keystroke, the server stops the
 *    request that never went through the box.
 */
export const CONSTRAINT_KEYWORDS = [
  'minLength', 'maxLength', 'pattern',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
  'minItems', 'maxItems',
  'formatMinimum', 'formatMaximum',
  // A file box: which kinds, how large. The store keeps a path, so these are
  // judged where the bytes are — the element on pick and drop, the upload endpoint.
  'accept', 'maxBytes',
] as const satisfies readonly (keyof ValueConstraints)[]

function constraintsOf(p: object): { constraints?: ValueConstraints } {
  const rec = p as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of CONSTRAINT_KEYWORDS) if (rec[k] !== undefined) out[k] = rec[k]
  return Object.keys(out).length > 0 ? { constraints: out as ValueConstraints } : {}
}

/**
 * Property types a shared lens cannot draw as a plain cell.
 *
 * ⚠️ `uuid` is the interesting one. It renders perfectly well — as a machine
 *    identifier, in front of a person, which is exactly the failure this package
 *    exists to catch everywhere else. An id belongs in a link's href, not in a
 *    column. `json` has no single sensible cell shape at all.
 *
 *    Both are refused rather than guessed at: an entity that genuinely needs to
 *    show one has a bespoke block, and saying so out loud is the point.
 */
const UNRENDERABLE: Partial<Record<PropertyDef['type'], string>> = {
  uuid: 'an identifier is for a link, not for a person to read',
  json: 'structured data has no single cell shape',
}

/**
 * Turn `equipmentName` into `Equipment name` as a last resort.
 *
 * ⚠️ A fallback, not a feature. A generated label is always worse than a
 *    written one, and in a system whose users read Vietnamese it is not even
 *    wrong-but-readable — it is English leaking onto the screen. Every use of
 *    this path also raises a diagnostic, so it shows up rather than ships.
 */
const humanise = (name: string) =>
  name
    // `equipmentName` → `equipment name`, not `equipment Name`: a fallback should
    // at least read as a phrase rather than as two labels stuck together.
    .replace(/([a-z0-9])([A-Z])/g, (_, a: string, b: string) => `${a} ${b.toLowerCase()}`)
    .replace(/^./, (c) => c.toUpperCase())

export function resolveView(
  decl: ViewDecl,
  ontology: ViewOntologyDecl,
  processes: ProcessDecl[] = [],
  options: ResolveOptions = {},
): ResolveResult {
  const diagnostics: Diagnostic[] = []
  const err = (code: Diagnostic['code'], where: string, message: string) =>
    diagnostics.push({ severity: 'error', code, where, message })
  const warn = (code: Diagnostic['code'], where: string, message: string) =>
    diagnostics.push({ severity: 'warn', code, where, message })

  const entities = new Map(ontology.entities.map((e) => [e.name, e]))
  const rels = new Map(ontology.relationships.map((r) => [r.name, r]))
  const entity = entities.get(decl.entity)

  if (!entity) {
    err('UNKNOWN_ENTITY', decl.entity, `Ontology declares no entity named "${decl.entity}".`)
    return {
      contract: { entity: decl.entity, label: decl.label ?? decl.entity, actions: [], widgets: {}, uses: [], hooks: {} },
      diagnostics,
      ok: false,
    }
  }

  const props = new Map(entity.properties.map((p) => [p.name, p]))
  const derived = new Map((entity.derived ?? []).map((d) => [d.name, d]))

  // ── Vocabulary declared ahead of the resolver ───────────────────────────
  //
  // ⚠️ These words exist so nobody has to rediscover them; they do NOT exist to
  //    be quietly ignored. An entity that declares `visibility: hidden` and then
  //    sees the property in a table has been misled by its own declaration, and
  //    that is worse than never having had the word.
  //
  //    So each one is reported here until the resolver honours it, at which
  //    point the entry moves out of this list. That is the whole cost of
  //    borrowing the vocabulary whole: a list that shrinks.
  for (const [key, note] of [
    ['status', 'a property on its way out'],
  ] as const) {
    const used = Object.keys(entity[key] ?? {})
    if (used.length > 0) {
      err('NOT_YET_RESOLVED', `${decl.entity}.${key}`,
        `"${key}" (${note}) is declared in the vocabulary but not yet resolved — ` +
        `used on: ${used.join(', ')}.`)
    }
  }

  // ── A limit stated as a view tag ────────────────────────────────────────
  //
  // ⚠️ `typeClasses: { maxLength }` reaches the `<input>` and nothing else: the
  //    browser stops the keystroke, the server stores whatever arrives by any
  //    other road. On the property, the same number is enforced by the write
  //    guard AND carried here. Two slots for one number drift; say which is real.
  for (const [name, tags] of Object.entries(entity.typeClasses ?? {})) {
    const inView = ['minLength', 'maxLength'].filter((k) => (tags as Record<string, unknown>)?.[k] !== undefined)
    if (inView.length > 0) {
      warn('CONSTRAINT_IN_VIEW', `${decl.entity}.typeClasses.${name}`,
        `${inView.join(', ')} declared as a view tag only the browser reads — declare it on the property, ` +
        `where the write guard enforces it too.`)
    }
  }

  // ── Visibility and keys ─────────────────────────────────────────────────
  //
  // ⭐ These two answer, from the ONTOLOGY, the two questions every view file
  //    was answering for itself: which columns are worth showing, and which
  //    property names the record.
  //
  //    Both are properties of the PROPERTY, not of the screen. Three screens
  //    over the same entity used to state them three times and drift apart. Now
  //    a view states them only to OVERRIDE, which is the rare case.
  //
  // ⚠️ `hidden` is not a permission. It keeps a property off the default column
  //    set; it does not stop anyone reading it. Access control lives behind the
  //    read gate with the scope filter — a rule that hides data in the browser
  //    is a rule nobody can enforce.
  const visibility = entity.visibility ?? {}
  /**
   * ⚠️ Order comes from the order of `visibility` itself, not from the order
   *    properties happen to be declared in.
   *
   *    It has to. In practice a table often LEADS with a derived column — the
   *    person a claim belongs to, the unit holding a piece of equipment — and
   *    derived properties are declared in a separate block, after the stored
   *    ones. Any rule of the form "properties first, then derived" puts the
   *    most important column last in exactly the common case.
   *
   *    YAML preserves mapping order and so does JS for string keys, so this is
   *    defined behaviour, not a happy accident. It also means `visibility` says
   *    the set AND the order in one place, which is the whole point.
   */
  const prominent = Object.entries(visibility).filter(([, v]) => v === 'prominent').map(([n]) => n)

  const titleKeys = Object.entries(entity.keys ?? {}).filter(([, k]) => k === 'title').map(([n]) => n)
  if (titleKeys.length > 1) {
    err('AMBIGUOUS_TITLE_KEY', `${decl.entity}.keys`,
      `"${decl.entity}" marks ${titleKeys.length} properties as the title key (${titleKeys.join(', ')}). ` +
      `A record has one name.`)
  }
  for (const name of [...titleKeys, ...prominent]) {
    if (!props.has(name) && !derived.has(name)) {
      err('UNKNOWN_FIELD', `${decl.entity}.keys`,
        `"${decl.entity}" marks "${name}", which it does not have.`)
    }
  }
  const titleKey = titleKeys.find((n) => props.has(n) || derived.has(n))

  /**
   * What a property is called on screen.
   *
   * Falls back to the code name only as a last resort, and says so. A generated
   * label is always worse than a written one, and for users who read Vietnamese
   * it is not merely clumsy — it is English leaking onto the screen.
   */
  const labelOf = (p: PropertyDef, where: string, owner: Entity = entity): string => {
    const declared = owner.labels?.[p.name]
    if (declared) return declared
    warn('MISSING_LABEL', where,
      `"${p.name}" has no label. Declare \`labels.${p.name}\`; falling back to "${humanise(p.name)}".`)
    return humanise(p.name)
  }

  // ── Enum wording ────────────────────────────────────────────────────────
  //
  // Checked in both directions on purpose. A value with no label prints a
  // machine code at a user; a label with no value is wording for something that
  // no longer exists — usually the residue of a rename, and a sign the enum and
  // its wording have started to drift apart.
  const enumOf = (p: PropertyDef, where: string, owner: Entity = entity): EnumValueDecl[] | undefined => {
    if (p.type !== 'enum') return undefined
    const declared = owner.values?.[p.name]
    const codes = p.enumValues ?? []
    if (!declared) {
      err('ENUM_WITHOUT_LABELS', where,
        `"${p.name}" is an enum with no wording. Declare \`values.${p.name}\` so screens `
        + `print words instead of codes like "${codes[0] ?? 'some_code'}".`)
      return codes.map((value) => ({ value, label: value }))
    }
    const known = new Set(declared.map((v) => v.value))
    for (const c of codes) {
      if (!known.has(c)) err('ENUM_VALUE_UNLABELLED', where, `Enum value "${c}" of "${p.name}" has no wording.`)
    }
    for (const v of declared) {
      if (!codes.includes(v.value)) {
        warn('ENUM_LABEL_ORPHAN', where,
          `Wording declared for "${v.value}", which "${p.name}" no longer accepts.`)
      }
    }
    return declared
  }

  // ── Derived properties ──────────────────────────────────────────────────
  //
  // Resolved here, at declaration time, rather than trusted at read time: the
  // relationship must exist, must have this entity at one end, and — for a
  // `linked` property — the far entity must really have the property being
  // shown. Each of these is a failure that would otherwise surface as an empty
  // column in front of a user.
  const resolveDerived = (d: DerivedDecl, where: string): ResolvedField => {
    const counts = d.kind === 'countLinks' || (d.kind === 'aggregate' && d.fn === 'count')
    const field: ResolvedField = {
      key: d.name,
      label: d.label ?? humanise(d.name),
      kind: 'derived',
      derived: d,
      priority: entity.priority?.[d.name] ?? 'normal',
      /* ⚠️ A derived column is NOT sortable unless the ontology says so. It is
         computed by following a link, so ordering by it means pulling the set
         into memory — a sort arrow here offers something the system cannot do,
         and the user finds out by clicking it. */
      ...(entity.sortable?.[d.name] === true ? { sortable: true } : {}),
      ...(decl.widgets?.[`cell.${d.name}`] ? { widget: decl.widgets[`cell.${d.name}`] } : {}),
      // Every aggregate and every arithmetic result is a number, whether or not
      // this resolver can compute it yet.
      ...(counts || d.kind === 'aggregate' || d.kind === 'math' ? { numeric: true } : {}),
    }
    if (!d.label) {
      warn('UNKNOWN_FIELD', where, `Derived property "${d.name}" has no label — falling back to "${field.label}".`)
    }

    // ⚠️ In the vocabulary, not yet in the resolver. Say so — a declaration that
    //    leans on one of these must fail, not render a blank cell that looks
    //    like missing data rather than a missing feature.
    if (d.kind === 'aggregate' && d.fn !== 'count') {
      err('NOT_YET_RESOLVED', where,
        `Derived "${d.name}" uses aggregate "${d.fn}", which is declared in the vocabulary but not yet resolved. ` +
        `Only "count" is implemented; use a bespoke cell until it is.`)
    }
    if (d.kind === 'math') {
      err('NOT_YET_RESOLVED', where,
        `Derived "${d.name}" uses arithmetic, which is declared in the vocabulary but not yet resolved. ` +
        `Use a bespoke cell until it is.`)
      // Check the operands anyway. Unresolved is not the same as unchecked, and
      // the day arithmetic is implemented these spellings should already be right.
      const walk = (node: MathNode) => {
        if (node.of.length < 2) {
          err('UNKNOWN_FIELD', where, `Derived "${d.name}" has an operator "${node.op}" with fewer than two operands.`)
        }
        for (const operand of node.of) {
          if (typeof operand !== 'string') walk(operand)
          else if (!props.has(operand)) {
            err('UNKNOWN_FIELD', where,
              `Derived "${d.name}" computes on "${operand}", which "${entity.name}" does not have.`)
          }
        }
      }
      walk(d)
      return field   // no relationship to follow — `math` stays on one object
    }

    const rel = rels.get(d.via)
    if (!rel) {
      err('UNKNOWN_RELATIONSHIP', where, `Derived "${d.name}" follows "${d.via}", which is not a declared relationship.`)
      return field
    }
    const far = rel.from === entity.name ? rel.to : rel.to === entity.name ? rel.from : null
    if (far === null) {
      err('RELATIONSHIP_WRONG_END', where,
        `Relationship "${d.via}" runs ${rel.from} → ${rel.to}; neither end is "${entity.name}".`)
      return field
    }
    if (d.kind === 'linked') {
      const target = entities.get(far)
      if (target && !target.properties.some((p) => p.name === d.show)) {
        err('UNKNOWN_TARGET_PROPERTY', where, `"${far}" has no property "${d.show}" for derived "${d.name}" to show.`)
      }
      /* ⭐ Which entity the value points AT. The resolver already worked it out
         to check `show`; it simply used to throw the answer away. Without it a
         renderer knows the cell names another record but not which kind, so it
         cannot offer a way to open it — and 70 cross-links get hand-written. */
      field.refEntity = far
    }
    return field
  }

  /**
   * One property of ANY entity, resolved into a field.
   *
   * ⚠️ Takes its owner explicitly. A related list shows columns of the entity on
   *    the OTHER end of a relationship, and reading those from this entity's
   *    metadata would silently label a decision's columns with a member's words.
   */
  const fieldOf = (name: string, owner: Entity, where: string): ResolvedField | null => {
    const p = owner.properties.find((x) => x.name === name)
    if (!p) {
      err('UNKNOWN_FIELD', where, `"${owner.name}" has no property named "${name}".`)
      return null
    }
    const why = UNRENDERABLE[p.type]
    if (why) {
      err('UNRENDERABLE_FIELD', where, `"${name}" is ${p.type}: ${why}.`)
    }
    return {
      key: name,
      label: labelOf(p, where, owner),
      kind: p.type,
      priority: owner.priority?.[name] ?? (owner.keys?.[name] === 'title' ? 'primary' : 'normal'),
      sortable: owner.sortable?.[name] ?? true,
      ...(owner.notes?.[name] ? { note: owner.notes[name] } : {}),
      ...(owner.meanings?.[name] ? { meaning: owner.meanings[name] } : {}),
      ...(owner.typeClasses?.[name] ? { typeClasses: owner.typeClasses[name] } : {}),
      ...constraintsOf(p),
      required: p.required,
      enum: enumOf(p, where, owner),
      ...(isNumeric(p.type) ? { numeric: true } : {}),
    }
  }

  // ── One field, from wherever it is declared ─────────────────────────────
  const field = (name: string, where: string): ResolvedField | null => {
    const d = derived.get(name)
    if (d) return resolveDerived(d, where)

    const p = props.get(name)
    if (!p) {
      err('UNKNOWN_FIELD', where,
        `"${decl.entity}" has no property or derived property named "${name}".`)
      return null
    }
    const why = UNRENDERABLE[p.type]
    if (why) {
      err('UNRENDERABLE_FIELD', where,
        `"${name}" is ${p.type}: ${why}. Use a bespoke block if it really must be shown.`)
    }
    return {
      key: name,
      label: labelOf(p, where),
      kind: p.type,
      /* ⭐ The column that NAMES the record cannot be dropped and leave a table
         of anything, so it starts at `primary` without anyone declaring it. */
      priority: entity.priority?.[name]
        ?? (entity.keys?.[name] === 'title' ? 'primary' : 'normal'),
      /* A stored column is sortable unless the ontology says otherwise. */
      sortable: entity.sortable?.[name] ?? true,
      ...(entity.notes?.[name] ? { note: entity.notes[name] } : {}),
      ...(entity.meanings?.[name] ? { meaning: entity.meanings[name] } : {}),
      ...(entity.typeClasses?.[name] ? { typeClasses: entity.typeClasses[name] } : {}),
      ...(decl.widgets?.[`cell.${name}`] ? { widget: decl.widgets[`cell.${name}`] } : {}),
      ...constraintsOf(p),
      required: p.required,
      enum: enumOf(p, where),
      ...(isNumeric(p.type) ? { numeric: true } : {}),
          }
  }

  const fields = (names: string[], where: string) =>
    names.map((n) => field(n, `${where}.${n}`)).filter((f): f is ResolvedField => f !== null)

  /** A column entry: a name to look up, or a virtual column declared inline. */
  const column = (c: string | { name: string; label: string; widget: string }, where: string) => {
    if (typeof c === 'string') return field(c, `${where}.${c}`)
    if (options.components && !options.components.includes(c.widget)) {
      err('UNKNOWN_WIDGET', `${where}.${c.name}`,
        `Virtual column "${c.name}" names component "${c.widget}", which is not registered.`)
    }
    return { key: c.name, label: c.label, kind: 'derived' as const, widget: c.widget }
  }

  // ── Steps ───────────────────────────────────────────────────────────────
  //
  // A step's form is built from what the step already declares. Measured on a
  // real app, 96% of parameters are typed by something already written down:
  // a property of this entity, a pointer to another record, or a property of
  // the record the step creates. `fields` covers the rest.
  const mine = processes.filter((p) => p.entity === decl.entity)

  /*
    ⭐ WHAT THE DECLARATION ALREADY DECIDED IS NOT A QUESTION FOR THE OPERATOR.

       `decision: { signedBy, legalBasis }` states which authority may sign this
       paper and which citations make it valid. Those used to be free-text boxes
       on the form, and the form asked the operator to retype a fact the
       declaration already held — so a typo produced a record that looked valid
       and failed much later, at a step run by somebody else.

         one allowed value   → the field is FIXED. Nothing to ask; the write side
                               supplies it. Asking invites the one wrong answer.
         several allowed     → the field becomes a CHOICE of exactly those. The
                               operator still decides which use case this is,
                               but cannot invent a value outside the law.

    ⚠️ Only applies to the two named fields, and only when the step declares
       them. A domain that routes the signer by a value on the record (some do —
       one benefit claim is signed at commune level, another at province)
       declares both and keeps the choice.
  */
  const fromDecision = (name: string, t: TransitionDecl): ResolvedField | null => {
    const d = t.decision
    if (!d) return null
    const rule = name === 'signedBy' ? d.signedBy : name === 'legalBasis' ? d.legalBasis : undefined
    if (rule === undefined) return null
    const values = (Array.isArray(rule) ? rule : [rule]).map(String)
    const written = t.creates ? entities.get(t.creates.entity) : undefined
    // The app names these fields, like every other field: a step's `fields: { x: { label } }`
    // first, then the label the decision record declares. The built-in words are only the
    // last resort for an app that said nothing.
    const relabel = t.fields?.[name]?.label
    const declaredLabel = (written as { labels?: Record<string, string> } | undefined)?.labels?.[name]
    const label = relabel ?? declaredLabel ?? (name === 'signedBy' ? 'Người ký' : 'Căn cứ pháp lý')
    if (values.length === 1) {
      return { key: name, label, kind: 'text', fixed: values[0], required: false }
    }
    /*
      ⛔ A CHOICE MUST READ IN WORDS, NOT CODES. `finance_minister` is how the
         store spells it; an officer needs "Bộ trưởng Bộ Tài chính". The wording
         is already declared on the record the step creates — look it up rather
         than let a machine code reach a form.

      ⚠️ A citation is its own wording: "QĐ-78 Đ.7 k2 d" IS the human
         text, so it is left alone when no label exists.
    */
    const wording = (written as { values?: Record<string, Array<{ value: string; label: string }>> } | undefined)
      ?.values?.[name] ?? []
    const say = (v: string) => wording.find((w) => w.value === v)?.label ?? v
    return {
      key: name, label, kind: 'enum',
      enum: values.map((v) => ({ value: v, label: say(v) })),
      required: t.params?.required?.includes(name),
    }
  }

  const pointerField = (name: string, target: string, t: TransitionDecl, label?: string, many?: boolean): ResolvedField => ({
    key: name,
    label: label ?? entities.get(target)!.label,
    kind: 'text',
    refEntity: target,
    ...((many ?? name.endsWith('Ids')) ? { many: true } : {}),
    required: t.params?.required?.includes(name),
  })

  const paramField = (name: string, t: TransitionDecl, where: string): ResolvedField => {
    const decided = fromDecision(name, t)
    if (decided) return decided
    /*
      ⭐ `fields: { x: { label } }` — CHỈ có nhãn — là ĐỔI NHÃN, không phải khai
         kiểu. Kiểu, lựa chọn, ràng buộc vẫn lấy từ chỗ đã khai (thuộc tính của
         thực thể, của bản ghi bước tạo ra, hoặc con trỏ); bước chỉ nói nó gọi
         ô ấy là gì.

      ⛔ TỪNG LÀ LỖI CÂM (đo 1/10/2026, app thật). Nhánh `fields` đứng trước
         nhánh "bản ghi bước tạo ra", nên ba ô `enum` của bản ghi ấy, chỉ khai
         nhãn ở bước, về hợp đồng KHÔNG kiểu, KHÔNG lựa chọn — và không ai kêu.
         Ngược lại, nhãn khai cho thuộc tính của chính thực thể thì bị lờ đi.
    */
    const declared = t.fields?.[name]
    const relabel = declared && Object.keys(declared).every((k) => k === 'label') ? declared.label : undefined

    const own = props.get(name)
    if (own) {
      return {
        key: name, label: relabel ?? labelOf(own, where),
        kind: own.type, required: t.params?.required?.includes(name),
        enum: enumOf(own, where),
        // ⚠️ Carried through so a renderer can act on it. This is the first real
        //    use of the escape valve, and it is the case it was meant for: "this
        //    text field holds a paragraph, not a name" is true of some text
        //    properties and not others, and there is no type that says it.
        //    A tag costs nothing and gathers evidence; a keyword would have been
        //    a design decision taken on one example.
        ...(entity.typeClasses?.[name] ? { typeClasses: entity.typeClasses[name] } : {}),
        ...constraintsOf(own),
      }
    }

    if (declared && relabel === undefined) {
      // ⚠️ Một khoá lạ ở đây phải KÊU, không được lờ.
      //
      //    `typeClasses` từng bị nhận rồi bỏ qua, và biểu mẫu lặng lẽ dựng ra ô
      //    một dòng cho một trường chứa đoạn văn. Người viết khai báo thấy mình
      //    đã nói, khuôn thì không nghe — dạng lỗi tệ nhất, vì cả hai bên đều
      //    tin là xong.
      // ⭐ Con trỏ khai tường minh: `{ ref: Entity, many?, label? }`. Đây là cách
      //    trả lời AMBIGUOUS_POINTER, và giữ nguyên refEntity/many như khi suy.
      if (declared.ref !== undefined) {
        for (const k of Object.keys(declared)) {
          if (!['ref', 'many', 'label'].includes(k)) {
            err('UNKNOWN_KEY', where,
              `Step "${t.action}" field "${name}" is a pointer (\`ref\`); "${k}" does not apply. Known: ref, many, label.`)
          }
        }
        if (!entities.has(declared.ref)) {
          err('UNKNOWN_ENTITY', where,
            `Step "${t.action}" field "${name}" points at "${declared.ref}", which the ontology does not declare.`)
          return { key: name, label: declared.label ?? humanise(name), kind: 'text', required: t.params?.required?.includes(name) }
        }
        return pointerField(name, declared.ref, t, declared.label, declared.many)
      }
      if (declared.type === undefined) {
        err('UNTYPED_PARAM', where,
          `Step "${t.action}" declares field "${name}" with neither \`type\` nor \`ref\`.`)
        return { key: name, label: declared.label ?? humanise(name), kind: 'text', required: t.params?.required?.includes(name) }
      }
      const KNOWN = ['type', 'label', 'typeClasses', 'valueType', 'enumValues', 'valuesOf', 'ref', ...CONSTRAINT_KEYWORDS]
      for (const k of Object.keys(declared)) {
        if (!KNOWN.includes(k)) {
          err('UNKNOWN_KEY', where,
            `Step "${t.action}" declares "${k}" on field "${name}", which this package does not read. ` +
            `Known: ${KNOWN.join(', ')}.`)
        }
      }
      // ⭐ Cùng bộ Value Types với thuộc tính (12/9/2026): một tham số chỉ có
      //    ở bước vẫn là "số tiền" hay "một đoạn văn" như mọi chỗ khác, nên trỏ
      //    tên thay vì chép lại con số. Tên sai hay sai kiểu thì KÊU lúc khởi động.
      let inherited = {}
      if (declared.valueType !== undefined) {
        const vt = ontology.valueTypes?.find((v) => v.name === declared.valueType)
        if (!vt) {
          err('UNKNOWN_VALUE_TYPE', where,
            `Step "${t.action}" field "${name}" names value type "${declared.valueType}", which the ontology does not declare.`)
        } else if (vt.type !== declared.type) {
          err('UNKNOWN_VALUE_TYPE', where,
            `Step "${t.action}" field "${name}" is ${declared.type} but value type "${vt.name}" is ${vt.type}.`)
        } else {
          inherited = constraintsOf(vt).constraints ?? {}
        }
      }
      const own = constraintsOf(declared).constraints ?? {}
      const merged = { ...inherited, ...own }

      // ⭐ Một ô chọn phải nói DANH SÁCH Ở ĐÂU (13/9/2026). Trước đây khuôn không
      //    có chỗ ghi, nên `type: enum` trần đi qua im lặng: không soi được giá
      //    trị nào, và không ai biết là không soi.
      let choices: EnumValueDecl[] | undefined
      if (declared.enumValues !== undefined || declared.valuesOf !== undefined) {
        if (declared.type !== 'enum') {
          err('UNKNOWN_KEY', where,
            `Step "${t.action}" field "${name}" is ${declared.type}; \`enumValues\`/\`valuesOf\` apply only to type enum.`)
        } else if (declared.valuesOf !== undefined) {
          const [ownerName, propName] = declared.valuesOf.split('.')
          const owner = ownerName ? entities.get(ownerName) : undefined
          const source = owner?.properties.find((x) => x.name === propName)
          if (!owner || !source || source.type !== 'enum' || !source.enumValues?.length) {
            err('ENUM_WITHOUT_VALUES', where,
              `Step "${t.action}" field "${name}" takes values of "${declared.valuesOf}", which is not an enum property with values.`)
          } else {
            choices = enumOf(source, where, owner)
          }
        } else if (!Array.isArray(declared.enumValues) || declared.enumValues.length === 0
          || declared.enumValues.some((v) => typeof v !== 'string' || v === '')) {
          err('ENUM_WITHOUT_VALUES', where,
            `Step "${t.action}" field "${name}" declares \`enumValues\` that is not a non-empty list of codes.`)
        } else {
          choices = declared.enumValues.map((value) => ({ value, label: value }))
        }
      } else if (declared.type === 'enum') {
        err('ENUM_WITHOUT_VALUES', where,
          `Step "${t.action}" field "${name}" is an enum with no values — declare \`enumValues\`, or \`valuesOf: Entity.property\`. `
          + 'A list that lives in the store is not an enum: declare `type: catalogue`, or a pointer (`…Id` / `…Ids`).')
      }
      return {
        key: name, label: declared.label ?? humanise(name), kind: declared.type,
        required: t.params?.required?.includes(name),
        ...(choices ? { enum: choices } : {}),
        ...(declared.typeClasses ? { typeClasses: declared.typeClasses } : {}),
        ...(Object.keys(merged).length > 0 ? { constraints: merged } : {}),
      }
    }

    // A property of the record this step creates.
    if (t.creates) {
      const target = entities.get(t.creates.entity)
      const p = target?.properties.find((x) => x.name === name)
      if (p) {
        // ⛔ NHÁNH NÀY TỪNG LÀ CÔNG DÂN HẠNG HAI, VÀ ĐÓ LÀ MỘT LỖI CÂM.
        //
        //    Nó trả về `kind` rồi dừng — không nhãn giá trị, không thẻ. Nên một
        //    thuộc tính `enum` của bản ghi mà bước TẠO RA về tới hợp đồng với
        //    `kind: 'enum'` và không một lựa chọn nào: biểu mẫu sinh ra một ô
        //    chọn RỖNG, đúng kiểu, và không dùng được.
        //
        //    Không ai thấy vì mọi bước đi qua đường này đều đang có biểu mẫu
        //    viết tay, và biểu mẫu viết tay tự cắm sẵn danh sách. Lỗi chỉ lộ ra
        //    lúc bước ấy được sinh — tức đúng lúc muộn nhất.
        //
        //    Một thuộc tính là một thuộc tính. Nó ở trên thực thể nào không đổi
        //    được điều đó, nên hai nhánh phải trả về cùng một thứ.
        return {
          key: name, label: relabel ?? target!.labels?.[name] ?? humanise(name),
          kind: p.type, required: t.params?.required?.includes(name),
          enum: enumOf(p, where, target!),
          ...(target!.typeClasses?.[name] ? { typeClasses: target!.typeClasses[name] } : {}),
          ...constraintsOf(p),
        }
      }
    }

    // A pointer to another record: `unitId` → StaffUnit, `unitIds` → many.
    /*
      ⛔ TỪNG CHỌN THEO THỨ TỰ KHAI BÁO (1/10/2026). `find` lấy thực thể ĐẦU TIÊN
         có tên chứa gốc từ, nên tách ontology thành nhiều tệp — chỉ đổi thứ tự —
         làm 22/113 con trỏ của một app thật lặng lẽ trỏ sang thực thể khác
         (`memberId`: StaffMember → MemberBadge). Không gì kêu.

      ⭐ Giờ chỉ suy khi KHÔNG CÒN CÁCH HIỂU NÀO KHÁC, còn lại thì KÊU:
           · đúng một thực thể có tên chứa gốc từ → chọn nó;
           · nhiều thực thể, mà đúng một trùng NGUYÊN tên → chọn nó;
           · còn lại → AMBIGUOUS_POINTER, kèm ứng viên và cách khai `ref`.

      ⛔ KHÔNG đoán thông minh hơn. Đã đo trên app thật (1/10/2026) một cách đoán
         theo danh từ chính + quan hệ khai báo: hết phụ thuộc thứ tự, nhưng 19
         con trỏ vẫn lặng lẽ đổi đích, có chỗ sai rõ (`planId` → BudgetPlan thay
         vì PlanDocument). Đoán khéo hơn chỉ là sai im lặng theo kiểu khác; chỗ
         mơ hồ phải do người khai trả lời, một lần, bằng `ref`.
    */
    const base = name.endsWith('Ids') ? name.slice(0, -3) : name.endsWith('Id') ? name.slice(0, -2) : null
    if (base) {
      const b = base.toLowerCase()
      const pool = [...entities.keys()].filter((e) => e.toLowerCase().includes(b)).sort()
      const exact = pool.filter((e) => e.toLowerCase() === b)
      const target = pool.length === 1 ? pool[0] : exact.length === 1 ? exact[0] : undefined
      if (target) return pointerField(name, target, t, relabel)
      if (pool.length > 1) {
        err('AMBIGUOUS_POINTER', where,
          `Step "${t.action}" takes "${name}", which could point at ${pool.join(', ')}. `
          + `Say which: \`fields: { ${name}: { ref: ${pool[0]} } }\`.`)
        return { key: name, label: relabel ?? humanise(name), kind: 'text', required: t.params?.required?.includes(name) }
      }
    }

    err('UNTYPED_PARAM', where,
      `Step "${t.action}" takes "${name}", which is not a property of ${decl.entity}, `
      + `not a property of anything it creates, and not a pointer. `
      + (relabel !== undefined
        ? `Its \`fields\` entry gives only a label — add \`type\` (or \`ref\`).`
        : `Declare it under \`fields\`.`))
    return { key: name, label: relabel ?? humanise(name), kind: 'text' }
  }

  /*
    ⭐ THE FOUR GATE FAMILIES, FOLDED INTO ONE SHAPE — see `ResolvedGate`.

    ⚠️ ORDER IS THE DECLARATION'S, not this function's. A step usually has one
       gate; where it has two, the one written first is the one the domain
       thought of first, and a renderer listing reasons should say them in that
       order rather than in whatever order this file happens to test them.
  */
  const gatesOf = (t: TransitionDecl): ResolvedGate[] => {
    const out: ResolvedGate[] = []
    if (t.needsDecision?.via) {
      out.push({ kind: 'decision', via: t.needsDecision.via, ...(t.needsDecision.is ? { is: t.needsDecision.is } : {}) })
    }
    if (t.requiresApproval?.relationship) {
      out.push({
        kind: 'decision',
        via: t.requiresApproval.relationship,
        ...(t.requiresApproval.decision ? { is: t.requiresApproval.decision } : {}),
      })
    }
    // One gate per fact, in declared order — a list is several waits, each nameable on its own.
    for (const g of [t.requiresFact ?? []].flat()) {
      if (g?.property) out.push({ kind: 'fact', via: g.property, ...(g.message ? { message: g.message } : {}) })
    }
    /* ⚠️ TWO SPELLINGS, ONE IDEA. `@dqa-ai-solutions/workflow-process` accepts `via` or
       `relationship` on a link gate, and both are in use. Reading one and
       ignoring the other would drop half the link gates in silence — which is
       exactly the class of bug this whole field exists to end. */
    const linkVia = t.requiresLink?.via ?? t.requiresLink?.relationship
    if (linkVia) {
      out.push({ kind: 'link', via: linkVia, ...(t.requiresLink?.message ? { message: t.requiresLink.message } : {}) })
    }
    return out
  }

  const actions: ResolvedAction[] = []
  for (const proc of mine) {
    for (const t of proc.transitions) {
      const names = [...(t.params?.required ?? []), ...(t.params?.optional ?? [])]
        // The target id names the record being acted on; it is context, not a
        // field for a person to fill in.
        .filter((n) => n !== t.params?.target)
      const waitsOn = gatesOf(t)
      actions.push({
        action: t.action,
        label: t.label,
        from: t.from,
        to: t.to,
        /* ⛔ The seam between lines. Without it a four-line entity's steps arrive
           as one flat list and any route drawn from them is a route through four
           processes at once. See `ResolvedAction.process`. */
        process: proc.process,
        role: proc.roles[t.role] ?? t.role,
        source_ref: t.source_ref,
        fields: names.map((n) => paramField(n, t, `${proc.process}.${t.action}.${n}`)),
        widget: decl.widgets?.[`action.${t.action}`],
        /* ⭐ Both declared in the process and, until now, dropped on the floor.
           An application was grafting `provisional` back onto the contract by
           hand after every load, because a warning that never reaches a screen
           is a warning that does not exist. */
        outcome: t.decision?.outcome,
        /* ⭐ `settles` and `waitsOn` are the two halves of the same sentence:
           this step opens gate X, those steps wait on gate X. Carrying one
           without the other buys nothing — a wait nobody can trace to its
           opener still cannot be named on a screen. */
        ...(t.decision?.via ? { settles: t.decision.via } : {}),
        ...(waitsOn.length ? { waitsOn } : {}),
        provisional: t.provisional,
        ...(t.task ? { task: t.task } : {}),
      })
      /* ⭐ A bespoke form for a step nobody does on a screen is either dead code or a declaration
         that is wrong about the step — either way, somebody has to look. */
      if (t.task?.category === 'system' && decl.widgets?.[`action.${t.action}`]) {
        warn('SCREEN_FOR_SYSTEM_STEP', `widgets.action.${t.action}`,
          `"${t.action}" is declared as done by the software on its own (\`task.category: system\`), yet it has a hand-written screen.`)
      }
      /* `reads` names what a person must SEE — it must be something this entity has, or the screen
         has nothing to show. Checked here, not in business-workflow, because only here is the
         ontology in reach. */
      for (const f of t.task?.reads ?? []) {
        if (typeof f === 'string' && !props.has(f)) {
          err('TASK_SHAPE', `${proc.process}.${t.action}.task.reads`,
            `"${t.action}" says the person must see "${f}", which "${decl.entity}" does not have.`)
        }
      }
    }
  }
  /* ⭐ ONE CHECK, OWNED BY THE VOCABULARY'S OWNER. The shape rules live in `@dqa-ai-solutions/workflow-process`
     so an app that loads processes without views gets the same answer as one that renders them. */
  for (const f of checkTaskShape(mine as unknown as Process[])) {
    err('TASK_SHAPE', `${f.process}.${f.at}`, `${f.problem} — ${f.fix}`)
  }

  /**
   * Collections hanging off this record.
   *
   * ⚠️ Follows a DECLARED RELATIONSHIP, never a free-text table name. That is
   *    the whole guard: a declaration cannot invent a link the ontology does not
   *    have, and cannot survive a rename of one it does.
   */
  /* ⚠️ A `const` arrow, not a `function`. A hoisted declaration does not inherit
     the narrowing that an early return already established for `entity`, so the
     same code failed to compile purely because of where the keyword put it. */
  const resolveRelated = (list: NonNullable<NonNullable<ViewDecl['detail']>['related']>) =>
    list.flatMap((r) => {
      const where = `detail.related.${r.name}`
      const rel = rels.get(r.via)
      if (!rel) {
        err('UNKNOWN_RELATIONSHIP', where,
          `"${r.name}" follows "${r.via}", which is not a declared relationship.`)
        return []
      }
      const far = rel.from === entity.name ? rel.to : rel.to === entity.name ? rel.from : null
      if (far === null) {
        err('RELATIONSHIP_WRONG_END', where,
          `Relationship "${r.via}" runs ${rel.from} → ${rel.to}; neither end is "${entity.name}".`)
        return []
      }
      const target = entities.get(far)
      if (!target) {
        err('UNKNOWN_ENTITY', where, `"${r.via}" points at "${far}", which the ontology does not declare.`)
        return []
      }
      /* Left out, the columns are what the related entity marks prominent —
         the same rule a list uses, so one entity does not answer "worth showing"
         twice and drift. */
      const names = r.columns?.length
        ? r.columns
        : target.properties
          .filter((prop) => target.visibility?.[prop.name] === 'prominent')
          .map((prop) => prop.name)
      if (!names.length) {
        warn('NO_COLUMNS', where,
          `"${r.name}" shows records of "${far}", and nothing says which columns — `
          + `name them, or mark properties of "${far}" \`visibility: prominent\`.`)
      }
      return [{
        name: r.name,
        via: r.via,
        label: r.label,
        entity: far,
        columns: names
          .map((n) => fieldOf(n, target, `${where}.${n}`))
          .filter((f): f is ResolvedField => f !== null),
        ...(r.when ? { when: r.when } : {}),
      }]
    })

  // ── Bespoke blocks ──────────────────────────────────────────────────────
  const widgets = decl.widgets ?? {}
  for (const [slot, component] of Object.entries(widgets)) {
    if (/\[\d+\]|\.\d+$|after:|before:/.test(slot)) {
      err('POSITIONAL_SLOT', slot,
        `Slot "${slot}" looks positional. Slots must be names the renderer publishes, `
        + `so that moving the shared layout cannot silently detach a block.`)
    } else if (options.slots && !options.slots.includes(slot)
               && !slot.startsWith('action.') && !slot.startsWith('cell.')) {
      err('UNKNOWN_WIDGET', slot, `No slot named "${slot}". Known: ${options.slots.join(', ')}.`)
    }
    if (options.components && !options.components.includes(component)) {
      err('UNKNOWN_WIDGET', slot, `Slot "${slot}" names component "${component}", which is not registered.`)
    }
  }
  // ── How much of this entity has fallen off the lens ─────────────────────
  //
  // ⚠️ Counted PER KIND, and that correction came from using it.
  //
  //    The first version counted every bespoke block together and warned past a
  //    flat cap. It then fired on an entity with one bespoke cell and two
  //    bespoke step forms — four of whose six steps were generated, and whose
  //    table was entirely on the lens. Nothing was wrong; the measure was.
  //
  //    The three kinds answer three different questions, and adding them up
  //    answers none:
  //
  //      cell.*    → the TABLE does not fit this entity
  //      action.*  → the DIALOG GENERATOR does not fit this entity
  //      slots     → the PAGE needs more than the lens gives it
  //
  //    An entity may be completely at home in the shared table while two of its
  //    steps need hand-written forms. Summing the two turns a healthy screen
  //    into a warning, and a warning that fires on healthy screens is a warning
  //    people learn to scroll past.
  const cap = options.maxWidgets ?? Infinity
  const kindOf = (slot: string) =>
    slot.startsWith('cell.') ? 'bespoke cells'
      : slot.startsWith('action.') ? 'bespoke step forms'
        : 'bespoke page blocks'
  //
  // ⚠️ COUNT DISTINCT COMPONENTS, not declarations — the second correction to
  //    this measure in one day.
  //
  //    Two steps pointing at the SAME hand-written form are not two things that
  //    fell off the lens; they are one thing, shared. An entity whose four-eyes
  //    check serves both its approval branches is BETTER off than one with two
  //    separate forms, and the old count called it worse.
  //
  //    What this is trying to measure is how much bespoke SURFACE an entity
  //    carries. Surface is components. Declarations are just where they are
  //    pointed.
  const byKind: Record<string, Set<string>> = {}
  for (const [slot, component] of Object.entries(widgets)) {
    ;(byKind[kindOf(slot)] ??= new Set()).add(component)
  }
  for (const [kind, set] of Object.entries(byKind)) {
    const n = set.size
    if (n > cap) {
      warn('TOO_MANY_WIDGETS', decl.entity,
        `${n} distinct ${kind} (cap ${cap}): ${[...set].join(', ')}. Either this shape has repeated `
        + `often enough to belong in the shared lens, or this entity wants a screen of its own.`)
    }
  }

  // ── App extension points ────────────────────────────────────────────────
  //
  // The kernel does exactly one thing here: check the name exists. It never
  // calls these, never knows what they compute, never sees their result. That
  // boundary is the whole reason they can hold domain logic at all.
  const uses = decl.uses ?? []
  for (const name of uses) {
    if (options.data && !options.data.includes(name)) {
      err('UNKNOWN_DATA', `uses.${name}`,
        `The screen wants data called "${name}", which the app does not supply. `
        + `Known: ${options.data.join(', ') || '(none registered)'}.`)
    }
  }

  const hooks = decl.hooks ?? {}
  for (const [key, name] of Object.entries(hooks)) {
    if (!key.startsWith('after.')) {
      err('UNKNOWN_HOOK', key, `Hook "${key}" is not addressed; only \`after.<step>\` exists.`)
    } else if (!actions.some((a) => a.action === key.slice('after.'.length))) {
      err('UNKNOWN_HOOK', key, `Hook "${key}" names a step this entity has no transition for.`)
    }
    if (options.hooks && !options.hooks.includes(name)) {
      err('UNKNOWN_HOOK', key, `Hook "${key}" names "${name}", which the app has not registered.`)
    }
  }

  // ── States ──────────────────────────────────────────────────────────────
  const proc = mine[0]
  const stateProp = proc ? props.get(proc.stateProperty) : undefined
  const stateWording = stateProp ? enumOf(stateProp, `${decl.entity}.${proc!.stateProperty}`) : undefined
  const toneOf = (name: string) => stateWording?.find((v) => v.value === name)?.tone
  const toned = (s: ProcessDecl['states'][number]) => ({ ...s, tone: toneOf(s.name) })

  /*
    ⭐ EVERY LINE'S STATES, AS TWO DIFFERENT ANSWERS TO TWO DIFFERENT QUESTIONS.

    `lines` keeps each line whole and in declared order — the only thing a route
    can be drawn from. `allStates` is the union for looking a state UP, where
    order across lines has no meaning and never did.

    ⛔ THE UNION USED TO BE THE APPLICATION'S JOB. It read the same YAML a second
       time after every load to put back the states this resolver had dropped,
       because `mine[0]` is one line and a four-line entity has three more. Two
       readers of one file is two things to drift, and the drift showed up as
       "unknown state: CO_SIGNED" on a screen.

    ⚠️ FIRST DECLARATION OF A NAME WINS. Lines that share a state share its
       wording — the loader already refuses two labels for one name — so a later
       line cannot quietly relabel an earlier one's state.
  */
  const lines = mine.map((p) => ({
    process: p.process,
    stateProperty: p.stateProperty,
    states: p.states.map(toned),
    ...(p.readers ? { readers: Object.fromEntries(Object.entries(p.readers).map(([st, who]) => [st, (Array.isArray(who) ? who : []).map((r) => p.roles[r] ?? r)])) } : {}),
  }))
  const allStates = proc
    ? [...new Map(lines.flatMap((l) => l.states).map((s) => [s.name, s])).values()]
    : undefined

  const listDecl = decl.list
  const rowDecl = decl.row

  /**
   * Columns: what the view names, else what the ontology calls prominent.
   *
   * ⚠️ Empty is an ERROR, not an empty table. A list with no columns is never
   *    what anyone meant — it is either a view that forgot to say, or an entity
   *    where nobody ever marked a property prominent. Both need saying out loud.
   */
  const columnNames = listDecl?.columns ?? prominent
  if (listDecl && columnNames.length === 0) {
    err('NO_COLUMNS', 'list',
      `"${decl.entity}" has a list but no columns: the view names none, and no property is marked `
      + `\`visibility: prominent\`. One of the two has to say something.`)
  }
  // A view that explicitly asks for a hidden property gets it — with a note.
  // Overriding is allowed; doing it by accident is what this catches.
  for (const c of listDecl?.columns ?? []) {
    const name = typeof c === 'string' ? c : c.name
    if (visibility[name] === 'hidden') {
      warn('HIDDEN_SHOWN', 'list',
        `"${name}" is marked \`visibility: hidden\` but this list names it as a column.`)
    }
  }

  /** The identity cell: what the view names, else the title key. */
  const mainName = listDecl?.main ?? titleKey
  const rowMainName = rowDecl?.main ?? titleKey
  if (rowDecl && !rowMainName) {
    err('NO_TITLE_KEY', 'row.main',
      `A work-queue row needs the record's name: either declare \`row.main\`, or mark a property `
      + `\`keys: title\` on "${decl.entity}".`)
  }

  return {
    contract: {
      entity: decl.entity,
      label: decl.label ?? entity.label,
      sub: decl.sub,
      cluster: decl.cluster,
      stateProperty: proc?.stateProperty,
      states: allStates,
      ...(lines.length ? { lines } : {}),
      list: listDecl && {
        columns: columnNames.map((c) => column(c, 'list')).filter((f): f is ResolvedField => f !== null),
        // Resolved even when not among `columns` — a subtitle field usually is not.
        main: mainName ? field(mainName, 'list.main') ?? undefined : undefined,
        sub: listDecl.sub ? field(listDecl.sub, 'list.sub') ?? undefined : undefined,
        search: listDecl.search ?? [],
        sort: listDecl.sort ?? [],
      },
      detail: decl.detail && {
        facts: fields(decl.detail.facts, 'detail'),
        ...(decl.detail.related?.length
          ? { related: resolveRelated(decl.detail.related) }
          : {}),
      },
      row: rowDecl
        ? {
            main: (rowMainName ? field(rowMainName, 'row.main') : null)
              ?? { key: rowMainName ?? '', label: rowMainName ?? '', kind: 'text' },
            sub: rowDecl.sub ? field(rowDecl.sub, 'row.sub') ?? undefined : undefined,
            badge: rowDecl.badge ? field(rowDecl.badge, 'row.badge') ?? undefined : undefined,
          }
        : undefined,
      actions,
      widgets,
      uses,
      hooks,
    },
    diagnostics,
    ok: !diagnostics.some((d) => d.severity === 'error'),
  }
}

/** Format diagnostics for a build check. */
export function formatDiagnostics(ds: Diagnostic[]): string {
  if (ds.length === 0) return 'no findings'
  return ds
    .map((d) => `${d.severity === 'error' ? '✖' : '⚠'} [${d.code}] ${d.where}: ${d.message}`)
    .join('\n')
}
