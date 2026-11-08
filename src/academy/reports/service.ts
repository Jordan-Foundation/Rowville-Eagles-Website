import type { Payload } from 'payload'
import type { AcademyRegistration, AcademyTermSlot, PlayerReport, Program, ReportCycle, Team, User } from '@/payload-types'
import { birthYearOf } from '../../lib/age-groups'
import { formatDate } from '../../lib/format'
import { emailLayout } from '../../lib/email-templates'
import { sendEmail } from '../../lib/email'
import { siteUrl } from '../../lib/payments'
import { REMINDER_KINDS, daysUntil, dueReminder } from '../reminders'
import { yearsLabel, slotLabel } from '../terms/slots'
import { OUTSTANDING, cleanEntry, coachCanEdit, planReports, submitProblems, type Candidate, type ReportInput, type ReportStatus } from './rules'

const q = { overrideAccess: true, depth: 0 } as const
const idOf = (v: unknown): number | null => (v && typeof v === 'object' ? (v as { id: number }).id : typeof v === 'number' ? v : null)
const ids = (v: unknown) => (Array.isArray(v) ? v.map(idOf).filter((x): x is number => x != null) : [])
const entry = (action: string, by: number | null, note?: string) => ({ action, by: by ?? undefined, at: new Date().toISOString(), note: note || undefined })

/** Everyone in a cycle's programs (paid term places) and teams (active members), with the coach who writes their report. */
export async function cycleCandidates(p: Payload, cycle: ReportCycle): Promise<Candidate[]> {
  const out: Candidate[] = []
  const programIds = ids(cycle.programs)
  if (programIds.length) {
    const [{ docs: slots }, { docs: regs }, { docs: programs }] = await Promise.all([
      p.find({ collection: 'academy-term-slots', where: { program: { in: programIds } }, limit: 500, ...q }),
      p.find({ collection: 'academy-registrations', where: { program: { in: programIds }, status: { equals: 'paid' } }, limit: 5000, sort: 'player.firstName', ...q }),
      p.find({ collection: 'programs', where: { id: { in: programIds } }, limit: 100, ...q }),
    ])
    // Coach profiles → their login accounts
    const coachIds = new Set<number>()
    for (const s of slots) { ids(s.coaches).forEach((c) => coachIds.add(c)); (s.groups ?? []).forEach((g) => ids(g.coaches).forEach((c) => coachIds.add(c))) }
    const { docs: coaches } = coachIds.size ? await p.find({ collection: 'academy-coaches', where: { id: { in: [...coachIds] } }, limit: 500, ...q }) : { docs: [] }
    const userOfCoach = new Map(coaches.map((c) => [c.id, idOf(c.user)]))
    const slotById = new Map(slots.map((s) => [s.id, s]))
    const programById = new Map(programs.map((x) => [x.id, x]))
    for (const r of regs as AcademyRegistration[]) {
      const slot = slotById.get(idOf(r.slot) ?? -1) as AcademyTermSlot | undefined
      const program = programById.get(idOf(r.program) ?? -1) as Program | undefined
      const group = slot && r.groupId ? (slot.groups ?? []).find((g) => g.id === r.groupId) : undefined
      // First-listed coach of the player's group, else of the whole time slot
      const first = ids(group?.coaches)[0] ?? ids(slot?.coaches)[0]
      const participant = idOf(r.participant)
      out.push({
        key: participant ? `participant:${participant}` : `registration:${r.id}`,
        name: `${r.player.firstName} ${r.player.lastName}`.trim(),
        birthYear: r.birthYear ?? birthYearOf(r.player.dateOfBirth),
        playingBirthYear: r.playingBirthYear,
        toddler: program?.type === 'toddler',
        coachUserId: first ? (userOfCoach.get(first) ?? null) : null,
        source: 'term',
        sourceLabel: [program?.title, slot ? `${group ? `${group.name} · ` : ''}${slotLabel(slot)} · ${yearsLabel(slot.birthYears)}` : null].filter(Boolean).join(' — '),
        participant,
        account: idOf(r.account),
        registration: r.id,
      })
    }
  }
  const teamIds = ids(cycle.teams)
  if (teamIds.length) {
    const [{ docs: teams }, { docs: members }] = await Promise.all([
      p.find({ collection: 'teams', where: { id: { in: teamIds } }, limit: 100, ...q }),
      p.find({ collection: 'team-members', where: { team: { in: teamIds }, active: { equals: true } }, limit: 5000, overrideAccess: true, depth: 1 }),
    ])
    const teamById = new Map((teams as Team[]).map((t) => [t.id, t]))
    for (const m of members) {
      const team = teamById.get(idOf(m.team) ?? -1)
      const pt = typeof m.participant === 'object' ? m.participant : null
      if (!team || !pt) continue
      const entryDoc = m.selectionEntry && typeof m.selectionEntry === 'object' ? m.selectionEntry : null
      out.push({
        key: `participant:${pt.id}`,
        name: `${pt.firstName} ${pt.lastName}`.trim(),
        birthYear: birthYearOf(pt.dateOfBirth),
        playingBirthYear: entryDoc?.playingBirthYear ?? null,
        coachUserId: ids(team.coaches)[0] ?? null,
        source: 'team',
        sourceLabel: team.type === 'tournament' && team.event ? `${team.event} – ${team.name}` : team.name,
        participant: pt.id,
        account: idOf(m.account) ?? idOf(pt.account),
        team: team.id,
      })
    }
  }
  return out
}

