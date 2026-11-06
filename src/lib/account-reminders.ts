import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { accountLink } from './accounts'
import { emailLayout, esc } from './email-templates'
import { sendEmail } from './email'
import { inviteTtlDays } from './invites'

/** Default days after the first booking before the one "create your account" reminder. */
export const DEFAULT_ACCOUNT_REMINDER_DAYS = 3
/** Accounts older than this never get a reminder (avoids emailing old records on first deploy). */
export const ACCOUNT_REMINDER_MAX_AGE_DAYS = 30

const DAY = 86_400_000

/** Pure: is the one-off reminder due for this account? */
export function accountReminderDue(u: Pick<User, 'createdAt' | 'activated' | 'accountReminderSentAt'>, days: number, now: Date) {
  if (u.activated || u.accountReminderSentAt) return false
  const age = now.getTime() - new Date(u.createdAt).getTime()
  return age >= days * DAY && age <= ACCOUNT_REMINDER_MAX_AGE_DAYS * DAY
}

export const accountBenefits = [
  'All your sessions and bookings in one place',
  'Booking reminders',
  'Manage your bookings',
  'Payment history',
  'Faster rebooking — your details are saved',
  'Club and Academy updates',
  'Player development pathway (coming soon)',
]

/**
 * Daily: one reminder, once, to families who booked as a guest but haven't set up their account.
 * The account is claimed (accountReminderSentAt set) before sending, so a second run can't send twice.
 */
export async function sendAccountReminders(payload: Payload, now = new Date()) {
  const result = { checked: 0, sent: 0 }
  const { docs: users } = await payload.find({
    collection: 'users',
    where: {
      activated: { not_equals: true },
      accountReminderSentAt: { exists: false },
      createdAt: { less_than_equal: new Date(now.getTime() - DAY).toISOString(), greater_than: new Date(now.getTime() - ACCOUNT_REMINDER_MAX_AGE_DAYS * DAY).toISOString() },
    },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  for (const user of users) {
    result.checked++
    const [{ docs: academy }, { totalDocs: club }] = await Promise.all([
      payload.find({ collection: 'academy-bookings', where: { account: { equals: user.id }, status: { in: ['confirmed', 'completed', 'payment_failed'] } }, sort: 'createdAt', limit: 1, depth: 1, overrideAccess: true }),
      payload.count({ collection: 'bookings', where: { account: { equals: user.id }, status: { equals: 'paid' } }, overrideAccess: true }),
    ])
    if (!academy.length && !club) continue // not from a booking (e.g. an interest form) — no reminder
    const term = academy[0] && typeof academy[0].term === 'object' ? academy[0].term : null
    const days = term?.accountReminderDays ?? DEFAULT_ACCOUNT_REMINDER_DAYS
    if (!accountReminderDue(user, days, now)) continue

    const claimed = await payload.update({
      collection: 'users',
      where: { id: { equals: user.id }, accountReminderSentAt: { exists: false } },
      data: { accountReminderSentAt: now.toISOString() },
      overrideAccess: true,
    })
    if (!claimed.docs.length) continue

    const brand = academy.length && !club ? 'academy' : 'club'
    const player = academy[0]?.player.firstName
    const link = await accountLink(payload, user)
    const html = emailLayout(brand, [
      {
        heading: 'Finish setting up your account',
        intro: `Hi ${esc(user.firstName || 'there')}, ${player ? `${esc(player)}’s bookings are` : 'your bookings are'} already waiting in your free account — it takes a minute to set a password.`,
        cta: link,
        after: `<strong>With your account:</strong><br>${accountBenefits.map((b) => '• ' + esc(b)).join('<br>')}<br><br>This is the only reminder we’ll send. The link works for ${inviteTtlDays()} days; after that use “Forgot password” on the login page.`,
      },
    ])
    await sendEmail(payload, {
      to: user.email,
      subject: player ? `${player}’s sessions are waiting in your account` : 'Your bookings are waiting in your account',
      html,
      sender: brand,
      userId: user.id,
    })
    result.sent++
  }
  return result
}
