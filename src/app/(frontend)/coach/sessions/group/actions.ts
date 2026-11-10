'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { coachOrNull } from '@/academy/portal'
import type { Where } from 'payload'
import { payload } from '@/lib/payload'
import { createGroup, GroupError } from '@/academy/groups'
import { cleanPlayer, playerProblem, rosterProblem, type RosterPlayer } from '@/academy/group-rules'

export type FoundPlayer = { id: number; name: string; parent: string; birthYear: number | null; canInvite: boolean; mobile: boolean }

/** Search all players by name (coaches can already find any player on the Players page). */
export async function searchGroupPlayers(term: string): Promise<FoundPlayer[]> {
  const c = await coachOrNull()
  if (!c) return []
  const q = term.trim().slice(0, 60)
  if (q.length < 2) return []
  const words = q.split(/\s+/).slice(0, 3)
  const p = await payload()
  const { docs } = await p.find({
    collection: 'participants',
    where: { and: words.map((w): Where => ({ or: [{ firstName: { like: w } }, { lastName: { like: w } }] })) },
    sort: 'firstName',
    limit: 8,
    depth: 1,
    overrideAccess: true,
  })
  return docs.map((k) => {
    const parent = k.account && typeof k.account === 'object' ? k.account : null
    return {
      id: k.id,
      name: `${k.firstName ?? ''} ${k.lastName ?? ''}`.trim(),
      parent: parent ? `${parent.firstName ?? ''} ${parent.lastName ?? ''}`.trim() : '',
      birthYear: k.dateOfBirth ? new Date(k.dateOfBirth).getFullYear() : null,
      canInvite: Boolean(parent?.email),
      mobile: Boolean(parent?.phone),
    }
  })
}

export type GroupFormState = { error?: string }

export async function createGroupAction(_prev: GroupFormState, fd: FormData): Promise<GroupFormState> {
  const c = await coachOrNull()
  if (!c) return { error: 'Please log in as a coach.' }
  const slot = String(fd.get('slot') ?? '')
  const type = slot.startsWith('term|') ? 'term' : 'casual'
  const [, a, b] = slot.split('|')
  if (!slot || !a) return { error: 'Choose a time.' }
  let raw: unknown[] = []
  try { raw = JSON.parse(String(fd.get('players') ?? '[]')) } catch { return { error: 'Add the players again.' } }
  if (!Array.isArray(raw)) return { error: 'Add the players again.' }
  const players = raw.slice(0, 6).map(cleanPlayer)
  const problem = rosterProblem(players)
  if (problem) return { error: problem }
  let groupId: number
  try {
    const r = await createGroup(await payload(), {
      coach: c.coach,
      user: c.user,
      type,
      ...(type === 'term' ? { weekday: a, startTime: b } : { startsAt: a }),
      players: players as RosterPlayer[],
      message: String(fd.get('message') ?? '').trim().slice(0, 500) || undefined,
    })
    groupId = r.group.id
  } catch (e) {
    if (e instanceof GroupError) return { error: e.message }
    throw e
  }
  revalidatePath('/coach/sessions')
  redirect(`/coach/sessions/group/${groupId}?sent=1`)
}

export type GroupDecisionState = { error?: string; done?: string }

