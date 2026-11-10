import { campDayLabel } from './camps'
import type { Payload, Where } from 'payload'
import type { CsvValue } from './csv'
import { formatPhone } from './phone'
import { localYmd } from './time'

const q = { overrideAccess: true, pagination: false } as const
const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined) ?? null)
const title = (v: unknown, k = 'title') => (v && typeof v === 'object' ? String((v as Record<string, unknown>)[k] ?? '') : '')
const when = (iso?: string | null) => (iso ? new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)) : '')
const day = (iso?: string | null) => (iso ? localYmd(new Date(iso)) : '')

export type Export = { name: string; headers: string[]; rows: CsvValue[][] }

/**
 * Every Management list as a spreadsheet. Medical notes are never exported (they stay in the portal).
 * `params` narrows some lists (e.g. ?program=, ?team=, ?cycle=, ?round=, ?status=).
 */
export const EXPORTS: Record<string, (p: Payload, params: URLSearchParams) => Promise<Export>> = {
  money: async (p, sp) => {
    const { CATEGORY_LABEL, moneyEntries, summarise } = await import('./money')
    const { localToUtc } = await import('./time')
    let from: string, to: string, name: string
    const term = sp.get('term') ? await p.findByID({ collection: 'academy-terms', id: Number(sp.get('term')), depth: 0, overrideAccess: true, disableErrors: true }) : null
    if (term) ({ startDate: from, endDate: to, name } = { ...term, name: `Money ${term.name}` })
    else {
      const ym = /^\d{4}-\d{2}$/.test(sp.get('m') ?? '') ? sp.get('m')! : new Date().toISOString().slice(0, 7)
      const [y, m] = ym.split('-').map(Number)
      from = localToUtc(`${ym}-01`, '00:00').toISOString()
      to = localToUtc(`${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`, '23:59').toISOString()
      name = `Money ${ym}`
    }
    const s = summarise(await moneyEntries(p, new Date(Date.parse(from) - 400 * 86_400_000).toISOString()), from, to)
    return {
      name,
      headers: ['Program', 'Payments', 'Taken', 'Discounts given', 'Refunds', 'Net'],
      rows: [
        ...s.lines.map((l) => [CATEGORY_LABEL[l.category], l.count, l.gross, l.discount, l.refunds, l.net] as CsvValue[]),
        ['Total', s.total.count, s.total.gross, s.total.discount, s.total.refunds, s.total.net],
        [],
        ['Academy Stripe account', '', s.accounts.academy.gross, '', s.accounts.academy.refunds, s.accounts.academy.net],
        ['Club Stripe account', '', s.accounts.club.gross, '', s.accounts.club.refunds, s.accounts.club.net],
      ],
    }
  },
  'one-on-ones': async (p, sp) => {
    const where: Where = { ...(sp.get('status') ? { status: { equals: sp.get('status') } } : {}), ...(sp.get('kind') ? { kind: { equals: sp.get('kind') } } : {}) }
    const { docs } = await p.find({ ...q, collection: 'academy-bookings', where, limit: 5000, depth: 1, sort: '-createdAt' })
    return {
      name: '1-on-1 and small group bookings',
      headers: ['Reference', 'Booked', 'Kind', 'Group', 'Player', 'Parent', 'Email', 'Mobile', 'Coach', 'Type', 'Sessions', 'Status', 'Price', 'Credit used', 'Refunded'],
      rows: docs.map((b) => [b.reference, when(b.createdAt), b.kind === 'group' ? 'Small group' : '1-on-1', b.kind === 'group' && b.group && typeof b.group === 'object' ? `${b.group.reference} (${b.group.plannedSize})` : '', `${b.player.firstName} ${b.player.lastName}`, `${b.contact.firstName} ${b.contact.lastName}`, b.contact.email, formatPhone(b.contact.mobile), title(b.coach, 'displayName'), b.type, b.sessionsTotal ?? 1, b.status, b.amount, b.creditApplied ?? 0, b.refundedAmount ?? 0]),
    }
  },
  bookings: async (p, sp) => {
    const where: Where = { ...(sp.get('program') ? { program: { equals: Number(sp.get('program')) } } : {}), ...(sp.get('status') ? { status: { equals: sp.get('status') } } : {}) }
    const { docs } = await p.find({ ...q, collection: 'bookings', where, limit: 5000, depth: 1, sort: '-createdAt' })
    return {
      name: 'Camp and program bookings',
      headers: ['Reference', 'Booked', 'Program', 'Type', 'Player', 'Born', 'Parent', 'Email', 'Mobile', 'Status', 'Paid', 'Discount', 'Paid to', 'Camp days', 'Keep with'],
      rows: docs.map((b) => [b.reference, when(b.createdAt), title(b.program), b.bookingType ?? 'enrolment', b.player?.teamName || `${b.player?.firstName ?? ''} ${b.player?.lastName ?? ''}`.trim(), day(b.player?.dateOfBirth), `${b.contact.firstName} ${b.contact.lastName}`, b.contact.email, formatPhone(b.contact.phone), b.status, b.amount, b.discount ?? 0, b.payee, b.fullCamp ? 'Full camp' : (b.campDays ?? []).map((d) => campDayLabel(d.day)).join('; '), b.keepWith ?? '']),
    }
  },
  registrations: async (p, sp) => {
    const where: Where = sp.get('program') ? { program: { equals: Number(sp.get('program')) } } : {}
    const { docs } = await p.find({ ...q, collection: 'academy-registrations', where, limit: 5000, depth: 1, sort: 'player.lastName' })
    return {
      name: 'Academy term registrations',
      headers: ['Reference', 'Program', 'Player', 'Born', 'Plays in', 'Parent', 'Email', 'Mobile', 'Status', 'Training time', 'Registered'],
      rows: docs.map((r) => [r.reference, title(r.program), `${r.player.firstName} ${r.player.lastName}`, day(r.player.dateOfBirth), r.playingBirthYear ?? r.birthYear, `${r.contact.firstName} ${r.contact.lastName}`, r.contact.email, formatPhone(r.contact.phone), r.status, r.slot && typeof r.slot === 'object' ? `${r.slot.weekday} ${r.slot.startTime}` : '', when(r.createdAt)]),
    }
  },
  orders: async (p, sp) => {
    const where: Where = sp.get('status') ? { status: { equals: sp.get('status') } } : {}
    const { docs } = await p.find({ ...q, collection: 'orders', where, limit: 5000, depth: 0, sort: '-createdAt' })
    return {
      name: 'Shop orders',
      headers: ['Reference', 'Ordered', 'Name', 'Email', 'Phone', 'Items', 'Total', 'Discount', 'Status', 'Pickup or post', 'Address'],
      rows: docs.map((o) => [o.reference, when(o.createdAt), o.contact.name, o.contact.email, formatPhone(o.contact.phone), (o.items ?? []).map((i) => `${i.quantity ?? 1} × ${i.name ?? ''}${i.size ? ` (${i.size})` : ''}`).join('; '), o.total, o.discount ?? 0, o.status, o.fulfilment, o.shippingAddress ?? '']),
    }
  },
  families: async (p) => {
    const { docs } = await p.find({ ...q, collection: 'users', limit: 10000, depth: 0, sort: 'lastName' })
    return {
      name: 'Families',
      headers: ['First name', 'Last name', 'Email', 'Mobile', 'Roles', 'Account activated', 'Marketing emails', 'Marketing texts', 'Texts turned off', 'Joined'],
      rows: docs.map((u) => [u.firstName, u.lastName, u.email, formatPhone(u.phone), (u.roles ?? []).join(' '), Boolean(u.activated), Boolean(u.marketingEmail), Boolean(u.marketingSms), Boolean(u.smsOptOut), day(u.createdAt)]),
    }
  },
  players: async (p) => {
    const { docs } = await p.find({ ...q, collection: 'participants', limit: 10000, depth: 1, sort: 'lastName' })
    return {
      name: 'Players',
      headers: ['First name', 'Last name', 'Born', 'Parent', 'Parent email', 'Parent mobile', 'Photos OK', 'Foundation+'],
      rows: docs.map((k) => {
        const u = typeof k.account === 'object' ? k.account : null
        return [k.firstName, k.lastName, day(k.dateOfBirth), u ? [u.firstName, u.lastName].filter(Boolean).join(' ') : '', u?.email, formatPhone(u?.phone), Boolean(k.photoConsent), k.pdr?.tier ?? 'free']
      }),
    }
  },
  'team-members': async (p, sp) => {
    const team = Number(sp.get('team'))
    const { docs } = await p.find({ ...q, collection: 'team-members', where: { ...(team ? { team: { equals: team } } : {}), active: { equals: true } }, limit: 5000, depth: 1 })
    return {
      name: team && docs[0] ? `Team ${title(docs[0].team, 'name')}` : 'Team members',
      headers: ['Team', 'Player', 'Born', 'Parent', 'Email', 'Mobile', 'Joined via'],
      rows: docs.map((m) => {
        const k = typeof m.participant === 'object' ? m.participant : null
        const u = typeof m.account === 'object' ? m.account : null
        return [title(m.team, 'name'), k ? `${k.firstName} ${k.lastName}` : '', day(k?.dateOfBirth), u ? [u.firstName, u.lastName].filter(Boolean).join(' ') : '', u?.email, formatPhone(u?.phone), m.source]
      }),
    }
  },
  reports: async (p, sp) => {
    const where: Where = sp.get('cycle') ? { cycle: { equals: Number(sp.get('cycle')) } } : {}
    const { docs } = await p.find({ ...q, collection: 'player-reports', where, limit: 5000, depth: 1, sort: 'playerName' })
    return {
      name: 'Player reports',
      headers: ['Round', 'Player', 'Level', 'Group or team', 'Coach', 'Status', 'Submitted', 'Released'],
      rows: docs.map((r) => [title(r.cycle, 'name'), r.playerName, r.level, r.sourceLabel, r.coach && typeof r.coach === 'object' ? [r.coach.firstName, r.coach.lastName].filter(Boolean).join(' ') : '', r.status, when(r.submittedAt), when(r.releasedAt)]),
    }
  },
  selections: async (p, sp) => {
    const where: Where = sp.get('round') ? { round: { equals: Number(sp.get('round')) } } : {}
    const { docs } = await p.find({ ...q, collection: 'selection-entries', where, limit: 5000, depth: 1, sort: 'player.lastName' })
    return {
      name: 'Selections',
      headers: ['Round', 'Player', 'Born', 'Plays in', 'Parent', 'Email', 'Mobile', 'Status', 'Squad', 'Paid'],
      rows: docs.map((e) => [title(e.round), `${e.player.firstName} ${e.player.lastName}`, day(e.player.dateOfBirth), e.playingBirthYear ?? e.birthYear, `${e.contact.firstName} ${e.contact.lastName}`, e.contact.email, formatPhone(e.contact.phone), e.status, title(e.squad, 'name'), when(e.paidAt)]),
    }
  },
  attendance: async (p) => {
    const { docs } = await p.find({ ...q, collection: 'training-attendance', limit: 10000, depth: 1, sort: '-date' })
    return {
      name: 'Training attendance',
      headers: ['Date', 'Training', 'Here', 'On the roster', 'Marked by', 'Marked at'],
      rows: docs.map((a) => [a.date, a.title, a.presentCount, a.rosterCount, a.takenBy && typeof a.takenBy === 'object' ? [a.takenBy.firstName, a.takenBy.lastName].filter(Boolean).join(' ') : '', when(a.takenAt)]),
    }
  },
  activity: async (p, sp) => {
    const { docs } = await p.find({ ...q, collection: 'activity-log', where: sp.get('area') ? { area: { equals: sp.get('area') } } : {}, limit: 10000, depth: 0, sort: '-createdAt' })
    return {
      name: 'Activity log',
      headers: ['When', 'Area', 'What', 'Action', 'By', 'Field', 'From', 'To'],
      rows: docs.flatMap((d) => ((d.changes as { label: string; from: string; to: string }[] | null) ?? []).map((c) => [when(d.createdAt), d.area, d.what, d.action, d.byName, c.label, c.from, c.to])),
    }
  },
  'promotion-uses': async (p) => {
    const { docs } = await p.find({ ...q, collection: 'promotion-uses', limit: 10000, depth: 1, sort: '-createdAt' })
    return {
      name: 'Promotion uses',
      headers: ['When', 'Promotion', 'Family', 'What', 'Reference', 'Discount', 'Paid', 'Status'],
      rows: docs.map((u) => [when(u.createdAt), title(u.promotion, 'name'), u.account && typeof u.account === 'object' ? u.account.email : rel(u.account), u.kind, u.reference, u.amountOff, u.paidAmount, u.status]),
    }
  },
}
