'use server'

import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'

export type PlayerFormState = { error?: string; saved?: boolean }

const PHONE = /^(\+?61|0)[2-478]\d{8}$/

/** A parent updates their own player's details. Ownership is checked here, on the server. */
export async function savePlayer(_prev: PlayerFormState, fd: FormData): Promise<PlayerFormState> {
  const user = await currentUser()
  if (!user) return { error: 'Please log in again.' }
  const p = await payload()
  const id = Number(fd.get('id'))
  const kid = id ? await p.findByID({ collection: 'participants', id, depth: 0, overrideAccess: true, disableErrors: true }) : null
  if (!kid || (typeof kid.account === 'object' ? kid.account.id : kid.account) !== user.id) return { error: 'You can only edit players on your own account.' }

  const s = (k: string) => String(fd.get(k) ?? '').trim().slice(0, 2000)
  const emergencyPhone = s('emergencyPhone').replace(/\s+/g, '')
  if (!s('emergencyContact') || !emergencyPhone) return { error: 'Please keep an emergency contact name and phone number.' }
  if (!PHONE.test(emergencyPhone)) return { error: 'Please enter an Australian phone number for the emergency contact, e.g. 0412 345 678.' }

  await p.update({
    collection: 'participants',
    id: kid.id,
    overrideAccess: true,
    data: {
      football: { currentClub: s('currentClub'), position: s('position'), goals: s('goals') },
      medical: { conditions: s('conditions'), emergencyContact: s('emergencyContact'), emergencyPhone },
      photoConsent: fd.get('photoConsent') === 'on',
    },
  })
  revalidatePath(`/account/players/${kid.id}`)
  return { saved: true }
}
