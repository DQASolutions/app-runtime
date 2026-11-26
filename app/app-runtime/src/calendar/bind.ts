// Khai báo phía app, và phép kiểm nó — LÚC KHỞI ĐỘNG, không lúc chạy.
//
// ⭐ Cùng lẽ với `bind.ts` của cascade-ledger: sai khai báo là sai cấu hình, mà
//    sai cấu hình phải nổ lúc dựng chứ không phải lúc một cán bộ mở màn hình.
//
// ⛔ VÀ ĐÂY LÀ CHỖ ĐẮT NHẤT CỦA CẢ GÓI, nên nói rõ: `whenState` là thứ giữ cho
//    cái lịch còn đáng tin. Một đợt huấn luyện còn ở dự thảo mà đã chiếm giờ của
//    năm người thì tuần sau không ai tin cái lịch nữa, và họ quay về sổ giấy.

import type { Recurrence, Role, SourceRecord } from './types.js'
import { SLOTS, degradations, requiredSlots } from './contract.js'

/** Một thực thể của app đóng vai `Source`, kèm ánh xạ ô. */
export interface SourceDecl {
  /** Tên thực thể trong ontology của APP. */
  entity: string
  /** Nhóm để lọc và tô màu. Engine không biết nghĩa của nhóm. */
  kind: string
  /** Ô của app đóng vai ô của engine: `{ from: 'startDate', title: 'eventName' }`. */
  fields: Record<string, string>
  /**
   * Chặng nào thì CHIẾM GIỜ. Bỏ trống là mọi chặng đều chiếm.
   *
   * ⚠️ Bỏ trống hầu như luôn sai. Xem khối đầu tệp.
   */
  whenState?: string[]
  /** Việc cả ngày — vẽ trên dải đầu ngày, không xếp theo giờ. */
  allDay?: boolean
}

export interface RosterDecl {
  entity: string
  fields: Record<string, string>
  /**
   * Chặng nào thì sổ đã hiệu lực.
   *
   * ⛔ Bỏ trống là mọi sổ đều hiệu lực, kể cả bản còn dự thảo — và một danh sách
   *    trực dự thảo hiện trên lịch là cách chắc chắn nhất để hai người cùng
   *    tưởng mình không phải trực.
   */
  whenState?: string[]
}

export interface ShiftDecl {
  entity: string
  fields: Record<string, string>
  /** Các loại ca, và luật lặp sinh ra chúng. */
  kinds: Record<string, Recurrence>
  /**
   * Ai KHÔNG vào lượt luân phiên của một loại ca.
   *
   * ⭐ Luật loại trừ là tri thức của app, không của engine: *"nhân viên nghỉ thai sản, lái
   *    xe, nhân viên văn thư không đảm nhiệm trực ban"* là một câu của một cơ
   *    quan cụ thể. Engine chỉ nhận một danh sách người và bỏ họ ra.
   */
  excluded?: Record<string, string[]>
  /**
   * Vai gắn cho từng loại ca. Không khai thì lấy chính tên loại ca.
   *
   * ⚠️ Ca trực đã biết đích danh NGƯỜI, nên vai ở đây dùng để lọc và tô màu chứ
   *    không để tra người — khác hẳn vai của một hồ sơ `Source`.
   */
  roles?: Record<string, string>
}

export interface EntryDecl {
  entity: string
  fields: Record<string, string>
}

export interface CalendarDecl {
  sources: SourceDecl[]
  roster?: RosterDecl
  shift?: ShiftDecl
  entry?: EntryDecl
}

/** Lược đồ app, ở mức engine cần: tên thực thể và tên ô. */
export interface SchemaView {
  entityTypes: { name: string; properties: { name: string }[] }[]
}

export interface BindProblem {
  role: Role
  entity: string
  problem: string
}

export interface BindReport {
  ok: boolean
  problems: BindProblem[]
  /** Tính năng mất đi vì bỏ ô tuỳ chọn — cảnh báo, không chặn. */
  warnings: string[]
}

const propsOf = (schema: SchemaView, entity: string): string[] | null => {
  const e = schema.entityTypes.find((x) => x.name === entity)
  return e ? e.properties.map((p) => p.name) : null
}

