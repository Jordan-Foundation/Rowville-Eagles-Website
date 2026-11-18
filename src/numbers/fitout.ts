import type { Payload } from 'payload'
import type { FitoutEntry, KitItem, Participant } from '@/payload-types'
import { birthYearOf } from '../lib/age-groups'
import { numbersFor } from './service'

const q = { overrideAccess: true, pagination: false } as const
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined)) ?? null

export const JACKET_SIZES = ['Kids 10', 'Kids 11', 'Kids 12', 'Kids 13', 'Kids 14', 'Kids 15', 'Kids 16', 'Adult S', 'Adult M', 'Adult L', 'Adult XL', 'Adult 2XL', 'Adult 3XL']

/** Kit items (active ones by default); the first time, seeds a Jacket with the club's sizes. */
export async function kitItems(p: Payload, o: { all?: boolean } = {}): Promise<KitItem[]> {
  let { docs } = await p.find({ ...q, collection: 'kit-items', sort: 'sortOrder', limit: 100, depth: 0 })
  if (!docs.length) {
    await p.create({ ...q, collection: 'kit-items', data: { name: 'Jacket', sortOrder: 1, active: true, sizes: JACKET_SIZES.map((label) => ({ label })) } })
    docs = (await p.find({ ...q, collection: 'kit-items', sort: 'sortOrder', limit: 100, depth: 0 })).docs
  }
  return o.all ? docs : docs.filter((d) => d.active !== false)
}

export type FitPlayer = { id: number; name: string; firstName: string; lastName: string; number: number | null; birthYear: number | null; programs: ('rfa' | 'rowville')[]; team: string | null; teamId: number | null }

/** Who can be fitted: active players registered for Rowville Eagles or a current RFA term. */
export async function fitoutPlayers(p: Payload): Promise<FitPlayer[]> {
  const today = new Date().toISOString()
  const [{ docs: rowville }, { docs: regs }] = await Promise.all([
    p.find({ ...q, collection: 'participants', where: { memberships: { contains: 'rowville' }, status: { not_equals: 'inactive' } }, limit: 5000, depth: 1 }),
    p.find({ ...q, collection: 'academy-registrations', where: { status: { equals: 'paid' } }, limit: 5000, depth: 1, select: { participant: true, program: true } }),
  ])
  const rfaIds = new Set(regs.filter((r) => { const prog = typeof r.program === 'object' ? r.program : null; return !prog?.endDate || prog.endDate >= today }).map((r) => idOf(r.participant)).filter((x): x is number => !!x))
  const extra = [...rfaIds].filter((id) => !rowville.some((k) => k.id === id))
  const { docs: rfaKids } = extra.length ? await p.find({ ...q, collection: 'participants', where: { id: { in: extra }, status: { not_equals: 'inactive' } }, limit: 5000, depth: 1 }) : { docs: [] as Participant[] }
  const all = [...rowville, ...rfaKids]
  const shirts = await numbersFor(p, all.map((k) => k.id))
  return all.map((k) => {
    const team = typeof k.team === 'object' && k.team ? k.team : null
    const programs = [...((k.memberships ?? []).includes('rowville') ? ['rowville' as const] : []), ...(rfaIds.has(k.id) ? ['rfa' as const] : [])]
    return { id: k.id, name: `${k.firstName} ${k.lastName}`, firstName: k.firstName, lastName: k.lastName, number: shirts.get(k.id) ?? null, birthYear: birthYearOf(k.dateOfBirth), programs, team: team?.name ?? null, teamId: team?.id ?? null }
  }).filter((x) => x.programs.length)
}

/** Pure: does a player fit the session's program (both / rfa / rowville)? */
export const inProgram = (pl: Pick<FitPlayer, 'programs'>, program?: string | null) => !program || program === 'both' || pl.programs.includes(program as 'rfa' | 'rowville')

/** The sizes last recorded for a player in any session (to pre-fill), and this session's entry if there is one. */
export async function sizesFor(p: Payload, sessionId: number, participantId: number) {
  const { docs } = await p.find({ ...q, collection: 'fitout-entries', where: { participant: { equals: participantId } }, sort: '-updatedAt', limit: 10, depth: 0 })
  const here = docs.find((d) => idOf(d.session) === sessionId) ?? null
  const last = here ?? docs[0] ?? null
  return { here, sizes: Object.fromEntries((last?.sizes ?? []).map((s) => [idOf(s.item), s.size])) as Record<number, string>, notes: here?.notes ?? '' }
}

