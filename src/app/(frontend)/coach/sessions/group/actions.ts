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