/** The coach's choices for a group: resend a link, replace a place, go ahead smaller, or cancel. */
export async function groupDecisionAction(_prev: GroupDecisionState, fd: FormData): Promise<GroupDecisionState> {
  const c = await coachOrNull()
  if (!c) return { error: 'Please log in as a coach.' }
  const p = await payload()
  const groupId = Number(fd.get('group'))
  const inviteId = Number(fd.get('invite'))
  const { cancelWholeGroup, goAheadSmaller, offerOneOnOne, replaceGroupPlace, resendGroupInvite } = await import('@/academy/group-decisions')
  let done: string
  try {
    switch (String(fd.get('do'))) {
      case 'resend': {
        const r = await resendGroupInvite(p, c.coach.id, inviteId, c.user.id)
        done = `Sent again${r.sentSms ? ' by email and text' : ' by email'} with a new link — the old one no longer works.`
        break
      }
      case 'replace': {
        let raw: unknown
        try { raw = JSON.parse(String(fd.get('player') ?? 'null')) } catch { return { error: 'Choose the new player again.' } }
        const player = cleanPlayer(raw)
        const problem = playerProblem(player)
        if (problem || !player) return { error: problem ?? 'Choose the new player.' }
        await replaceGroupPlace(p, c.coach.id, inviteId, player, c.user.id)
        done = 'Invited — they have their own link by email (and text if there’s a mobile).'
        break
      }
      case 'smaller': {
        const r = await goAheadSmaller(p, c.coach.id, groupId, c.user.id)
        done = `Going ahead with ${r.players} players — they keep their price.`
        break
      }
      case 'one-on-one': {
        const r = await offerOneOnOne(p, c.coach, c.user, groupId)
        done = `Group cancelled and ${r.player}’s family refunded. They’ve been sent a link to book the same time as a 1-on-1${r.held ? ' — it’s held for them' : ''}.${r.problems.length ? ` Some refunds need Management: ${r.problems.join('; ')}` : ''}`
        break
      }
      case 'term-offer': {
        const { proposeTermOffer } = await import('@/academy/group-term-offer')
        await proposeTermOffer(p, groupId, { coachId: c.coach.id, by: c.user.id })
        done = 'Offered — each family has been asked to say yes or no. The weeks are held for you until they answer.'
        break
      }
      case 'add': {
        let raw: unknown
        try { raw = JSON.parse(String(fd.get('player') ?? 'null')) } catch { return { error: 'Choose the new player again.' } }
        const player = cleanPlayer(raw)
        const problem = playerProblem(player)
        if (problem || !player) return { error: problem ?? 'Choose the new player.' }
        const { addGroupPlayer } = await import('@/academy/group-admin')
        await addGroupPlayer(p, c.coach, groupId, player, c.user.id)
        done = 'Added — they have their own link to pay for the sessions left.'
        break
      }
      case 'need-cover': {
        const { coachNeedsGroupCover } = await import('@/academy/group-admin')
        await coachNeedsGroupCover(p, c.coach, groupId, String(fd.get('at') ?? ''), String(fd.get('note') ?? '').trim().slice(0, 1000))
        done = 'Cover requested — the Academy has been told and will arrange a coach.'
        break
      }
      case 'cancel': {
        if (fd.get('confirm') !== 'on') return { error: 'Tick the box to confirm cancelling the whole group.' }
        const r = await cancelWholeGroup(p, c.coach.id, groupId, c.user.id, String(fd.get('reason') ?? '').trim().slice(0, 500))
        done = r.problems.length ? `Group cancelled, but some refunds need Management: ${r.problems.join('; ')}` : 'Group cancelled — everyone who paid is being refunded, and every family has been told.'
        break
      }
      default:
        return { error: 'Unknown action.' }
    }
  } catch (e) {
    if (e instanceof GroupError) return { error: e.message }
    throw e
  }
  revalidatePath(`/coach/sessions/group/${groupId}`)
  revalidatePath('/coach/sessions')
  return { done }
}

/** "Running late" for a small group: tell every family, each in their own conversation. */
export async function groupRunningLate(_prev: GroupDecisionState, fd: FormData): Promise<GroupDecisionState> {
  const c = await coachOrNull()
  if (!c) return { error: 'Please log in as a coach.' }
  const p = await payload()
  const { loadGroupSession } = await import('@/academy/coach-sessions')
  const data = await loadGroupSession(p, c.coach.id, Number(fd.get('group')), String(fd.get('at') ?? ''))
  if (!data) return { error: 'Session not found.' }
  const mins = [5, 10, 15, 20].includes(Number(fd.get('minutes'))) ? Number(fd.get('minutes')) : 10
  if (new Date(String(fd.get('at'))).getTime() < Date.now() - 60 * 60_000) return { error: 'This session has already finished.' }
  const { conversationFor, staffReply } = await import('@/messaging/service')
  let told = 0
  const missed: string[] = []
  for (const { booking: b } of data.rows) {
    const accountId = typeof b.account === 'object' ? b.account?.id : b.account
    if (!accountId) { missed.push(b.player.firstName); continue }
    const account = await p.findByID({ collection: 'users', id: accountId, depth: 0, overrideAccess: true })
    const conv = await conversationFor(p, { account })
    const r = await staffReply(p, { user: c.user, side: 'coach', coach: c.coach }, conv.id, `Hi ${b.contact.firstName}, I’m running about ${mins} minutes late for ${b.player.firstName}’s small group session — sorry! See you soon.`)
    if (r.delivery === 'failed') missed.push(b.player.firstName)
    else told++
  }
  return missed.length ? { error: `Told ${told} famil${told === 1 ? 'y' : 'ies'}; couldn’t reach ${missed.join(', ')} — please call them.` } : { done: `All ${told} families told you’re ${mins} minutes late.` }
}
