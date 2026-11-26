// Bind — pack khai VAI, app giữ TỪ VỰNG. §D.
//
// ⭐ Kiểm LÚC KHỞI ĐỘNG, không lúc chạy. Việc duy nhất tầng này làm là biến
//    "màn hình lặng lẽ mất một con số" thành "máy chủ không khởi động được".
//    Cùng nguyên tắc đã chạy thật ở app tham chiếu.

import { ROLES, type Role, type DocTypeExpectation, type Violation } from './types.js'
import { type Measure } from './types.js'
import { checkMeasureShape } from './measure.js'
import { SLOTS, migrationHint, type FieldLens, type ValueLens, type RoleLens } from './contract.js'
import { Lens } from './lens.js'

/** Hình dạng tối thiểu của ontology mà pack cần biết để chấm bind. */
export interface SchemaView {
  /** `properties` không bắt buộc — thiếu thì bỏ qua phép chấm "ô có thật không". */
  entityTypes: ReadonlyArray<{ name: string; properties?: ReadonlyArray<{ name: string }> }>
  relationshipTypes: ReadonlyArray<{ name: string; from: string; to: string; cardinality: string }>
}

export interface CascadeDecl {
  bind: Partial<Record<Role, string>>
  /** ⭐ Tầng ②: vai Ô. `fields.Target.baselineQty = 'assignedQty'`. */
  fields?: Partial<Record<Role, FieldLens>>
  /** ⭐ Tầng ②: vai GIÁ TRỊ, cho phép nhiều-về-một. */
  values?: Partial<Record<Role, ValueLens>>
  edges: Record<string, string>
  /** Cạnh bằng chứng cho lối `derived` — khoá là tên vai cạnh app khai ở `Measure.evidence`. */
  evidence?: Record<string, string>
  measures?: Record<string, Omit<Measure, 'key'>>
  docTypes?: Record<string, DocTypeExpectation>
  /** Miền cho phép giao vượt có kiểm soát. Mặc định: không. */
  allowOverAllocation?: boolean
}

/** Cạnh bắt buộc và vai hai đầu của nó. `Actual` là vai duy nhất được phép vắng. */
const REQUIRED_EDGES: Array<{ key: string; from: Role; to: Role }> = [
  { key: 'answers',         from: 'Commitment', to: 'Mandate' },
  { key: 'targetOf',        from: 'Target',     to: 'Commitment' },
  { key: 'allocatesTarget', from: 'Allocation', to: 'Target' },
  { key: 'allocatedTo',     from: 'Allocation', to: 'Unit' },
  // ⭐ Mắt xích nối HAI CẤP. Không có nó thì I2 không chấm được bằng máy và
  //    phép gộp không đi xuống được — fit-log §M F2.
  { key: 'fulfils',         from: 'Target',     to: 'Allocation' },
]

/**
 * ⭐ CẠNH TUỲ CHỌN — khai thì được thêm phép chấm, không khai thì mất đúng phép ấy.
 *
 *   Thêm 5/9/2026 cho I2. Hai cạnh này cho phép pack SUY nguồn gốc của một chỉ
 *   tiêu thay vì hỏi ô `selfExecuted`: đi từ chỉ tiêu về mệnh lệnh chủ, rồi hỏi
 *   mệnh lệnh ấy có do một lần giao đẻ ra không.
 *
 * ⛔ CỐ Ý KHÔNG BẮT BUỘC. Bắt buộc là làm gãy mọi app đã bind — và với app chỉ
 *    có một cấp thì hai cạnh này vô nghĩa thật.
 */
const OPTIONAL_EDGES: Array<{ key: string; from: Role; to: Role; degrades: string }> = [
  { key: 'raises', from: 'Allocation', to: 'Mandate',
    degrades: 'I2 phải tin ô `selfExecuted` thay vì suy từ đồ thị — và ô ấy là chỗ dễ bind nhầm nhất' },
  { key: 'targetOfMandate', from: 'Target', to: 'Mandate',
    degrades: 'I2 không đi được từ chỉ tiêu về mệnh lệnh chủ, nên không suy được nguồn gốc' },
]

export interface Bound {
  decl: CascadeDecl
  entityOf: (r: Role) => string
  /** Thấu kính cho từng vai — chỗ duy nhất biết ô của app tên gì. */
  lensOf: (r: Role) => Lens
  /** Tên vai cạnh bằng chứng đã bind thật — dùng cho I8 ②. */
  boundEvidence: ReadonlySet<string>
}

