'use server'

import { revalidatePath } from 'next/cache'
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
