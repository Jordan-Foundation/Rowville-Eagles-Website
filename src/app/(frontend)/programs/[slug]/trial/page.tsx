import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { payload, formatDate } from '@/lib/payload'
import { AcademyBackdrop } from '@/components/AcademyBackdrop'
import { toddlerTrialSessions } from '@/academy/terms/toddler-data'
import { ToddlerTrialForm } from './ToddlerTrialForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Book a free Mini Ballers trial' }

export default async function ToddlerTrialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = await payload()
  const program = (await p.find({ collection: 'programs', where: { slug: { equals: slug }, type: { equals: 'toddler' } }, limit: 1, depth: 0 })).docs[0]
  if (!program || !['open', 'full'].includes(program.status ?? '')) notFound()
  const sessions = await toddlerTrialSessions(p, program)
  return (
    <div data-brand="academy" data-page-brand="academy">
      <section className="relative overflow-hidden border-b border-line">
        <AcademyBackdrop size="md" />
        <div className="container-x relative py-16">
          <Link href={`/programs/${program.slug}`} className="text-sm text-muted hover:text-ink">← {program.title}</Link>
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.35em] text-muted">Free trial</p>
          <h1 className="mt-3 font-display text-5xl font-semibold uppercase leading-[0.95] tracking-tight">Try {program.title} free</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            One free 30-minute session{program.startDate ? ` (term from ${formatDate(program.startDate)})` : ''}. Small groups — {program.trialPlacesPerNight ?? 2} trial places per session, one free trial per child.
          </p>
        </div>
      </section>
      <div className="container-x max-w-3xl py-14">
        {sessions.length ? <ToddlerTrialForm slug={program.slug} sessions={sessions} /> : <p className="panel border border-line bg-surface-2 p-6 text-muted">Trial sessions open once the term’s session times are set.</p>}
      </div>
    </div>
  )
}
