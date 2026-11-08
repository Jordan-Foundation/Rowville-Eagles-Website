import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { payload, formatDate } from '@/lib/payload'
import { toddlerTrialSessions } from '@/academy/terms/toddler-data'
import { ToddlerTrialForm } from './ToddlerTrialForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Book a free Mini Ballers trial' }

export default async function ToddlerTrialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = await payload()
  const program = (await p.find({ pagination: false, collection: 'programs', where: { slug: { equals: slug }, type: { equals: 'toddler' } }, limit: 1, depth: 0 })).docs[0]
  if (!program || !['open', 'full'].includes(program.status ?? '')) notFound()
  const sessions = await toddlerTrialSessions(p, program)
  return (
    <div>
      <section className="pitch-lines bg-[#0f2a55] text-white">
        <div className="container-x py-16">
          <Link href={`/programs/${program.slug}`} className="text-sm text-white/70 hover:text-white">← {program.title}</Link>
          <p className="eyebrow mt-6">Free trial · Rowville Eagles</p>
          <h1 className="mt-3 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase leading-[0.95]">Try {program.title} free</h1>
          <p className="mt-5 max-w-2xl text-lg text-white/75">
            One free 30-minute session{program.startDate ? ` (term from ${formatDate(program.startDate)})` : ''}. Small groups — {program.trialPlacesPerNight ?? 2} trial places per session, one free trial per child.
          </p>
        </div>
      </section>
      <div className="container-x max-w-3xl py-14">
        {sessions.length ? <ToddlerTrialForm slug={program.slug} sessions={sessions} /> : <p className="rounded-2xl border border-line bg-surface-2 p-6 text-muted">Trial sessions open once the term’s session times are set.</p>}
      </div>
    </div>
  )
}
