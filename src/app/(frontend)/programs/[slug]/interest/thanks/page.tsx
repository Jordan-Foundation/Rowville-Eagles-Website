import Link from 'next/link'
import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { getAgeRules } from '@/lib/age-rules'
import { fullLabel, groupInfo } from '@/lib/age-groups'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Interest received', robots: { index: false } }

export default async function InterestThanks({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ref?: string }> }) {
  const [{ slug }, { ref }] = await Promise.all([params, searchParams])
  const p = await payload()
  const entry = ref ? (await p.find({ collection: 'selection-entries', where: { reference: { equals: ref } }, limit: 1, depth: 1, overrideAccess: true })).docs[0] : undefined
  const rules = await getAgeRules(p)
  const program = entry && typeof entry.round === 'object' && entry.round.program && typeof entry.round.program === 'object' ? entry.round.program : null

  return (
    <div className="container-x max-w-2xl py-16 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent text-2xl text-accent-ink">✓</div>
      <h1 className="mt-6 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Interest received</h1>
      {entry && (
        <>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
            We’ve registered {entry.player.firstName}’s interest{program ? ` in ${program.title}` : ''} for the{' '}
            <strong className="text-ink">{entry.birthYear ? fullLabel(groupInfo(entry.birthYear, rules)) : ''}</strong> age group. We’ve emailed {entry.contact.email} — you’ll hear from us once teams are selected.
          </p>
          <p className="mt-2 text-sm text-muted">Reference <span className="font-mono font-semibold text-ink">{entry.reference}</span></p>
        </>
      )}
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/account" className="rounded-full bg-brand px-6 py-3 font-semibold text-white">My account</Link>
        <Link href={`/programs/${slug}`} className="rounded-full border border-line px-6 py-3 font-semibold">Back to tournament</Link>
      </div>
    </div>
  )
}