const checkOne = (
  schema: SchemaView, role: Role, entity: string, fields: Record<string, string>,
  problems: BindProblem[], warnings: string[],
): void => {
  const props = propsOf(schema, entity)
  if (!props) {
    problems.push({ role, entity, problem: `thực thể không có trong lược đồ app` })
    return
  }
  for (const slot of requiredSlots(role)) {
    const col = fields[slot]
    if (!col) {
      problems.push({ role, entity, problem: `thiếu ô bắt buộc \`${slot}\`` })
      continue
    }
    if (!props.includes(col)) {
      problems.push({ role, entity, problem: `\`${slot}\` trỏ vào \`${col}\` — ô này không có trên ${entity}` })
    }
  }
  for (const [slot, col] of Object.entries(fields)) {
    if (!SLOTS[role].some((s) => s.slot === slot)) {
      problems.push({ role, entity, problem: `khai ô \`${slot}\` mà engine không có vai nào cho nó` })
    } else if (!props.includes(col)) {
      problems.push({ role, entity, problem: `\`${slot}\` trỏ vào \`${col}\` — ô này không có trên ${entity}` })
    }
  }
  warnings.push(...degradations(role, Object.keys(fields)).map((w) => `${entity}: ${w}`))
}

/**
 * Kiểm khai báo đối chiếu lược đồ của app.
 *
 * ⭐ KHÔNG kiểm "app có dùng đúng không" — kiểm "khai báo có nói được sự thật
 *    không". Engine không có ý kiến về việc một đợt huấn luyện nên lên lịch hay
 *    không; nó chỉ chặn khi khai báo trỏ vào một ô không tồn tại.
 */
export const checkBindings = (decl: CalendarDecl, schema: SchemaView): BindReport => {
  const problems: BindProblem[] = []
  const warnings: string[] = []

  if (decl.sources.length === 0) {
    problems.push({ role: 'Source', entity: '(không có)', problem: 'chưa khai nguồn nào — lịch sẽ trống vĩnh viễn' })
  }
  const seen = new Set<string>()
  for (const s of decl.sources) {
    if (seen.has(s.entity)) {
      problems.push({ role: 'Source', entity: s.entity, problem: 'khai hai lần — một hồ sơ sẽ hiện hai ô, bất biến C2 vỡ' })
    }
    seen.add(s.entity)
    checkOne(schema, 'Source', s.entity, s.fields, problems, warnings)
    if (!s.whenState || s.whenState.length === 0) {
      warnings.push(`${s.entity}: chưa khai \`whenState\` → MỌI chặng đều chiếm giờ, kể cả bản còn dự thảo`)
    }
  }
  if (decl.roster) checkOne(schema, 'Roster', decl.roster.entity, decl.roster.fields, problems, warnings)
  if (decl.shift) {
    checkOne(schema, 'Shift', decl.shift.entity, decl.shift.fields, problems, warnings)
    if (Object.keys(decl.shift.kinds).length === 0) {
      problems.push({ role: 'Shift', entity: decl.shift.entity, problem: 'khai vai ca trực mà không có loại ca nào' })
    }
  }
  if (decl.entry) checkOne(schema, 'Entry', decl.entry.entity, decl.entry.fields, problems, warnings)

  return { ok: problems.length === 0, problems, warnings }
}

/** Kiểm rồi ném — dùng ở đường khởi động, nơi không có ai để trả lỗi về. */
export const bindOrThrow = (decl: CalendarDecl, schema: SchemaView): CalendarDecl => {
  const r = checkBindings(decl, schema)
  if (!r.ok) {
    const lines = r.problems.map((p) => `  ${p.role}/${p.entity}: ${p.problem}`)
    throw new Error(`Khai báo lịch không đứng vững:\n${lines.join('\n')}`)
  }
  return decl
}

/** Đọc một ô của app theo tên vai. */
export const slot = (rec: SourceRecord, fields: Record<string, string>, name: string): unknown => {
  const col = fields[name]
  return col === undefined ? undefined : rec.fields[col]
}
