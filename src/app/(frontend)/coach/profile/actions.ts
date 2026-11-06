'use server'

import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { coachOrNull } from '@/academy/portal'

export type ProfileState = { error?: string; saved?: boolean }

const MAX_PHOTO_BYTES = 2.5 * 1024 * 1024

export async function saveCoachProfile(_prev: ProfileState, fd: FormData): Promise<ProfileState> {
  const me = await coachOrNull()
  if (!me) return { error: 'Please log in as a coach.' }
  const displayName = String(fd.get('displayName') ?? '').trim()
  const bio = String(fd.get('bio') ?? '').trim()
  const specialties = String(fd.get('specialties') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6)
  if (displayName.length < 2) return { error: 'Please enter the name families will see.' }
  if (bio.length > 400) return { error: 'Please keep your bio to 400 characters.' }

  const p = await payload()
  let photoId: number | undefined
  const file = fd.get('photo')
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith('image/')) return { error: 'Please choose an image file for your photo.' }
    if (file.size > MAX_PHOTO_BYTES) return { error: 'That photo is too large — please choose one under 2.5 MB.' }
    const media = await p.create({
      collection: 'media',
      overrideAccess: true,
      data: { alt: `${displayName}, Foundation Academy coach` },
      file: { data: Buffer.from(await file.arrayBuffer()), mimetype: file.type, name: file.name || 'coach.jpg', size: file.size },
    })
    photoId = media.id
  }

  await p.update({
    collection: 'academy-coaches',
    id: me.coach.id,
    overrideAccess: true,
    data: { displayName, bio: bio || undefined, specialties: specialties.map((label) => ({ label })), ...(photoId ? { photo: photoId } : {}) },
  })
  revalidatePath('/coach')
  revalidatePath('/coach/profile')
  return { saved: true }
}
