import { describe, expect, it } from 'vitest'
import { navModel, routesOf, domainOf, type NavDecl } from './nav.js'

const NAV: NavDecl = {
  domains: [
    { name: 'hr', label: 'Nhân sự', clusters: ['tuyen-dung', 'ngan-sach', 'ky-luat'] },
    { name: 'training', label: 'Đào tạo', need: ['ROLE-TRAIN'], clusters: ['tuyen-dung'] },
    { name: 'canh-bao', label: 'Cảnh báo', crossDomain: true },
  ],
  clusters: [
    {
      name: 'tuyen-dung',
      label: 'Tuyển dụng',
      items: [
        {
          name: 'members', label: 'Nhân viên', path: '/members',
          under: [{ path: '/:id' }, { path: '/:id/in' }],
        },
        { name: 'register', label: 'Đăng ký nhân viên', path: '/members/new', need: ['ROLE-HR'] },
      ],
    },
    {
      name: 'ngan-sach',
      label: 'Ngân sách',
      items: [{
        name: 'budget', label: 'Kế hoạch ngân sách', path: '/budget', need: ['ROLE-FIN'],
        under: [{ path: '/moi', need: ['ROLE-ADMIN'] }],
      }],
    },
    {
      name: 'ky-luat',
      label: 'Kỷ luật',
      /* Khai phạm vi, chưa dựng màn — không có `path`. */
      items: [{ name: 'discipline', label: 'Hồ sơ kỷ luật', need: ['ROLE-HR'] }],
    },
  ],
}

const clerk = { roles: ['ROLE-HR'] }
const visitor = { roles: [] }

describe('hide, do not dim', () => {
  it('⭐ leaves out what the viewer may not enter', () => {
    const mine = navModel(NAV, clerk, '/hr/members')
    const theirs = navModel(NAV, visitor, '/hr/members')
    const items = (m: typeof mine) => m.clusters.flatMap((c) => c.items.map((i) => i.name))
    /* `discipline` chưa dựng nhưng VẪN thuộc về vai này — nó hiện, chỉ là xám.
       Người không giữ vai thì không thấy nó, y như mọi mục khác. */
    expect(items(mine)).toEqual(['members', 'register', 'discipline'])
    expect(items(theirs)).toEqual(['members'])
  })

  it('⭐ removes a cluster whose every item is hidden — no empty headings', () => {
    expect(navModel(NAV, clerk, '/hr/members').clusters.map((c) => c.name))
      .toEqual(['tuyen-dung', 'ky-luat'])
    expect(navModel(NAV, { roles: ['ROLE-HR', 'ROLE-FIN'] }, '/hr/members').clusters.map((c) => c.name))
      .toEqual(['tuyen-dung', 'ngan-sach', 'ky-luat'])
    /* `ngan-sach` biến mất với người không giữ ROLE-FIN — cụm rỗng thì không có
       tiêu đề rỗng. Còn `ky-luat` ở lại: nó KHÔNG rỗng, nó chưa dựng. */
    expect(navModel(NAV, visitor, '/hr/members').clusters.map((c) => c.name))
      .toEqual(['tuyen-dung'])
  })

  it('sends someone to the entry screen rather than an empty rail', () => {
    const m = navModel(NAV, visitor, '/training/members')
    expect(m.entry).toBe('launcher')
    expect(m.domain).toBeNull()
  })

  it('treats an unknown domain as the entry screen, not an error', () => {
    expect(navModel(NAV, clerk, '/khong-co-that').entry).toBe('launcher')
  })

  it('never enters a cross-domain feed as if it were a domain', () => {
    expect(navModel(NAV, clerk, '/canh-bao').entry).toBe('launcher')
  })
})

describe('where the viewer is', () => {
  it('lights the entry a child route belongs to', () => {
    expect(navModel(NAV, clerk, '/hr/members/m-1').active?.item.name).toBe('members')
    expect(navModel(NAV, clerk, '/hr/members/m-1/in').active?.item.name).toBe('members')
  })

  it('⭐ `end` giữ trang chủ không sáng đèn ở mọi trang con', () => {
    const withHome: NavDecl = {
      domains: [{ ...NAV.domains[0], clusters: ['home', 'tuyen-dung'] }],
      clusters: [
        { name: 'home', items: [{ name: 'home', label: 'Trang chủ', path: '/', end: true }] },
        ...NAV.clusters,
      ],
    }
    expect(navModel(withHome, clerk, '/hr').active?.item.name).toBe('home')
    expect(navModel(withHome, clerk, '/hr/members').active?.item.name).toBe('members')
  })

  it('cụm được phép không có tiêu đề', () => {
    const noLabel: NavDecl = {
      domains: [{ ...NAV.domains[0], clusters: ['thang'] }],
      clusters: [{ name: 'thang', items: [{ name: 'x', label: 'X', path: '/x' }] }],
    }
    expect(navModel(noLabel, clerk, '/hr/x').clusters[0].label).toBeUndefined()
  })

  it('⭐ prefers the longest matching path when two could claim it', () => {
    expect(navModel(NAV, clerk, '/hr/members/new').active?.item.name).toBe('register')
  })

  it('is nowhere when the path matches no entry', () => {
    expect(navModel(NAV, clerk, '/hr/bao-cao').active).toBeNull()
  })

  it('reads the domain off the first segment and nothing cleverer', () => {
    expect(domainOf('/hr/members/m-1')).toBe('hr')
    expect(domainOf('hr')).toBe('hr')
  })
})