/** "Create reports": one per player in scope who doesn't have one in this cycle yet. Safe to press again after adding players. */
export async function createCycleReports(p: Payload, cycleId: number, by: number | null) {
  const cycle = await p.findByID({ collection: 'report-cycles', id: cycleId, ...q })
  const candidates = await cycleCandidates(p, cycle)
  const { docs: existing } = await p.find({ collection: 'player-reports', where: { cycle: { equals: cycleId } }, limit: 10000, ...q, select: { key: true } })
  const plan = planReports(candidates, cycle.season, new Set(existing.map((e) => e.key)))
  let created = 0
  for (const c of plan.create) {
    try {
      await p.create({
        collection: 'player-reports',
        overrideAccess: true,
        data: {
          cycle: cycleId, key: c.key, status: 'not_started', playerName: c.name, birthYear: c.birthYear ?? undefined, level: c.level,
          coach: c.coachUserId ?? undefined, source: c.source, sourceLabel: c.sourceLabel,
          participant: c.participant ?? undefined, account: c.account ?? undefined, registration: c.registration ?? undefined, team: c.team ?? undefined,
          strands: cleanEntry({ strands: [] }).strands, history: [entry('Created', by)],
        },
      })
      created++
    } catch {
      // unique (cycle, key): created by a concurrent click
    }
  }
  await p.update({ collection: 'report-cycles', id: cycleId, overrideAccess: true, data: { reportsCreatedAt: new Date().toISOString() } })
  return { created, already: plan.already, skipped: plan.skipped, noCoach: plan.create.filter((c) => !c.coachUserId).length }
}

/** A coach's report, or null if it isn't theirs. */
export async function coachReport(p: Payload, id: number, userId: number) {
  const r = await p.findByID({ collection: 'player-reports', id, ...q, disableErrors: true })
  return r && idOf(r.coach) === userId ? r : null
}

export type SaveResult = { ok: true; savedAt: string; status: ReportStatus } | { ok: false; error: string }

/** Autosave: stores the coach's draft (only while they can still edit it). */
export async function saveDraft(p: Payload, report: PlayerReport, input: ReportInput, by: number): Promise<SaveResult> {
  if (!coachCanEdit(report.status as ReportStatus)) return { ok: false, error: 'This report has been submitted and is locked.' }
  const clean = cleanEntry(input)
  const savedAt = new Date().toISOString()
  const status: ReportStatus = report.status === 'not_started' ? 'draft' : (report.status as ReportStatus)
  await p.update({ collection: 'player-reports', id: report.id, overrideAccess: true, data: { ...clean, status, savedAt, ...(report.status === 'not_started' ? { history: [...(report.history ?? []), entry('Started', by)] } : {}) } })
  return { ok: true, savedAt, status }
}

export async function submitReport(p: Payload, report: PlayerReport, input: ReportInput, by: number): Promise<SaveResult & { problems?: string[] }> {
  if (!coachCanEdit(report.status as ReportStatus)) return { ok: false, error: 'This report has already been submitted.' }
  const problems = submitProblems(input)
  if (problems.length) return { ok: false, error: problems.join(' '), problems }
  const now = new Date().toISOString()
  await p.update({
    collection: 'player-reports', id: report.id, overrideAccess: true,
    data: { ...cleanEntry(input), status: 'submitted', savedAt: now, submittedAt: now, history: [...(report.history ?? []), entry(report.status === 'returned' ? 'Resubmitted' : 'Submitted', by)] },
  })
  return { ok: true, savedAt: now, status: 'submitted' }
}

