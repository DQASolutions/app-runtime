import { describe, expect, it, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { Milestones, Milestone, MilestonesFoot, MilestoneNote } from './milestone.js'

afterEach(cleanup)

describe('Milestones — a route, and where on it the record is', () => {
  const route = (
    <Milestones label="Kế hoạch huấn luyện">
      <Milestone label="Bản nháp" standing="past" mark="✓" who="Trợ lý Đào tạo" />
      <Milestone label="Đã trình cấp trên" standing="current" who="Trưởng phòng" />
      <Milestone label="Phê duyệt kế hoạch" standing="ahead" gate awaiting who="Ban giám đốc tỉnh" />
      <Milestone label="Đã mời" standing="ahead" />
    </Milestones>
  )

  /* ⭐ THE ONE THING A SIGHTED READER GETS FOR FREE. Without `aria-current` a
     listener hears four labels in a row and no way to tell which one is now —
     which is the entire question the strip exists to answer. */
  it('marks exactly one point as where the record is', () => {
    const { container } = render(route)
    const current = container.querySelectorAll('[aria-current]')
    expect(current).toHaveLength(1)
    expect(current[0]!.textContent).toContain('Đã trình cấp trên')
    expect(current[0]!.getAttribute('aria-current')).toBe('step')
  })

  it('names the group, so two routes on one screen are not both "group"', () => {
    render(route)
    expect(screen.getByRole('group', { name: 'Kế hoạch huấn luyện' })).toBeTruthy()
  })

  it('wears the standing the caller was given, not one it worked out', () => {
    const { container } = render(route)
    expect([...container.querySelectorAll('.fos-milestone')].map((el) => el.className))
      .toEqual([
        'fos-milestone fos-milestone--past',
        'fos-milestone fos-milestone--current',
        'fos-milestone fos-milestone--ahead fos-milestone--gate fos-milestone--awaiting',
        'fos-milestone fos-milestone--ahead',
      ])
  })

  /* ⛔ The mark is the FOURTH channel, after colour, connector and `aria-current`
     — so it must be hidden from a reader who would otherwise hear "tick". */
  it('hides the mark from assistive readers', () => {
    const { container } = render(route)
    expect(container.querySelector('.fos-milestone-dot')!.getAttribute('aria-hidden')).toBe('true')
  })

  it('leaves out the actor line when nobody was named', () => {
    const { container } = render(<Milestone label="Đã mời" standing="ahead" />)
    expect(container.querySelector('.fos-milestone-who')).toBeNull()
  })

  /*
    ⛔ AN APPROVED GATE THAT STILL LOOKS LIKE A WAIT IS THE PICTURE CONTRADICTING
       THE WORDS. On a cross-level line the record does not move when the level
       above decides, so `--past` is all the kit can say — and `--gate` repaints
       the dot after it. Without a class of its own, "already approved" prints
       under a warn-coloured ring. Reported on the reference app 9/9/2026.
  */
  it('says a gate was RULED ON, and which way — its own class either way', () => {
    const { container } = render(
      <>
        <Milestone label="Phê duyệt" standing="past" gate settled="passed" />
        <Milestone label="Phê duyệt" standing="past" gate settled="refused" />
      </>,
    )
    expect([...container.querySelectorAll('.fos-milestone')].map((el) => el.className))
      .toEqual([
        'fos-milestone fos-milestone--past fos-milestone--gate fos-milestone--passed',
        'fos-milestone fos-milestone--past fos-milestone--gate fos-milestone--refused',
      ])
  })

  it('draws off-route work below the rail, not as points on it', () => {
    const { container } = render(
      <>
        {route}
        <MilestonesFoot>
          <MilestoneNote mark={<i data-t="back" />}>Trả lại thì kế hoạch về Bản nháp</MilestoneNote>
          <MilestoneNote mark={<i data-t="side" />}>Ghi diễn biến — chạy song song</MilestoneNote>
          <MilestoneNote mark={<i data-t="aside" />}>Quyết định điều chuyển — làm khi cần</MilestoneNote>
        </MilestonesFoot>
      </>,
    )
    const foot = container.querySelector('.fos-milestones-foot')!
    expect(foot.querySelectorAll('.fos-milestone-note')).toHaveLength(3)
    /* Outside the rail, so none can be read as another point in the sequence. */
    expect(container.querySelector('.fos-milestones')!.contains(foot)).toBe(false)
    expect(container.querySelectorAll('.fos-milestone')).toHaveLength(4)
  })

  /* ⛔ THE SEAM IS ONE SEAM. Three lines each drawing their own divider was the
     shape this replaced, and it stacked three rules under a four-point rail. */
  it('draws the divider once, on the foot, not once per line', () => {
    const { container } = render(
      <MilestonesFoot>
        <MilestoneNote mark={<i />}>một</MilestoneNote>
        <MilestoneNote mark={<i />}>hai</MilestoneNote>
      </MilestonesFoot>,
    )
    expect(container.querySelectorAll('.fos-milestones-foot')).toHaveLength(1)
    expect(container.querySelectorAll('.fos-milestone-note')).toHaveLength(2)
  })

  /* ⚠️ Three lines that read alike need three different marks, or they are one
     grey paragraph. The mark is hidden from a reader who hears the words. */
  it('hides each note’s mark from assistive readers', () => {
    const { container } = render(
      <MilestonesFoot><MilestoneNote mark={<i data-t="x" />}>lời</MilestoneNote></MilestonesFoot>,
    )
    const note = container.querySelector('.fos-milestone-note')!
    expect(note.firstElementChild!.getAttribute('aria-hidden')).toBe('true')
    expect(note.textContent).toBe('lời')
  })
})
