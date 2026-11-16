import { redirect } from 'next/navigation'
import type { User } from '@/payload-types'
import { hasRole } from '../access'
import { currentUser } from '../lib/auth'

/** Finance is for admins (owners) only — committee members and coaches never see pay, expenses or bank data. */
export const isFinanceUser = (u: User | null | undefined) => hasRole(u, 'admin')

export async function requireFinance(next = '/management/finance'): Promise<User> {
  const user = await currentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`)
  if (!isFinanceUser(user)) redirect('/no-access?area=finance')
  return user
}

export async function financeOrNull(): Promise<User | null> {
  const user = await currentUser()
  return isFinanceUser(user) ? user : null
}
