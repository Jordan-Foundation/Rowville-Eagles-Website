'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { StaffingError, inviteCampCoach, markDeclineSeen, removeCampCoach } from '@/camps/staffing'
import { payload } from '@/lib/payload'
import { managementOrNull } from '@/lib/management'
import { moveCampKid, resetCampGroups, unlockCampKid } from '@/camps/groups'

export type CampActionState = { error?: string; done?: string }

/** Move a child to another group (drag and drop, or the "Move to" menu). They stay there from now on. */
export async function moveKidAction(campId: number, placementId: number, group: number): Promise<CampActionState> {
  const user = await managementOrNull()
  if (!user) return { error: 'Management only.' }
  const p = await payload()
  const x = await p.findByID({ collection: 'camp-placements', id: placementId, depth: 0, overrideAccess: true, disableErrors: true })
  if (!x || (typeof x.program === 'object' ? x.program.id : x.program) !== campId) return { error: 'That child isn’t at this camp any more — refresh the page.' }
  try {
    await moveCampKid(p, { placementId, group, actorId: user.id })
  } catch (e) {
    return { error: (e as Error).message }
  }
  revalidatePath(`/management/camps/${campId}`)
  return { done: `${x.name} moved to group ${group} — they’ll stay there.` }
}

export async function unlockKidAction(campId: number, placementId: number): Promise<CampActionState> {
  if (!(await managementOrNull())) return { error: 'Management only.' }
  await unlockCampKid(await payload(), placementId)
  revalidatePath(`/management/camps/${campId}`)
  return { done: 'Unlocked — the automatic grouping can place this child again.' }
}

export async function resetGroupsAction(campId: number): Promise<CampActionState> {
  if (!(await managementOrNull())) return { error: 'Management only.' }
  const r = await resetCampGroups(await payload(), campId)
  revalidatePath(`/management/camps/${campId}`)
  return { done: `Groups worked out again for ${r.children} children.` }
}

const back = (campId: number, msg: string, key: 'done' | 'error' = 'done') => redirect(`/management/camps/${campId}?${key}=${encodeURIComponent(msg)}#coaches`)

/** Ask a coach to work this camp (email + text with confirm/decline). */
export async function inviteCoachAction(fd: FormData) {
  const campId = Number(fd.get('camp'))
  const user = await managementOrNull()
  if (!user) return back(campId, 'Management only.', 'error')
  const coachId = Number(fd.get('coach'))
  if (!coachId) return back(campId, 'Choose a coach.', 'error')
  let msg: string
  try {
    await inviteCampCoach(await payload(), { programId: campId, coachId, actorId: user.id })
    msg = 'Asked — they’ve been emailed and texted a link to confirm or decline.'
  } catch (e) {
    return back(campId, e instanceof StaffingError ? e.message : 'Couldn’t ask that coach — please try again.', 'error')
  }
  revalidatePath(`/management/camps/${campId}`)
  back(campId, msg)
}

export async function removeCoachAction(fd: FormData) {
  const campId = Number(fd.get('camp'))
  if (!(await managementOrNull())) return back(campId, 'Management only.', 'error')
  await removeCampCoach(await payload(), Number(fd.get('campCoach')))
  revalidatePath(`/management/camps/${campId}`)
  back(campId, 'Removed — their camp days are free again and they’ve been told.')
}

export async function declineSeenAction(fd: FormData) {
  const campId = Number(fd.get('camp'))
  if (!(await managementOrNull())) return back(campId, 'Management only.', 'error')
  await markDeclineSeen(await payload(), Number(fd.get('campCoach')))
  revalidatePath(`/management/camps/${campId}`)
  back(campId, 'Noted.')
}
