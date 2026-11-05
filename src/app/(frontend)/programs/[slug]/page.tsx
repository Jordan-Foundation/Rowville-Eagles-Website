import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { payload, formatAUD, formatDate } from '@/lib/payload'
import { programTypes } from '@/collections/Programs'

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
      <section className={academy ? 'border-b border-line' : 'pitch-lines bg-[#0f2a55] text-white'}>
        <div className="container-x py-16 md:py-24">
          <p className="eyebrow">{programTypes.find((t) => t.value === p.type)?.label}</p>
          <h1 className={`mt-4 max-w-3xl text-5xl leading-none sm:text-6xl ${academy ? 'font-display font-semibold' : 'font-[family-name:var(--font-barlow)] font-extrabold uppercase'}`}>
            {p.title}
          </h1>
          <p className={`mt-5 max-w-2xl text-lg ${academy ? 'text-muted' : 'text-white/75'}`}>{p.summary}</p>
        </div>
      </section>
      <div className="container-x grid gap-12 py-14 lg:grid-cols-[1fr_22rem]">
        <article className="prose max-w-none text-ink [&_p]:mb-4 [&_p]:leading-relaxed">
          {p.description ? <RichText data={p.description} /> : <p className="text-muted">Full details coming soon.</p>}
        </article>
        <aside className="h-fit rounded-2xl border border-line bg-surface-2 p-7 lg:sticky lg:top-24">
          <p className="text-3xl font-bold">{formatAUD(p.price)}</p>
          {p.priceNote && <p className="mt-1 text-sm text-muted">{p.priceNote}</p>}
          <dl className="mt-6 space-y-3 border-t border-line pt-6 text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {p.status === 'open' ? (
            <Link
              href={`/programs/${p.slug}/book`}
              className={`mt-7 block w-full bg-accent px-6 py-3 text-center font-semibold text-accent-ink transition hover:brightness-110 ${academy ? 'uppercase tracking-[0.18em]' : 'rounded-full'}`}
            >
              {p.type === 'registration' ? 'Register & pay' : 'Book now'}
            </Link>
          ) : (
            <p className="mt-7 rounded-lg border border-line px-4 py-3 text-center text-sm text-muted">
              {p.status === 'full' ? 'Fully booked' : 'Bookings closed'}
            </p>
          )}
          {p.type === 'registration' && (
            <p className="mt-4 text-xs text-muted">After paying, you’ll complete the Football Victoria section in PlayFootball.</p>
          )}
        </aside>
      </div>
    </div>
  )
}
