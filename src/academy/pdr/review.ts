import type { Payload } from 'payload'
import type { Participant, PdrStage, PdrSubmission, User } from '@/payload-types'
import { sendEmail } from '../../lib/email'
import { emailLayout, esc } from '../../lib/email-templates'
import { siteUrl } from '../../lib/payments'
import { sendSms } from '../../lib/sms'
import { criteriaSummary } from './content'
import { foundationSettings, loadReport } from './load'
import { stageSlug } from './report'
import { canSubmit, isBetter, meetsTarget, monthStart, type SubmissionType } from './rules'
import { createUpload, deleteVideo, streamConfigured } from './stream'

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number))
const MONTH = 30 * 86_400_000

export class FoundationError extends Error {}

async function settings(p: Payload) {
  return p.findGlobal({ slug: 'pdr-settings', depth: 0, overrideAccess: true })
}

/** Where this stage stands for the player (status from the report, plus the stage itself). */
export async function stageContext(p: Payload, kid: Participant, stageId: number) {
  const { report, tier } = await loadReport(p, kid)
  for (const a of report) for (const l of a.levels) for (const row of l.stages) if (row.stage.id === stageId) {
    const stage = await p.findByID({ collection: 'pdr-stages', id: stageId, depth: 0, overrideAccess: true })
    return { row, level: l, area: a.area, tier, stage }
  }
  throw new FoundationError('Stage not found.')
}

const stageUrl = (kid: Pick<Participant, 'id'>, areaSlug: string, s: Pick<PdrStage, 'levelNumber' | 'stageNumber'>) =>
  `${siteUrl()}/foundation-plus/${kid.id}/${areaSlug}/${stageSlug({ levelNumber: s.levelNumber ?? 0, stageNumber: s.stageNumber })}`

/** Step 1: check the player may send this video, then get a one-time upload link. */
export async function startSubmission(p: Payload, o: { kid: Participant; user: User; stageId: number; type: SubmissionType; claimedScore: number | null; note: string }) {
  if (!streamConfigured()) throw new FoundationError('Video uploads aren’t switched on yet — please try again soon.')
  const ctx = await stageContext(p, o.kid, o.stageId)
  const s = await settings(p)
  const [{ totalDocs: pending }, { totalDocs: feedback }] = await Promise.all([
    p.count({ collection: 'pdr-submissions', where: { player: { equals: o.kid.id }, stage: { equals: o.stageId }, or: [{ status: { equals: 'pending' } }, { and: [{ status: { equals: 'uploading' } }, { createdAt: { greater_than: new Date(Date.now() - 3_600_000).toISOString() } }] }] }, overrideAccess: true }),
    p.count({ collection: 'pdr-submissions', where: { player: { equals: o.kid.id }, type: { equals: 'feedback' }, status: { not_equals: 'uploading' }, createdAt: { greater_than_equal: new Date(`${monthStart(new Date())}T00:00:00+10:00`).toISOString() } }, overrideAccess: true }),
  ])
  const check = canSubmit({ type: o.type, status: ctx.row.status, tier: ctx.tier, pendingOnStage: pending, feedbackThisMonth: feedback, feedbackPerMonth: s.feedbackPerMonth ?? 2 })
  if (!check.ok) throw new FoundationError(check.reason)
  if (o.type === 'verification' && ctx.stage.scoring === 'scored' && (o.claimedScore == null || o.claimedScore < 0)) throw new FoundationError(`Enter your score (${ctx.stage.criteria?.unit ?? 'score'}).`)
  const upload = await createUpload({ maxDurationSeconds: s.maxClipSeconds ?? 90, name: `${o.kid.firstName} ${o.kid.lastName} — ${ctx.stage.code}` })
  const sub = await p.create({
    collection: 'pdr-submissions',
    overrideAccess: true,
    data: {
      label: `${o.kid.firstName} ${o.kid.lastName} — ${ctx.stage.code}`,
      player: o.kid.id,
      stage: o.stageId,
      area: rel(ctx.stage.area),
      levelNumber: ctx.stage.levelNumber,
      type: o.type,
      status: 'uploading',
      claimedScore: o.type === 'verification' ? o.claimedScore : null,
      playerNote: o.note || undefined,
      streamUid: upload.uid,
      submittedBy: o.user.id,
    },
  })
  return { id: sub.id, uploadURL: upload.uploadURL, maxMB: s.maxFileMB ?? 200, maxSeconds: s.maxClipSeconds ?? 90 }
}

