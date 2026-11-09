import { redirect } from 'next/navigation'
import type { AcademyCoach, User } from '@/payload-types'
import { hasRole } from '../access'
import { currentUser } from '../lib/auth'
import { payload } from '../lib/payload'

/**
 * Gate for every /coach page and action: the user must have the coach role.
 * Their public coach profile is created automatically the first time they open the portal.
 */
export async function requireCoach(next = '/coach'): Promise<{ user: User; coach: AcademyCoach }> {
  const user = await currentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`)
  if (!hasRole(user, 'coach')) redirect('/no-access?area=coach')
  const coach = await coachFor(user)
  return { user, coach }
}

/** For server actions: returns null instead of redirecting. */
export async function coachOrNull(): Promise<{ user: User; coach: AcademyCoach } | null> {
  const user = await currentUser()
  if (!user || !hasRole(user, 'coach')) return null
  return { user, coach: await coachFor(user) }
}

async function coachFor(user: User): Promise<AcademyCoach> {
  const p = await payload()
  const { docs } = await p.find({ pagination: false, collection: 'academy-coaches', where: { user: { equals: user.id } }, limit: 1, depth: 1, overrideAccess: true })
  if (docs[0]) return docs[0]
  return p.create({
    collection: 'academy-coaches',
    overrideAccess: true,
    data: { user: user.id, displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0], active: false },
  })
}

/**
 * Video reviews: coaches, and Management (who may not have the coach role). Returns the reviewer's account;
 * Management doesn't get a coach profile created just for reviewing.
 */
export async function requireReviewer(next = '/coach/reviews'): Promise<User> {
  const user = await currentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`)
  if (!hasRole(user, 'coach') && !hasRole(user, 'admin') && !hasRole(user, 'committee')) redirect('/no-access?area=coach')
  return user
}

export async function reviewerOrNull(): Promise<User | null> {
  const user = await currentUser()
  return user && (hasRole(user, 'coach') || hasRole(user, 'admin') || hasRole(user, 'committee')) ? user : null
}
