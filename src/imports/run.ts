import { randomBytes } from 'crypto'
import type { Payload } from 'payload'
import type { Participant, Program, User } from '@/payload-types'
import { getAgeRules } from '../lib/age-rules'
import { localYmd } from '../lib/time'
import { slotKey } from '../numbers/rules'
import { numberAudit, rangeForYear } from '../numbers/service'
import { checkRows, parsePlayerSheet, playerKey, rowStatus, type ImportContext, type ImportRow } from './players'

/**
 * Existing player import (server): preview (nothing saved) → import valid rows family by family → undo a batch.
 * Families are grouped by Parent 1 email. Re-running the same file changes nothing (players are matched by
 * family + name + date of birth, and blank cells never wipe existing data). Nothing is sent to families.
 */

const q = { overrideAccess: true } as const
const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : ((v as number | null | undefined) ?? null))
const lc = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()
const local04 = (e164: string | null) => (e164 ? `0${e164.slice(3)}` : null)

/** What the checks need to know about the portal. */
export async function importContext(p: Payload): Promise<ImportContext & { kitIds: { shirt?: number; shorts?: number; jacket?: number } }> {
  const [{ docs: teams }, { docs: nums }, { docs: users }, { kitItems }] = await Promise.all([
    p.find({ collection: 'teams', where: { type: { equals: 'rowville' }, archived: { not_equals: true } }, limit: 500, depth: 0, ...q, pagination: false, select: { name: true, ageGroup: true } }),
    p.find({ collection: 'player-numbers', where: { status: { equals: 'active' } }, limit: 10000, depth: 1, ...q, pagination: false }),
    p.find({ collection: 'users', limit: 20000, depth: 0, ...q, pagination: false, select: { email: true, firstName: true, lastName: true } }),
    import('../numbers/fitout'),
  ])
  const numbers = new Map<string, string>()
  for (const n of nums) {
    const k = n.participant && typeof n.participant === 'object' ? n.participant : null
    if (k) numbers.set(`${n.birthYear}-${n.number}`, `${lc(k.firstName)}|${lc(k.lastName)}|${(k.dateOfBirth ?? '').slice(0, 10)}`)
  }
  const ranges = new Map<number, { start: number; end: number } | null>()
  const years = new Set<number>()
  for (let y = new Date().getFullYear() - 25; y <= new Date().getFullYear(); y++) years.add(y)
  for (const y of years) ranges.set(y, await rangeForYear(p, y).catch(() => null))
  const teamYears = teams.map((t) => Number((t.ageGroup ?? '').match(/(19|20)\d{2}/)?.[0])).filter((y) => y > 1900)
  const items = await kitItems(p, { all: true })
  const item = (name: string) => items.find((i) => lc(i.name) === name)
  return {
    today: localYmd(new Date()),
    teams: new Map(teams.map((t) => [lc(t.name), t.name])),
    numbers,
    accounts: new Map(users.map((u) => [lc(u.email), [u.firstName, u.lastName].filter(Boolean).join(' ')])),
    range: (y) => ranges.get(y) ?? null,
    oldestBirthYear: teamYears.length ? Math.min(...teamYears) : null,
    sizes: { shirt: item('shirt')?.sizes?.map((s) => s.label), shorts: item('shorts')?.sizes?.map((s) => s.label), jacket: item('jacket')?.sizes?.map((s) => s.label) },
    kitIds: { shirt: item('shirt')?.id, shorts: item('shorts')?.id, jacket: item('jacket')?.id },
  }
}

export type PreviewRow = ImportRow & { status: 'ok' | 'warning' | 'error'; family: 'new' | 'existing'; player: ImportRow['player']; action: 'create' | 'update' | 'skip' }
export type Preview = {
  rows: PreviewRow[]
  totals: { familiesNew: number; familiesMatched: number; playersCreate: number; playersUpdate: number; errors: number; warnings: number }
}

