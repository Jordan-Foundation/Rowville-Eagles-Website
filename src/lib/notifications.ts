import { groupLabel } from './age-groups'
import { markSelectionPaid } from '../selections/payment'
import { addMember } from '../teams/service'
import { markTermRegistrationPaid, slotRows } from '../academy/terms/service'
import type { Payload } from 'payload'
import type { Booking, Order, Program } from '@/payload-types'
import { accountLink, addMembership, ensureAccount, findOrCreateParticipant } from './accounts'
import { sendEmail } from './email'
import { emailLayout, esc } from './email-templates'
import { formatAUD, formatDate } from './format'
import { siteUrl } from './payments'

const when = (iso: string) => formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })

/**
 * After a booking is paid (or confirmed free):
 *  - link it to an account + player (creating them if needed)
 *  - tag the player: team registration → Rowville, Academy term → RFA
 *  - email confirmation (+ "create your account" link for new families)
 */
export async function onBookingPaid(payload: Payload, booking: Booking) {
  const programId = typeof booking.program === 'object' ? booking.program.id : booking.program
  const program = (await payload.findByID({ collection: 'programs', id: programId, depth: 0 })) as Program
  const academy = booking.payee === 'academy'
  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 })

  // Trial nights: confirmation only — families get an account once they enrol.
  if (booking.bookingType === 'trial') {
    const html = emailLayout('academy', [
      {
        heading: 'Your RFA trial is booked',
        intro: `Thanks ${esc(booking.contact.firstName)} — ${esc(booking.player?.firstName || '')} is booked in for a Rowville Foundation Academy trial session.`,
        rows: [
          ['When', booking.sessionStart ? when(booking.sessionStart) : ''],
          ['Program', program.title],
          ['Age group', booking.birthYear ? groupLabel(booking.birthYear) : ''],
          ['Where', program.location || settings.ground?.address || 'Rowville'],
          ['Reference', booking.reference ?? ''],
        ],
        after: 'Please bring boots, shin pads and a water bottle, and arrive 10 minutes early. At the end of the session our coaches will talk you through enrolling for the term.',
      },
    ])
    await sendEmail(payload, { to: booking.contact.email, subject: 'RFA trial booked', html, sender: 'academy', replyTo: settings.email || undefined })
    return
  }

  const { user } = booking.account
    ? { user: await payload.findByID({ collection: 'users', id: typeof booking.account === 'object' ? booking.account.id : booking.account, depth: 0, overrideAccess: true }) }
    : await ensureAccount(payload, booking.contact)

  let participantId = typeof booking.participant === 'object' ? booking.participant?.id : booking.participant
  if (!participantId && booking.player?.firstName && booking.player.lastName && booking.player.dateOfBirth) {
    participantId = (await findOrCreateParticipant(payload, user.id, {
      firstName: booking.player.firstName,
      lastName: booking.player.lastName,
      dateOfBirth: booking.player.dateOfBirth,
    })).id
  }

  if (participantId) {
    const participant = await payload.findByID({ collection: 'participants', id: participantId, depth: 0, overrideAccess: true })
    if (program.type === 'registration') {
      const updated = await addMembership(payload, participant, 'rowville', { registrationOffer: { ...participant.registrationOffer, status: 'paid' } })
      // Club registration paid → onto the team (and its team page)
      if (updated.team) await addMember(payload, { team: typeof updated.team === 'object' ? updated.team.id : updated.team, participant: updated.id, account: user.id, source: 'registration' })
      const regs = await payload.find({ collection: 'selection-entries', where: { participant: { equals: participantId } }, limit: 5, depth: 0, overrideAccess: true })
      for (const r of regs.docs) {
        await payload.update({ collection: 'selection-entries', id: r.id, data: { status: 'registered' }, overrideAccess: true, context: { skipOffer: true } })
      }
    } else if (program.type === 'academy-term') {
      await addMembership(payload, participant, 'rfa')
    }
  }
  await payload.update({ collection: 'bookings', id: booking.id, data: { account: user.id, participant: participantId || undefined }, overrideAccess: true })
  // Paid after selection (tournament / Rowville trials): the player is now registered
  await markSelectionPaid(payload, { ...booking, account: user.id, participant: participantId || null })
  // Academy term: the registration is paid and the training time goes in the email
  let termRows: [string, string][] = []
  const termReg = await markTermRegistrationPaid(payload, { ...booking, account: user.id, participant: participantId || null })
  if (termReg?.slot) {
    const slot = await payload.findByID({ collection: 'academy-term-slots', id: typeof termReg.slot === 'object' ? termReg.slot.id : termReg.slot, depth: 0, overrideAccess: true, disableErrors: true })
    if (slot) termRows = slotRows(slot, program)
  }

  const link = await accountLink(payload, user)
  const who = booking.player?.teamName || [booking.player?.firstName, booking.player?.lastName].filter(Boolean).join(' ')
  const html = emailLayout(academy ? 'academy' : 'club', [
    {
      heading: program.type === 'registration' ? 'Registration paid — welcome aboard!' : 'Booking confirmed',
      intro: `Thanks ${esc(booking.contact.firstName)} — here are the details for ${esc(who || 'your booking')}.`,
      rows: [
        ['Program', program.title],
        ...(termRows.length ? [...termRows, ['Player', who] as [string, string]] : booking.sessionStart ? ([['Time', when(booking.sessionStart)]] as [string, string][]) : program.startDate ? ([['Starts', formatDate(program.startDate)]] as [string, string][]) : []),
        ['Paid', formatAUD(booking.amount)],
        ['Reference', booking.reference ?? ''],
      ],
      cta: link,
      after:
        program.type === 'registration'
          ? `<strong>Next step:</strong> complete the Football Victoria section in <a href="${settings.links?.playFootball || 'https://www.playfootball.com.au'}">PlayFootball</a> and select Rowville Eagles FC.`
          : 'Your account shows every upcoming session, camp and booking for your family in one place.',
    },
  ])
  await sendEmail(payload, {
    to: booking.contact.email,
    subject: `${program.type === 'registration' ? 'Registration confirmed' : 'Booking confirmed'}: ${program.title}`,
    html,
    sender: academy ? 'academy' : 'club',
    replyTo: settings.email || undefined,
  })
}

export async function onOrderPaid(payload: Payload, order: Order) {
  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 })
  const html = emailLayout('academy', [
    {
      heading: 'Order confirmed',
      intro: `Thanks ${esc(order.contact.name)} — we’ve received your order. ${order.fulfilment === 'pickup' ? esc(settings.shop?.pickupNote || 'We’ll let you know when it’s ready to collect.') : 'We’ll email you when it’s posted.'}`,
      rows: [
        ...order.items.map((i) => [`${i.quantity} × ${i.name} (${i.size})`, formatAUD((i.unitPrice ?? 0) * (i.quantity ?? 0))] as [string, string]),
        ...(order.postage ? ([['Postage', formatAUD(order.postage)]] as [string, string][]) : []),
        ['Total', formatAUD(order.total)],
        ['Reference', order.reference ?? ''],
      ],
      cta: { label: 'Visit the shop', href: `${siteUrl()}/shop` },
    },
  ])
  await sendEmail(payload, { to: order.contact.email, subject: `Order ${order.reference} confirmed`, html, sender: 'academy', replyTo: settings.email || undefined })
}
