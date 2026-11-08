import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { requireManagement } from '@/lib/management'
import { LiveDashboard } from '@/components/dashboard/LiveDashboard'
import { managementAttention } from '@/lib/attention'
import { RoleSwitch, myChildren } from '@/components/dashboard/RoleSwitch'
import { managementItems } from './items'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Management', robots: { index: false } }

export default async function ManagementHome() {
  const user = await requireManagement('/management')
  const p = await payload()
  const [kids, counts] = await Promise.all([myChildren(p, user), managementAttention(p, user)])
  return (
    <div data-brand="academy" data-page-brand="academy" className="min-h-[70vh]">
      <div className="container-x py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Management · Rowville Eagles &amp; Foundation Academy</p>
            <h1 className="mt-2 font-display text-5xl font-semibold uppercase tracking-tight">Hi {user.firstName || 'there'}</h1>
          </div>
          <RoleSwitch user={user} current="management" kids={kids} />
        </div>
        <div className="mt-10">
          <LiveDashboard items={managementItems} initial={counts} role="management" />
        </div>
      </div>
    </div>
  )
}
