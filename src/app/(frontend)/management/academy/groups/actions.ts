'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { hasRole } from '@/access'
import { localToUtc } from '@/lib/time'
import { GroupError } from '@/academy/groups'
import { cancelGroupDate, moveGroupDate, setGroupCover } from '@/academy/group-admin'

export type GroupAdminState = { error?: string; done?: string }

async function staff() {
  const user = await currentUser()
  return user && hasRole(user, 'admin', 'committee') ? user : null
}

/** Management: cancel, move or arrange cover for one date of a small group — the whole group together. */
export async function groupDateAction(_prev: GroupAdminState, fd: FormData): Promise<GroupAdminState> {
  const user = await staff()
  if (!user) return { error: 'Management only.' }
  const p = await payload()
  const groupId = Number(fd.get('group'))
  const at = String(fd.get('at') ?? '')
  let done: string
  try {
    switch (String(fd.get('do'))) {
      case 'cancel': {
        const outcome = fd.get('outcome') === 'credit' ? 'credit' : 'refund'
        const r = await cancelGroupDate(p, { groupId, startsAt: at, outcome, reason: String(fd.get('reason') ?? '').trim(), actorId: user.id })
        done = `Cancelled for ${r.players} player${r.players === 1 ? '' : 's'} — ${outcome === 'refund' ? 'refunded to card' : 'small group credit given'}; families emailed.${r.problems.length ? ` Check: ${r.problems.join('; ')}` : ''}`
        break
      }
      case 'move': {
        const date = String(fd.get('date') ?? '')
        const time = String(fd.get('time') ?? '')
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: 'Choose the new date and time.' }
        await moveGroupDate(p, { groupId, from: at, to: localToUtc(date, time).toISOString(), actorId: user.id, notify: fd.get('notify') === 'on' })
        done = `Moved.${fd.get('notify') === 'on' ? ' Families and the coach have been emailed.' : ''}`
        break
      }
      case 'cover': {
        const coach = Number(fd.get('coverCoach')) || null
        const n = await setGroupCover(p, { groupId, startsAt: at, needsCover: fd.get('needsCover') === 'on' || Boolean(coach), coverCoach: coach, actorId: user.id })
        done = coach ? `Cover coach assigned for all ${n - 1} players.` : 'Cover updated.'
        break
      }
      default:
        return { error: 'Unknown action.' }
    }
  } catch (e) {
    if (e instanceof GroupError) return { error: e.message }
    throw e
  }
  revalidatePath(`/management/academy/groups/${groupId}`)
  // Back to the group with a banner (the date's row may have gone, taking its message with it)
  redirect(`/management/academy/groups/${groupId}?done=${encodeURIComponent(done)}`)
}
