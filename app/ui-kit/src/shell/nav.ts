// The SHELL lens: who may go where, and where they are now.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ WHAT THIS REPLACES
//
//   `libs/ui-shell/App.jsx` in the reference app opens with 127 consecutive
//   import lines, one per page, and a route table written by hand beside them.
//   The navigation itself is already declared — `app/navigation.yaml`, served
//   over an endpoint, with a build check comparing every menu path against the
//   routes underneath.
//
//   ⭐ That check exists because the two lists can disagree. Derive the routes
//      FROM the navigation and they cannot: `routesOf()` below turns a check
//      that can fail into a question that cannot be asked.
//
// ⭐ AND THE RULING THE REFERENCE APP GOT RIGHT, KEPT VERBATIM:
//
//     *"hiện hết mọi mục rồi báo bạn không có quyền là bắt người dùng học một
//      hệ thống không phải của họ."*
//
//   Hide what the viewer may not enter. Do not dim it. A dimmed item with an
//   explanation is for work that IS theirs but is not yet their turn — a
//   different thing, and it belongs on the record, not in the rail.
// ═══════════════════════════════════════════════════════════════════════════

import type { LensDiagnostic } from '../lens/index.js'

export interface NavItem {
  name: string
  label: string
  /**
   * Absolute, within the domain. `/members`, not `members`.
   *
   * ⭐ OPTIONAL, AND THE ABSENCE MEANS SOMETHING: this part of the scope is
   *    DECLARED BUT NOT BUILT YET. The item still appears, dimmed and inert.
   *
   *    Borrowed from an application bitten by the opposite: its menu was
   *    hand-written and listed only finished screens, so a system with 19
   *    entities across 5 clusters opened as a 9-item product and one whole
   *    cluster was invisible. A menu is a MAP OF THE SCOPE, and a map that omits
   *    the unbuilt roads is not a smaller map — it is a wrong one.
   */
  path?: string
  /** Roles that may enter. Absent means everyone in the domain. */
  need?: string[]
  /**
   * Match this path EXACTLY, never as a prefix.
   *
   * ⚠️ Almost always wrong, and load-bearing for the one case it is right: an
   *    item at `/` is a prefix of every other page, so without this the home
   *    entry is lit on every screen in the product.
   */
  end?: boolean
  /**
   * Routes that live UNDER this item and never appear in a menu.
   *
   * ⛔ ADDED AFTER A CLAIM OF MINE TURNED OUT WRONG BY A FACTOR OF THREE.
   *
   *   The fit log said `routesOf()` replaces a hand-written route table: "126
   *   imports, 130 routes". Run against a real declaration it produced **49
   *   routes against the application's 128**. The 79 missing were never menu
   *   entries and never could be — `/members/:id`, `/plans/new`,
   *   `/documents/:id/print`. A menu that lists `/members/:id` is a broken menu.
   *
   *   ⭐ So `routesOf` was never a route-table generator. It was HALF a table,
   *      and the other half had no vocabulary. This is that half.
   *
   *   Paths are relative to the parent, so the prefix stays written once. A
   *   child may NARROW the roles — a "new record" form is routinely restricted
   *   where the list above it is not, and today that restriction is retyped by
   *   hand in a route guard.
   */
  under?: { path: string; need?: string[]; end?: boolean }[]
}

/**
 * ⛔ TWO REASONS AN ITEM IS NOT AVAILABLE, AND THEY MUST NOT LOOK ALIKE.
 *
 *   hidden  — the viewer does not hold the role. Left out entirely: showing
 *             every item and then refusing makes someone learn a system that is
 *             not theirs.
 *   unbuilt — the work IS theirs and the screen does not exist yet. Shown,
 *             dimmed, inert. Hiding it misreports the scope; enabling it is a
 *             link into nothing.
 *
 *   Collapsing the two into one grey state is a rail lying in both directions
 *   at once.
 */
export type ItemState = 'ready' | 'unbuilt'

export interface NavCluster {
  name: string
  /**
   * ⚠️ Optional: a cluster may have no heading at all. Some rails open with a
   *    few entries belonging to no named group, and inventing a title for them
   *    ("General", "Other") adds a word the reader has to skip past.
   */
  label?: string
  items: NavItem[]
}

/** An item as the rail should draw it. */
export interface ResolvedNavItem extends NavItem {
  state: ItemState
}

export interface ResolvedNavCluster {
  name: string
  label?: string
  items: ResolvedNavItem[]
}

export interface NavDomain {
  name: string
  label: string
  need?: string[]
  /** Reachable from every domain — an alert feed, a search. */
  crossDomain?: boolean
  /** Cluster names, in the order they should read. */
  clusters?: string[]
}

export interface NavDecl {
  domains: NavDomain[]
  clusters: NavCluster[]
}

export interface Viewer {
  roles: string[]
}

export interface NavModel {
  /** Null when the path names no domain the viewer may enter. */
  domain: NavDomain | null
  /** What to draw in the rail — already filtered, already ordered. */
  clusters: ResolvedNavCluster[]
  active: { cluster: string; item: ResolvedNavItem } | null
  /** `launcher` when there is no domain to show: the entry screen, not an error. */
  entry: 'launcher' | 'domain'
  diagnostics: LensDiagnostic[]
}

const mayEnter = (need: string[] | undefined, viewer: Viewer) =>
  !need?.length || need.some((r) => viewer.roles.includes(r))

