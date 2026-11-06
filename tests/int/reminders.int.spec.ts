import { describe, expect, it } from 'vitest'
import { daysUntil, dueReminder } from '@/academy/reminders'

const none = new Set<string>()

describe('which availability reminder is due', () => {
  it('sends nothing more than 2 weeks out', () => expect(dueReminder(15, none)).toBeNull())
  it('sends the 2-week reminder from 14 days out', () => expect(dueReminder(14, none)).toBe('14d'))
  it('does not repeat a reminder already sent', () => expect(dueReminder(10, new Set(['14d']))).toBeNull())
  it('moves to 1 week, 3 days and 1 day', () => {
    expect(dueReminder(7, new Set(['14d']))).toBe('7d')
    expect(dueReminder(3, new Set(['14d', '7d']))).toBe('3d')
    expect(dueReminder(1, new Set(['14d', '7d', '3d']))).toBe('1d')
  })
  it('does not send missed reminders late — only the most urgent one', () => {
    expect(dueReminder(5, none)).toBe('7d')
    expect(dueReminder(2, none)).toBe('3d')
  })
  it('sends nothing on or after the deadline day', () => {
    expect(dueReminder(0, none)).toBeNull()
    expect(dueReminder(-2, none)).toBeNull()
  })
})

describe('days until the deadline (Sydney calendar days)', () => {
  const deadline = new Date('2027-01-15T07:00:00Z') // Fri 15 Jan, 6pm AEDT
  it('counts calendar days, not 24-hour blocks', () => {
    expect(daysUntil(deadline, new Date('2027-01-13T19:07:00Z'))).toBe(1) // daily run at 6:07am Thu 14 Jan
    expect(daysUntil(deadline, new Date('2027-01-14T19:07:00Z'))).toBe(0) // 6:07am Fri 15 Jan — deadline day
    expect(daysUntil(deadline, new Date('2027-01-01T19:07:00Z'))).toBe(13)
  })
})
