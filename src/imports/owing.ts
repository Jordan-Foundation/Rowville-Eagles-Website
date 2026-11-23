import type { Payload } from 'payload'
import type { Participant, Program, User } from '@/payload-types'
import { accountLink } from '../lib/accounts'
import { emailLayout, esc } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { formatAUD } from '../lib/format'
import { siteUrl } from '../lib/payments'

const q = { overrideAccess: true } as const
const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : ((v as number | null | undefined) ?? null))

/** Imported Eagles players whose registration is still owing (never emailed automatically). */
export async function owingPlayers(p: Payload) {
  const { docs } = await p.find({ collection: 'participants', where: { 'imported.registrationStatus': { equals: 'not_paid' }, 'registrationOffer.status': { equals: 'offered' } }, sort: 'lastName', limit: 2000, depth: 1, ...q, pagination: false })
  return docs
}

/** The existing registration payment email: the program, the fee and a link to pay (or set up the account first). */
export async function sendOwingEmail(p: Payload, kidId: number) {
  const kid = (await p.findByID({ collection: 'participants', id: kidId, depth: 1, ...q })) as Participant
  const program = kid.registrationOffer?.program && typeof kid.registrationOffer.program === 'object' ? (kid.registrationOffer.program as Program) : null
  const user = (await p.findByID({ collection: 'users', id: rel(kid.account)!, depth: 0, ...q })) as User
  if (!program) throw new Error(`${kid.firstName} has no registration program — set it on their player record first.`)
  const link = await accountLink(p, user)
  const html = emailLayout('club', [
    {
      heading: `${kid.firstName}’s ${program.title}`,
      intro: `Hi ${esc(user.firstName || 'there')}, ${esc(kid.firstName)}’s club registration for ${esc(program.title)} is ready to pay. ${user.activated ? 'Log in and you’ll see it at the top of your account.' : 'Set up your account (it’s all filled in) and you’ll see it at the top.'}`,
      rows: [['Player', `${kid.firstName} ${kid.lastName}`], ['Registration', program.title], ['Fee', formatAUD(program.price ?? 0)]],
      cta: user.activated ? { label: 'Pay registration', href: `${siteUrl()}/programs/${program.slug}/book` } : link,
      after: 'After paying the club fee you’ll complete the Football Victoria section in PlayFootball. Questions? Just reply to this email.',
    },
  ])
  await sendEmail(p, { to: user.email, subject: `${kid.firstName}’s ${program.title} — ready to pay`, html, sender: 'club', userId: user.id })
  await p.update({ collection: 'participants', id: kid.id, ...q, data: { imported: { ...(kid.imported ?? {}), batch: rel(kid.imported?.batch), owingEmailAt: new Date().toISOString() } } })
}