/** Find the family for a Parent 1 email (or, failing that, the same mobile). */
async function findFamily(p: Payload, email: string, mobile: string | null) {
  const byEmail = (await p.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, ...q })).docs[0]
  if (byEmail) return { user: rel(byEmail.familyAccount) ? await p.findByID({ collection: 'users', id: rel(byEmail.familyAccount)!, depth: 0, ...q }) : byEmail, how: 'email' as const }
  if (mobile) {
    const byPhone = (await p.find({ collection: 'users', where: { or: [{ phone: { equals: mobile } }, { phone: { equals: local04(mobile) } }], roles: { contains: 'parent' }, familyAccount: { exists: false } }, limit: 1, depth: 0, ...q })).docs[0]
    if (byPhone) return { user: byPhone, how: 'mobile' as const }
  }
  return null
}

async function findPlayer(p: Payload, accountId: number, r: ImportRow) {
  const { docs } = await p.find({ collection: 'participants', where: { account: { equals: accountId } }, limit: 50, depth: 0, ...q })
  return docs.find((k) => `${lc(k.firstName)}|${lc(k.lastName)}|${(k.dateOfBirth ?? '').slice(0, 10)}` === playerKey(r)) ?? null
}

/** Read and check a file; work out what importing it would do. Nothing is saved. */
export async function previewImport(p: Payload, sheet: unknown[][]): Promise<Preview | { missing: string[] }> {
  const parsed = parsePlayerSheet(sheet)
  if (parsed.missing.length) return { missing: parsed.missing }
  const ctx = await importContext(p)
  checkRows(parsed.rows, ctx)
  const families = new Map<string, { status: 'new' | 'existing'; accountId: number | null }>()
  const out: PreviewRow[] = []
  for (const r of parsed.rows) {
    let fam = families.get(r.parent1.email)
    if (!fam && r.parent1.email) {
      const f = await findFamily(p, r.parent1.email, r.parent1.mobile)
      if (f?.how === 'mobile') r.warnings.push(`Matched to an existing family by mobile (${f.user.email}) — the Parent 1 email is different`)
      fam = { status: f ? 'existing' : 'new', accountId: f?.user.id ?? null }
      families.set(r.parent1.email, fam)
    }
    const existing = fam?.accountId && r.player.dob ? await findPlayer(p, fam.accountId, r) : null
    const status = rowStatus(r)
    out.push({ ...r, status, family: fam?.status ?? 'new', action: status === 'error' ? 'skip' : existing ? 'update' : 'create' })
  }
  const ok = out.filter((r) => r.status !== 'error')
  const fams = new Map(ok.map((r) => [r.parent1.email, r.family]))
  return {
    rows: out,
    totals: {
      familiesNew: [...fams.values()].filter((f) => f === 'new').length,
      familiesMatched: [...fams.values()].filter((f) => f === 'existing').length,
      playersCreate: ok.filter((r) => r.action === 'create').length,
      playersUpdate: ok.filter((r) => r.action === 'update').length,
      errors: out.filter((r) => r.status === 'error').length,
      warnings: out.filter((r) => r.status === 'warning').length,
    },
  }
}

/** The season's Eagles registration program for a player's age (by the program's age range), if one exists. */
async function registrationFor(p: Payload, birthYear: number | null): Promise<Program | null> {
  const { season } = await getAgeRules(p)
  const { docs } = await p.find({ collection: 'programs', where: { type: { equals: 'registration' } }, limit: 50, depth: 0, ...q, pagination: false })
  const thisSeason = docs.filter((d) => String(d.title ?? '').includes(String(season)) || (d.startDate ?? '').startsWith(String(season)))
  const list = thisSeason.length ? thisSeason : docs
  if (!birthYear) return list.length === 1 ? list[0] : null
  const age = season - birthYear
  const { ageBounds } = await import('../lib/age-check')
  const fits = list.filter((d) => {
    const b = ageBounds(d)
    return (b.min === null || age >= b.min) && (b.max === null || age <= b.max)
  })
  return fits[0] ?? (list.length === 1 ? list[0] : null)
}

type Log = {
  users: number[]
  participants: number[]
  updated: { id: number; before: Partial<Participant> }[]
  members: number[]
  numbers: { id: number; participant: number; previous: { birthYear: number; number: number } | null }[]
  fitout: number[]
  fitoutSession: number | null
  usersUpdated: { id: number; before: Partial<User> }[]
}

const setIf = <T,>(value: T | null | undefined | '', current: T | null | undefined) => (value !== undefined && value !== null && value !== '' ? value : (current ?? undefined))

