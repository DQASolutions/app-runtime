import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { createElement } from 'react'
import { Segmented, SegmentedItem } from './segmented.js'
import { setPrefix } from '../prefix/index.js'

afterEach(() => { cleanup(); setPrefix('fos') })
const box = (c: React.ReactNode) => render(<>{c}</>).container

describe('segmented — đổi CÁCH nhìn, không đổi CHỖ đứng', () => {
  it('nhóm có vai và có tên — không thì đọc lên là năm nút vô danh', () => {
    const el = box(<Segmented label="Lọc theo trạng thái"><SegmentedItem icon={<i />}>a</SegmentedItem></Segmented>)
      .firstElementChild!
    expect(el.getAttribute('role')).toBe('group')
    expect(el.getAttribute('aria-label')).toBe('Lọc theo trạng thái')
    expect(el.className).toBe('fos-segmented')
  })

  it('mục là <button type=button> mang lớp nhân', () => {
    const b = box(<Segmented label="x"><SegmentedItem icon={<i />}>Toàn bộ</SegmentedItem></Segmented>)
      .querySelector('button')!
    expect(b.getAttribute('type')).toBe('button')
    expect(b.className).toBe('fos-segmented-item')
    expect(b.textContent).toBe('Toàn bộ')
  })

  it('`current` nói bằng aria-current=page — thứ nhân neo vào', () => {
    const b = box(<Segmented label="x"><SegmentedItem icon={<i />} current>a</SegmentedItem></Segmented>)
      .querySelector('button')!
    expect(b.getAttribute('aria-current')).toBe('page')
  })

  it('không current thì KHÔNG ghi aria-current="false"', () => {
    expect(box(<Segmented label="x"><SegmentedItem icon={<i />}>a</SegmentedItem></Segmented>)
      .querySelector('button')!.hasAttribute('aria-current')).toBe(false)
  })

  /*
   * ⛔ SỐ 0 PHẢI HIỆN. `count && …` nuốt mất nó, và một lát "Đã huỷ" không có
   *    con số đọc ra như *"bộ lọc hỏng"*, chứ không phải *"không có cái nào"*.
   */
  it('số 0 vẫn vẽ ra — nó nói trạng thái ấy CÓ và đang rỗng', () => {
    const el = box(<Segmented label="x"><SegmentedItem icon={<i />} count={0}>Đã huỷ</SegmentedItem></Segmented>)
    expect(el.querySelector('.fos-count')!.textContent).toBe('0')
  })

  it('không truyền count thì không vẽ ô số', () => {
    expect(box(<Segmented label="x"><SegmentedItem icon={<i />}>a</SegmentedItem></Segmented>)
      .querySelector('.fos-count')).toBeNull()
  })

  /* ⚠️ Con số đi CẠNH nhãn, không thay nhãn — một con số trần không đọc được. */
  it('số đứng sau nhãn, nhãn vẫn còn nguyên', () => {
    const b = box(<Segmented label="x"><SegmentedItem icon={<i />} count={12}>Đang lập</SegmentedItem></Segmented>)
      .querySelector('button')!
    expect(b.textContent).toBe('Đang lập12')
    /* ⭐ Thứ tự nay là HÌNH · NHÃN · SỐ — dấu vào mắt trước, rồi tới chữ, rồi
       tới con số đếm. Bản trước hình chưa bắt buộc nên nhãn đứng đầu. */
    expect(b.children[0].tagName.toLowerCase()).toBe('i')
    expect(b.childNodes[1]!.textContent).toBe('Đang lập')
  })

  it('bấm gọi đúng onClick', () => {
    const onClick = vi.fn()
    fireEvent.click(box(<Segmented label="x"><SegmentedItem icon={<i />} onClick={onClick}>a</SegmentedItem></Segmented>)
      .querySelector('button')!)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  /*
   * ⭐ Bộ lọc sống trong ĐƯỜNG DẪN thì chia sẻ được, đánh dấu được, bấm Back
   *    được. Nhân không biết bộ định tuyến nào, nên nhận nó qua `as`.
   */
  it('`as` cho phép mục là một liên kết của bộ định tuyến', () => {
    /* ⚠️ Bản giả phải CHUYỂN TIẾP props lạ xuống DOM, y như `Link` thật của
       bộ định tuyến. Bản đầu chỉ nhận `to`/`className`/`children` nên nó nuốt
       mất `aria-current`, và phép thử đỏ vì bản giả sai chứ không phải mã sai —
       một phép thử dựng sai bản giả thì đo chính bản giả. */
    const RouterLink = ({ to, children, ...rest }: { to: string; children?: React.ReactNode }) =>
      createElement('a', { ...rest, href: to, 'data-router': '' }, children)
    const a = box(
      <Segmented label="x">
        <SegmentedItem icon={<i />} as={RouterLink} {...{ to: '/orders?status=draft' }} current count={3}>
          Đang lập
        </SegmentedItem>
      </Segmented>,
    ).querySelector('a')!
    expect(a.getAttribute('href')).toBe('/orders?status=draft')
    expect(a.className).toBe('fos-segmented-item')
    expect(a.getAttribute('aria-current')).toBe('page')
    expect(a.querySelector('.fos-count')!.textContent).toBe('3')
  })

  it('khoá đi thẳng xuống nút và chặn onClick', () => {
    const onClick = vi.fn()
    const b = box(<Segmented label="x"><SegmentedItem icon={<i />} disabled onClick={onClick}>a</SegmentedItem></Segmented>)
      .querySelector('button')!
    expect(b.hasAttribute('disabled')).toBe(true)
    fireEvent.click(b)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('đổi stem thì cả ba lớp đổi theo', () => {
    setPrefix('acme')
    const c = box(<Segmented label="x"><SegmentedItem icon={<i />} count={1}>a</SegmentedItem></Segmented>)
    expect(c.firstElementChild!.className).toBe('acme-segmented')
    expect(c.querySelector('button')!.className).toBe('acme-segmented-item')
    expect(c.querySelector('.acme-count')).not.toBeNull()
  })

  it('có `icon` thì hình đứng TRƯỚC chữ', () => {
    const el = render(<Segmented label="x"><SegmentedItem icon={<i data-t="m" />}>Chọn</SegmentedItem></Segmented>).container
    const b = el.querySelector('[role]')!.querySelector('button, a')!
    expect(b.children[0].getAttribute('data-t')).toBe('m')
  })
})
