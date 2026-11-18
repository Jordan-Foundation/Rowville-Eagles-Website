import type { Payload, PayloadRequest } from 'payload'
import type { SelectionEntry, SelectionRound, Squad, TrialSession, User } from '@/payload-types'
import { checkMove, groupLabel, type AgeRules } from '../lib/age-groups'
import { sendEmail } from '../lib/email'
import { emailLayout, esc } from '../lib/email-templates'
import { formatDate } from '../lib/format'
import { siteUrl } from '../lib/payments'
import { sendSms } from '../lib/sms'
import { pickOutcome, playingYear } from './board'
import { isSuccessful, isTrialist, positionGroupOf, type PositionGroup } from './flow'

/**
 * Trials, outcomes and team building (server). Only Management calls these (checked in the actions).
 * Nothing reaches a family from here except "Invite to next trial" and the finalised-team email;
 * outcome emails go from Review & send (service.ts → sendQueued).
 */

const q = { overrideAccess: true } as const
const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : ((v as number | null | undefined) ?? null))
export class SelectionError extends Error {}

export async function audit(p: Payload, o: { round?: number | null; entry?: number | null; squad?: number | null; action: string; summary: string; by?: number | null }) {
  await p.create({ collection: 'selection-audit', ...q, data: { round: o.round ?? undefined, entry: o.entry ?? undefined, squad: o.squad ?? undefined, action: o.action, summary: o.summary.slice(0, 300), by: o.by ?? undefined } })
}

// ── Rounds ───────────────────────────────────────────────────────────────────

/** Rounds for a program (newest first). */
export async function roundsFor(p: Payload, kind: 'rowville' | 'tournament') {
  const { docs } = await p.find({ collection: 'selection-rounds', where: { kind: { equals: kind } }, sort: '-createdAt', limit: 100, depth: 1, ...q, pagination: false })
  return docs
}

// ── Trial invites ────────────────────────────────────────────────────────────

/** Make sure a player's trial (booked by the family or invited by Management) is on their trial history. */
export async function ensureInvite(p: Payload, o: { entry: number; session: number; source: 'booked' | 'invited'; by?: number | null }, req?: PayloadRequest) {
  const key = `${o.entry}-${o.session}`
  const { docs } = await p.find({ collection: 'trial-invites', where: { key: { equals: key } }, limit: 1, depth: 0, ...q, req })
  if (docs[0]) return docs[0]
  if (req) return p.create({ collection: 'trial-invites', ...q, req, data: { key, entry: o.entry, session: o.session, source: o.source, invitedAt: new Date().toISOString(), invitedBy: o.by ?? undefined } })
  try {
    return await p.create({ collection: 'trial-invites', ...q, data: { key, entry: o.entry, session: o.session, source: o.source, invitedAt: new Date().toISOString(), invitedBy: o.by ?? undefined } })
  } catch {
    // Created at the same moment elsewhere
    return (await p.find({ collection: 'trial-invites', where: { key: { equals: key } }, limit: 1, depth: 0, ...q })).docs[0]
  }
}

/** Trials booked through the join flow (one or two nights) appear on the trial history. Safe to run any time. */
export async function syncBookedInvites(p: Payload, entries: Pick<SelectionEntry, 'id' | 'trialSession' | 'trialSession2'>[], have: Set<string>) {
  for (const e of entries) {
    for (const s of [e.trialSession, e.trialSession2]) {
      const sid = rel(s)
      if (sid && !have.has(`${e.id}-${sid}`)) {
        await ensureInvite(p, { entry: e.id, session: sid, source: 'booked' })
        have.add(`${e.id}-${sid}`)
      }
    }
  }
}

