import { cache } from 'react'
import { headers } from 'next/headers'
import type { User } from '@/payload-types'
import { payload } from './payload'

/** Exactly who is signed in (their own login) — for personal things: password, preferences, notifications. */
export const currentLogin = cache(async (): Promise<User | null> => {
  const p = await payload()
  const { user } = await p.auth({ headers: await headers() })
  return user && user.collection === 'users' ? (user as User) : null
})

/**
 * The signed-in family (parents, players, staff) for the current request, if any. A second parent's login
 * (Parent 2) signs in to the same family, so this returns the family's main account: same players, bookings,
 * payments and team pages. Use `currentLogin()` for anything personal to the person signed in.
 */
export const currentUser = cache(async (): Promise<User | null> => {
  const login = await currentLogin()
  const fam = login?.familyAccount
  if (!login || !fam) return login
  const id = typeof fam === 'object' ? fam.id : fam
  const p = await payload()
  const family = await p.findByID({ collection: 'users', id, depth: 0, overrideAccess: true, disableErrors: true })
  return (family as User | null) ?? login
})