/** Management: hand a report to a different coach. */
export async function reassignReport(p: Payload, reportId: number, coachUserId: number | null, by: number) {
  const r = await p.findByID({ collection: 'player-reports', id: reportId, ...q })
  if (idOf(r.coach) === coachUserId) return
  let name = 'nobody'
  if (coachUserId) {
    const u = await p.findByID({ collection: 'users', id: coachUserId, ...q, disableErrors: true })
    if (!u || !(u.roles ?? []).includes('coach')) throw new Error('Choose a coach')
    name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email
  }
  await p.update({ collection: 'player-reports', id: reportId, overrideAccess: true, data: { coach: coachUserId ?? null, history: [...(r.history ?? []), entry(`Assigned to ${name}`, by)] } })
}

/** Outstanding reports for a coach in open cycles (the coach dashboard badge). */
export async function outstandingFor(p: Payload, userId: number) {
  const { docs: cycles } = await p.find({ collection: 'report-cycles', where: { status: { equals: 'open' } }, limit: 50, ...q, select: { name: true } })
  if (!cycles.length) return 0
  return (await p.count({ collection: 'player-reports', where: { coach: { equals: userId }, cycle: { in: cycles.map((c) => c.id) }, status: { in: OUTSTANDING } }, overrideAccess: true })).totalDocs
}

/** Daily job: remind coaches with unfinished reports 14, 7, 3 and 1 days before the cycle's due date. */
export async function sendReportReminders(p: Payload, now = new Date()) {
  const result = { cycles: 0, sent: 0 }
  const { docs: cycles } = await p.find({ collection: 'report-cycles', where: { status: { equals: 'open' }, dueDate: { greater_than: now.toISOString() } }, limit: 20, ...q })
  for (const cycle of cycles) {
    result.cycles++
    const days = daysUntil(new Date(cycle.dueDate), now)
    const { docs } = await p.find({ collection: 'player-reports', where: { cycle: { equals: cycle.id }, status: { in: OUTSTANDING }, coach: { exists: true } }, limit: 10000, ...q, select: { coach: true } })
    const perCoach = new Map<number, number>()
    for (const r of docs) { const c = idOf(r.coach); if (c) perCoach.set(c, (perCoach.get(c) ?? 0) + 1) }
    for (const [coachId, outstanding] of perCoach) {
      const { docs: log } = await p.find({ collection: 'report-reminder-log', where: { cycle: { equals: cycle.id }, coach: { equals: coachId } }, limit: 10, ...q })
      const kind = dueReminder(days, new Set(log.map((l) => l.kind)))
      if (!kind) continue
      try {
        await p.create({ collection: 'report-reminder-log', overrideAccess: true, data: { cycle: cycle.id, coach: coachId, kind, outstanding } })
      } catch {
        continue // already claimed by another run
      }
      const user = await p.findByID({ collection: 'users', id: coachId, ...q, disableErrors: true })
      if (!user?.email) continue
      await sendEmail(p, { to: user.email, subject: reminderSubject(cycle, kind, outstanding), html: reminderHtml(user, cycle, outstanding, kind), sender: 'academy', userId: user.id })
      result.sent++
    }
  }
  return result
}

const plural = (n: number) => `${n} report${n === 1 ? '' : 's'}`
function reminderSubject(cycle: ReportCycle, kind: string, n: number) {
  const label = REMINDER_KINDS.find((r) => r.kind === kind)!.label
  return kind === '1d' ? `Tomorrow: ${plural(n)} due for ${cycle.name}` : `Reminder: ${plural(n)} due in ${label} (${cycle.name})`
}
function reminderHtml(user: User, cycle: ReportCycle, n: number, kind: string) {
  return emailLayout('academy', [
    {
      heading: kind === '1d' ? 'Player reports due tomorrow' : `${cycle.name} reports`,
      intro: `Hi ${user.firstName || 'coach'} — you have ${plural(n)} still to finish for ${cycle.name}. Your drafts are saved as you type, so you can do a few at a time.`,
      rows: [['Due', formatDate(cycle.dueDate, { weekday: 'long', day: 'numeric', month: 'long' })], ['To finish', String(n)]],
      cta: { label: 'Open my reports', href: `${siteUrl()}/coach/reports` },
      after: 'You’ll stop getting these once every report is submitted.',
    },
  ])
}
