import { describe, expect, it } from 'vitest'
import { dialable, formatPhone, isMobile } from '@/lib/phone'

describe('phone numbers', () => {
  it('formats the usual ways people type them', () => {
    for (const raw of ['0412345678', '0412 345 678', '+61 412 345 678', '61412345678', '(04) 1234-5678']) expect(formatPhone(raw)).toBe('0412 345 678')
    expect(formatPhone('0391234567')).toBe('03 9123 4567')
    expect(formatPhone('1300123456')).toBe('1300 123 456')
    expect(formatPhone(' ext 5 ')).toBe('ext 5')
  })
  it('dials in international form', () => {
    expect(dialable('0412 345 678')).toBe('+61412345678')
    expect(dialable('03 9123 4567')).toBe('+61391234567')
    expect(dialable('hello')).toBeNull()
    expect(isMobile('+61412345678')).toBe(true)
    expect(isMobile('03 9123 4567')).toBe(false)
  })
})
