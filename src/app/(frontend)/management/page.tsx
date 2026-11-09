import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { requireManagement } from '@/lib/management'
import { LiveDashboard } from '@/components/dashboard/LiveDashboard'
import { managementAttention } from '@/lib/attention'
import { RoleSwitch, myChildren } from '@/components/dashboard/RoleSwitch'
import { managementItems } from './items'
import Link from 'next/link'
import { managementThisWeek } from '@/lib/this-week'
import { formatDate } from '@/lib/payload'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Management', robots: { index: false } }

export default async function ManagementHome() {
  const user = await requireManagement('/management')
  const p = await payload()
  const [kids, counts, week] = await Promise.all([myChildren(p, user), managementAttention(p, user), managementThisWeek(p)])
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
        <section aria-label="This week" className="panel mt-8 border border-line">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3">
            <h2 className="font-display text-xl font-semibold uppercase">This week</h2>
            <p className="text-xs text-muted">{formatDate(`${week.from}T02:00:00Z`, { weekday: 'short', day: 'numeric', month: 'short' })} – {formatDate(`${week.to}T02:00:00Z`, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {week.lines.map((l) => (
              <div key={l.label} className="border-b border-r border-line">
                <Link href={l.href ?? '/management'} className="block h-full p-4 hover:bg-white/5">
                  <dt className="text-xs text-muted">{l.label}</dt>
                  <dd className={`mt-1 font-display text-2xl font-semibold ${l.tone === 'warn' ? 'text-amber-300' : l.tone === 'good' ? 'text-emerald-300' : ''}`}>{l.value}</dd>
                </Link>
              </div>
            ))}
          </dl>
        </section>
        <div className="mt-10">
          <LiveDashboard items={managementItems} initial={counts} role="management" />
        </div>
      </div>
    </div>
  )
}
