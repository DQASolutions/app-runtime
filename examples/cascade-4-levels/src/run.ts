// In ra một lượt chạy để đọc bằng mắt. `npm start`.
import { run } from './app.js'

const r = await run()
const d = (n: number | null | undefined) => (n === null || n === undefined ? '—' : String(n))

console.log('\n═══ TRỤC DỌC BỐN CẤP · năm 2027 ═══\n')
console.log('  cấp            nhận   đã chia   còn lại   đã đạt')
const row = (name: string, label: string, id: string, split: string) =>
  console.log(`  ${name.padEnd(14)} ${label.padStart(5)}  ${split.padStart(8)}  ${d(r.remaining[id]).padStart(8)}  ${d(r.achieved[id]).padStart(7)}`)
row('Bộ', '4000', 'bo', '600')
row('Vùng B', '600', 'vung', '560')
row('Tỉnh A', '45', 'tinh', '42')
row('Xã X', '3', 'xa', '0')

console.log('\n  chỉ tiêu TỶ LỆ (truyền, không chia)')
console.log(`    còn lại: ${d(r.remaining.tyLe)}   ← null, KHÔNG phải 0: câu hỏi vô nghĩa`)
console.log(`    gộp lên: ${d(r.achieved.tyLe)}   ← null: cộng tỷ lệ là bịa ra một phép cộng`)

console.log('\n═══ ENGINE ĐÃ CHẶN ═══')
for (const l of r.errors) console.log('  ⛔ ' + l.replace(/\n/g, '\n     '))

console.log('\n═══ ENGINE ĐÃ KÊU ═══')
for (const c of r.warnings) console.log('  · ' + c)

console.log('\n═══ SỐ VỀ MUỘN ═══')
console.log(`  đã báo lên tỉnh (chốt 20/11): ${d(r.reported)}`)
console.log(`  số thật hiện tại:             ${d(r.current)}`)
for (const l of r.drift) console.log('  ⚠ ' + l)

console.log('\n═══ ĐO ĐƯỢC ═══')
console.log(`  đo được: ${r.measured.measurable} · văn xuôi: ${r.measured.narrative} · `
  + `văn xuôi đi xuyên qua: ${r.measured.passthrough} · ngoại lệ quá hạn: ${r.measured.expired.length}`)

console.log('\n═══ TIỀN BÁM CHỈ TIÊU (tỉnh A) ═══')
console.log(`  đề xuất ${r.funding.proposed.toLocaleString('vi')} · duyệt ${r.funding.approved.toLocaleString('vi')} `
  + `· chênh ${r.funding.variance.toLocaleString('vi')} trên ${r.funding.lines} dòng\n`)