/**
 * Import every valid row. One family at a time: if anything fails for a family, what was made for it is removed
 * again and the family is reported as failed. Nothing is sent to families.
 */
export async function runImport(p: Payload, o: { sheet: unknown[][]; fileName: string; by: User }) {
  const preview = await previewImport(p, o.sheet)
  if ('missing' in preview) throw new Error(`Missing columns: ${preview.missing.join(', ')}`)
  const ctx = await importContext(p)
  const batch = await p.create({ collection: 'import-batches', ...q, data: { fileName: o.fileName.slice(0, 200), by: o.by.id, status: 'imported' } })
  const log: Log = { users: [], participants: [], updated: [], members: [], numbers: [], fitout: [], fitoutSession: null, usersUpdated: [] }
  const counts = { familiesCreated: 0, familiesMatched: 0, playersCreated: 0, playersUpdated: 0, unchanged: 0, skipped: preview.totals.errors, failed: [] as string[] }
  const valid = preview.rows.filter((r) => r.status !== 'error')
  const byFamily = new Map<string, PreviewRow[]>()
  for (const r of valid) byFamily.set(r.parent1.email, [...(byFamily.get(r.parent1.email) ?? []), r])

  for (const [email, rows] of byFamily) {
    const mark = { users: log.users.length, participants: log.participants.length, updated: log.updated.length, members: log.members.length, numbers: log.numbers.length, fitout: log.fitout.length, usersUpdated: log.usersUpdated.length }
    try {
      const first = rows[0]
      const found = await findFamily(p, email, first.parent1.mobile)
      const priorClient = rows.some((r) => r.paidBefore || r.rfa)
      let account: User
      if (found) {
        account = found.user as User
        const before = { firstName: account.firstName, lastName: account.lastName, phone: account.phone, imported: account.imported }
        const data = {
          firstName: account.firstName || first.parent1.first,
          lastName: account.lastName || first.parent1.last,
          phone: account.phone || first.parent1.mobile || undefined,
          imported: { ...(account.imported ?? {}), batch: account.imported?.batch ?? batch.id, relationship: setIf(first.parent1.relationship, account.imported?.relationship), suburb: setIf(first.suburb, account.imported?.suburb), postcode: setIf(first.postcode, account.imported?.postcode), priorClient: Boolean(account.imported?.priorClient) || priorClient, getsMessages: true },
        }
        const n = (v: unknown) => (v === undefined || v === '' ? null : v)
        const sig = (u: { firstName?: string | null; lastName?: string | null; phone?: string | null; imported?: Partial<NonNullable<User['imported']>> | null }) => JSON.stringify([n(u.firstName), n(u.lastName), n(u.phone), n(rel(u.imported?.batch)), n(u.imported?.relationship), n(u.imported?.suburb), n(u.imported?.postcode), Boolean(u.imported?.priorClient), Boolean(u.imported?.getsMessages)])
        const changed = sig(before) !== sig(data)
        if (changed) {
          log.usersUpdated.push({ id: account.id, before })
          account = await p.update({ collection: 'users', id: account.id, ...q, context: { skipWelcome: true }, data })
        }
        counts.familiesMatched++
      } else {
        account = await p.create({
          collection: 'users',
          ...q,
          context: { skipWelcome: true },
          data: { email, password: randomBytes(24).toString('base64url'), firstName: first.parent1.first, lastName: first.parent1.last, phone: first.parent1.mobile ?? undefined, roles: ['parent'], activated: false, imported: { batch: batch.id, relationship: first.parent1.relationship || undefined, suburb: first.suburb || undefined, postcode: first.postcode || undefined, priorClient, getsMessages: true } },
        })
        log.users.push(account.id)
        counts.familiesCreated++
      }
      // Parent 2: their own login on the same family (only when they're to get messages)
      const p2 = rows.find((r) => r.parent2?.send && r.parent2.email && r.parent2.email !== email)?.parent2
      if (p2) {
        const existing2 = (await p.find({ collection: 'users', where: { email: { equals: p2.email } }, limit: 1, depth: 0, ...q })).docs[0]
        if (!existing2) {
          const u2 = await p.create({ collection: 'users', ...q, context: { skipWelcome: true }, data: { email: p2.email, password: randomBytes(24).toString('base64url'), firstName: p2.first || undefined, lastName: p2.last || undefined, phone: p2.mobile ?? undefined, roles: ['parent'], activated: false, familyAccount: account.id, imported: { batch: batch.id, priorClient, getsMessages: true } } })
          log.users.push(u2.id)
        }
      }
      for (const r of rows) {
        const res = await importPlayer(p, { r, account, batchId: batch.id, ctx, log, by: o.by })
        counts[res === 'created' ? 'playersCreated' : res === 'updated' ? 'playersUpdated' : 'unchanged']++
      }
    } catch (e) {
      p.logger.error({ err: e, msg: `Import of family ${email} failed` })
      counts.failed.push(email)
      await rollback(p, { users: log.users.splice(mark.users), participants: log.participants.splice(mark.participants), updated: log.updated.splice(mark.updated), members: log.members.splice(mark.members), numbers: log.numbers.splice(mark.numbers), fitout: log.fitout.splice(mark.fitout), usersUpdated: log.usersUpdated.splice(mark.usersUpdated), fitoutSession: null }).catch(() => null)
    }
  }
  await p.update({ collection: 'import-batches', id: batch.id, ...q, data: { counts, log } })
  return { batch: batch.id, counts }
}