/** Tick (or untick) a player as attended. Attending moves them to "Attended" on the trialist page. */
export async function setAttendance(p: Payload, inviteId: number, attended: boolean, by: User) {
  const inv = await p.update({ collection: 'trial-invites', id: inviteId, ...q, depth: 0, data: { attended, attendedAt: attended ? new Date().toISOString() : null, markedBy: by.id } })
  const entry = await p.findByID({ collection: 'selection-entries', id: rel(inv.entry)!, depth: 0, ...q })
  if (attended && ['interested', 'trial-booked'].includes(entry.status)) {
    await p.update({ collection: 'selection-entries', id: entry.id, ...q, context: { skipOffer: true }, data: { status: 'attended' } })
  }
  if (!attended && entry.status === 'attended') {
    const { totalDocs } = await p.count({ collection: 'trial-invites', where: { entry: { equals: entry.id }, attended: { equals: true } }, ...q })
    if (!totalDocs) await p.update({ collection: 'selection-entries', id: entry.id, ...q, context: { skipOffer: true }, data: { status: 'trial-booked' } })
  }
  await audit(p, { round: rel(entry.round), entry: entry.id, action: attended ? 'attended' : 'not-attended', summary: `${entry.player.firstName} ${entry.player.lastName} ${attended ? 'attended' : 'marked not attended'}`, by: by.id })
  return inv
}

const when = (iso: string) => formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })

/** "Invite to next trial": record the invite and email (and text) the family the date, time, venue and what to bring. */
export async function inviteToTrial(p: Payload, o: { ids: number[]; session: number; by: User }) {
  const session = (await p.findByID({ collection: 'trial-sessions', id: o.session, depth: 0, ...q })) as TrialSession
  if (new Date(session.start).getTime() < Date.now()) throw new SelectionError('That trial has already happened — choose an upcoming one.')
  const { docs } = await p.find({ collection: 'selection-entries', where: { id: { in: o.ids } }, limit: o.ids.length, depth: 1, ...q, pagination: false })
  let sent = 0
  for (const e of docs) {
    await ensureInvite(p, { entry: e.id, session: session.id, source: 'invited', by: o.by.id })
    if (e.status === 'interested') await p.update({ collection: 'selection-entries', id: e.id, ...q, context: { skipOffer: true }, data: { status: 'trial-booked' } })
    const brand = e.kind === 'tournament' ? 'academy' : 'club'
    const sender = brand === 'academy' ? 'Foundation Academy' : 'Rowville Eagles'
    const html = emailLayout(brand, [
      {
        heading: `${e.player.firstName}’s next trial`,
        intro: `Hi ${esc(e.contact.firstName)} — thanks for coming along. We’d love to see ${esc(e.player.firstName)} at another trial before we make a decision.`,
        rows: [
          ['When', when(session.start)],
          ['Where', session.location || '208 Dandelion Drive, Rowville'],
          ['Age group', e.birthYear ? groupLabel(playingYear(e)) : ''],
        ],
        after: `${session.whatToBring ? `<strong>What to bring:</strong> ${esc(session.whatToBring)}<br><br>` : ''}Can’t make it? Just reply to this email and we’ll find another time.`,
      },
    ])
    const user = e.account && typeof e.account === 'object' ? e.account : null
    await sendEmail(p, { to: e.contact.email, subject: `${e.player.firstName}’s next trial — ${formatDate(session.start, { weekday: 'short', day: 'numeric', month: 'short' })}`, html, sender: brand, userId: user?.id })
    await sendSms(p, { to: e.contact.phone, kind: 'service', optedOut: user?.smsOptOut, userId: user?.id, body: `${sender}: we’d love to see ${e.player.firstName} at another trial — ${when(session.start)} at ${session.location || '208 Dandelion Drive, Rowville'}. Reply to the email if you can’t make it.` })
    await audit(p, { round: rel(e.round), entry: e.id, action: 'invited', summary: `${e.player.firstName} ${e.player.lastName} invited to ${session.title} (${formatDate(session.start, { day: 'numeric', month: 'short' })})`, by: o.by.id })
    sent++
  }
  return { sent }
}

