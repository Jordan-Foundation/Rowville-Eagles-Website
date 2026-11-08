import Link from 'next/link'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { isCoachRoles, isManagementRoles } from '@/lib/home'

export type View = 'management' | 'coach' | 'family'

/** The family's own players (a Management or Coach account can also be a parent). */
export async function myChildren(p: Payload, user: User) {
  const { docs } = await p.find({ pagination: false, collection: 'participants', where: { account: { equals: user.id } }, limit: 20, depth: 0, overrideAccess: true, select: { firstName: true } })
  return docs.map((d) => ({ id: d.id, firstName: d.firstName }))
}

/** Switch between the dashboards someone has, and their own child's profile — kept separate, never mixed in. */
export function RoleSwitch({ user, current, kids }: { user: User; current: View; kids: { id: number; firstName: string }[] }) {
  const links: { href: string; label: string }[] = []
  if (current !== 'management' && isManagementRoles(user.roles)) links.push({ href: '/management', label: 'Management dashboard' })
  if (current !== 'coach' && isCoachRoles(user.roles)) links.push({ href: '/coach', label: 'Switch to Coach dashboard' })
  if (current !== 'family' && kids.length)
    links.push(kids.length === 1 ? { href: `/account/players/${kids[0].id}`, label: `View ${kids[0].firstName}’s profile` } : { href: '/account?view=family', label: 'View my children’s profiles' })
  if (!links.length) return null
  return (
    <nav aria-label="Switch view" className="flex flex-wrap gap-2">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="border border-line px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition hover:border-ink">
          {l.label} →
        </Link>
      ))}
    </nav>
  )
}