/** Step 2: the browser finished uploading — the video joins the coaches' queue. */
export async function finishSubmission(p: Payload, kid: Participant, id: number) {
  const sub = await p.findByID({ collection: 'pdr-submissions', id, depth: 0, overrideAccess: true, disableErrors: true })
  if (!sub || rel(sub.player) !== kid.id) throw new FoundationError('Submission not found.')
  if (sub.status !== 'uploading') return sub
  return p.update({ collection: 'pdr-submissions', id, overrideAccess: true, data: { status: 'pending' } })
}

async function audit(p: Payload, data: { action: 'verify' | 'reject' | 'feedback' | 'score_change' | 'promote' | 'revoke'; actor: number; player: number; stage: number; submission?: number; before?: string; after?: string; note?: string; summary: string }) {
  await p.create({ collection: 'pdr-audit', overrideAccess: true, data })
}

export async function tellFamily(p: Payload, kid: Participant, o: { subject: string; heading: string; intro: string; rows: [string, string][]; href: string; sms: string }) {
  const accountId = rel(kid.account)
  const parent = accountId ? ((await p.findByID({ collection: 'users', id: accountId, depth: 0, overrideAccess: true, disableErrors: true })) as User | null) : null
  if (!parent) return
  const html = emailLayout('academy', [{ heading: o.heading, intro: o.intro, rows: o.rows, cta: { label: 'Open the Foundation+ player page', href: o.href } }])
  await sendEmail(p, { to: parent.email, subject: o.subject, html, sender: 'academy', userId: parent.id })
  await sendSms(p, { to: parent.phone, kind: 'service', optedOut: parent.smsOptOut, userId: parent.id, body: `${o.sms} ${o.href} – Foundation Academy` })
}

export type Decision = 'verify' | 'reject' | 'feedback'

