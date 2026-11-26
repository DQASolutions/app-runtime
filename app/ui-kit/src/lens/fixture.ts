// A contract shaped like a real one, for tests.
//
// Modelled on the reference app's central entity — a person with a lifecycle, a
// derived unit followed through a link, a money field, and steps that both
// advance and exit. Written once so every lens test argues about the same shape.

import type { ViewContract, ResolvedField, ResolvedAction } from '@dqa-ai-solutions/ontology-view'

const f = (over: Partial<ResolvedField> & Pick<ResolvedField, 'key' | 'label' | 'kind'>): ResolvedField => over

export const FULL_NAME = f({ key: 'fullName', label: 'Họ và tên', kind: 'text' })
export const STATUS = f({
  key: 'status', label: 'Trạng thái', kind: 'enum',
  enum: [
    { value: 'REGISTERED', label: 'Đã đăng ký', tone: 'wait' },
    { value: 'ACTIVE', label: 'Đang làm việc', tone: 'doing' },
    { value: 'COMPLETED', label: 'Hoàn thành hợp đồng', tone: 'done' },
  ],
})
export const TYPE = f({ key: 'employeeType', label: 'Loại hình', kind: 'text' })
export const JOINED = f({ key: 'serviceStartDate', label: 'Ngày vào', kind: 'date' })
export const ALLOWANCE = f({
  key: 'allowance', label: 'Trợ cấp', kind: 'number', meaning: 'currency', numeric: true,
  note: { text: 'Bộ luật Lao động Điều 34 khoản 1 điểm a', ref: 'L-34-1-a' },
})
/** Columns of the related entity, not of this one. */
const DECISION_NO = f({ key: 'decisionNumber', label: 'Số văn bản', kind: 'text', priority: 'primary' })
const SIGNED_AT = f({ key: 'signedDate', label: 'Ngày ký', kind: 'date' })
export const UNIT = f({
  key: 'unit', label: 'Đơn vị', kind: 'derived',
  derived: { name: 'unit', kind: 'linked', via: 'heldByUnit', show: 'unitName' },
  /* ⭐ Resolved by the contract, so a cell can offer a way to open the record. */
  refEntity: 'Unit',
})
export const ALLOWANCE_NOTE = { text: 'Bộ luật Lao động Điều 34 khoản 1 điểm a', ref: 'L-34-1-a' }
export const DEADLINE = f({ key: 'deadline', label: 'Hạn xử lý', kind: 'derived', widget: 'claim-deadline' })

const ACTIONS: ResolvedAction[] = [
  {
    action: 'select', label: 'Tuyển chọn', from: ['REGISTERED'], to: 'ACTIVE', role: 'ROLE-HR',
    process: 'membership',
    outcome: 'approve',
    fields: [
      f({ key: 'decisionNo', label: 'Số quyết định', kind: 'text', required: true }),
      f({ key: 'signedBy', label: 'Người ký', kind: 'text', fixed: 'Chủ tịch UBND xã' }),
      f({ key: 'unitId', label: 'Đơn vị', kind: 'uuid', refEntity: 'Unit' }),
      f({ key: 'note', label: 'Ghi chú', kind: 'text', typeClasses: { multiline: true } }),
    ],
  },
  {
    action: 'defer', label: 'Tạm hoãn', from: ['REGISTERED'], to: 'DEFERRED', role: 'ROLE-HR',
    process: 'membership',
    provisional: 'Trình tự này chưa có văn bản hướng dẫn công khai',
    fields: [f({ key: 'reason', label: 'Lý do', kind: 'text', required: true })],
  },
  {
    action: 'complete', label: 'Hoàn thành hợp đồng', from: ['ACTIVE'], to: 'COMPLETED', role: 'ROLE-HR',
    process: 'membership',
    fields: [f({ key: 'payload', label: 'Hồ sơ kèm', kind: 'json' })],
  },
]

const STATES = [
  { name: 'REGISTERED', label: 'Đã đăng ký', hint: 'Đã ghi vào sổ, chờ tuyển chọn' },
  { name: 'ACTIVE', label: 'Đang làm việc', hint: 'Đã nhận vào đơn vị' },
  { name: 'COMPLETED', label: 'Hoàn thành hợp đồng' },
]

export const CONTRACT: ViewContract = {
  entity: 'StaffMember',
  label: 'Nhân viên chính thức',
  stateProperty: 'status',
  states: STATES,
  /* One line, so `lines` and `states` agree. An entity with several is the case
     the milestone lens refuses to guess at — see its `AMBIGUOUS_LINE` branch. */
  lines: [{ process: 'membership', stateProperty: 'status', states: STATES }],
  list: {
    columns: [FULL_NAME, TYPE, STATUS, UNIT, ALLOWANCE, DEADLINE],
    main: FULL_NAME,
    sub: STATUS,
    search: ['fullName'],
    sort: [{ by: 'fullName', collate: 'vi' }],
  },
  detail: {
    facts: [FULL_NAME, STATUS, TYPE, JOINED, ALLOWANCE, UNIT],
    related: [{
      name: 'decisions',
      via: 'hasDecision',
      label: 'Quyết định ký ngoài hệ thống',
      entity: 'OffSystemDecision',
      columns: [DECISION_NO, SIGNED_AT],
    }],
  },
  row: { main: FULL_NAME, sub: TYPE, badge: STATUS },
  actions: ACTIONS,
  widgets: { 'cell.deadline': 'claim-deadline' },
  uses: [],
  hooks: {},
}

