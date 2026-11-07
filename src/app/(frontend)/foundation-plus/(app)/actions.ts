'use server'

import { revalidatePath } from 'next/cache'
import { currentUser } from '@/lib/auth'
import { payload } from '@/lib/payload'
import { foundationSettings, isStaffOrCoach } from '@/academy/pdr/load'
import { finishSubmission, FoundationError, promoteStage, startSubmission } from '@/academy/pdr/review'
import type { Participant } from '@/payload-types'

/** The player, if this visitor is their parent (or staff/coach, who can act for them). */
async function player(id: number) {
  const user = await currentUser()
  if (!user) return null
  const p = await payload()
  const kid = (await p.findByID({ collection: 'participants', id, depth: 0, overrideAccess: true, disableErrors: true })) as Participant | null
  if (!kid) return null
  const owner = (typeof kid.account === 'object' ? kid.account?.id : kid.account) === user.id
  if (!owner && !isStaffOrCoach(user)) return null
  const s = await foundationSettings(p)
  if (!s.enabled && !isStaffOrCoach(user)) return null
  return { p, user, kid }
}

export type StartResult = { error?: string; id?: number; uploadURL?: string; maxMB?: number; maxSeconds?: number }

export async function startUploadAction(fd: FormData): Promise<StartResult> {
  const ctx = await player(Number(fd.get('player')))
  if (!ctx) return { error: 'Please log in again.' }
  const raw = String(fd.get('score') ?? '').trim()
  const score = raw === '' ? null : Number(raw)
  if (score !== null && (!Number.isFinite(score) || score < 0 || score > 100000)) return { error: 'Enter your score as a number.' }
  try {
    return await startSubmission(ctx.p, {
      kid: ctx.kid,
      user: ctx.user,
      stageId: Number(fd.get('stage')),
      type: fd.get('type') === 'feedback' ? 'feedback' : 'verification',
      claimedScore: score,
      note: String(fd.get('note') ?? '').slice(0, 500),
    })
  } catch (e) {
    if (e instanceof FoundationError) return { error: e.message }
    ctx.p.logger.error({ err: e, msg: 'Starting a Foundation+ upload failed' })
    return { error: 'We couldn’t start the upload. Please try again.' }
  }
}

export async function finishUploadAction(playerId: number, id: number, path: string) {
  const ctx = await player(playerId)
  if (!ctx) return { error: 'Please log in again.' }
  await finishSubmission(ctx.p, ctx.kid, id)
  revalidatePath(path)
  return { done: true }
}

export type PromoteState = { error?: string; done?: string }

export async function promoteAction(_prev: PromoteState, fd: FormData): Promise<PromoteState> {
  const user = await currentUser()
  if (!user || !isStaffOrCoach(user)) return { error: 'Only coaches can mark stages as passed.' }
  const p = await payload()
  const kid = (await p.findByID({ collection: 'participants', id: Number(fd.get('player')), depth: 0, overrideAccess: true, disableErrors: true })) as Participant | null
  if (!kid) return { error: 'Player not found.' }
  const raw = String(fd.get('score') ?? '').trim()
  try {
    await promoteStage(p, user, kid, Number(fd.get('stage')), { score: raw === '' ? null : Number(raw), date: String(fd.get('date') ?? '') || null, note: String(fd.get('note') ?? '').slice(0, 500) })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not mark as passed.' }
  }
  revalidatePath(String(fd.get('path') ?? '/foundation-plus'))
  return { done: 'Marked as passed — the family has been told.' }
}

/** The family has seen the celebration for these badges (only their own child; staff previews don't count). */
export async function celebratedAction(playerId: number, awardIds: number[]) {
  const user = await currentUser()
  if (!user) return
  const p = await payload()
  const kid = await p.findByID({ collection: 'participants', id: playerId, depth: 0, overrideAccess: true, disableErrors: true })
  if (!kid || (typeof kid.account === 'object' ? kid.account?.id : kid.account) !== user.id) return
  await p.update({ collection: 'pdr-awards', where: { id: { in: awardIds.slice(0, 50) }, player: { equals: playerId } }, overrideAccess: true, data: { celebratedAt: new Date().toISOString() } })
}

export type PrivacyState = { error?: string; done?: string }

/** Parents choose whether their child appears on leaderboards, and under what name. */
export async function privacyAction(_prev: PrivacyState, fd: FormData): Promise<PrivacyState> {
  const user = await currentUser()
  if (!user) return { error: 'Please log in again.' }
  const p = await payload()
  const kid = (await p.findByID({ collection: 'participants', id: Number(fd.get('player')), depth: 0, overrideAccess: true, disableErrors: true })) as Participant | null
  if (!kid || (typeof kid.account === 'object' ? kid.account?.id : kid.account) !== user.id) return { error: 'Only a parent can change this.' }
  const { validDisplayName } = await import('@/academy/pdr/leaderboard')
  const name = String(fd.get('name') ?? '').trim()
  if (name && !validDisplayName(name)) return { error: 'Use 2–20 letters (no numbers or contact details).' }
  await p.update({ collection: 'participants', id: kid.id, overrideAccess: true, data: { pdr: { ...kid.pdr, leaderboardOptOut: fd.get('show') !== 'on', leaderboardName: name || null } } })
  revalidatePath(`/foundation-plus/${kid.id}`)
  return { done: 'Saved.' }
}