/** A coach checks a video. Verified attempts pass the stage (first time) or record a better score. */
export async function reviewSubmission(p: Payload, coach: User, id: number, o: { decision: Decision; score: number | null; feedback: string }) {
  const sub = await p.findByID({ collection: 'pdr-submissions', id, depth: 0, overrideAccess: true })
  if (sub.status !== 'pending') throw new FoundationError('This video has already been reviewed.')
  if (sub.type === 'challenge') {
    if (o.decision === 'feedback') throw new FoundationError('This is a challenge entry — count the score or ask for another go.')
    const s = await settings(p)
    const now = new Date()
    const reviewed = { reviewedBy: coach.id, reviewedAt: now.toISOString(), deleteVideoAfter: new Date(now.getTime() + (s.retentionMonths ?? 6) * MONTH).toISOString(), feedback: o.feedback || undefined }
    const { reviewChallengeEntry } = await import('./challenges')
    return reviewChallengeEntry(p, coach, sub, { decision: o.decision, score: o.score, feedback: o.feedback }, reviewed)
  }
  const [stage, kid, s, fs] = await Promise.all([
    p.findByID({ collection: 'pdr-stages', id: rel(sub.stage), depth: 1, overrideAccess: true }),
    p.findByID({ collection: 'participants', id: rel(sub.player), depth: 0, overrideAccess: true }) as Promise<Participant>,
    settings(p),
    foundationSettings(p),
  ])
  const area = stage.area as { slug: string; name: string }
  const href = stageUrl(kid, area.slug, stage)
  const now = new Date()
  const reviewed = { reviewedBy: coach.id, reviewedAt: now.toISOString(), deleteVideoAfter: new Date(now.getTime() + (s.retentionMonths ?? 6) * MONTH).toISOString(), feedback: o.feedback || undefined }
  const base = { actor: coach.id, player: kid.id, stage: stage.id, submission: sub.id }

  if (o.decision === 'feedback' || sub.type === 'feedback') {
    if (sub.type !== 'feedback') throw new FoundationError('This is a challenge attempt — verify it or ask for another attempt.')
    if (!o.feedback.trim()) throw new FoundationError('Write your feedback.')
    await p.update({ collection: 'pdr-submissions', id, overrideAccess: true, data: { ...reviewed, status: 'feedback_given' } })
    await audit(p, { ...base, action: 'feedback', summary: `Feedback on ${kid.firstName} ${kid.lastName} — ${stage.code}`, note: o.feedback })
    await tellFamily(p, kid, { subject: `Coach feedback for ${kid.firstName} — ${stage.code}`, heading: 'Coach feedback', intro: `A coach watched ${esc(kid.firstName)}’s ${esc(stage.code ?? "")} video:<br><br><em>${esc(o.feedback)}</em>`, rows: [], href, sms: `${fs.name}: a coach left feedback on ${kid.firstName}’s ${stage.code} video.` })
    return { status: 'feedback_given' as const }
  }

  if (o.decision === 'reject') {
    if (!o.feedback.trim()) throw new FoundationError('Tell the player what to work on.')
    await p.update({ collection: 'pdr-submissions', id, overrideAccess: true, data: { ...reviewed, status: 'rejected' } })
    await audit(p, { ...base, action: 'reject', summary: `Another attempt needed — ${kid.firstName} ${kid.lastName}, ${stage.code}`, before: sub.claimedScore != null ? String(sub.claimedScore) : undefined, note: o.feedback })
    await tellFamily(p, kid, {
      subject: `${kid.firstName}’s ${stage.code} video — another attempt needed`,
      heading: 'Nearly there',
      intro: `A coach watched ${esc(kid.firstName)}’s ${esc(stage.code ?? "")} attempt and it needs another go:<br><br><em>${esc(o.feedback)}</em><br><br>Send another video whenever you’re ready.`,
      rows: [],
      href,
      sms: `${fs.name}: ${kid.firstName}’s ${stage.code} attempt needs another go — see the coach’s tips:`,
    })
    return { status: 'rejected' as const }
  }

  // Verify
  const scored = stage.scoring === 'scored'
  const score = scored ? (o.score ?? sub.claimedScore ?? null) : null
  if (scored && score == null) throw new FoundationError('Enter the score you counted.')
  const { docs } = await p.find({ pagination: false, collection: 'pdr-progress', where: { player: { equals: kid.id }, stage: { equals: stage.id } }, limit: 1, depth: 0, overrideAccess: true })
  const existing = docs[0]
  if (!existing && scored && !meetsTarget(score, stage.criteria)) {
    throw new FoundationError(`That’s below the target (${criteriaSummary(stage.criteria)}) — choose “Needs another attempt” instead.`)
  }
  let passedNow = false
  let improved = false
  if (!existing) {
    await p.create({ collection: 'pdr-progress', overrideAccess: true, data: { player: kid.id, stage: stage.id, method: 'verified', score, by: coach.id, passedAt: now.toISOString() } })
    passedNow = true
  } else if (existing.method === 'promoted' || (score != null && isBetter(score, existing.score, stage.criteria?.direction))) {
    await p.update({ collection: 'pdr-progress', id: existing.id, overrideAccess: true, data: { method: 'verified', ...(score != null && isBetter(score, existing.score, stage.criteria?.direction) ? { score } : {}), by: coach.id } })
    improved = score != null && isBetter(score, existing.score, stage.criteria?.direction)
    if (improved) await audit(p, { ...base, action: 'score_change', summary: `New best — ${kid.firstName} ${kid.lastName}, ${stage.code}`, before: existing.score != null ? String(existing.score) : '—', after: String(score) })
  }
  await p.update({ collection: 'pdr-submissions', id, overrideAccess: true, data: { ...reviewed, status: 'verified', verifiedScore: score, passed: passedNow || Boolean(existing) } })
  await audit(p, { ...base, action: 'verify', summary: `Verified — ${kid.firstName} ${kid.lastName}, ${stage.code}${score != null ? ` (${score})` : ''}`, before: sub.claimedScore != null ? String(sub.claimedScore) : undefined, after: score != null ? String(score) : undefined, note: o.feedback || undefined })
  const unit = stage.criteria?.unit ?? ''
  const headline = passedNow ? 'Stage passed!' : improved ? 'New best score!' : 'Attempt checked'
  await tellFamily(p, kid, {
    subject: `${kid.firstName}: ${stage.code} — ${headline}`,
    heading: headline,
    intro: `A coach checked ${esc(kid.firstName)}’s ${esc(stage.code ?? "")} video${score != null ? ` — <strong>${esc(String(score))} ${esc(unit)}</strong>` : ''}.${passedNow ? ' The stage is passed — well done!' : improved ? ' That’s a new personal best.' : ' Their best score stays the same this time.'}${o.feedback ? `<br><br><em>${esc(o.feedback)}</em>` : ''}`,
    rows: [],
    href,
    sms: `${fs.name}: ${kid.firstName}’s ${stage.code} video was checked — ${headline}`,
  })
  return { status: 'verified' as const, passedNow, improved }
}

