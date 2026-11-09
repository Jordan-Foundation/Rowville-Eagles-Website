'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { coachOrNull } from '@/academy/portal'
import type { Where } from 'payload'
import { payload } from '@/lib/payload'
import { createGroup, GroupError } from '@/academy/groups'
import { cleanPlayer, rosterProblem, type RosterPlayer } from '@/academy/group-rules'

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
