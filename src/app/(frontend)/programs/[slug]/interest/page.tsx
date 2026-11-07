import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { payload, formatDate } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { getAgeRules } from '@/lib/age-rules'
import { miniRoosBirthYears, groupLabel } from '@/lib/age-groups'
import { InterestForm } from './InterestForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Register interest', robots: { index: false } }

export default async function InterestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = await payload()
  const program = (await p.find({ collection: 'programs', where: { slug: { equals: slug }, type: { equals: 'tournament' } }, limit: 1, depth: 0 })).docs[0]
  if (!program) notFound()
  const [user, rules] = await Promise.all([currentUser(), getAgeRules(p)])
  const players = user
    ? (await p.find({ collection: 'participants', where: { account: { equals: user.id } }, depth: 0, limit: 20, overrideAccess: true })).docs.map((k) => ({ id: k.id, name: `${k.firstName} ${k.lastName}`, dob: k.dateOfBirth }))
    : []
  const years = miniRoosBirthYears(rules)

  return (
    <div className="container-x max-w-3xl py-14">
      <Link href={`/programs/${slug}`} className="text-sm text-muted hover:text-ink">← {program.title}</Link>
      <p className="eyebrow mt-6 !text-brand">Tournament · register interest</p>
      <h1 className="mt-2 font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase sm:text-5xl">{program.title}</h1>
      <p className="mt-3 text-muted">
        {program.startDate && `${formatDate(program.startDate, { weekday: 'long', day: 'numeric', month: 'long' })} · `}
        Teams are picked by age group ({groupLabel(years.at(-1)!)}–{groupLabel(years[0])}). Register your interest — coaches select players, and selected players are sent a link to complete registration.
      </p>
      <div className="mt-8">
        {program.status === 'open' ? (
          <InterestForm slug={slug} title={program.title} rules={rules} me={user ? { firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone } : null} players={players} />
        ) : (
          <p className="rounded-2xl border border-line p-6 text-muted">Registrations of interest are closed.</p>
        )}
      </div>
    </div>
  )
}