/** The domain a path is inside — the first segment, and nothing cleverer. */
export const domainOf = (path: string): string => path.replace(/^\/+/, '').split('/')[0] ?? ''

export function navModel(decl: NavDecl, viewer: Viewer, path: string): NavModel {
  const diagnostics: LensDiagnostic[] = []
  const byName = new Map(decl.clusters.map((c) => [c.name, c]))

  const seen = new Map<string, string>()
  for (const cluster of decl.clusters) {
    for (const item of cluster.items) {
      if (item.path == null) continue // scope declared, screen not built — claims nothing
      if (!item.path.startsWith('/')) {
        diagnostics.push({
          severity: 'error',
          code: 'CONTRACT_GAP',
          where: `${cluster.name}.${item.name}`,
          message: `"${item.path}" is not absolute. A relative menu path resolves differently `
            + `depending on the page it is clicked from, which is a link that works until it does not.`,
        })
      }
      const already = seen.get(item.path)
      if (already) {
        diagnostics.push({
          severity: 'error',
          code: 'CONTRACT_GAP',
          where: `${cluster.name}.${item.name}`,
          message: `"${item.path}" is already claimed by "${already}". Two menu entries pointing at `
            + `one screen means one of them is a name nobody can navigate back to.`,
        })
      } else {
        seen.set(item.path, `${cluster.name}.${item.name}`)
      }
    }
  }

  const segment = domainOf(path)
  const domain = decl.domains.find((d) => d.name === segment && !d.crossDomain) ?? null

  if (!domain || !mayEnter(domain.need, viewer)) {
    /* ⚠️ Not an error and not a redirect loop: a viewer who typed a domain they
       do not hold, or who has just signed in, belongs on the entry screen. */
    return { domain: null, clusters: [], active: null, entry: 'launcher', diagnostics }
  }

  const order = domain.clusters?.length ? domain.clusters : decl.clusters.map((c) => c.name)
  for (const name of order) {
    if (!byName.has(name)) {
      diagnostics.push({
        severity: 'error',
        code: 'CONTRACT_GAP',
        where: `domains.${domain.name}`,
        message: `cluster "${name}" is listed but never declared, so a section of this domain has `
          + `no way in and nothing says so.`,
      })
    }
  }

  const clusters = order
    .map((name) => byName.get(name))
    .filter((c): c is NavCluster => c != null)
    .map((c) => ({
      ...c,
      items: c.items
        .filter((i) => mayEnter(i.need, viewer))
        .map((i): ResolvedNavItem => ({ ...i, state: i.path == null ? 'unbuilt' : 'ready' })),
    }))
    /* ⭐ A cluster whose every item is hidden disappears too. An empty heading
       tells the viewer a section exists that they cannot open — the same harm as
       showing the items, with less information. */
    .filter((c) => c.items.length > 0)

  /* Longest matching prefix, so `/members/123` lights up `/members` and a
     `/members/new` entry beats it when both exist. */
  const inside = '/' + path.replace(/^\/+/, '').split('/').slice(1).join('/')
  let active: NavModel['active'] = null
  for (const cluster of clusters) {
    for (const item of cluster.items) {
      if (item.path == null) continue
      /* ⭐ A declared child route marks its parent active — no prefix guessing.
         `/members/42` lights "Nhân viên" because the declaration says `/:id`
         lives under it, not because one string happens to begin with another. */
      const hit = item.end ? inside === item.path
        : inside === item.path || inside.startsWith(item.path + '/')
      if (!hit) continue
      if (!active || item.path.length > (active.item.path?.length ?? 0)) {
        active = { cluster: cluster.name, item }
      }
    }
  }

  return { domain, clusters, active, entry: 'domain', diagnostics }
}

/**
 * Every route the shell must serve, derived from the declaration.
 *
 * ⭐ The point is that it is DERIVED. A hand-written route table and a
 *    hand-written menu are two lists of the same thing, and the reference app
 *    had to write a build check to keep them honest. Generate one from the
 *    other and there is nothing left to check.
 */
export interface Route {
  path: string
  item: NavItem
  cluster: string
  /** True for a route that is not itself a menu entry — see `NavItem.under`. */
  child: boolean
  /** Roles for THIS route: the child's if it narrows, otherwise the item's. */
  need?: string[]
}

const join = (parent: string, child: string) =>
  `${parent.replace(/\/$/, '')}/${child.replace(/^\//, '')}`

/**
 * Every route the shell must serve — menu entries AND the pages under them.
 *
 * ⚠️ Unbuilt items yield nothing, children included. A route to a screen that
 *    does not exist is a blank page, which reads as a defect; a dimmed menu
 *    entry reads as "not yet", which is the truth.
 */
export const routesOf = (decl: NavDecl): Route[] =>
  decl.clusters.flatMap((c) => c.items.flatMap((item): Route[] => {
    const path = item.path
    if (path == null) return []
    const self: Route = {
      path, item, cluster: c.name, child: false,
      ...(item.need ? { need: item.need } : {}),
    }
    const kids = (item.under ?? []).map((u): Route => {
      const need = u.need ?? item.need
      return {
        path: join(path, u.path), item, cluster: c.name, child: true,
        ...(need ? { need } : {}),
      }
    })
    return [self, ...kids]
  }))