/**
 * ⭐ Tầng ② + ③: chấm vai Ô.
 *
 * Ô BẮT BUỘC thiếu → dừng, kèm gợi ý di trú. Ô TUỲ CHỌN thiếu → **không dừng**,
 * chỉ tắt tính năng phụ thuộc vào nó. Nhờ vậy app dùng được engine từng phần.
 */
export function checkFields(decl: CascadeDecl, schema: SchemaView): Violation[] {
  const v: Violation[] = []
  const propsOf = new Map(schema.entityTypes.map((e) => [e.name, new Set((e.properties ?? []).map((p) => p.name))]))

  for (const [role, specs] of Object.entries(SLOTS)) {
    const entity = decl.bind[role as Role]
    if (!entity) continue // vai chưa bind — đã báo ở checkBindings, không báo hai lần
    const lens: FieldLens = decl.fields?.[role as Role] ?? {}
    for (const spec of specs) {
      const appField = lens[spec.slot]
      if (!appField) {
        if (spec.required) {
          v.push({ code: 'BIND_INVALID', subject: `${role}.${spec.slot}`,
            message: `Vai ${role} thiếu ô bắt buộc "${spec.slot}". ` + migrationHint(role, spec, entity) })
        }
        continue
      }
      const props = propsOf.get(entity)
      // Lược đồ không kê thuộc tính thì không chấm được — bỏ qua, không đoán.
      if (props && props.size > 0 && !props.has(appField)) {
        v.push({ code: 'BIND_INVALID', subject: `${role}.${spec.slot}`,
          message: `Vai ${role}.${spec.slot} ánh xạ vào "${entity}.${appField}" — thực thể ấy không có ô nào tên vậy` })
      }
    }
  }
  return v
}

/** Ô tuỳ chọn app không khai — không phải lỗi, nhưng phải nói ra là tắt cái gì. */
export function degradations(decl: CascadeDecl): string[] {
  const out: string[] = []
  for (const [role, specs] of Object.entries(SLOTS)) {
    if (!decl.bind[role as Role]) continue
    const lens: FieldLens = decl.fields?.[role as Role] ?? {}
    for (const spec of specs) {
      if (!spec.required && !lens[spec.slot] && spec.degrades) {
        out.push(`${role}.${spec.slot} không khai → ${spec.degrades}`)
      }
    }
  }
  for (const opt of OPTIONAL_EDGES) {
    if (!decl.edges?.[opt.key]) out.push(`cạnh ${opt.key} không khai → ${opt.degrades}`)
  }
  return out
}

/**
 * Chấm một khai báo bind với lược đồ của app. Trả danh sách vi phạm — báo HẾT một
 * lượt, không ném ở cái sai đầu tiên: người sửa cấu hình cần thấy cả rổ.
 */
