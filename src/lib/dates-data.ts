import type { Payload } from 'payload'
import { currentSeason } from './age-groups'
import { DATE_FIELDS, dateIssues, formatDateInput } from './dates-edit'

export type DateField = { key: string; label: string; value: string; type: 'date' | 'datetime-local' | 'month' | 'number' }
export type DateRow = { target: string; title: string; note?: string; href: string; muted?: boolean; fields: DateField[]; locked?: string }
export type DateSection = { id: string; title: string; intro: string; rows: DateRow[] }

const q = { depth: 0, overrideAccess: true } as const
const inputType = (key: string): DateField['type'] => {
  const k = DATE_FIELDS[key]
  return k.kind === 'day' ? 'date' : k.kind === 'datetime' ? 'datetime-local' : k.kind === 'month' ? 'month' : 'number'
}
const f = (collection: string, field: string, label: string, stored: unknown): DateField => {
  const key = `${collection}.${field}`
  return { key: field, label, value: formatDateInput(DATE_FIELDS[key], stored as string | number | null), type: inputType(key) }
}
const typeLabel: Record<string, string> = { 'holiday-camp': 'Holiday camp', tournament: 'Tournament', registration: 'Season registration', 'academy-trial': 'Trial', toddler: 'Mini Ballers', 'academy-term': 'Academy group term' }

export async function loadDates(p: Payload): Promise<DateSection[]> {
  const settings = await p.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true })
  const [terms, programs, trials, rounds, cycles, challenges] = await Promise.all([
    p.find({ collection: 'academy-terms', sort: '-startDate', limit: 12, ...q }),
    p.find({ collection: 'programs', where: { type: { not_in: ['private-session', 'community'] }, status: { not_equals: 'closed' } }, sort: 'startDate', limit: 100, ...q }),
    p.find({ collection: 'trial-sessions', where: { start: { greater_than: new Date(Date.now() - 30 * 86400000).toISOString() } }, sort: 'start', limit: 50, ...q }),
    p.find({ collection: 'selection-rounds', where: { status: { not_equals: 'closed' } }, sort: '-createdAt', limit: 30, ...q }),
    p.find({ collection: 'report-cycles', sort: '-dueDate', limit: 10, ...q }),
    p.find({ collection: 'pdr-challenges', sort: '-month', limit: 6, ...q }),
  ])
  const termName = new Map(terms.docs.map((t) => [t.id, t.name]))
  const termOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null))
  return [
    {
      id: 'season',
      title: 'Season',
      intro: 'Age groups are worked out from this year (age group = season − year of birth). Change it when the new season’s age groups start.',
      rows: [{ target: 'g:site-settings', title: 'Season year', href: '/admin/globals/site-settings', fields: [{ key: 'season', label: 'Season', value: String(settings.season ?? currentSeason()), type: 'number' }] }],
    },
    {
      id: 'terms',
      title: 'Academy terms',
      intro: 'School-term dates for 1-on-1s and group training, and when coaches must submit their availability. Group programs and Mini Ballers linked to a term follow its dates automatically.',
      rows: terms.docs.map((t) => ({
        target: `academy-terms:${t.id}`,
        title: t.name,
        note: t.status,
        href: `/admin/collections/academy-terms/${t.id}`,
        muted: t.status === 'closed',
        fields: [f('academy-terms', 'startDate', 'First day', t.startDate), f('academy-terms', 'endDate', 'Last day', t.endDate), f('academy-terms', 'availabilityDeadline', 'Coach availability due', t.availabilityDeadline)],
      })),
    },
    {
      id: 'programs',
      title: 'Programs & camps',
      intro: 'Start and finish (date and time). Programs linked to an Academy term take the term’s dates — change those above.',
      rows: programs.docs.map((x) => {
        const linked = (x.type === 'academy-term' || x.type === 'toddler') && termOf(x.academyTerm)
        return {
          target: `programs:${x.id}`,
          title: x.title,
          note: [typeLabel[x.type] ?? x.type, x.status].filter(Boolean).join(' · '),
          href: `/admin/collections/programs/${x.id}`,
          locked: linked ? `Follows ${termName.get(termOf(x.academyTerm)!) ?? 'its Academy term'}` : undefined,
          fields: [f('programs', 'startDate', 'Starts', x.startDate), f('programs', 'endDate', 'Finishes', x.endDate)],
        }
      }),
    },
    {
      id: 'trials',
      title: 'Club trial nights',
      intro: 'Families who registered interest are told when a trial night is published. Changing the time doesn’t re-send that email.',
      rows: trials.docs.map((t) => ({ target: `trial-sessions:${t.id}`, title: t.title, note: t.status ?? '', href: `/admin/collections/trial-sessions/${t.id}`, muted: new Date(t.start).getTime() < Date.now(), fields: [f('trial-sessions', 'start', 'Starts', t.start)] })),
    },
    {
      id: 'tournaments',
      title: 'Tournament payments',
      intro: 'How many days selected players have to pay before their place can be offered to someone else.',
      rows: rounds.docs.map((r) => ({ target: `selection-rounds:${r.id}`, title: r.title, note: r.status, href: `/admin/collections/selection-rounds/${r.id}`, fields: [f('selection-rounds', 'paymentDeadlineDays', 'Days to pay', r.paymentDeadlineDays ?? 7)] })),
    },
    {
      id: 'reports',
      title: 'Player report rounds',
      intro: 'When coaches must finish their reports. Reminders go out 2 weeks, 1 week, 3 days and 1 day before.',
      rows: cycles.docs.map((c) => ({ target: `report-cycles:${c.id}`, title: c.name, note: c.status, href: `/management/reports/${c.id}`, muted: c.status === 'closed', fields: [f('report-cycles', 'dueDate', 'Coaches finish by', c.dueDate)] })),
    },
    {
      id: 'challenges',
      title: 'Foundation+ monthly challenges',
      intro: 'Each challenge runs for one calendar month.',
      rows: challenges.docs.map((c) => ({ target: `pdr-challenges:${c.id}`, title: c.title, note: c.published ? 'live' : 'draft', href: `/admin/collections/pdr-challenges/${c.id}`, fields: [f('pdr-challenges', 'month', 'Month', c.month)] })),
    },
  ]
}