// ── Outcomes ─────────────────────────────────────────────────────────────────

export type Outcome = 'successful' | 'unsuccessful' | 'another' | 'clear'

/**
 * Mark outcomes. Nothing is sent: successful/unsuccessful wait for "Send outcome emails".
 * Successful players appear on the Selected page straight away (teams can be built before offers go).
 */
export async function markOutcome(p: Payload, o: { ids: number[]; outcome: Outcome; by: User }) {
  const { docs } = await p.find({ collection: 'selection-entries', where: { id: { in: o.ids } }, limit: o.ids.length, depth: 1, ...q, pagination: false })
  let changed = 0
  for (const e of docs) {
    // Outcomes already sent can't be changed here
    if (!['interested', 'trial-booked', 'attended'].includes(e.status)) continue
    const round = e.round as SelectionRound
    const now = new Date().toISOString()
    const data =
      o.outcome === 'another'
        ? { needsAnotherTrial: true, outcomeQueued: null }
        : o.outcome === 'clear'
          ? { needsAnotherTrial: false, outcomeQueued: null, squad: null }
          : { needsAnotherTrial: false, outcomeQueued: (o.outcome === 'successful' ? pickOutcome(round.kind) : 'unsuccessful') as 'selected' | 'successful' | 'unsuccessful', outcomeEmail: true, outcomeMarkedAt: now, outcomeMarkedBy: o.by.id, ...(o.outcome === 'unsuccessful' ? { squad: null } : {}) }
    await p.update({ collection: 'selection-entries', id: e.id, ...q, context: { skipOffer: true }, data })
    await audit(p, { round: round.id, entry: e.id, action: `outcome-${o.outcome}`, summary: `${e.player.firstName} ${e.player.lastName}: ${o.outcome === 'another' ? 'needs another trial' : o.outcome === 'clear' ? 'outcome cleared (back to trialist)' : o.outcome}`, by: o.by.id })
    changed++
  }
  return { changed, skipped: docs.length - changed }
}

// ── Age groups (Macro) ───────────────────────────────────────────────────────

/** Move a selected player to another age group. Clears their team (they land in that group's Unassigned list). */
export async function moveAgeGroup(p: Payload, o: { id: number; to: number; by: User; rules: AgeRules }) {
  const e = await p.findByID({ collection: 'selection-entries', id: o.id, depth: 1, ...q })
  if (!isSuccessful(e)) throw new SelectionError('Only selected players can be moved here.')
  const squad = e.squad && typeof e.squad === 'object' ? (e.squad as Squad) : null
  if (squad?.finalisedAt) throw new SelectionError(`${squad.name} is finalised — unlock it first to move ${e.player.firstName}.`)
  const from = playingYear(e)
  if (from === o.to) return { ok: true as const, warning: null }
  const c = checkMove(e.birthYear!, o.to, o.rules)
  if (!c.allowed) throw new SelectionError(`${e.player.firstName}: ${c.message}`)
  await p.update({
    collection: 'selection-entries',
    id: e.id,
    ...q,
    context: { skipOffer: true },
    data: {
      playingBirthYear: o.to === e.birthYear ? null : o.to,
      squad: null,
      moves: [...(e.moves ?? []).map((m) => ({ ...m, by: rel(m.by) })), { from, to: o.to, direction: c.direction === 'none' ? undefined : c.direction, steps: c.steps, reason: 'Moved on the depth chart', by: o.by.id, at: new Date().toISOString() }],
    },
  })
  await audit(p, { round: rel(e.round), entry: e.id, squad: squad?.id, action: 'age-group', summary: `${e.player.firstName} ${e.player.lastName}: ${groupLabel(from)} → ${groupLabel(o.to)}${squad ? ` (left ${squad.name})` : ''}`, by: o.by.id })
  return { ok: true as const, warning: c.warning ? c.message : null }
}

// ── Teams (Micro) ────────────────────────────────────────────────────────────

