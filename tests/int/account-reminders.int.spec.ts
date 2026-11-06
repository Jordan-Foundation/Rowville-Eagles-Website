import { describe, expect, it } from 'vitest'
import { accountReminderDue } from '@/lib/account-reminders'

const now = new Date('2027-02-10T00:00:00Z')
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString()

describe('create-account reminder', () => {
  it('is due 3 days after the account was made from a booking', () => {
    expect(accountReminderDue({ createdAt: daysAgo(3), activated: false }, 3, now)).toBe(true)
    expect(accountReminderDue({ createdAt: daysAgo(2.9), activated: false }, 3, now)).toBe(false)
  })
  it('is sent once only', () => {
    expect(accountReminderDue({ createdAt: daysAgo(5), activated: false, accountReminderSentAt: daysAgo(2) }, 3, now)).toBe(false)
  })
  it('is never sent to someone who already set up their account', () => {
    expect(accountReminderDue({ createdAt: daysAgo(5), activated: true }, 3, now)).toBe(false)
  })
  it('skips old accounts', () => {
    expect(accountReminderDue({ createdAt: daysAgo(31), activated: false }, 3, now)).toBe(false)
  })
  it('follows the term setting', () => {
    expect(accountReminderDue({ createdAt: daysAgo(5), activated: false }, 7, now)).toBe(false)
  })
})
