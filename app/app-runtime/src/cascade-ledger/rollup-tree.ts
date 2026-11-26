// Gộp bằng chứng lên theo CÂY GIAO — I7, và §C.0.
//
// ⭐ Gộp đi theo cạnh giao, KHÔNG đếm lại bằng chứng của cấp dưới. Nếu chỉ tiêu
//    tỉnh cũng đếm bằng chứng mà học viên của xã lại nằm trong tỉnh, thì 42
//    người bị tính hai lần và không ai thấy.
//
// ⚠️ App cấp `ownEvidence` — số bản ghi nối THẲNG vào từng chỉ tiêu — vì chỉ app
//    biết cạnh của nó tên gì. Engine chỉ lo phần app không lo được: đi đúng cây
//    và không cộng trùng.

import type { AllocationRec, Measure, TargetRec, Violation } from './types.js'
import { rollup } from './algebra.js'

export interface TreeInput {
  targets: readonly TargetRec[]
  allocations: readonly AllocationRec[]
  /** chỉ tiêu id -> số bằng chứng nối THẲNG vào nó. */
  ownEvidence: Readonly<Record<string, number>>
  measures: ReadonlyMap<string, Measure>
}

export interface TreeNode {
  targetId: string
  own: number
  children: string[]
  achieved: number | null
  note?: string
}

/**
 * Gộp từ lá lên gốc. Trả về một nút cho mỗi chỉ tiêu.
 *
 * Cây dựng từ `fulfilsAllocationId`: chỉ tiêu con -> lần giao -> chỉ tiêu cha.
 * Không có cạnh ấy thì cấp trên không cộng được của cấp dưới — đó chính là lý do
 * `fulfils` phải có (§D.5), và ở đây nó trả cổ tức lần thứ ba.
 */
export function rollupTree(input: TreeInput): Map<string, TreeNode> {
  const allocById = new Map(input.allocations.map((a) => [a.id, a]))
  const nodes = new Map<string, TreeNode>()
  for (const t of input.targets) {
    nodes.set(t.id, { targetId: t.id, own: input.ownEvidence[t.id] ?? 0, children: [], achieved: null })
  }
  // con -> cha
  const parentOf = new Map<string, string>()
  for (const t of input.targets) {
    if (!t.fulfilsAllocationId) continue
    const parent = allocById.get(t.fulfilsAllocationId)?.targetId
    if (!parent || !nodes.has(parent)) continue
    parentOf.set(t.id, parent)
    nodes.get(parent)!.children.push(t.id)
  }

  // Đi sâu trước, có canh vòng lặp — cây dữ liệu thật vẫn có thể bị nối vòng.
  const done = new Set<string>()
  const onStack = new Set<string>()
  const visit = (id: string): number | null => {
    if (done.has(id)) return nodes.get(id)!.achieved
    if (onStack.has(id)) return nodes.get(id)!.own   // gặp vòng: dừng, không cộng tiếp
    onStack.add(id)
    const n = nodes.get(id)!
    const kids = n.children.map(visit)
    const t = input.targets.find((x) => x.id === id)!
    const m = input.measures.get(t.measureKey)
    const r = m ? rollup(m, n.own, kids) : { achieved: null as number | null }
    n.achieved = r.achieved
    if ('note' in r && r.note) n.note = r.note
    onStack.delete(id)
    done.add(id)
    return n.achieved
  }
  for (const id of nodes.keys()) visit(id)
  return nodes
}

/**
 * I7 — một bản ghi bằng chứng chỉ được nối vào ĐÚNG MỘT chỉ tiêu, và chỉ tiêu ấy
 * phải là cấp THỰC SỰ LÀM. Nối vào cả cha lẫn con là đếm hai lần.
 */
export function checkEvidencePlacement(
  links: ReadonlyArray<{ evidenceId: string; targetId: string }>,
  tree: ReadonlyMap<string, TreeNode>,
): Violation[] {
  const byEvidence = new Map<string, string[]>()
  for (const l of links) byEvidence.set(l.evidenceId, [...(byEvidence.get(l.evidenceId) ?? []), l.targetId])

  const ancestors = (id: string): Set<string> => {
    const out = new Set<string>()
    for (const [pid, n] of tree) if (n.children.includes(id)) { out.add(pid); for (const a of ancestors(pid)) out.add(a) }
    return out
  }
  const out: Violation[] = []
  for (const [evidenceId, targets] of byEvidence) {
    const uniq = [...new Set(targets)]
    if (uniq.length < 2) continue
    const overlap = uniq.some((a) => uniq.some((b) => a !== b && ancestors(b).has(a)))
    out.push({ code: 'DOUBLE_COUNTED', subject: evidenceId,
      message: overlap
        ? `Bản ghi này nối vào cả chỉ tiêu cha lẫn con — cấp trên sẽ cộng nó hai lần`
        : `Bản ghi này nối vào ${uniq.length} chỉ tiêu — sẽ bị đếm nhiều lần khi gộp lên` })
  }
  return out
}