const ageOf = (s: Pick<Squad, 'birthYears'>) => s.birthYears?.[0] ?? null

/** Put a player in a team (or back to Unassigned) and/or a position group. Saves immediately. */
export async function placePlayer(p: Payload, o: { id: number; squad: number | null; position?: PositionGroup | null; sortOrder?: number; by: User }) {
  const e = await p.findByID({ collection: 'selection-entries', id: o.id, depth: 1, ...q })
  if (!isSuccessful(e)) throw new SelectionError('Only selected players can be placed in a team.')
  const from = e.squad && typeof e.squad === 'object' ? (e.squad as Squad) : null
  const to = o.squad ? ((await p.findByID({ collection: 'squads', id: o.squad, depth: 0, ...q })) as Squad) : null
  if (from?.finalisedAt && from.id !== to?.id) throw new SelectionError(`${from.name} is finalised — unlock it first.`)
  if (to?.finalisedAt && from?.id !== to.id) throw new SelectionError(`${to.name} is finalised — unlock it first.`)
  if (to && rel(to.round) !== rel(e.round)) throw new SelectionError('That team belongs to a different round.')
  if (to && ageOf(to) && ageOf(to) !== playingYear(e)) throw new SelectionError(`${to.name} is the ${groupLabel(ageOf(to)!)} — move ${e.player.firstName} to that age group first (Macro view).`)
  const position = o.position === undefined ? (e.positionGroup ?? positionGroupOf(e.position ?? (typeof e.participant === 'object' ? e.participant?.football?.position : null))) : o.position
  await p.update({ collection: 'selection-entries', id: e.id, ...q, context: { skipOffer: true }, data: { squad: to?.id ?? null, positionGroup: position ?? null, sortOrder: o.sortOrder ?? e.sortOrder ?? 0 } })
  if (from?.id !== to?.id) await audit(p, { round: rel(e.round), entry: e.id, squad: to?.id ?? from?.id, action: 'team', summary: `${e.player.firstName} ${e.player.lastName}: ${from?.name ?? 'Unassigned'} → ${to?.name ?? 'Unassigned'}`, by: o.by.id })
  else if (position !== e.positionGroup) await audit(p, { round: rel(e.round), entry: e.id, squad: to?.id, action: 'position', summary: `${e.player.firstName} ${e.player.lastName}: ${(e.positionGroup ?? 'none').toUpperCase()} → ${(position ?? 'none').toUpperCase()}`, by: o.by.id })
}

/** One-team age groups: everyone unassigned goes into it. */
export async function assignAllUnassigned(p: Payload, o: { squad: number; by: User }) {
  const squad = (await p.findByID({ collection: 'squads', id: o.squad, depth: 0, ...q })) as Squad
  if (squad.finalisedAt) throw new SelectionError(`${squad.name} is finalised — unlock it first.`)
  const { docs } = await p.find({ collection: 'selection-entries', where: { round: { equals: rel(squad.round) }, squad: { exists: false } }, limit: 2000, depth: 1, ...q, pagination: false })
  const mine = docs.filter((e) => isSuccessful(e) && playingYear(e) === ageOf(squad))
  for (const e of mine) await placePlayer(p, { id: e.id, squad: squad.id, by: o.by })
  return { placed: mine.length }
}