/** A coach saw the stage done in person (e.g. at training) and marks it passed. */
export async function promoteStage(p: Payload, coach: User, kid: Participant, stageId: number, o: { score: number | null; date: string | null; note: string }) {
  const stage = await p.findByID({ collection: 'pdr-stages', id: stageId, depth: 1, overrideAccess: true })
  if (!stage.published || stage.placeholder) throw new FoundationError('This stage isn’t published yet.')
  const { totalDocs } = await p.count({ collection: 'pdr-progress', where: { player: { equals: kid.id }, stage: { equals: stageId } }, overrideAccess: true })
  if (totalDocs) throw new FoundationError('Already passed.')
  const passedAt = o.date ? new Date(`${o.date}T12:00:00+10:00`).toISOString() : new Date().toISOString()
  if (new Date(passedAt) > new Date(Date.now() + 86_400_000)) throw new FoundationError('The date can’t be in the future.')
  await p.create({ collection: 'pdr-progress', overrideAccess: true, data: { player: kid.id, stage: stageId, method: 'promoted', promotedScore: o.score, passedAt, by: coach.id, note: o.note || undefined } })
  await audit(p, { action: 'promote', actor: coach.id, player: kid.id, stage: stageId, summary: `Promoted — ${kid.firstName} ${kid.lastName}, ${stage.code}`, after: o.score != null ? String(o.score) : undefined, note: o.note || undefined })
  const fs = await foundationSettings(p)
  const area = stage.area as { slug: string }
  await tellFamily(p, kid, {
    subject: `${kid.firstName}: ${stage.code} — stage passed!`,
    heading: 'Stage passed!',
    intro: `${esc(coach.firstName ?? 'A coach')} saw ${esc(kid.firstName)} complete <strong>${esc(stage.code ?? "")} — ${esc(stage.skillName)}</strong>${o.score != null ? ` (${esc(String(o.score))} ${esc(stage.criteria?.unit ?? '')})` : ''} and marked it as passed.`,
    rows: [],
    href: stageUrl(kid, area.slug, stage),
    sms: `${fs.name}: ${kid.firstName} passed ${stage.code}!`,
  })
}

/** Daily: delete videos past the retention date, and abandoned uploads. */
export async function purgeSubmissionVideos(p: Payload, now = new Date()) {
  const out = { deleted: 0, abandoned: 0, failed: 0 }
  if (!streamConfigured()) return out
  const { docs } = await p.find({ pagination: false, collection: 'pdr-submissions', where: { streamUid: { exists: true }, videoDeletedAt: { exists: false }, deleteVideoAfter: { less_than: now.toISOString() } }, limit: 500, depth: 0, overrideAccess: true })
  for (const d of docs) {
    try {
      await deleteVideo(d.streamUid!)
      await p.update({ collection: 'pdr-submissions', id: d.id, overrideAccess: true, data: { videoDeletedAt: now.toISOString() } })
      out.deleted++
    } catch (e) {
      out.failed++
      p.logger.error({ err: e, msg: `Deleting video for submission ${d.id} failed` })
    }
  }
  const { docs: stale } = await p.find({ pagination: false, collection: 'pdr-submissions', where: { status: { equals: 'uploading' }, createdAt: { less_than: new Date(now.getTime() - 86_400_000).toISOString() } }, limit: 500, depth: 0, overrideAccess: true })
  for (const d of stale) {
    try {
      if (d.streamUid) await deleteVideo(d.streamUid).catch(() => undefined)
      await p.delete({ collection: 'pdr-submissions', id: d.id, overrideAccess: true })
      out.abandoned++
    } catch {
      out.failed++
    }
  }
  return out
}

export type { PdrSubmission }
