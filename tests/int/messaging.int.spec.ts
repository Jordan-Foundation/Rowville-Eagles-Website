import { describe, expect, it } from 'vitest'
import { isUnread, preview, smsReply } from '@/messaging/rules'

describe('messaging', () => {
  it('unread when the other side wrote after you last read', () => {
    const c = { lastFamilyAt: '2026-11-08T10:00:00Z', lastStaffAt: '2026-11-08T09:00:00Z', reads: [{ user: 5, at: '2026-11-08T09:30:00Z' }, { user: { id: 9 }, at: '2026-11-08T10:05:00Z' }] }
    expect(isUnread(c, 5, 'staff')).toBe(true) // coach 5 read before the family's 10:00 message
    expect(isUnread(c, 9, 'staff')).toBe(false)
    expect(isUnread(c, 7, 'staff')).toBe(true) // never opened
    expect(isUnread(c, 9, 'family')).toBe(false)
    expect(isUnread({ lastFamilyAt: null }, 1, 'staff')).toBe(false)
  })
  it('previews and signs texts', () => {
    expect(preview('Hi\n\n  there  ')).toBe('Hi there')
    expect(smsReply(' See you Tuesday ', 'Coach Sam')).toBe('See you Tuesday\n– Coach Sam, Foundation Academy')
    expect(smsReply('Hi', 'Foundation Academy')).toBe('Hi\n– Foundation Academy')
  })
})
