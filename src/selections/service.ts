import type { Payload } from 'payload'
import type { Program, SelectionEntry, SelectionRound, Squad, User } from '@/payload-types'
import { checkMove, fullLabel, groupInfo, groupLabel, type AgeRules } from '../lib/age-groups'
import { sendEmail } from '../lib/email'
import { emailLayout } from '../lib/email-templates'
import { formatDate } from '../lib/format'
import { siteUrl } from '../lib/payments'
import { sendSms } from '../lib/sms'
import { sendOffer } from '../lib/trials'
import { pickOutcome, playingYear } from './board'
import { DEFAULT_TEMPLATES, fill, leftovers, toHtml, type OutcomeKind } from './templates'

/** Selection dashboard actions (server). Nothing reaches a family until staff press "Send" in Review & send. */

const rel = (v: number | { id: number } | null | undefined) => (v && typeof v === 'object' ? v.id : (v ?? null))

export async function loadRound(payload: Payload, roundId: number) {
  const round = await payload.findByID({ collection: 'selection-rounds', id: roundId, depth: 1, overrideAccess: true, disableErrors: true })
  if (!round) return null
  const [{ docs: squads }, { docs: entries }] = await Promise.all([
    payload.find({ collection: 'squads', where: { round: { equals: roundId } }, sort: 'name', limit: 200, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'selection-entries', where: { round: { equals: roundId } }, sort: 'player.lastName', limit: 5000, depth: 1, overrideAccess: true }),
  ])
  return { round, squads, entries }
}

// ── Age-group moves ──────────────────────────────────────────────────────────

export async function moveEntries(payload: Payload, o: { ids: number[]; to: number; reason: string; confirmWarning: boolean; actor: User; rules: AgeRules }) {
  if (!o.reason.trim()) return { ok: false as const, error: 'Every age-group move needs a reason.' }
  const { docs } = await payload.find({ collection: 'selection-entries', where: { id: { in: o.ids } }, limit: o.ids.length, depth: 0, overrideAccess: true })
  // Check everyone first, so a blocked player doesn't leave a half-applied bulk move
  const checks = docs.map((e) => ({ e, c: checkMove(e.birthYear!, o.to, o.rules) }))
  const blocked = checks.filter((x) => !x.c.allowed)
  if (blocked.length) return { ok: false as const, error: blocked.map((x) => `${x.e.player.firstName} ${x.e.player.lastName}: ${x.c.message}`).join(' ') }
  const warned = checks.filter((x) => x.c.warning)
  if (warned.length && !o.confirmWarning) {
    return { ok: false as const, needsConfirm: true, error: warned.map((x) => `${x.e.player.firstName} ${x.e.player.lastName}: ${x.c.message}`).join(' ') }
  }
  for (const { e, c } of checks) {
    const from = playingYear(e)
    if (from === o.to) continue
    await payload.update({
      collection: 'selection-entries',
      id: e.id,
      overrideAccess: true,
      context: { skipOffer: true },
      data: {
        playingBirthYear: o.to === e.birthYear ? null : o.to,
        moves: [...(e.moves ?? []), { from, to: o.to, direction: c.direction === 'none' ? undefined : c.direction, steps: c.steps, reason: o.reason.trim(), by: o.actor.id, at: new Date().toISOString() }],
      },
    })
  }
  return { ok: true as const, moved: checks.length }
}

// ── Squads & outcomes ────────────────────────────────────────────────────────

export async function assignSquad(payload: Payload, ids: number[], squadId: number | null) {
  for (const id of ids) await payload.update({ collection: 'selection-entries', id, data: { squad: squadId }, overrideAccess: true, context: { skipOffer: true } })
  return { ok: true as const }
}

/** Stage an outcome (or clear it). Picks need a squad; Rowville picks also need the squad's club team + the round's registration. */
export async function queueOutcome(payload: Payload, round: SelectionRound, ids: number[], outcome: 'pick' | 'unsuccessful' | 'clear', emailUnsuccessful = true) {
  const { docs } = await payload.find({ collection: 'selection-entries', where: { id: { in: ids }, round: { equals: round.id } }, limit: ids.length, depth: 1, overrideAccess: true })
  if (outcome === 'pick') {
    const noSquad = docs.filter((e) => !e.squad)
    if (noSquad.length) return { ok: false as const, error: `Put ${noSquad.map((e) => e.player.firstName).join(', ')} in a squad first.` }
    if (round.kind === 'rowville') {
      if (!round.program) return { ok: false as const, error: 'Set this round’s registration program (Selection rounds → this round) before sending offers.' }
      const noTeam = docs.filter((e) => !(e.squad as Squad).team)
      if (noTeam.length) return { ok: false as const, error: `Link squad “${(noTeam[0].squad as Squad).name}” to a club team first (Squads → ${(noTeam[0].squad as Squad).name} → Team).` }
    }
  }
  const done = docs.filter((e) => ['registered', 'withdrawn', 'released'].includes(e.status))
  for (const e of docs) {
    if (done.includes(e)) continue
    await payload.update({
      collection: 'selection-entries',
      id: e.id,
      overrideAccess: true,
      context: { skipOffer: true },
      data: outcome === 'clear' ? { outcomeQueued: null } : { outcomeQueued: outcome === 'pick' ? pickOutcome(round.kind) : 'unsuccessful', outcomeEmail: outcome === 'unsuccessful' ? emailUnsuccessful : true },
    })
  }
  return { ok: true as const, skipped: done.length }
}

