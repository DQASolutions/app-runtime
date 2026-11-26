// Kho thật của kernel + ba cách làm so-rồi-đặt, để ĐO xem cái nào chặn được.
//
// ⭐ ĐÂY LÀ PHẦN ĐÁNG GIÁ NHẤT CỦA VÍ DỤ. Nó biến đề nghị `Q4` từ một ý kiến
//    thành một số đo: viết shim ở tầng ứng dụng thì KHÔNG chặn được, vì giữa
//    "đọc" và "ghi" luôn có một `await`, và Node nhả sự kiện đúng ở đó.

import { InMemoryAdapter, createOntology, type Ctx, type Provenance, type OntologySchema } from '@dqa-ai-solutions/ontology-runtime'
import type { InstancePort } from '@dqa-ai-solutions/app-runtime/cascade-ledger'

export const CTX: Ctx = { tenantId: 'demo', actor: 'ROLE-HEAD' }
export const PROV: Provenance = {
  source_ref: 'QĐ-01/2027', confirmed_by: 'ROLE-HEAD', confirmed_at: '2027-01-15T00:00:00.000Z',
}

/** Ontology của app mẫu — TỪ VỰNG RIÊNG, engine không biết tên nào ở đây. */
export const SCHEMA: OntologySchema = {
  entityTypes: [
    { name: 'ChiTieu', label: 'Chỉ tiêu', properties: [
      { name: 'thuocDo', type: 'text', required: true },
      { name: 'soGiao', type: 'number' },
      { name: 'soDieuChinh', type: 'number' },
      { name: 'conLai', type: 'number' },
      { name: 'tinhTrang', type: 'enum', enumValues: ['dang_lap', 'binh_thuong', 'giao_vuot'] },
      { name: 'ky', type: 'text' },
      { name: 'tuPhat', type: 'enum', enumValues: ['co', 'khong'] },
      { name: 'theoLanGiao', type: 'text' },
      // ⬇ nghiệp vụ của app. Engine không đọc, không ghi, không biết là có.
      { name: 'maTinh', type: 'text' }, { name: 'ghiChu', type: 'text' }, { name: 'nguoiKy', type: 'text' },
    ] },
    { name: 'LanGiao', label: 'Lần giao chỉ tiêu', properties: [
      { name: 'maLanGiao', type: 'text', required: true },
      { name: 'maChiTieu', type: 'text', required: true },
      { name: 'maDonVi', type: 'text' },
      { name: 'soChia', type: 'number' },
      { name: 'trangThai', type: 'enum', enumValues: ['da_giao', 'da_nhan', 'xong', 'tra_lai'] },
    ] },
    { name: 'HocVien', label: 'Học viên', properties: [
      { name: 'hoTen', type: 'text', required: true },
      { name: 'maChiTieu', type: 'text' },
    ] },
  ],
  relationshipTypes: [
    { name: 'hocVienTheoChiTieu', from: 'HocVien', to: 'ChiTieu', cardinality: '1..N', directed: true },
  ],
}

export type Onto = ReturnType<typeof createOntology>
/** Giữ lại adapter để dùng lệnh ghi có điều kiện của kernel. */
export const adapterOf = new WeakMap<object, InMemoryAdapter>()

export async function openStore(): Promise<Onto> {
  const adapter = new InMemoryAdapter()
  const onto = createOntology({ adapter })
  adapterOf.set(onto as object, adapter)
  for (const e of SCHEMA.entityTypes) await onto.defineEntityType(e, CTX)
  for (const r of SCHEMA.relationshipTypes) await onto.defineRelationshipType(r, CTX)
  await onto.migrate(CTX)
  return onto
}

type Port = InstancePort & { tenGoi: string }

const basePort = (onto: Onto): Omit<InstancePort, 'compareAndSetInstance'> => ({
  getInstance: (id) => onto.get(id, CTX) as never,
  queryInstances: (type, cond) => onto.find(type, cond as never, CTX) as never,
  insertInstance: (type, data, prov) => onto.create(type, data as never, prov as Provenance, CTX) as never,
  updateInstance: (id, patch, prov) => onto.update(id, patch as never, prov as Provenance, CTX) as never,
})

/**
 * ① Shim NGÂY THƠ — cái ai cũng viết đầu tiên.
 *
 * ⚠️ Giữa `get` và `update` có một `await`. Node nhả sự kiện đúng ở đó, nên hai
 *    lệnh giao đồng thời cùng đọc số cũ, cùng qua cửa, cùng ghi. Ví dụ này ĐO
 *    được điều đó, không phải suy.
 */
export const naivePort = (onto: Onto): Port => ({
  tenGoi: 'shim ngây thơ (đọc rồi ghi)',
  ...basePort(onto),
  compareAndSetInstance: async (id, expected, patch, prov) => {
    const cur = await onto.get(id, CTX)
    if (!cur) return false
    for (const [k, v] of Object.entries(expected)) {
      const a = cur.data[k], b = v
      if ((a ?? null) !== (b ?? null)) return false
    }
    await onto.update(id, patch as never, prov as Provenance, CTX)
    return true
  },
})

/**
 * ③ ⭐ CỔNG THẬT — dùng `compareAndSetInstance` của kernel.
 *
 * Đây là lời giải, không phải bản vá: phần so và phần ghi nằm trong CÙNG một
 * thao tác của kho, nên không có khe nào để chen vào — đúng ở mọi số tiến trình.
 */
export const realPort = (onto: Onto): Port => {
  // ⚠️ PHẢI GẮN TENANT. Tầng Ontology ghi theo `CTX.tenantId`; gọi thẳng adapter
  //    gốc là đi tìm ở kho của tenant mặc định, không thấy gì, và trả về false —
  //    trông y hệt "có người chen ngang". Lỗi này ví dụ bắt được bằng cách hỏng.
  const adapter = adapterOf.get(onto as object)!.withTenant(CTX.tenantId)
  return {
    tenGoi: 'cổng thật (compareAndSetInstance của kernel)',
    ...basePort(onto),
    compareAndSetInstance: (id, expected, patch, prov) =>
      adapter.compareAndSetInstance!(id, expected as never, patch as never, prov as Provenance),
  }
}

/**
 * ② Shim CÓ KHOÁ THEO CHỈ TIÊU — chặn được, nhưng chỉ trong MỘT tiến trình.
 *
 * ⚠️ Triển khai nhiều tiến trình, hoặc nhiều nút, là khoá này vô nghĩa: mỗi tiến
 *    trình có bản đồ khoá của riêng nó. Nên đây là bản vá đúng cho máy đơn, và
 *    KHÔNG phải lời giải.
 */
export const lockedPort = (onto: Onto): Port => {
  const queue = new Map<string, Promise<unknown>>()
  const base = naivePort(onto)
  return {
    tenGoi: 'shim có khoá (một tiến trình)',
    ...basePort(onto),
    compareAndSetInstance: async (id, expected, patch, prov) => {
      const previous = queue.get(id) ?? Promise.resolve()
      let release!: () => void
      queue.set(id, new Promise<void>((r) => { release = r }))
      await previous
      try { return await base.compareAndSetInstance!(id, expected, patch, prov) }
      finally { release() }
    },
  }
}