async function importPlayer(p: Payload, o: { r: PreviewRow; account: User; batchId: number; ctx: Awaited<ReturnType<typeof importContext>>; log: Log; by: User }): Promise<'created' | 'updated' | 'unchanged'> {
  const { r, account, batchId, ctx, log } = o
  const existing = await findPlayer(p, account.id, r)
  const teamName = r.eagles ? ctx.teams.get(lc(r.team)) : null
  const team = teamName ? (await p.find({ collection: 'teams', where: { name: { equals: teamName }, type: { equals: 'rowville' } }, limit: 1, depth: 0, ...q })).docs[0] : null
  const program = r.eagles && r.registration !== 'na' ? await registrationFor(p, r.player.birthYear) : null
  const memberships = Array.from(new Set([...(existing?.memberships ?? []), ...(r.eagles ? (['rowville'] as const) : []), ...(r.rfa ? (['rfa'] as const) : [])]))
  const data = {
    firstName: existing?.firstName ?? r.player.first,
    lastName: existing?.lastName ?? r.player.last,
    dateOfBirth: existing?.dateOfBirth ?? r.player.dob!,
    gender: setIf(r.player.gender as Participant['gender'], existing?.gender),
    account: account.id,
    memberships,
    ...(team ? { team: team.id } : {}),
    football: { ...(existing?.football ?? {}), position: setIf(r.goalkeeper ? 'Goalkeeper' : 'Outfield', existing?.football?.position) },
    medical: {
      ...(existing?.medical ?? {}),
      conditions: setIf(r.medical, existing?.medical?.conditions),
      emergencyContact: setIf(r.emergency.name, existing?.medical?.emergencyContact),
      emergencyPhone: setIf(r.emergency.mobile, existing?.medical?.emergencyPhone),
    },
    ...(r.photoConsent !== null ? { photoConsent: r.photoConsent } : {}),
    numbers: { ...(existing?.numbers ?? {}), required: false },
    ...(r.eagles && r.registration !== 'na' && existing?.registrationOffer?.status !== 'paid' ? { registrationOffer: { program: program?.id ?? rel(existing?.registrationOffer?.program), status: r.registration === 'paid' ? ('paid' as const) : ('offered' as const) } } : {}),
    imported: {
      ...(existing?.imported ?? {}),
      batch: rel(existing?.imported?.batch) ?? batchId,
      registrationStatus: r.eagles ? (existing?.registrationOffer?.status === 'paid' ? 'paid' : r.registration) : (existing?.imported?.registrationStatus ?? 'na'),
      registrationSource: r.eagles && r.registration === 'paid' ? (existing?.imported?.registrationSource ?? 'imported_paid_offline') : existing?.imported?.registrationSource,
      mobile: setIf(r.player.mobile, existing?.imported?.mobile),
      email: setIf(r.player.email, existing?.imported?.email),
      notes: setIf(r.notes, existing?.imported?.notes),
    },
  } as Partial<Participant>
  let kid: Participant
  let result: 'created' | 'updated' | 'unchanged'
  if (existing) {
    const n = (v: unknown) => (v === undefined || v === '' ? null : v)
    const pick = (k: Partial<Participant>) => JSON.stringify([n(k.gender), [...(k.memberships ?? [])].sort(), n(rel(k.team)), n(k.football?.position), n(k.medical?.conditions), n(k.medical?.emergencyContact), n(k.medical?.emergencyPhone), Boolean(k.photoConsent), n(rel(k.registrationOffer?.program)), n(k.registrationOffer?.status), n(k.imported?.registrationStatus), n(k.imported?.mobile), n(k.imported?.email), n(k.imported?.notes)])
    const changed = pick(existing) !== pick({ ...existing, ...data })
    if (changed) {
      log.updated.push({ id: existing.id, before: { gender: existing.gender, memberships: existing.memberships, team: rel(existing.team), football: existing.football, medical: existing.medical, photoConsent: existing.photoConsent, registrationOffer: existing.registrationOffer ? { program: rel(existing.registrationOffer.program), status: existing.registrationOffer.status } : undefined, imported: existing.imported, numbers: existing.numbers } as Partial<Participant> })
      kid = await p.update({ collection: 'participants', id: existing.id, ...q, context: { skipNumberRelease: true }, data })
    } else kid = existing
    result = changed ? 'updated' : 'unchanged'
  } else {
    kid = await p.create({ collection: 'participants', ...q, data: data as Participant })
    log.participants.push(kid.id)
    result = 'created'
  }
  // Straight onto the club team (no trial, selection or registration emails)
  if (team) {
    const { docs } = await p.find({ collection: 'team-members', where: { team: { equals: team.id }, participant: { equals: kid.id } }, limit: 1, depth: 0, ...q })
    if (!docs[0]) {
      const m = await p.create({ collection: 'team-members', ...q, data: { team: team.id, participant: kid.id, account: account.id, source: 'admin', active: true } })
      log.members.push(m.id)
    } else if (!docs[0].active) await p.update({ collection: 'team-members', id: docs[0].id, ...q, data: { active: true } })
  }
  // Their shirt number, locked to them (they're never asked to pick)
  if (r.number && r.player.birthYear) {
    const { docs: current } = await p.find({ collection: 'player-numbers', where: { participant: { equals: kid.id }, status: { equals: 'active' } }, limit: 1, depth: 0, ...q })
    const cur = current[0]
    if (!cur || cur.number !== r.number || cur.birthYear !== r.player.birthYear) {
      if (cur) await p.update({ collection: 'player-numbers', id: cur.id, ...q, data: { status: 'released', slot: null, releasedAt: new Date().toISOString() } })
      const n = await p.create({ collection: 'player-numbers', ...q, data: { participant: kid.id, birthYear: r.player.birthYear, number: r.number, status: 'active', slot: slotKey(r.player.birthYear, r.number), assignedAt: new Date().toISOString(), assignedBy: 'admin' } })
      log.numbers.push({ id: n.id, participant: kid.id, previous: cur ? { birthYear: cur.birthYear, number: cur.number } : null })
      await numberAudit(p, { participant: kid.id, action: cur ? 'changed' : 'assigned', oldNumber: cur?.number, newNumber: r.number, birthYear: r.player.birthYear, by: o.by.id, note: 'Imported existing player' })
      if (result === 'unchanged') result = 'updated'
    }
  }
  // Kit sizes → the fitout screen (this import's fitout session), so they appear in the kit order export
  const sizes = (['shirt', 'shorts', 'jacket'] as const)
    .map((k) => {
      const item = ctx.kitIds[k]
      const opts = ctx.sizes[k]
      const v = r.sizes[k]
      const label = opts?.find((x) => lc(x) === lc(v))
      return item && label ? { item, size: label } : null
    })
    .filter((x): x is { item: number; size: string } => Boolean(x))
  if (sizes.length) {
    if (!log.fitoutSession) {
      const s = await p.create({ collection: 'fitout-sessions', ...q, data: { name: `Imported kit sizes (import ${batchId})`, date: new Date().toISOString(), program: 'both', createdBy: o.by.id } })
      log.fitoutSession = s.id
    }
    const { docs: prior } = await p.find({ collection: 'fitout-entries', where: { participant: { equals: kid.id } }, sort: '-updatedAt', limit: 1, depth: 0, ...q })
    const same = prior[0] && JSON.stringify((prior[0].sizes ?? []).map((s) => [rel(s.item), s.size]).sort()) === JSON.stringify(sizes.map((s) => [s.item, s.size]).sort())
    if (!same) {
      const e = await p.create({ collection: 'fitout-entries', ...q, data: { key: `${log.fitoutSession}-${kid.id}`, session: log.fitoutSession, participant: kid.id, sizes, notes: 'Imported', updatedBy: o.by.id } })
      log.fitout.push(e.id)
      if (result === 'unchanged') result = 'updated'
    }
  }
  return result
}