export async function saveSquad(p: Payload, o: { round: number; id?: number | null; name: string; ageGroup: number; coach?: number | null; by: User }) {
  const name = o.name.trim().slice(0, 60)
  if (!name) throw new SelectionError('Give the team a name, e.g. U12 Gold.')
  const data = { round: o.round, name, birthYears: [o.ageGroup], ...(o.coach !== undefined ? { coaches: o.coach ? [o.coach] : [] } : {}) }
  const prevCoach = o.id ? rel(((await p.findByID({ collection: 'squads', id: o.id, depth: 0, ...q })) as Squad).coaches?.[0]) : null
  const doc = o.id ? await p.update({ collection: 'squads', id: o.id, ...q, data }) : await p.create({ collection: 'squads', ...q, data })
  // A newly assigned coach gets the "write a welcome message" task (badge) and a phone notification
  if (o.coach && o.coach !== prevCoach) {
    const { notifyUser } = await import('../lib/app-install')
    await notifyUser(p, o.coach, 'teams', { title: `You’re coaching ${name}`, body: 'Write a short welcome message for your new team’s families.', url: '/coach/team-welcome' }).catch(() => 0)
  }
  // Keep the linked team page's coach in step
  if (o.coach !== undefined && doc.team) await p.update({ collection: 'teams', id: rel(doc.team)!, ...q, data: { coaches: o.coach ? [o.coach] : [] } }).catch(() => null)
  await audit(p, { round: o.round, squad: doc.id, action: o.id ? 'team-edit' : 'team-add', summary: `${o.id ? 'Updated' : 'Added'} team ${name}${o.coach ? ' (coach set)' : ''}`, by: o.by.id })
  return doc
}

export async function deleteSquad(p: Payload, o: { id: number; by: User }) {
  const squad = (await p.findByID({ collection: 'squads', id: o.id, depth: 0, ...q })) as Squad
  if (squad.finalisedAt) throw new SelectionError(`${squad.name} is finalised — unlock it first.`)
  const { docs } = await p.find({ collection: 'selection-entries', where: { squad: { equals: o.id } }, limit: 2000, depth: 0, ...q, pagination: false })
  for (const e of docs) await p.update({ collection: 'selection-entries', id: e.id, ...q, context: { skipOffer: true }, data: { squad: null } })
  await p.delete({ collection: 'squads', id: o.id, ...q })
  await audit(p, { round: rel(squad.round), action: 'team-delete', summary: `Deleted team ${squad.name} (${docs.length} player${docs.length === 1 ? '' : 's'} back to Unassigned)`, by: o.by.id })
}

/** Coach welcome message (the coach for their own team, or Management). */
export async function saveWelcome(p: Payload, o: { squad: number; message: string; by: User; asManagement: boolean }) {
  const squad = (await p.findByID({ collection: 'squads', id: o.squad, depth: 0, ...q })) as Squad
  if (!o.asManagement && !(squad.coaches ?? []).some((c) => rel(c) === o.by.id)) throw new SelectionError('You can only write the message for your own team.')
  const message = o.message.trim().slice(0, 600)
  await p.update({ collection: 'squads', id: squad.id, ...q, data: { welcomeMessage: message || null, welcomeUpdatedBy: o.by.id, welcomeUpdatedAt: new Date().toISOString() } })
  await audit(p, { round: rel(squad.round), squad: squad.id, action: 'welcome', summary: `Welcome message for ${squad.name} ${message ? 'saved' : 'cleared'}${o.asManagement ? ' by Management' : ''}`, by: o.by.id })
}

// ── Finalise + team email ────────────────────────────────────────────────────

/** Create the club team page for a Rowville team the first time it's finalised (tournament teams have their own). */
async function ensureTeamPage(p: Payload, squad: Squad, round: SelectionRound) {
  const { ensureSquadTeam } = await import('../teams/service')
  const existing = await ensureSquadTeam(p, squad)
  if (existing) return existing
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
  const base = slugify(`${squad.name}-${round.season}`)
  let slug = base
  for (let i = 2; (await p.count({ collection: 'teams', where: { slug: { equals: slug } }, ...q })).totalDocs > 0; i++) slug = `${base}-${i}`
  const team = await p.create({ collection: 'teams', ...q, data: { type: 'rowville', name: squad.name, slug, season: round.season, brand: 'club', ageGroup: (squad.birthYears ?? []).map((y) => `${y}s`).join(' / ') || undefined, coaches: (squad.coaches ?? []).map((c) => rel(c)!).filter(Boolean) } })
  await p.update({ collection: 'squads', id: squad.id, ...q, data: { team: team.id } })
  return team.id
}

