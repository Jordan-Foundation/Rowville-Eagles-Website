import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { payload, formatAUD, formatDate } from '@/lib/payload'
import { programTypes } from '@/collections/Programs'
import { AcademyBackdrop } from '@/components/AcademyBackdrop'
import { RfaLogo } from '@/components/Logos'

export default async function ProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { docs } = await (await payload()).find({ collection: 'programs', where: { slug: { equals: slug } }, limit: 1, depth: 1 })
  const p = docs[0]
  if (!p) notFound()
  const academy = p.brand === 'academy'

  const facts = [
    ['When', [formatDate(p.startDate), p.endDate && formatDate(p.endDate)].filter(Boolean).join(' – ')],
    ['Schedule', p.scheduleNote],
    ['Ages', p.ageRange],
    ['Where', p.location],
    ['Places', p.capacity ? `${p.capacity} total` : null],
  ].filter(([, v]) => v) as [string, string][]

  return (
    <div data-brand={academy ? 'academy' : undefined} data-page-brand={academy ? 'academy' : undefined}>
      <section className={academy ? 'relative overflow-hidden border-b border-line' : 'pitch-lines bg-[#0f2a55] text-white'}>
        {academy && <AcademyBackdrop size="md" />}
        <div className="container-x relative py-16 md:py-24">
          {academy && <RfaLogo className="mb-8 h-10 w-auto" ink="#fff" paper="#000" />}
          <p className={academy ? 'text-xs font-medium uppercase tracking-[0.35em] text-muted' : 'eyebrow'}>{programTypes.find((t) => t.value === p.type)?.label}</p>
          <h1 className={`mt-4 max-w-3xl text-5xl leading-none sm:text-6xl ${academy ? 'font-display font-semibold uppercase tracking-tight' : 'font-[family-name:var(--font-barlow)] font-extrabold uppercase'}`}>
            {p.title}
          </h1>
          <p className={`mt-5 max-w-2xl text-lg ${academy ? 'text-muted' : 'text-white/75'}`}>{p.summary}</p>
        </div>
      </section>
      <div className="container-x grid gap-12 py-14 lg:grid-cols-[1fr_22rem]">
        <article className="prose max-w-none text-ink [&_p]:mb-4 [&_p]:leading-relaxed">
          {p.description ? <RichText data={p.description} /> : <p className="text-muted">Full details coming soon.</p>}
        </article>
        <aside className={`panel h-fit border border-line bg-surface-2 p-7 lg:sticky lg:top-24 ${academy ? 'gloss-sheen rounded-sm' : 'rounded-2xl'}`}>
          <p className={`text-3xl font-bold ${academy ? 'font-display' : ''}`}>{formatAUD(p.price)}</p>
          {p.priceNote && <p className="mt-1 text-sm text-muted">{p.priceNote}</p>}
          <dl className="mt-6 space-y-3 border-t border-line pt-6 text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {p.type === 'registration' ? (
            <div className="mt-7 space-y-3">
              <p className="text-sm text-muted">Team registration is by invitation after trials. Families who receive an offer pay from their account.</p>
              <Link href="/join" className="block w-full rounded-full bg-accent px-6 py-3 text-center font-semibold text-accent-ink hover:brightness-110">Join us for trials</Link>
              <Link href="/login?next=/account" className="block text-center text-sm font-semibold underline">Have an offer? Log in</Link>
            </div>
          ) : p.status === 'open' ? (
            <Link
              href={`/programs/${p.slug}/book`}
              className={`mt-7 block w-full bg-accent px-6 py-3 text-center font-semibold text-accent-ink transition hover:brightness-110 ${academy ? 'uppercase tracking-[0.18em]' : 'rounded-full'}`}
            >
              Book now
            </Link>
          ) : (
            <p className="mt-7 rounded-lg border border-line px-4 py-3 text-center text-sm text-muted">
              {p.status === 'full' ? 'Fully booked' : 'Bookings closed'}
            </p>
          )}

        </aside>
      </div>
    </div>
  )
}
