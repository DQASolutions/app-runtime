import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Field } from './field.js'
import { fieldAttributes } from './field-attributes.js'

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.resetModules() })

describe('từ khai báo thuộc tính tới ô — `fieldAttributes`', () => {
  it('số tiền VND: minimum · maximum · multipleOf → min · max · step, và phần tử êm', () => {
    const a = fieldAttributes('number', { minimum: 0, maximum: 1e11, multipleOf: 1 })
    expect(a).toEqual({ min: 0, max: 1e11, step: 1 })
    expect(() => render(<Field type="number" name="amount" {...a} />)).not.toThrow()
  })
  it('exclusiveMinimum trên lưới bước ra đúng cận đóng: > 0 với bước 1 là ≥ 1', () => {
    expect(fieldAttributes('number', { exclusiveMinimum: 0, maximum: 10, multipleOf: 1 })).toEqual({ min: 1, max: 10, step: 1 })
  })
  it('ngày: formatMinimum · formatMaximum → min · max', () => {
    expect(fieldAttributes('date', { formatMinimum: '1900-01-01', formatMaximum: '2100-12-31' }))
      .toEqual({ min: '1900-01-01', max: '2100-12-31' })
  })
  it('mốc giờ: cận viết theo múi giờ → giờ tường cho ô datetime-local', () => {
    expect(fieldAttributes('datetime', { formatMinimum: '2020-01-01T00:00:00Z', formatMaximum: '2100-12-31' }))
      .toEqual({ min: '2020-01-01T00:00', max: '2100-12-31T00:00' })
  })
  it('chữ: maxLength · minLength · pattern', () => {
    expect(fieldAttributes('text', { maxLength: 12, minLength: 12, pattern: '^[0-9]{12}$' }))
      .toEqual({ maxLength: 12, minLength: 12, pattern: '^[0-9]{12}$' })
  })

  it('khai cả `minimum` lẫn `exclusiveMinimum` thì lấy cận chặt hơn', () => {
    // soLuong (min 0) thu hẹp thành "phải dương".
    expect(fieldAttributes('number', { minimum: 0, exclusiveMinimum: 0, maximum: 1e9, multipleOf: 1 })).toEqual({ min: 1, max: 1e9, step: 1 })
    expect(fieldAttributes('number', { minimum: 0, exclusiveMinimum: 0, maximum: 1e9, multipleOf: 0.001 }).min).toBe(0.001)
    expect(fieldAttributes('number', { minimum: 5, exclusiveMinimum: 0, maximum: 10, exclusiveMaximum: 8, multipleOf: 1 })).toEqual({ min: 5, max: 7, step: 1 })
  })

  it('ô danh sách: trần là của CẢ danh sách, không phải của một mục', () => {
    // 500 mục × (300 + xuống dòng) − 1. `pattern` của mục không lên ô.
    expect(fieldAttributes('text[]', { maxItems: 500, maxLength: 300, pattern: '^x$' })).toEqual({ maxLength: 150_499 })
    expect(fieldAttributes('text[]', { maxItems: 500 })).toEqual({})
  })
})
