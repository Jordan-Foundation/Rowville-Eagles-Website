import type { Metadata } from 'next'
import { CoachNav } from './CoachNav'
import { coachOrNull } from '@/academy/portal'
import { payload } from '@/lib/payload'
import { unreadCount } from '@/messaging/service'

export const metadata: Metadata = { title: { default: 'Coach portal', template: '%s · Coach portal' }, robots: { index: false } }

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const c = await coachOrNull()
  const unread = c ? await unreadCount(await payload(), { user: c.user, side: 'coach', coach: c.coach }) : 0
  return (
    <div data-brand="academy" data-page-brand="academy" className="min-h-[70vh]">
      <div className="border-b border-line bg-surface-2">
        <div className="container-x flex flex-wrap items-center justify-between gap-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Foundation Academy · Coach portal</p>
          <CoachNav unread={unread} />
        </div>
      </div>
      <div className="container-x py-12">{children}</div>
    </div>
  )
}
