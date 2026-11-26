import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { Link } from './link.js'
import { setPrefix } from '../prefix/index.js'

afterEach(() => { cleanup(); setPrefix('fos') })

const a = (c: ReactNode) => render(<>{c}</>).container.querySelector('a')!

describe('Link — goes somewhere, never commits', () => {
  it('is an anchor carrying the kit\'s class, and the class the caller added', () => {
    const el = a(<Link href="/ke-hoach" className="mine">đi</Link>)
    expect(el.tagName).toBe('A')
    expect(el.className).toBe('fos-link mine')
    expect(el.getAttribute('href')).toBe('/ke-hoach')
  })

  it('writes the stem the app configured, not the one it was born with', () => {
    setPrefix('acme')
    expect(a(<Link href="/x">đi</Link>).className).toBe('acme-link')
  })

  it('disabled: says so to a reader AND stops being a destination', () => {
    const el = a(<Link href="/ke-hoach" disabled>chưa mở</Link>)
    expect(el.getAttribute('aria-disabled')).toBe('true')
    expect(el.hasAttribute('href')).toBe(false)
    expect(el.hasAttribute('disabled')).toBe(false)
  })

  it('hands the tag to the router when asked', () => {
    const Router = (p: { to: string; children?: ReactNode; className?: string }) =>
      createElement('a', { href: p.to, className: p.className, 'data-router': '' }, p.children)
    const el = a(<Link as={Router} {...{ to: '/kh' }}>đi</Link>)
    expect(el.hasAttribute('data-router')).toBe(true)
    expect(el.className).toBe('fos-link')
  })

  it('drops the router when disabled — no destination, no router', () => {
    const Router = (p: { children?: ReactNode }) =>
      createElement('a', { 'data-router': '' }, p.children)
    expect(a(<Link as={Router} disabled>chưa mở</Link>).hasAttribute('data-router')).toBe(false)
  })
})
