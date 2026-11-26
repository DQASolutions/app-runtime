// Kỳ, đóng kỳ, và số về muộn — I5. §C.1, và fit-log §M F4, F6.
//
// ⭐ ĐÓNG KỲ THEO CẶP (KỲ × ĐƠN VỊ), KHÔNG TOÀN CỤC.
//    Xã chốt năm xong, tỉnh còn ghi tới 25/11, vùng tới 30/11. Một lệnh
//    `closePeriod(2027)` toàn cục sẽ khoá nhầm cả ba cấp cùng lúc.
//
// ⭐ ĐÓNG KỲ THÌ ĐÓNG BĂNG LUÔN SỐ ĐÃ BÁO.
//    Không có ảnh chụp ấy thì sáu tháng sau không ai trả lời được "lúc gửi báo
//    cáo, con số là bao nhiêu" — trừ khi phát lại toàn bộ nhật ký. Ảnh chụp là
//    thứ làm `asReported()` trả lời được bằng một phép đọc.

import { LedgerError, type Violation } from './types.js'

export interface Period { key: string; from: string; to: string; label?: string }

export interface PeriodClose {
  periodKey: string
  unitId: string
  closedAt: string
  /** Ảnh chụp lúc chốt: chỉ tiêu -> số đạt đã báo lên. */
  reported: Record<string, number>
}

/**
 * Ghi bổ sung cho một kỳ ĐÃ ĐÓNG. Không sửa đè bản gốc — sổ chỉ-thêm.
 *
 * ⚠️ Mang `delta` chứ không mang giá trị mới: bản gốc còn nguyên, nên cộng dồn
 *    ra số hiện tại mà vẫn đọc lại được số đã gửi.
 */
export interface Restatement {
  id: string
  periodKey: string
  unitId: string
  targetId: string
  delta: number
  reason: string
  at: string
}

const keyOf = (periodKey: string, unitId: string) => `${periodKey} ${unitId}`

export class PeriodBook {
  private readonly closes = new Map<string, PeriodClose>()
  private readonly restatements: Restatement[] = []

  constructor(closes: readonly PeriodClose[] = [], restatements: readonly Restatement[] = []) {
    for (const c of closes) this.closes.set(keyOf(c.periodKey, c.unitId), c)
    this.restatements.push(...restatements)
  }

  isClosed(periodKey: string, unitId: string): boolean {
    return this.closes.has(keyOf(periodKey, unitId))
  }

  /** Guard của `recordActual` — kỳ đã đóng thì chỉ còn đường ghi bổ sung. */
  assertOpen(periodKey: string, unitId: string): void {
    if (this.isClosed(periodKey, unitId)) {
      throw new LedgerError('OVER_COMMITTED',
        `Kỳ "${periodKey}" của đơn vị này đã chốt. Số mới ghi bằng bản bổ sung, không sửa đè.`,
        unitId)
    }
  }

  close(periodKey: string, unitId: string, reported: Record<string, number>, at: string): PeriodClose {
    const k = keyOf(periodKey, unitId)
    if (this.closes.has(k)) {
      throw new LedgerError('OVER_COMMITTED', `Kỳ "${periodKey}" của đơn vị này đã chốt rồi`, unitId)
    }
    const c: PeriodClose = { periodKey, unitId, closedAt: at, reported: { ...reported } }
    this.closes.set(k, c)
    return c
  }

  restate(r: Restatement): Restatement {
    if (!this.isClosed(r.periodKey, r.unitId)) {
      throw new LedgerError('OVER_COMMITTED',
        'Kỳ chưa chốt thì sửa thẳng số đạt, không dùng bản bổ sung', r.targetId)
    }
    if (!r.reason?.trim()) {
      throw new LedgerError('OVER_COMMITTED', 'Bản bổ sung phải có lý do', r.targetId)
    }
    this.restatements.push(r)
    return r
  }

  /**
   * ⭐ Con số ĐÃ GỬI LÊN — không đổi theo số về muộn.
   *
   * Xã báo bổ sung tháng 12 trong khi tỉnh đã gửi báo cáo trước 25/11: số đã gửi
   * không được tự đổi. `null` nghĩa là kỳ ấy chưa chốt, chưa có gì để "đã báo".
   */
  asReported(periodKey: string, unitId: string, targetId: string): number | null {
    const c = this.closes.get(keyOf(periodKey, unitId))
    if (!c) return null
    return c.reported[targetId] ?? 0
  }

  /** Số hiện tại = số đã báo cộng mọi bản bổ sung sau đó. */
  asNow(periodKey: string, unitId: string, targetId: string, liveIfOpen?: number): number | null {
    const reported = this.asReported(periodKey, unitId, targetId)
    if (reported === null) return liveIfOpen ?? null
    const delta = this.restatements
      .filter((r) => r.periodKey === periodKey && r.unitId === unitId && r.targetId === targetId)
      .reduce((s, r) => s + r.delta, 0)
    return reported + delta
  }

  /** Kỳ đã chốt mà số hiện tại đã lệch khỏi số đã gửi — việc cấp trên cần biết. */
  drifted(): Violation[] {
    const seen = new Set<string>()
    const out: Violation[] = []
    for (const r of this.restatements) {
      const k = `${r.periodKey}|${r.unitId}|${r.targetId}`
      if (seen.has(k)) continue
      seen.add(k)
      const rep = this.asReported(r.periodKey, r.unitId, r.targetId)
      const now = this.asNow(r.periodKey, r.unitId, r.targetId)
      if (rep !== now) {
        out.push({ code: 'LEDGER_DRIFT', subject: r.targetId,
          message: `Kỳ "${r.periodKey}": đã báo lên ${rep}, số hiện tại ${now}. `
            + 'Báo cáo đã gửi vẫn giữ nguyên; chênh lệch này phải nói với cấp trên.' })
      }
    }
    return out
  }
}
