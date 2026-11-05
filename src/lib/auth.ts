import { headers } from 'next/headers'
import type { User } from '@/payload-types'
import { payload } from './payload'

/** The logged-in website user (parents, players, staff) for the current request, if any. */
export async function currentUser(): Promise<User | null> {
  const p = await payload()
  const { user } = await p.auth({ headers: await headers() })
  return user && user.collection === 'users' ? (user as User) : null
}