/** Lock a team. Paid players join the team page now (the rest join when they pay). */
export async function finaliseSquad(p: Payload, o: { id: number; by: User }) {
  const squad = (await p.findByID({ collection: 'squads', id: o.id, depth: 1, ...q })) as Squad
  if (squad.finalisedAt) return squad
  const round = squad.round as SelectionRound
  const teamId = await ensureTeamPage(p, squad, round)
  const done = await p.update({ collection: 'squads', id: squad.id, ...q, data: { finalisedAt: new Date().toISOString(), finalisedBy: o.by.id } })
  const { docs } = await p.find({ collection: 'selection-entries', where: { squad: { equals: squad.id } }, limit: 2000, depth: 0, ...q, pagination: false })
  const { joinFromEntry } = await import('../teams/service')
  for (const e of docs) {
    if (teamId) await p.update({ collection: 'selection-entries', id: e.id, ...q, context: { skipOffer: true }, data: { offeredTeam: teamId } })
    if (e.status === 'registered') await joinFromEntry(p, { ...e, squad: done }).catch((err) => p.logger.error({ err, msg: `Team page for ${e.reference}` }))
  }
  await audit(p, { round: round.id, squad: squad.id, action: 'finalise', summary: `Finalised ${squad.name} (${docs.length} players)`, by: o.by.id })
  return done
}

export async function unlockSquad(p: Payload, o: { id: number; by: User }) {
  const squad = (await p.findByID({ collection: 'squads', id: o.id, depth: 0, ...q })) as Squad
  await p.update({ collection: 'squads', id: squad.id, ...q, data: { finalisedAt: null, finalisedBy: null } })
  await audit(p, { round: rel(squad.round), squad: squad.id, action: 'unlock', summary: `Unlocked ${squad.name}`, by: o.by.id })
}

export type CoachIntro = { name: string; photo: string | null; bio: string; message: string | null }

