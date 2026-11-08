import { currentUser } from '@/lib/auth'
import { hasRole } from '@/access'
import { payload } from '@/lib/payload'
import { getAgeRules } from '@/lib/age-rules'
import { programSlots } from '@/academy/terms/service'
import { boardRows } from '@/academy/terms/board-data'

const cell = (v: unknown) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : /^[=+\-@]/.test(s) ? `'${s}` : s
}

/** CSV of the players board, with the same filters. */
export async function GET(req: Request) {
  const user = await currentUser()
  if (!user || !hasRole(user, 'admin', 'committee')) return new Response('Not allowed', { status: 403 })
  const q = new URL(req.url).searchParams
  const p = await payload()
  const program = await p.findByID({ collection: 'programs', id: Number(q.get('program')), depth: 0, overrideAccess: true, disableErrors: true })
  if (!program) return new Response('Program not found', { status: 404 })
  const [slots, { docs }, rules, { docs: coachDocs }] = await Promise.all([
    programSlots(p, program.id),
    p.find({ pagination: false, collection: 'academy-registrations', where: { program: { equals: program.id }, status: { not_equals: 'cancelled' } }, sort: 'player.lastName', limit: 5000, depth: 0, overrideAccess: true }),
    getAgeRules(p),
    p.find({ pagination: false, collection: 'academy-coaches', limit: 300, depth: 0, overrideAccess: true }),
  ])
  const coachName = new Map(coachDocs.map((c) => [c.id, c.displayName]))
  const f = { year: q.get('year'), slot: q.get('slot'), group: q.get('group'), coach: q.get('coach'), status: q.get('status') }
  const rows = boardRows(docs, slots, rules).filter(
    (r) =>
      (!f.year || String(r.playing ?? r.birthYear) === f.year) &&
      (!f.slot || String(r.slotId ?? '') === f.slot) &&
      (!f.group || (f.group === '-' ? !r.groupId : `${r.slotId}:${r.groupId}` === f.group)) &&
      (!f.coach || r.coachIds.includes(Number(f.coach))) &&
      (!f.status || (f.status === 'unpaid' ? r.status !== 'paid' : r.status === f.status)),
  )
  const head = ['Reference', 'Player', 'Born', 'Plays in', 'Training time', 'Group', 'Coaches', 'Status', 'Parent', 'Email', 'Mobile', 'Medical', 'Emergency contact', 'Moves']
  const lines = rows.map((r) =>
    [r.reference, r.name, r.birthYear, `${r.playing ?? r.birthYear}s`, r.slotLabel || 'Waiting for a place', r.groupName ?? '', r.coachIds.map((c) => coachName.get(c)).join(' & '), r.statusLabel, r.parent, r.email, r.phone, r.medicalText, r.emergency, r.moves.map((m) => `${m.from}→${m.to} (${m.reason})`).join('; ')]
      .map(cell)
      .join(','),
  )
  const name = `${program.slug}-players.csv`
  return new Response([head.join(','), ...lines].join('\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"` } })
}
