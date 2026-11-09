'use server'

import { revalidatePath } from 'next/cache'
import { managementOrNull } from '@/lib/management'
import { payload } from '@/lib/payload'
import { teamCategories } from '@/collections/Teams'

export type TeamEditState = { saved?: string; error?: string }

const s = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? '').trim().slice(0, max)

/** Team details editable from Management (only these fields). */
export async function saveTeam(_prev: TeamEditState, fd: FormData): Promise<TeamEditState> {
  const user = await managementOrNull()
  if (!user) return { error: 'Management only — please log in again.' }
  const p = await payload()
  const team = await p.findByID({ collection: 'teams', id: Number(fd.get('id')), depth: 0, overrideAccess: true, disableErrors: true })
  if (!team) return { error: 'Team not found.' }
  const name = s(fd, 'name', 100)
  if (name.length < 2) return { error: 'Please give the team a name.' }
  const category = s(fd, 'category')
  const coachIds = fd.getAll('coaches').map(Number).filter(Number.isInteger)
  const { docs: allowed } = coachIds.length ? await p.find({ pagination: false, collection: 'users', where: { id: { in: coachIds }, roles: { in: ['coach', 'admin', 'committee'] } }, limit: 50, depth: 0, overrideAccess: true }) : { docs: [] }
  const url = s(fd, 'driblUrl', 300)
  if (url && !/^https:\/\//.test(url)) return { error: 'The fixtures link must start with https://' }
  await p.update({
    collection: 'teams',
    id: team.id,
    overrideAccess: true,
    user,
    data: {
      name,
      ageGroup: s(fd, 'ageGroup', 40) || null,
      competition: s(fd, 'competition', 120) || null,
      trainingTimes: s(fd, 'trainingTimes', 120) || null,
      driblUrl: url || null,
      ...(team.type !== 'tournament' && teamCategories.some((c) => c.value === category) ? { category: category as never } : {}),
      coaches: allowed.map((u) => u.id),
      sections: { info: fd.get('sec-info') === 'on', notices: fd.get('sec-notices') === 'on', fixtures: fd.get('sec-fixtures') === 'on', training: fd.get('sec-training') === 'on', forum: fd.get('sec-forum') === 'on' },
    },
  })
  revalidatePath('/management/teams')
  revalidatePath(`/teams/${team.slug}`)
  return { saved: 'Team saved.' }
}