describe('the routes are derived, so they cannot disagree with the menu', () => {
  it('⭐ yields the menu entries AND the pages under them', () => {
    expect(routesOf(NAV).map((r) => r.path)).toEqual([
      '/members', '/members/:id', '/members/:id/in', '/members/new',
      '/budget', '/budget/moi',
    ])
  })

  it('⛔ a child may NARROW the roles, and inherits when it does not', () => {
    const by = Object.fromEntries(routesOf(NAV).map((r) => [r.path, r.need]))
    expect(by['/budget']).toEqual(['ROLE-FIN'])
    expect(by['/budget/moi'], 'khai riêng thì hẹp lại').toEqual(['ROLE-ADMIN'])
    expect(by['/members/:id'], 'không khai thì kế thừa').toBeUndefined()
  })

  it('không sinh tuyến con cho mục chưa dựng', () => {
    expect(routesOf(NAV).some((r) => r.item.name === 'discipline')).toBe(false)
  })
})

describe('what it refuses', () => {
  it('catches two entries claiming one screen', () => {
    const dup: NavDecl = {
      ...NAV,
      clusters: [
        NAV.clusters[0],
        { name: 'x', label: 'X', items: [{ name: 'again', label: 'Lại', path: '/members' }] },
      ],
    }
    const d = navModel(dup, clerk, '/hr/members').diagnostics
    expect(d.some((x) => x.message.includes('already claimed'))).toBe(true)
  })

  it('catches a relative path, which works until it does not', () => {
    const bad: NavDecl = {
      ...NAV,
      clusters: [{ name: 'x', label: 'X', items: [{ name: 'y', label: 'Y', path: 'members' }] }],
    }
    expect(navModel(bad, clerk, '/hr').diagnostics.some((x) => x.message.includes('not absolute')))
      .toBe(true)
  })

  it('catches a domain listing a cluster nobody declared', () => {
    const bad: NavDecl = { ...NAV, domains: [{ name: 'hr', label: 'D', clusters: ['khong-co'] }] }
    expect(navModel(bad, clerk, '/hr').diagnostics.some((x) => x.message.includes('never declared')))
      .toBe(true)
  })
})


describe('mục CHƯA DỰNG — khác hẳn mục thiếu quyền', () => {
  it('⭐ vẫn hiện, đánh dấu `unbuilt`, cho vai có việc ở đó', () => {
    const m = navModel(NAV, clerk, '/hr/members')
    const ky = m.clusters.find((c) => c.name === 'ky-luat')
    expect(ky?.items).toHaveLength(1)
    expect(ky?.items[0].state).toBe('unbuilt')
  })

  it('⛔ nhưng vẫn LỌC THEO VAI — chưa dựng không có nghĩa là ai cũng thấy', () => {
    expect(navModel(NAV, visitor, '/hr/members').clusters.map((c) => c.name))
      .not.toContain('ky-luat')
  })

  it('không sinh tuyến đường nào — liên kết vào hư không tệ hơn một mục xám', () => {
    expect(routesOf(NAV).some((r) => r.item.name === 'discipline')).toBe(false)
  })

  it('không bao giờ là mục đang đứng', () => {
    expect(navModel(NAV, clerk, '/hr/discipline').active).toBeNull()
  })

  it('không bị bắt lỗi "đường dẫn không tuyệt đối" — nó không có đường dẫn', () => {
    expect(navModel(NAV, clerk, '/hr').diagnostics).toHaveLength(0)
  })

  it('mục đã dựng vẫn đánh dấu `ready`', () => {
    const m = navModel(NAV, clerk, '/hr/members')
    expect(m.clusters[0].items.every((i) => i.state === 'ready')).toBe(true)
  })
})
