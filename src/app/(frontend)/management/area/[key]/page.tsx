import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { requireManagement } from '@/lib/management'
import { managementAttention } from '@/lib/attention'
import { LiveDashboard } from '@/components/dashboard/LiveDashboard'
import { managementSections, sectionsFor } from '../../items'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params
  const s = managementSections.find((x) => x.key === key)
  return { title: s?.label ?? 'Management', robots: { index: false } }
}

/** One dashboard category: its buttons, with live badges. */
export default async function ManagementArea({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const user = await requireManagement(`/management/area/${key}`)
  const section = sectionsFor(Boolean(user.roles?.includes('admin'))).find((s) => s.key === key)
  if (!section) notFound()
  if (section.href) redirect(section.href)
  const counts = await managementAttention(await payload(), user)
  return (
    <div data-brand="academy" data-page-brand="academy" className="min-h-[70vh]">
      <div className="container-x py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Management</p>
        <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">{section.label}</h1>
        <div className="mt-8"><LiveDashboard items={section.items} initial={counts} role="management" /></div>
      </div>
    </div>
  )
}