// ── Rendering & sending ──────────────────────────────────────────────────────

function templateFor(round: SelectionRound, kind: OutcomeKind) {
  const t = (round.templates ?? {}) as Record<string, string | null | undefined>
  return {
    subject: t[`${kind}Subject`] || DEFAULT_TEMPLATES[kind].subject,
    body: t[`${kind}Body`] || DEFAULT_TEMPLATES[kind].body,
    sms: t[`${kind}Sms`] ?? DEFAULT_TEMPLATES[kind].sms,
  }
}

export function renderOutcome(e: SelectionEntry, round: SelectionRound, rules: AgeRules) {
  const kind = e.outcomeQueued as OutcomeKind
  const squad = e.squad && typeof e.squad === 'object' ? (e.squad as Squad) : null
  const program = round.program && typeof round.program === 'object' ? (round.program as Program) : null
  const by = playingYear(e)
  const deadline = new Date(Date.now() + (round.paymentDeadlineDays ?? 7) * 86_400_000).toISOString()
  const vars = {
    parent: e.contact.firstName,
    player: e.player.firstName,
    playerFull: `${e.player.firstName} ${e.player.lastName}`,
    team: squad?.name ?? '',
    ageGroup: by ? groupLabel(by) : '',
    event: round.kind === 'tournament' ? (program?.title ?? round.title) : `Rowville Eagles ${round.season}`,
    link: `${siteUrl()}/account`,
    deadline: formatDate(deadline, { weekday: 'long', day: 'numeric', month: 'long' }),
  }
  const t = templateFor(round, kind)
  const subject = fill(t.subject, vars)
  const body = fill(t.body, vars)
  const sms = t.sms ? fill(t.sms, vars) : ''
  const heading = kind === 'unsuccessful' ? 'Trial outcome' : kind === 'selected' ? `${e.player.firstName} has been selected` : `Welcome to the Eagles, ${e.player.firstName}!`
  return { kind, subject, heading, bodyHtml: toHtml(body), body, sms, missing: leftovers(`${subject} ${body} ${sms}`), placement: by ? fullLabel(groupInfo(by, rules)) : '' }
}

/** Send every queued outcome in the round. Called only from Review & send, after staff confirm. */
export async function sendQueued(payload: Payload, roundId: number, actor: User, rules: AgeRules) {
  const data = await loadRound(payload, roundId)
  if (!data) return { ok: false as const, error: 'Round not found.' }
  const { round } = data
  const queued = data.entries.filter((e) => e.outcomeQueued)
  const brand = round.kind === 'tournament' && round.program && typeof round.program === 'object' && (round.program as Program).brand === 'academy' ? 'academy' : 'club'
  const result = { selected: 0, successful: 0, unsuccessful: 0, emailed: 0, failed: [] as string[] }
  for (const e of queued) {
    const r = renderOutcome(e, round, rules)
    const now = new Date().toISOString()
    try {
      const user = e.account ? ((await payload.findByID({ collection: 'users', id: rel(e.account)!, depth: 0, overrideAccess: true, disableErrors: true })) as User | null) : null
      if (r.kind === 'successful') {
        const squad = e.squad as Squad
        await payload.update({
          collection: 'selection-entries',
          id: e.id,
          overrideAccess: true,
          context: { skipOffer: true },
          data: { status: 'offered', offeredTeam: rel(squad.team), registrationProgram: rel(round.program), outcomeQueued: null, outcomeSentAt: now, outcomeSentBy: actor.id, selectedAt: now },
        })
        const fresh = await payload.findByID({ collection: 'selection-entries', id: e.id, depth: 0, overrideAccess: true })
        await sendOffer(payload, fresh, undefined, { subject: r.subject, heading: r.heading, bodyHtml: r.bodyHtml })
        result.successful++
        result.emailed++
      } else {
        await payload.update({
          collection: 'selection-entries',
          id: e.id,
          overrideAccess: true,
          context: { skipOffer: true },
          data: { status: r.kind === 'selected' ? 'selected' : 'unsuccessful', outcomeQueued: null, outcomeSentAt: now, outcomeSentBy: actor.id, ...(r.kind === 'selected' ? { selectedAt: now } : {}) },
        })
        if (r.kind === 'selected' || e.outcomeEmail !== false) {
          const html = emailLayout(brand, [{ heading: r.heading, intro: r.bodyHtml, ...(r.kind === 'selected' ? { cta: { label: 'Go to my account', href: `${siteUrl()}/account` } } : {}) }])
          await sendEmail(payload, { to: e.contact.email, subject: r.subject, html, sender: brand, userId: user?.id })
          result.emailed++
        }
        result[r.kind === 'selected' ? 'selected' : 'unsuccessful']++
      }
      if (r.sms) await sendSms(payload, { to: e.contact.phone, body: `${r.sms} – ${brand === 'academy' ? 'Foundation Academy' : 'Rowville Eagles'}`, kind: 'service', optedOut: user?.smsOptOut })
    } catch (err) {
      payload.logger.error({ err, msg: `Outcome for ${e.reference} failed` })
      result.failed.push(`${e.player.firstName} ${e.player.lastName}`)
    }
  }
  return { ok: true as const, ...result }
}
