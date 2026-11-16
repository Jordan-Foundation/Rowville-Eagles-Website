import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { createInvite, inviteTtlDays } from './invites'
import { emailLayout } from './email-templates'
import { sendEmail } from './email'
import { sendSms } from './sms'
import { siteUrl } from './payments'
import { localToUtc, localYmd } from './time'

/**
 * Coach sign-up: Management enters name, mobile and email → the coach gets an email + text with a private link →
 * they create their account and send their Working With Children Check (number, expiry, photo of the card) →
 * Management checks it, which shows the coach to families. Pay is set separately (Finance, admins).
 */

const q = { overrideAccess: true, depth: 0 } as const
export const MOBILE = /^(\+?61|0)4\d{8}$/
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Victorian WWC card numbers look like 1234567A-01; other states differ, so allow letters, digits and dashes. */
export const WWCC_NUMBER = /^[A-Za-z0-9][A-Za-z0-9 -]{4,23}$/

export class CoachSignupError extends Error {}

export type CoachStatus = 'not-invited' | 'invited' | 'wwcc-needed' | 'to-check' | 'expired' | 'expiring' | 'ready'
export const STATUS_LABEL: Record<CoachStatus, string> = {
  'not-invited': 'No account yet',
  invited: 'Sign-up link sent',
  'wwcc-needed': 'WWCC not sent yet',
  'to-check': 'WWCC to check',
  expired: 'WWCC expired',
  expiring: 'WWCC expires soon',
  ready: 'Ready',
}

type W = { number?: string | null; expiry?: string | null; photo?: unknown; submittedAt?: string | null; checkedAt?: string | null }
/** Pure: where a coach is up to (unit tested). */
export function coachStatus(u: { activated?: boolean | null; coachInvitedAt?: string | null; wwcc?: W | null }, today: string): CoachStatus {
  const w = u.wwcc ?? {}
  if (!u.activated) return u.coachInvitedAt ? 'invited' : 'not-invited'
  if (!w.number || !w.photo || !w.expiry) return 'wwcc-needed'
  const exp = localYmd(new Date(w.expiry))
  if (exp < today) return 'expired'
  if (!w.checkedAt) return 'to-check'
  const soon = new Date(`${today}T00:00:00Z`)
  soon.setUTCDate(soon.getUTCDate() + 30)
  return exp <= soon.toISOString().slice(0, 10) ? 'expiring' : 'ready'
}

const fullName = (u: Pick<User, 'firstName' | 'lastName' | 'email'>) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email

/** Make sure the coach has a (hidden until checked) coach profile. */
async function ensureCoachProfile(p: Payload, user: User) {
  const { docs } = await p.find({ ...q, collection: 'academy-coaches', where: { user: { equals: user.id } }, limit: 1 })
  if (docs[0]) return docs[0]
  return p.create({ ...q, collection: 'academy-coaches', data: { user: user.id, displayName: `Coach ${user.firstName || fullName(user)}`.trim(), active: false } })
}

/** Management adds a coach: creates (or reuses) the account, gives it the coach role, and sends the sign-up link. */
export async function inviteCoach(p: Payload, input: { firstName: string; lastName: string; email: string; mobile: string }) {
  const email = input.email.trim().toLowerCase()
  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  const mobile = input.mobile.replace(/\s+/g, '')
  if (!firstName || !lastName) throw new CoachSignupError('Enter the coach’s first and last name.')
  if (!EMAIL.test(email)) throw new CoachSignupError('Enter a valid email address.')
  if (!MOBILE.test(mobile)) throw new CoachSignupError('Enter an Australian mobile number, e.g. 0412 345 678.')
  const { docs } = await p.find({ ...q, collection: 'users', where: { email: { equals: email } }, limit: 1 })
  let user = docs[0]
  if (user?.roles?.includes('coach') && user.activated && user.wwcc?.number) throw new CoachSignupError(`${fullName(user)} is already a coach.`)
  if (user) {
    user = await p.update({ ...q, collection: 'users', id: user.id, data: { roles: [...new Set([...(user.roles ?? []), 'coach' as const])], firstName: user.firstName || firstName, lastName: user.lastName || lastName, phone: user.phone || mobile } })
  } else {
    user = await p.create({ ...q, collection: 'users', data: { email, firstName, lastName, phone: mobile, roles: ['coach'], activated: false, password: crypto.randomUUID() + crypto.randomUUID() } })
  }
  await ensureCoachProfile(p, user)
  await sendCoachInvite(p, user)
  return user
}