/** A row as the read layer hands it over: stored fields nested, derived at top. */
export const ROW = {
  id: 'm-1',
  unit: { id: 'u-7', unitName: 'Tổ 1' },
  data: {
    fullName: 'Nguyễn Văn A',
    status: 'ACTIVE',
    employeeType: 'Toàn thời gian',
    serviceStartDate: '2026-01-15',
    allowance: 1_250_000,
  },
}

/** The same row from a read layer that never ran the `heldByUnit` join. */
export const UNWIRED_ROW = { id: 'm-2', data: { ...ROW.data, fullName: 'Trần Thị B' } }

/** Rows the app hands over for the declared related list. */
export const DECISIONS = [
  { id: 'd-1', data: { decisionNumber: '12/QĐ-UBND', signedDate: '2026-02-01' } },
  { id: 'd-2', data: { decisionNumber: '31/QĐ-UBND', signedDate: '2026-05-14' } },
]

/*
  ═══════════════════════════════════════════════════════════════════════════
  ⭐ A SECOND CONTRACT, FOR THE SHAPES ONLY A ROUTE CARES ABOUT.

    `CONTRACT` above is the shape every lens argues about, and it stays put:
    adding these steps to it moved five assertions in three other lenses that
    had nothing to do with the change. A fixture that cannot be extended without
    perturbing unrelated tests is a fixture people stop extending.

    What is here that is not there, and why each one is not decoration:

      · a gate opened by a step declaring NO `to` — the superior writes a
        verdict and leaves the subordinate's record where it stands. On the app
        this was cut from, 36 of 40 gates are shaped exactly like this, and
        that single fact is why a strip of states cannot answer "am I waiting".
      · a refusal branch on the same gate, so the opener cannot be found by
        looking for "the step that mentions the gate".
      · a step walking the record BACKWARD — 22 of 54 processes have one.
      · a step naming a state the line does not declare, so the diagnostic that
        catches a wrong-line wiring has something real to catch.
  ═══════════════════════════════════════════════════════════════════════════
*/
export const GATE = 'selectionApproval'

const GATED_ACTIONS: ResolvedAction[] = [
  {
    action: 'register', label: 'Đăng ký', from: [], to: 'REGISTERED', role: 'ROLE-HR',
    process: 'membership', fields: [],
  },
  {
    action: 'approveSelection', label: 'Phê duyệt tuyển chọn', from: ['REGISTERED'], role: 'ROLE-BRANCH',
    process: 'membership', settles: GATE, outcome: 'approve', fields: [],
  },
  {
    action: 'returnSelection', label: 'Trả lại để bổ sung', from: ['REGISTERED'], role: 'ROLE-BRANCH',
    process: 'membership', settles: GATE, outcome: 'reject', fields: [],
  },
  {
    action: 'select', label: 'Tuyển chọn', from: ['REGISTERED'], to: 'ACTIVE', role: 'ROLE-HR',
    process: 'membership', waitsOn: [{ kind: 'decision', via: GATE, is: 'approve' }], fields: [],
  },
  {
    action: 'complete', label: 'Hoàn thành hợp đồng', from: ['ACTIVE'], to: 'COMPLETED', role: 'ROLE-HR',
    process: 'membership', fields: [],
  },
  {
    action: 'reinstate', label: 'Đưa về sổ đăng ký', from: ['ACTIVE'], to: 'REGISTERED', role: 'ROLE-HR',
    process: 'membership', fields: [],
  },
  /* ⚠️ A step that lands where it started — an edit in place, not a journey
     backward. 90 steps on the source app are declared `repeatable` like this,
     and a `to <= from` test calls every one of them a return. */
  {
    action: 'amend', label: 'Sửa hồ sơ', from: ['REGISTERED'], to: 'REGISTERED', role: 'ROLE-HR',
    process: 'membership', fields: [],
  },
  /* A step of ANOTHER line, left in on purpose: filtering on `process` is the
     whole reason that field exists, and a filter with nothing to exclude proves
     nothing. `PROVISIONAL` is not a state of `membership`. */
  {
    action: 'provisionalIntake', label: 'Ghi tạm', from: ['REGISTERED'], to: 'PROVISIONAL', role: 'ROLE-HR',
    process: 'provisionalMembership', fields: [],
  },
]

export const GATED_CONTRACT: ViewContract = {
  ...CONTRACT,
  states: [...STATES, { name: 'PROVISIONAL', label: 'Ghi tạm' }],
  lines: [
    { process: 'membership', stateProperty: 'status', states: STATES },
    {
      process: 'provisionalMembership',
      stateProperty: 'status',
      states: [{ name: 'REGISTERED', label: 'Đã đăng ký' }, { name: 'PROVISIONAL', label: 'Ghi tạm' }],
    },
  ],
  actions: GATED_ACTIONS,
}
