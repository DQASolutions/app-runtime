// Từ lời khai của thuộc tính tới thuộc tính HTML của ô nhập — phần ô cần để CHẠY.

/**
 * Mẫu viết một mục của `accept` — trùng `ACCEPT_FORM` của `@dqa-ai-solutions/core-runtime`,
 * nơi lời khai được bác lúc định nghĩa: `.pdf` · `image/*` · `application/pdf`.
 */
export const ACCEPT_ITEM = /^(\.[A-Za-z0-9]+|[a-z]+\/(\*|[A-Za-z0-9.+-]+))$/

/** `accept` của HTML (một chuỗi, phẩy ngăn) hoặc của lời khai (một danh sách) → các mục. */
export const acceptItems = (accept: unknown): string[] =>
  (Array.isArray(accept) ? accept.map(String) : typeof accept === 'string' ? accept.split(',') : [])
    .map((x) => x.trim()).filter(Boolean)

// ── Từ khai báo tới thuộc tính HTML ────────────────────────────────────────

/**
 * Ràng buộc một thuộc tính khai — cùng tên JSON Schema mà `@dqa-ai-solutions/core-runtime`
 * ép lúc ghi và `@dqa-ai-solutions/ontology-view` chở vào `field.constraints`. Khai lại hình
 * dạng ở đây để phần tử không phải phụ thuộc vào gói view.
 */
export interface DeclaredConstraints {
  minLength?: number
  maxLength?: number
  pattern?: string
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  exclusiveMaximum?: number
  multipleOf?: number
  minItems?: number
  maxItems?: number
  formatMinimum?: string
  formatMaximum?: string
  accept?: string[]
  maxBytes?: number
}

export interface FieldAttributes {
  minLength?: number
  maxLength?: number
  pattern?: string
  min?: number | string
  max?: number | string
  step?: number
  accept?: string
  maxBytes?: number
}

export function fieldAttributes(kind: string, c: DeclaredConstraints | undefined): FieldAttributes {
  const a: FieldAttributes = {}
  if (!c) return a
  if (kind === 'file') {
    if (c.accept?.length) a.accept = c.accept.join(',')
    if (c.maxBytes !== undefined) a.maxBytes = c.maxBytes
    return a
  }
  if (kind === 'number') {
    const step = c.multipleOf
    if (step !== undefined) a.step = step
    // ⚠️ Có thể khai CẢ HAI: kiểu giá trị cho `minimum: 0`, thuộc tính thu hẹp
    //    thành "phải dương" bằng `exclusiveMinimum: 0`. Lấy cận CHẶT hơn — bản
    //    trước lấy `minimum` và bỏ qua `exclusiveMinimum`, ô nhận số 0 mà máy
    //    chủ bác (12/9/2026).
    const lo = [
      c.minimum,
      c.exclusiveMinimum !== undefined ? (step !== undefined ? c.exclusiveMinimum + step : c.exclusiveMinimum) : undefined,
    ].filter((v): v is number => v !== undefined)
    if (lo.length) a.min = Math.max(...lo)
    const hi = [
      c.maximum,
      c.exclusiveMaximum !== undefined ? (step !== undefined ? c.exclusiveMaximum - step : c.exclusiveMaximum) : undefined,
    ].filter((v): v is number => v !== undefined)
    if (hi.length) a.max = Math.min(...hi)
    return a
  }
  if (kind === 'date' || kind === 'datetime') {
    const cut = (v: string) => (kind === 'date' ? v.slice(0, 10) : v.length === 10 ? `${v}T00:00` : v.replace(' ', 'T').slice(0, 16))
    if (c.formatMinimum !== undefined) a.min = cut(c.formatMinimum)
    if (c.formatMaximum !== undefined) a.max = cut(c.formatMaximum)
    return a
  }
  if (kind.endsWith('[]')) {
    // ⭐ Ô DANH SÁCH (`text[]`) giữ CẢ danh sách, mỗi dòng một mục. `maxLength`
    //    và `pattern` khai cho MỘT mục — gắn thẳng lên ô là chặn cả danh sách ở
    //    độ dài của một mục (đo được 12/9/2026: ô "Căn cứ" 500 mục × 300 ký tự
    //    bị cắt ở 300 ký tự tổng). Trần của ô là trần của cả danh sách:
    //    số mục × (độ dài mục + 1 dấu xuống dòng) − 1. `pattern` thì HTML không
    //    áp được theo từng dòng — bỏ, máy chủ kiểm từng mục.
    if (c.maxItems !== undefined && c.maxLength !== undefined) a.maxLength = c.maxItems * (c.maxLength + 1) - 1
    return a
  }
  if (c.maxLength !== undefined) a.maxLength = c.maxLength
  if (c.minLength !== undefined) a.minLength = c.minLength
  if (c.pattern !== undefined) a.pattern = c.pattern
  return a
}