/** Save a player's sizes in a session (one entry per player per session). */
export async function saveFitout(p: Payload, o: { sessionId: number; participantId: number; sizes: Record<number, string>; notes: string; by: number }) {
  const items = await kitItems(p)
  const sizes = items.filter((i) => o.sizes[i.id] && (i.sizes ?? []).some((s) => s.label === o.sizes[i.id])).map((i) => ({ item: i.id, size: o.sizes[i.id] }))
  const key = `${o.sessionId}-${o.participantId}`
  const { docs } = await p.find({ ...q, collection: 'fitout-entries', where: { key: { equals: key } }, limit: 1, depth: 0 })
  const data = { key, session: o.sessionId, participant: o.participantId, sizes, notes: o.notes.slice(0, 200), updatedBy: o.by }
  return docs[0] ? p.update({ ...q, collection: 'fitout-entries', id: docs[0].id, data: { ...data, exportedAt: null } }) : p.create({ ...q, collection: 'fitout-entries', data })
}

export type ExportFilters = { program?: string; team?: string; birthYear?: string; notExported?: boolean }

/** Rows for the kit order: one per player, sorted by program, then team / year of birth, then number. */
export async function fitoutRows(p: Payload, sessionId: number, f: ExportFilters) {
  const [items, players, { docs: entries }] = await Promise.all([
    kitItems(p, { all: true }),
    fitoutPlayers(p),
    p.find({ ...q, collection: 'fitout-entries', where: { session: { equals: sessionId } }, limit: 5000, depth: 0 }),
  ])
  const byId = new Map(players.map((x) => [x.id, x]))
  const rows = (entries as FitoutEntry[])
    .map((e) => ({ e, pl: byId.get(idOf(e.participant)!) }))
    .filter((r): r is { e: FitoutEntry; pl: FitPlayer } => Boolean(r.pl))
    .filter(({ e, pl }) => inProgram(pl, f.program) && (!f.team || String(pl.teamId) === f.team) && (!f.birthYear || String(pl.birthYear) === f.birthYear) && (!f.notExported || !e.exportedAt))
    .map(({ e, pl }) => ({ entryId: e.id, pl, program: pl.programs.map((x) => (x === 'rfa' ? 'RFA' : 'Rowville')).join(' + '), sizes: Object.fromEntries((e.sizes ?? []).map((s) => [idOf(s.item), s.size])) as Record<number, string>, notes: e.notes ?? '' }))
    .sort((a, b) => a.program.localeCompare(b.program) || (a.pl.team ?? '').localeCompare(b.pl.team ?? '') || (b.pl.birthYear ?? 0) - (a.pl.birthYear ?? 0) || (a.pl.number ?? 999) - (b.pl.number ?? 999))
  return { items: items.filter((i) => i.active !== false || rows.some((r) => r.sizes[i.id])), rows }
}

/** The .xlsx kit order. */
export async function fitoutWorkbook(sessionName: string, data: Awaited<ReturnType<typeof fitoutRows>>) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Kit order')
  ws.columns = [
    { header: 'Player', key: 'name', width: 26 },
    { header: 'Number', key: 'number', width: 9 },
    { header: 'Born', key: 'birthYear', width: 8 },
    { header: 'Program', key: 'program', width: 16 },
    { header: 'Team', key: 'team', width: 18 },
    ...data.items.map((i) => ({ header: i.name, key: `item${i.id}`, width: 14 })),
    { header: 'Notes', key: 'notes', width: 30 },
  ]
  for (const r of data.rows) ws.addRow({ name: r.pl.name, number: r.pl.number ?? 'No number', birthYear: r.pl.birthYear, program: r.program, team: r.pl.team ?? '', ...Object.fromEntries(data.items.map((i) => [`item${i.id}`, r.sizes[i.id] ?? ''])), notes: r.notes })
  ws.getRow(1).font = { bold: true }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  wb.title = sessionName
  return Buffer.from(await wb.xlsx.writeBuffer())
}