/** Remove what a (part of a) batch created and put back what it changed. */
async function rollback(p: Payload, log: Log) {
  for (const id of log.fitout) await p.delete({ collection: 'fitout-entries', id, ...q }).catch(() => null)
  for (const n of [...log.numbers].reverse()) {
    await p.delete({ collection: 'player-numbers', id: n.id, ...q }).catch(() => null)
    if (n.previous) {
      const { docs } = await p.find({ collection: 'player-numbers', where: { participant: { equals: n.participant }, birthYear: { equals: n.previous.birthYear }, number: { equals: n.previous.number }, status: { equals: 'released' } }, sort: '-releasedAt', limit: 1, depth: 0, ...q })
      if (docs[0]) await p.update({ collection: 'player-numbers', id: docs[0].id, ...q, data: { status: 'active', slot: slotKey(n.previous.birthYear, n.previous.number), releasedAt: null } }).catch(() => null)
    }
  }
  for (const id of log.members) await p.delete({ collection: 'team-members', id, ...q }).catch(() => null)
  for (const u of log.updated) await p.update({ collection: 'participants', id: u.id, ...q, context: { skipNumberRelease: true }, data: u.before }).catch(() => null)
  for (const id of log.participants) {
    await p.delete({ collection: 'player-numbers', where: { participant: { equals: id } }, ...q }).catch(() => null)
    await p.delete({ collection: 'participants', id, ...q }).catch(() => null)
  }
  for (const u of log.usersUpdated) await p.update({ collection: 'users', id: u.id, ...q, context: { skipWelcome: true }, data: u.before }).catch(() => null)
  for (const id of [...log.users].reverse()) {
    await p.delete({ collection: 'invite-tokens', where: { user: { equals: id } }, ...q }).catch(() => null)
    await p.delete({ collection: 'users', id, ...q }).catch(() => null)
  }
  if (log.fitoutSession) await p.delete({ collection: 'fitout-sessions', id: log.fitoutSession, ...q }).catch(() => null)
}

/** Undo is allowed only while nobody in the batch has set up their account or been sent anything. */
export async function undoBlockers(p: Payload, batchId: number) {
  const { docs } = await p.find({ collection: 'users', where: { 'imported.batch': { equals: batchId } }, limit: 5000, depth: 0, ...q, pagination: false, select: { email: true, activated: true, launch: true } })
  return docs.filter((u) => u.activated || u.launch?.emailAt || u.launch?.smsAt).map((u) => u.email)
}

export async function undoBatch(p: Payload, batchId: number, by: User) {
  const batch = await p.findByID({ collection: 'import-batches', id: batchId, depth: 0, ...q })
  if (batch.status === 'undone') return { already: true }
  const blockers = await undoBlockers(p, batchId)
  if (blockers.length) throw new Error(`Can’t undo: ${blockers.length} famil${blockers.length === 1 ? 'y has' : 'ies have'} already been messaged or set up their account (${blockers.slice(0, 3).join(', ')}${blockers.length > 3 ? '…' : ''}).`)
  await rollback(p, batch.log as Log)
  await p.update({ collection: 'import-batches', id: batchId, ...q, data: { status: 'undone', undoneAt: new Date().toISOString(), undoneBy: by.id } })
  return { already: false }
}

export { rowStatus }
