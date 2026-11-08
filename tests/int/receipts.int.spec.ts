import { describe, expect, it } from 'vitest'
import { replyTimeLabel, seenReceipt, typicalReplyMinutes } from '@/messaging/receipts'

const t = (min: number) => new Date(Date.UTC(2027, 0, 1, 0, min)).toISOString()

describe('read receipts', () => {
  const msgs = [
    { id: 1, direction: 'out', createdAt: t(0) },
    { id: 2, direction: 'in', createdAt: t(10) },
  ]
  it('family sees "Seen by" once a coach opens it after their message', () => {
    expect(seenReceipt(msgs, [{ user: 7, at: t(5) }], { side: 'family', familyUserId: 1, names: { 7: 'Coach Sam' } })).toBeNull()
    expect(seenReceipt(msgs, [{ user: 1, at: t(11) }, { user: 7, at: t(20) }], { side: 'family', familyUserId: 1, names: { 7: 'Coach Sam' } })).toEqual({ id: 2, at: t(20), text: 'Seen by Coach Sam' })
  })
  it('coach sees "Seen" when the family opened it after the reply', () => {
    const m2 = [...msgs, { id: 3, direction: 'out', createdAt: t(30) }]
    expect(seenReceipt(m2, [{ user: 1, at: t(31) }], { side: 'management', familyUserId: 1 })?.text).toBe('Seen')
    expect(seenReceipt(m2, [{ user: 1, at: t(29) }], { side: 'management', familyUserId: 1 })).toBeNull()
  })
  it('nothing once the other side has replied', () => {
    expect(seenReceipt(msgs, [{ user: 7, at: t(20) }], { side: 'management', familyUserId: 1 })).toBeNull()
  })
})

describe('typical reply time', () => {
  it('median of first replies, needs enough replies', () => {
    const msgs = [30, 60, 90, 120, 600].flatMap((w, i) => [
      { id: i * 10, direction: 'in', createdAt: t(0), conversation: i },
      { id: i * 10 + 1, direction: 'in', createdAt: t(5), conversation: i },
      { id: i * 10 + 2, direction: 'out', createdAt: t(w), conversation: i },
    ])
    expect(typicalReplyMinutes(msgs)).toBe(90)
    expect(typicalReplyMinutes(msgs.slice(0, 6))).toBeNull()
  })
  it('labels', () => {
    expect(replyTimeLabel(45)).toBe('Usually replies within an hour')
    expect(replyTimeLabel(150)).toBe('Usually replies within 3 hours')
    expect(replyTimeLabel(20 * 60)).toBe('Usually replies within a day')
    expect(replyTimeLabel(50 * 60)).toBe('Usually replies within 3 days')
    expect(replyTimeLabel(null)).toBeNull()
  })
})
