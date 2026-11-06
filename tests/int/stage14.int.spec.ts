import { describe, expect, it } from 'vitest'
import { bookingSummary } from '@/academy/coach-alerts'
import { reviewDue } from '@/academy/review-requests'
import { toE164 } from '@/lib/sms'

const tue = (d: number) => ({ startsAt: new Date(Date.UTC(2027, 1, 2 + 7 * d, 6)).toISOString() }) // Tuesdays 5pm Sydney

describe('coach booking alert', () => {
  it('summarises a whole term in one line — one message, not one per session', () => {
    const s = bookingSummary({ type: 'term', weekday: 'Tuesday' }, Array.from({ length: 9 }, (_, i) => tue(i)))
    expect(s).toBe('Tuesdays 5:00 pm, 9 sessions 2 Feb–30 Mar')
  })
  it('describes a casual session and a make-up', () => {
    expect(bookingSummary({ type: 'casual', weekday: null }, [tue(1)])).toBe('casual 1-on-1 Tue, 9 Feb, 5:00 pm')
    expect(bookingSummary({ type: 'term', weekday: 'Tuesday' }, [tue(1)], { makeUp: true })).toBe('make-up 1-on-1 Tue, 9 Feb, 5:00 pm')
  })
  it('formats Australian mobiles for SMS', () => {
    expect(toE164('0412 345 678')).toBe('+61412345678')
    expect(toE164('+61412345678')).toBe('+61412345678')
    expect(toE164('03 9123 4567')).toBeNull()
  })
})

describe('google review request', () => {
  it('asks once, at the milestone', () => {
    expect(reviewDue(11, 12, false)).toBe(false)
    expect(reviewDue(12, 12, false)).toBe(true)
    expect(reviewDue(30, 12, true)).toBe(false)
  })
})
