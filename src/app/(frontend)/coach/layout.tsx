import type { Metadata } from 'next'
import Link from 'next/link'
import { CoachNav, CoachTabs } from './CoachNav'
import { AppSupport } from '@/components/coach/AppSupport'
import { coachOrNull } from '@/academy/portal'
import { payload } from '@/lib/payload'
import { unreadCount } from '@/messaging/service'

export const metadata: Metadata = { title: { default: 'Coach portal', template: '%s · Coach portal' }, robots: { index: false } }

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const c = await coachOrNull()
  const p = await payload()
  const [unread, kids] = c
    ? await Promise.all([unreadCount(p, { user: c.user, side: 'coach', coach: c.coach }), p.count({ collection: 'participants', where: { account: { equals: c.user.id } }, overrideAccess: true }).then((r) => r.totalDocs)])
    : [0, 0]
  return (
    <div data-brand="academy" data-page-brand="academy" data-portal="coach" className="min-h-[70vh] pb-20 lg:pb-0">
      <AppSupport />
      <div className="border-b border-line bg-surface-2">
        <div className="container-x flex flex-wrap items-center justify-between gap-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Foundation Academy · Coach portal</p>
          <span className="flex gap-4 text-xs">
            {kids > 0 && <Link href="/account?view=family" className="font-semibold underline">My family account</Link>}
            <Link href="/" className="text-muted underline lg:hidden">Website</Link>
          </span>
          <CoachNav unread={unread} />
        </div>
      </div>
      <div className="container-x py-8 lg:py-12">{children}</div>
      <CoachTabs unread={unread} />
    </div>
  )
}
