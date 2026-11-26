// Phép thử e2e: cả trục bốn cấp chạy một lượt, rồi soi từng bất biến.
import { describe, it, expect } from 'vitest'
import { run, LENS } from './app.js'

const r = await run()

describe('bảo toàn dọc bốn cấp', () => {
  it('mỗi cấp còn đúng phần mình giữ lại', () => {
    expect(r.remaining.bo).toBe(3400)   // 4000 − 600
    expect(r.remaining.vung).toBe(40)      // 600 − 45 − 515
    expect(r.remaining.tinh).toBe(3)     // 45 − 3 − 39
    expect(r.remaining.xa).toBe(3)       // cấp cuối, tự làm cả 3
  })
  it('giao vượt bị chặn, kèm số còn lại', () => {
    expect(r.errors.join(' ')).toMatch(/còn 40 người, đang chia 41/)
  })
})

describe('thước TRUYỀN khác thước CHIA', () => {
  it('phần còn lại là null, KHÔNG phải 0', () => {
    expect(r.remaining.tyLe).toBeNull()
  })
  it('chia nhỏ một tỷ lệ bị chặn', () => {
    expect(r.errors.join(' ')).toMatch(/truyền xuống nguyên vẹn/)
  })
  it('khai `ratio` + `divide` bị bác ngay lúc định nghĩa thước', () => {
    expect(r.errors.join(' ')).toMatch(/không chia xuống được/)
  })
  it('gộp tỷ lệ trả null', () => {
    expect(r.achieved.tyLe).toBeNull()
  })
})

describe('gộp bằng chứng lên, đếm một lần', () => {
  it('⭐ số đạt do ENGINE ĐẾM CẠNH, không ai gõ: xã 3 · tỉnh 3 · vùng 5', () => {
    expect(r.achieved.xa).toBe(3)      // 3 học viên nối thẳng vào chỉ tiêu xã
    expect(r.achieved.tinh).toBe(3)    // tỉnh không tự làm, cộng của xã lên
    expect(r.achieved.vung).toBe(5)      // 2 lớp Vùng tự mở + 3 của tỉnh
  })
  it('một học viên nối vào cả chỉ tiêu cha lẫn con thì bị bắt', () => {
    expect(r.warnings.join(' ')).toMatch(/cả chỉ tiêu cha lẫn con/)
  })
})

describe('đo được', () => {
  it('chỉ tiêu chết bị bắt khi cạnh bằng chứng chưa bind', () => {
    expect(r.warnings.join(' ')).toMatch(/Số đạt sẽ mãi bằng 0/)
  })
  it('kế hoạch huấn luyện khai văn xuôi thì đòi lý do, người duyệt, hạn', () => {
    expect(r.warnings.join(' ')).toMatch(/thiếu: lý do, người duyệt, hạn xem lại/)
  })
  it('đếm được số lần VĂN XUÔI ĐI XUYÊN QUA', () => {
    expect(r.measured.passthrough).toBe(1)
    expect(r.measured.measurable).toBe(1)
    expect(r.measured.expired).toEqual(['kh-xa'])
  })
  it('⭐ cả bốn cấp sạch I2 — chỉ cái cố ý hỏng bị kêu', () => {
    const orphans = r.warnings.filter((c) => /không nối về lần giao nào/.test(c))
    expect(orphans).toHaveLength(1)
  })
})

describe('số về muộn', () => {
  it('số ĐÃ GỬI không đổi, số hiện tại đổi, chênh lệch bày ra', () => {
    expect(r.reported).toBe(3)
    expect(r.current).toBe(2)
    expect(r.drift.join(' ')).toMatch(/đã báo lên 3, số hiện tại 2/)
  })
})

describe('cắt chỉ tiêu giữa kỳ rồi thu hồi', () => {
  it('cắt xuống dưới phần đã chia thì đặt cờ, không từ chối', () => {
    expect(r.warnings.join(' ')).toMatch(/cắt giữa kỳ: OVER_COMMITTED, còn -60/)
  })
  it('thu hồi bớt thì phần còn lại dương trở lại', () => {
    expect(r.warnings.join(' ')).toMatch(/thu hồi xong: còn 455/)
  })
})

describe('tiền bám chỉ tiêu', () => {
  it('gộp theo chỉ tiêu, chênh lệch âm là bị cắt', () => {
    expect(r.funding.approved).toBe(450_000_000)
    expect(r.funding.variance).toBe(-50_000_000)
  })
  it('dòng chi mồ côi bị kêu', () => {
    expect(r.warnings.join(' ')).toMatch(/chưa nối về chỉ tiêu nào/)
  })
})

describe('⭐ engine không biết ô của app tên gì', () => {
  it('kho thật đã ghi bằng TÊN Ô CỦA APP', async () => {
    const { openStore: openStore } = await import('./kho.js')
    expect(typeof openStore).toBe('function')
    expect(Object.keys(r.ids)).toContain('vung')
  })
  it('app dùng tên tiếng Việt, engine vẫn chạy', () => {
    expect(LENS.field('baselineQty')).toBe('soGiao')
    expect(LENS.field('remainingQty')).toBe('conLai')
  })
  it('ô nghiệp vụ của app KHÔNG lọt vào kiểu của engine', () => {
    const t = LENS.readTarget({ ma: 'x', thuocDo: 'head_count', soGiao: 10, conLai: 10,
      tinhTrang: 'binh_thuong', maTinh: '01', ghiChu: 'x', nguoiKy: 'ROLE-HEAD' }) as unknown as Record<string, unknown>
    for (const o of ['maTinh', 'ghiChu', 'nguoiKy', 'capBanHanh']) expect(t[o]).toBeUndefined()
  })
  it('giá trị enum của app cũng được dịch', () => {
    expect(LENS.readTarget({ ma: 'x', thuocDo: 'm', soGiao: 1, conLai: 1, tinhTrang: 'giao_vuot' }).state)
      .toBe('OVER_COMMITTED')
  })
  it('đề xuất chỉ tiêu từ lần giao là ĐỦ để bấm nhận', () => {
    expect(r.warnings.join(' ')).toMatch(/Cấp trên vừa giao 600.*đủ để bấm nhận: true/)
  })
})