export function checkBindings(decl: CascadeDecl, schema: SchemaView): Violation[] {
  const v: Violation[] = []
  const bad = (message: string, subject = '') => v.push({ code: 'BIND_INVALID', subject, message })
  const entities = new Set(schema.entityTypes.map((e) => e.name))
  const rels = new Map(schema.relationshipTypes.map((r) => [r.name, r]))

  for (const role of ROLES) {
    const name = decl.bind[role]
    // ⭐ `Actual` được phép VẮNG — app chỉ dùng lối `derived` thì đếm cạnh, không
    //    cần bảng nào. Nhưng KHAI RỒI thì chấm như mọi vai khác: sửa 5/9/2026.
    //    Trước đây `continue` sớm bỏ qua cả trường hợp app đã bind vào một thực
    //    thể KHÔNG TỒN TẠI — vai duy nhất được phép vắng hoá ra là vai duy nhất
    //    không ai chấm.
    if (role === 'Actual' && !name) continue
    if (!name) { bad(`Vai "${role}" chưa bind vào thực thể nào`, role); continue }
    if (!entities.has(name)) bad(`Vai "${role}" bind vào "${name}" — không có thực thể ấy trong ontology`, role)
  }

  for (const req of REQUIRED_EDGES) {
    const relName = decl.edges[req.key]
    if (!relName) { bad(`Cạnh "${req.key}" chưa khai`, req.key); continue }
    const rel = rels.get(relName)
    if (!rel) { bad(`Cạnh "${req.key}" trỏ vào quan hệ "${relName}" không có trong ontology`, req.key); continue }
    const from = decl.bind[req.from], to = decl.bind[req.to]
    // Chấp nhận cả hai chiều: app đặt chiều theo nghiệp vụ của nó, không theo pack.
    const straight = rel.from === from && rel.to === to
    const reverse = rel.from === to && rel.to === from
    if (from && to && !straight && !reverse) {
      bad(`Cạnh "${req.key}" (${relName}) nối ${rel.from} → ${rel.to}, `
        + `nhưng vai đòi ${from} ↔ ${to}`, req.key)
    }
  }

  // ⭐ Cạnh tuỳ chọn: KHÔNG khai thì thôi, khai rồi thì chấm như cạnh bắt buộc.
  //    Cùng lẽ với vai `Actual` — thứ được phép vắng vẫn phải đúng khi có mặt.
  for (const opt of OPTIONAL_EDGES) {
    const relName = decl.edges[opt.key]
    if (!relName) continue
    const rel = rels.get(relName)
    if (!rel) { bad(`Cạnh "${opt.key}" trỏ vào quan hệ "${relName}" không có trong ontology`, opt.key); continue }
    const from = decl.bind[opt.from], to = decl.bind[opt.to]
    const straight = rel.from === from && rel.to === to
    const reverse = rel.from === to && rel.to === from
    if (from && to && !straight && !reverse) {
      bad(`Cạnh "${opt.key}" (${relName}) nối ${rel.from} → ${rel.to}, `
        + `nhưng vai đòi ${from} ↔ ${to}`, opt.key)
    }
  }

  for (const [key, relName] of Object.entries(decl.evidence ?? {})) {
    if (!rels.has(relName)) bad(`Cạnh bằng chứng "${key}" trỏ vào quan hệ "${relName}" không có trong ontology`, key)
  }

  v.push(...checkFields(decl, schema))

  for (const [key, m] of Object.entries(decl.measures ?? {})) {
    v.push(...checkMeasureShape({ ...m, key }))
    // Thước đếm-từ-cạnh phải nêu bằng chứng ĐÃ BIND, không chỉ nêu tên suông.
    for (const e of m.source === 'derived' ? (m.evidence ?? []) : []) {
      if (!(decl.evidence ?? {})[e]) {
        v.push({ code: 'DEAD_TARGET', subject: key,
          message: `Thước "${key}" cần bằng chứng "${e}" nhưng cạnh ấy chưa bind — mọi chỉ tiêu theo thước này sẽ chết` })
      }
    }
    // ⭐ VẾ ĐỐI XỨNG — thêm 5/9/2026. Thước BÁO-LÊN phải có chỗ chở số báo, y như
    //    thước đếm-từ-cạnh phải có cạnh. Thiếu vế này thì `reported` là lối duy
    //    nhất đi qua khởi động mà chết lúc chạy: app tham chiếu khai bốn thước
    //    `reported`, bind xanh, và bốn cột "đã đạt" đứng ở 0 vĩnh viễn cho tới
    //    khi ai đó bấm nút và đọc *"kho chưa khai chỗ ghi số đạt"*.
    if (m.source === 'reported' && !decl.bind.Actual) {
      v.push({ code: 'DEAD_TARGET', subject: key,
        message: `Thước "${key}" nhận số do người báo nhưng vai "Actual" chưa bind — `
          + 'không có chỗ ghi số đạt, mọi chỉ tiêu theo thước này sẽ đứng ở 0' })
    }
  }
  return v
}

/** Chấm rồi trả về bộ bind dùng được. Ném khi có vi phạm — máy chủ không khởi động. */
export function bindOrThrow(decl: CascadeDecl, schema: SchemaView): Bound {
  const v = checkBindings(decl, schema)
  if (v.length) {
    throw new Error(
      `Khai báo cascade không dùng được (${v.length} lỗi):\n`
      + v.map((x) => `  · [${x.code}] ${x.subject ? x.subject + ': ' : ''}${x.message}`).join('\n'))
  }
  const lenses = new Map<Role, Lens>()
  for (const role of Object.keys(SLOTS) as Role[]) {
    const rl: RoleLens = { fields: decl.fields?.[role] ?? {}, values: decl.values?.[role] }
    lenses.set(role, new Lens(rl))
  }
  return {
    decl,
    entityOf: (r) => decl.bind[r]!,
    lensOf: (r) => {
      const l = lenses.get(r)
      if (!l) throw new Error(`Vai "${r}" không có thấu kính — vai này không khai ô nào ở SLOTS`)
      return l
    },
    boundEvidence: new Set(Object.keys(decl.evidence ?? {})),
  }
}
