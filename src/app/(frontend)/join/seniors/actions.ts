'use server'

import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { rateLimit } from '@/lib/form-guard'
import { phoneOk } from '@/lib/validate'
import { sendEmail } from '@/lib/email'
import { emailLayout } from '@/lib/email-templates'
import { SENIOR_TEAMS } from '@/site/collections'

export type EnquiryState = { error?: string; values?: Record<string, string> }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Senior enquiry → saved, then emailed to the club secretary (reply goes straight to the player). */
export async function seniorEnquiry(_prev: EnquiryState, fd: FormData): Promise<EnquiryState> {
  const values = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, String(v).slice(0, 2000)]))
  const s = (k: string) => (values[k] ?? '').trim()
  const fail = (error: string): EnquiryState => ({ error, values })
  const name = s('name')
  const email = s('email').toLowerCase()
  const phone = s('phone')
  const teamKey = s('team')
  const team = SENIOR_TEAMS.find((t) => t.key === teamKey)
  const age = Number(s('age')) || null
  if (s('website')) redirect('/join/seniors/thanks') // honeypot
  if (!name) return fail('Please enter your name.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Please enter a valid email address.')
  if (!phone || !phoneOk(phone)) return fail('Please enter an Australian mobile number, e.g. 0412 345 678.')
  if (!team && teamKey !== 'unsure') return fail('Please choose a team (or “Not sure yet”).')
  if (age !== null && (age < 15 || age > 80)) return fail('Please check your age.')

  const p = await payload()
  const limited = await rateLimit(p, 'senior-enquiry', { email })
  if (limited) return fail(limited)
  const g = await p.findGlobal({ slug: 'senior-teams', depth: 0, overrideAccess: true }).catch(() => null)
  const to = g?.enquiryEmail || 'refc.secretary@outlook.com'
  const doc = await p.create({
    collection: 'enquiries',
    overrideAccess: true,
    data: { name, email, phone, team: (team?.key ?? 'unsure') as 'men' | 'reserves' | 'women' | 'unsure', age, position: s('position') || null, previousClub: s('previousClub') || null, message: s('message') || null, status: 'new', emailedTo: to },
  })
  const rows: [string, string][] = [
    ['Name', name],
    ['Email', email],
    ['Mobile', phone],
    ['Team', team?.name ?? 'Not sure yet'],
    ...(age ? ([['Age', String(age)]] as [string, string][]) : []),
    ...(s('position') ? ([['Position', s('position')]] as [string, string][]) : []),
    ...(s('previousClub') ? ([['Previous club / level', s('previousClub')]] as [string, string][]) : []),
  ]
  const html = emailLayout('club', [{
    heading: `Senior enquiry — ${team?.name ?? 'Seniors'}`,
    intro: `${esc(name)} has sent an enquiry from the website. Reply to this email to answer them directly.`,
    rows,
    after: s('message') ? `<strong>Message</strong><br>${esc(s('message')).replace(/\n/g, '<br>')}` : undefined,
  }])
  await sendEmail(p, { to, subject: `Senior enquiry: ${name} (${team?.name ?? 'not sure yet'})`, html, sender: 'club', replyTo: email }).catch((e) => p.logger.error({ err: e, msg: `Senior enquiry ${doc.id} email failed` }))
  redirect(`/join/seniors/thanks?team=${team?.key ?? 'unsure'}`)
}