/** The coach introduction for the team email: name, photo and bio from their coach profile, plus their message. */
export async function coachIntro(p: Payload, squad: Squad): Promise<CoachIntro | null> {
  const coachId = rel(squad.coaches?.[0])
  if (!coachId) return null
  const user = (await p.findByID({ collection: 'users', id: coachId, depth: 0, ...q, disableErrors: true })) as User | null
  if (!user) return null
  const { docs } = await p.find({ collection: 'academy-coaches', where: { user: { equals: coachId } }, limit: 1, depth: 1, ...q })
  const prof = docs[0]
  const photo = prof?.photo && typeof prof.photo === 'object' ? (prof.photo.url ?? null) : null
  return { name: prof?.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Your coach', photo: photo ? (photo.startsWith('http') ? photo : `${siteUrl()}${photo}`) : null, bio: prof?.bio ?? '', message: squad.welcomeMessage?.trim() || null }
}

/** What the team email says (used for the preview and the send). */
export async function teamEmail(p: Payload, squadId: number) {
  const squad = (await p.findByID({ collection: 'squads', id: squadId, depth: 1, ...q })) as Squad
  const round = squad.round as SelectionRound
  const team = squad.team ? await p.findByID({ collection: 'teams', id: rel(squad.team)!, depth: 0, ...q, disableErrors: true }) : null
  const coach = await coachIntro(p, squad)
  const brand: 'club' | 'academy' = round.kind === 'tournament' ? 'academy' : 'club'
  const program = round.kind === 'tournament' ? round.title : `Rowville Eagles ${round.season}`
  const age = squad.birthYears?.[0] ? groupLabel(squad.birthYears[0]) : ''
  const training = (team?.training ?? []).map((t) => `${t.day} ${t.start}${t.end ? `–${t.end}` : ''}${t.location ? ` · ${t.location}` : ''}`)
  const first = nextTraining(team?.training ?? [])
  const blocks = (parent: string, player: string) => [
    {
      heading: `${player} is in ${squad.name}`,
      intro: `Hi ${esc(parent)} — teams are set for ${esc(program)}, and ${esc(player)} is in <strong>${esc(squad.name)}</strong>${age ? ` (${esc(age)})` : ''}.`,
      rows: [
        ['Team', squad.name],
        ...(age ? ([['Age group', age]] as [string, string][]) : []),
        ['Program', program],
        ['Training', training.length ? training.join('<br>') : 'Details to follow'],
        ['Game day', team?.gameDay ?? 'Details to follow'],
      ] as [string, string][],
    },
    ...(coach
      ? [
          {
            heading: `Meet your coach: ${coach.name}`,
            intro: `${coach.photo ? `<img src="${esc(coach.photo)}" alt="" width="96" height="96" style="border-radius:999px;object-fit:cover;display:block;margin:0 0 12px">` : ''}${coach.bio ? `${esc(coach.bio)}<br><br>` : ''}${coach.message ? `<em>“${esc(coach.message).replace(/\n/g, '<br>')}”</em><br>— ${esc(coach.name)}` : ''}`,
          },
        ]
      : []),
    {
      heading: 'What happens next',
      intro: `${first ? `First training: <strong>${esc(first)}</strong>. ` : 'We’ll confirm the first training date soon. '}${round.kind === 'rowville' ? 'Your team page has notices, training times and fixtures — and kit fitting details will be posted there.' : 'Your team page has everything for the tournament.'}`,
      ...(team ? { cta: { label: 'Open the team page', href: `${siteUrl()}/teams/${team.slug}` } } : {}),
    },
  ]
  return { squad, round, team, coach, brand, program, blocks, subject: `${squad.name}: welcome to the team — ${program}` }
}

function nextTraining(training: { day: string; start: string; location?: string | null }[]) {
  if (!training.length) return null
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const now = new Date()
  const opts = training.map((t) => {
    const d = new Date(now)
    d.setDate(d.getDate() + ((days.indexOf(t.day) - d.getDay() + 7) % 7 || 7))
    return { d, t }
  }).sort((a, b) => a.d.getTime() - b.d.getTime())[0]
  return `${formatDate(opts.d.toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })} at ${opts.t.start}${opts.t.location ? `, ${opts.t.location}` : ''}`
}

/** Send the team email to every family in a finalised team. */
export async function sendTeamEmail(p: Payload, o: { id: number; by: User }) {
  const m = await teamEmail(p, o.id)
  if (!m.squad.finalisedAt) throw new SelectionError('Finalise the team first.')
  const { docs } = await p.find({ collection: 'selection-entries', where: { squad: { equals: o.id } }, limit: 2000, depth: 0, ...q, pagination: false })
  let sent = 0
  for (const e of docs) {
    const html = emailLayout(m.brand, m.blocks(e.contact.firstName, e.player.firstName))
    if (await sendEmail(p, { to: e.contact.email, subject: m.subject, html, sender: m.brand, userId: rel(e.account) ?? undefined })) sent++
    const { notifyUser } = await import('../lib/app-install')
    await notifyUser(p, rel(e.account), 'teams', { title: `${e.player.firstName} is in ${m.squad.name}`, body: m.coach ? `Meet coach ${m.coach.name} — tap for training details.` : 'Tap for your team details.', url: m.team ? `/teams/${m.team.slug}` : '/account' })
  }
  await p.update({ collection: 'squads', id: o.id, ...q, data: { teamEmailSentAt: new Date().toISOString() } })
  await audit(p, { round: m.round.id, squad: o.id, action: 'team-email', summary: `Team email sent for ${m.squad.name} to ${sent} famil${sent === 1 ? 'y' : 'ies'}${m.coach?.message ? '' : ' (no coach message)'}`, by: o.by.id })
  return { sent, families: docs.length }
}

export const trialistFilter = isTrialist