/** Email + text the private sign-up link (also used for "Resend"). */
export async function sendCoachInvite(p: Payload, user: User) {
  const token = await createInvite(p, { userId: user.id, email: user.email, purpose: 'coach-invite' })
  const link = `${siteUrl()}/account/coach-setup?invite=${encodeURIComponent(token)}`
  const html = emailLayout('club', [{
    heading: `Welcome to the coaching team, ${user.firstName || 'coach'}!`,
    intro: 'Use the button below to create your coach account. You’ll choose a password and add your Working With Children Check — the card number, expiry date and a photo of the card. It takes about two minutes.',
    cta: { label: 'Create my coach account', href: link },
    after: `This link is just for you and works for ${inviteTtlDays()} days. Questions? Reply to this email.`,
  }])
  const emailed = await sendEmail(p, { to: user.email, subject: 'Create your Rowville Eagles coach account', html, sender: 'club' })
  const texted = await sendSms(p, { to: user.phone, kind: 'service', userId: user.id, body: `Hi ${user.firstName || 'coach'}, welcome to the Rowville Eagles / Foundation Academy coaching team! Create your coach account and add your WWCC here: ${link}` }).then((r) => r.sent).catch(() => false)
  await p.update({ ...q, collection: 'users', id: user.id, data: { coachInvitedAt: new Date().toISOString() } })
  return { emailed, texted }
}

/** Validate the coach's WWCC details (pure). Returns an error message or null. */
export function wwccProblem(number: string, expiry: string, today: string, hasFile: boolean) {
  if (!WWCC_NUMBER.test(number.trim())) return 'Enter your Working With Children Check card number, e.g. 1234567A-01.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return 'Enter the expiry date on your card.'
  if (expiry < today) return 'That card has expired — please renew it with Service Victoria first.'
  if (!hasFile) return 'Add a photo of your card (front, with the number and expiry showing).'
  return null
}

/** Save the coach's WWCC (from sign-up or their profile). A new card always needs checking again. */
export async function saveWwcc(p: Payload, user: User, w: { number: string; expiry: string; file: { data: Buffer; mimetype: string; name: string; size: number } }) {
  const photo = await p.create({ ...q, collection: 'wwcc-files', data: { note: `${fullName(user)} (user ${user.id})` }, file: w.file })
  await p.update({ ...q, collection: 'users', id: user.id, data: { wwcc: { number: w.number.trim().toUpperCase(), expiry: localToUtc(w.expiry, '12:00').toISOString(), photo: photo.id, submittedAt: new Date().toISOString(), checkedAt: null, checkedBy: null } } })
  try {
    const { record } = await import('../staff-feed/service')
    await record(p, `wwcc:${user.id}:${photo.id}`, { kind: 'enquiry', title: `Coach WWCC to check — ${fullName(user)}`, detail: `Card ${w.number.trim().toUpperCase()}, expires ${w.expiry}`, href: '/management/coaches' })
  } catch {}
}

/** Management has looked up the card (Service Victoria) — show the coach to families. */
export async function markWwccChecked(p: Payload, userId: number, by: User) {
  const user = await p.findByID({ ...q, collection: 'users', id: userId })
  if (!user.wwcc?.number || !user.wwcc.photo) throw new CoachSignupError('This coach hasn’t sent their WWCC yet.')
  await p.update({ ...q, collection: 'users', id: userId, data: { wwcc: { ...user.wwcc, photo: typeof user.wwcc.photo === 'object' ? user.wwcc.photo.id : user.wwcc.photo, checkedAt: new Date().toISOString(), checkedBy: by.id } } })
  const profile = await ensureCoachProfile(p, user)
  if (!profile.active) await p.update({ ...q, collection: 'academy-coaches', id: profile.id, data: { active: true } })
}