export async function loadDateIssues(p: Payload, now = new Date()) {
  const settings = await p.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true })
  const [terms, programs, cycles] = await Promise.all([
    p.find({ collection: 'academy-terms', limit: 30, ...q, select: { name: true, status: true, startDate: true, endDate: true } }),
    p.find({ collection: 'programs', where: { status: { equals: 'open' } }, limit: 100, ...q, select: { title: true, type: true, status: true, startDate: true, endDate: true, academyTerm: true } }),
    p.find({ collection: 'report-cycles', where: { status: { equals: 'open' } }, limit: 20, ...q }),
  ])
  const outstanding = await Promise.all(cycles.docs.map(async (c) => (await p.count({ collection: 'player-reports', where: { cycle: { equals: c.id }, status: { in: ['not_started', 'draft', 'returned'] } }, overrideAccess: true })).totalDocs))
  return dateIssues({
    now,
    terms: terms.docs.map((t) => ({ id: t.id, name: t.name, status: t.status, startDate: t.startDate, endDate: t.endDate })),
    programs: programs.docs.map((x) => ({ id: x.id, name: x.title, type: x.type, status: x.status, startDate: x.startDate, endDate: x.endDate, termLinked: (x.type === 'academy-term' || x.type === 'toddler') && !!x.academyTerm })),
    cycles: cycles.docs.map((c, i) => ({ id: c.id, name: c.name, status: c.status, dueDate: c.dueDate, outstanding: outstanding[i] })),
    season: settings.season ?? null,
    expectedSeason: currentSeason(),
  })
}
