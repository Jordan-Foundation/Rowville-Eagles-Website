import { describe, expect, it } from 'vitest'
import { dobProblem, emailOk, phoneOk } from '../../src/lib/validate'

describe('form checks', () => {
  it('Australian phone numbers', () => {
    for (const ok of ['0412 345 678', '0412345678', '+61 412 345 678', '(03) 9876 5432', '0495101515']) expect(phoneOk(ok)).toBe(true)
    for (const bad of ['abc', '12345', '0412 345', '+1 555 123 4567']) expect(phoneOk(bad)).toBe(false)
  })
  it('dates of birth', () => {
    const now = new Date('2026-11-08T00:00:00Z')
    expect(dobProblem('2016-03-03', now)).toBeNull()
    expect(dobProblem('2030-01-01', now)).toContain('future')
    expect(dobProblem('1900-01-01', now)).toContain('year')
    expect(dobProblem('03/03/2016', now)).toContain('valid')
  })
  it('emails', () => {
    expect(emailOk('a@b.com')).toBe(true)
    expect(emailOk('a@b')).toBe(false)
  })
})
