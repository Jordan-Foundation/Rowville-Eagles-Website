'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { entryForFamily } from '@/selections/prefs'
import { prefsEditable } from '@/selections/flow'
import type { Squad } from '@/payload-types'

const NIGHTS = ['mon_wed', 'tue_thu', 'none'] as const
const DAYS = ['sat', 'sun', 'none'] as const

/** Save the family's training nights / game day preferences (until the team is finalised). */
export async function savePrefsAction(fd: FormData) {
  const ref = String(fd.get('ref') ?? '')
  const path = `/account/selections/${encodeURIComponent(ref)}/preferences`
  const user = await currentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`)
  const p = await payload()
  const e = await entryForFamily(p, ref, user.id)
  if (!e) redirect('/account')
  if (!prefsEditable(e.squad && typeof e.squad === 'object' ? (e.squad as Squad) : null)) redirect(`${path}?error=${encodeURIComponent('Teams are finalised, so preferences can’t be changed now. Please contact the club.')}`)
  const nights = String(fd.get('trainingNights') ?? '') as (typeof NIGHTS)[number]
  const day = String(fd.get('gameDay') ?? '') as (typeof DAYS)[number]
  if (!NIGHTS.includes(nights) || !DAYS.includes(day)) redirect(`${path}?error=${encodeURIComponent('Please answer both questions.')}`)
  await p.update({ collection: 'selection-entries', id: e.id, overrideAccess: true, context: { skipOffer: true }, data: { prefs: { trainingNights: nights, gameDay: day, answeredAt: new Date().toISOString() } } })
  revalidatePath('/account')
  redirect(`${path}?saved=1`)
}
