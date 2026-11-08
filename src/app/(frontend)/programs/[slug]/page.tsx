import { priceBreakdown } from '@/lib/format'
import { PriceTag } from '@/components/PriceTag'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { payload, formatAUD, formatDate } from '@/lib/payload'
import { programTypes } from '@/collections/Programs'
import { AcademyBackdrop } from '@/components/AcademyBackdrop'
import { RfaLogo } from '@/components/Logos'
import type { Metadata } from 'next'
import { cache } from 'react'
import { describe, jsonLd, mediaUrl, siteBase } from '@/lib/seo'

export const revalidate = 600
export const generateStaticParams = () => [] as { slug: string }[]

const getProgram = cache(async (slug: string) => {
  const { docs } = await (await payload()).find({ pagination: false, collection: 'programs', where: { slug: { equals: slug } }, limit: 1, depth: 1 })
  return docs[0] ?? null
})

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getProgram((await params).slug)
  if (!p) return { title: 'Programs' }
  const when = p.startDate ? ` · ${formatDate(p.startDate, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''
  const image = mediaUrl(p.heroImage)
  return {
    title: `${p.title}${when}`,
    description: describe([p.summary, p.ageRange, p.scheduleNote].filter(Boolean).join(' · ')),
    alternates: { canonical: `/programs/${p.slug}` },
    openGraph: { title: p.title, description: describe(p.summary), ...(image ? { images: [image] } : {}) },
  }
}

export default async function ProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const pl = await payload()
  const p = await getProgram(slug)
  if (!p) notFound()
  if (p.type === 'private-session') redirect('/academy/1-on-1')
  const academy = p.brand === 'academy'
  // A location like "Home ground" gets the ground's full address and a directions link
  const settings = await pl.findGlobal({ slug: 'site-settings', depth: 0 })
  const place = p.location && /\d/.test(p.location) ? p.location : [p.location, settings.ground?.address].filter(Boolean).join(' · ') || null
  const directions = place ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.location && /\d/.test(p.location) ? p.location : settings.ground?.address || place)}` : null

  const facts = [
    ['When', [formatDate(p.startDate), p.endDate && formatDate(p.endDate)].filter(Boolean).join(' – ')],
    ['Schedule', p.scheduleNote],
    ['Ages', p.ageRange],
    ['Where', place],
    ['Places', p.capacity ? `${p.capacity} total` : null],
  ].filter(([, v]) => v) as [string, string][]

  return (
    <div data-brand={academy ? 'academy' : undefined} data-page-brand={academy ? 'academy' : undefined}>
      {p.startDate && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd({
              '@context': 'https://schema.org',
              '@type': 'SportsEvent',
              name: p.title,
              description: p.summary,
              startDate: p.startDate,
              endDate: p.endDate ?? undefined,
              eventStatus: 'https://schema.org/EventScheduled',
              eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
              location: place ? { '@type': 'Place', name: p.location || settings.ground?.name || 'Rowville Eagles', address: place } : undefined,
              image: mediaUrl(p.heroImage),
              organizer: { '@id': `${siteBase()}/#club` },
              url: `${siteBase()}/programs/${p.slug}`,
              offers: p.type === 'community' ? undefined : { '@type': 'Offer', price: p.pricePerSession ?? p.price ?? 0, priceCurrency: 'AUD', availability: p.status === 'open' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut', url: `${siteBase()}/programs/${p.slug}` },
            }),
          }}
        />
      )}
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
          <p><PriceTag p={p} big={`text-4xl font-bold ${academy ? 'font-display' : ''}`} /></p>
          {priceBreakdown(p).length > 1 && (
            <dl className="mt-3 space-y-1 text-sm">
              {priceBreakdown(p).map((r) => (
                <div key={r.label} className="flex justify-between gap-4"><dt className="text-muted">{r.label}</dt><dd className="font-semibold">{r.price}</dd></div>
              ))}
            </dl>
          )}
          {p.priceNote && <p className="mt-1 text-sm text-muted">{p.priceNote}</p>}
          <dl className="mt-6 space-y-3 border-t border-line pt-6 text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 flex flex-wrap justify-end gap-x-4 gap-y-1 text-sm">
            {directions && <a href={directions} target="_blank" rel="noopener" className="font-semibold underline">Get directions</a>}
            {p.type !== 'community' && <a href="/policies/refunds" target="_blank" rel="noopener" className="underline">Refunds &amp; cancellations</a>}
          </p>
          {p.type === 'community' ? (
            <div className="mt-7 space-y-2 rounded-xl border border-line bg-surface p-4 text-sm">
              <p className="font-semibold">No booking needed — just come along.</p>
              <p className="text-muted">A parent or carer stays to supervise their child. All welcome.</p>
            </div>
          ) : p.type === 'registration' ? (
            <div className="mt-7 space-y-3">
              <p className="text-sm text-muted">Team registration is by invitation after trials. Families who receive an offer pay from their account.</p>
              <Link href="/join" className="block w-full rounded-full bg-accent px-6 py-3 text-center font-semibold text-accent-ink hover:brightness-110">Join us for trials</Link>
              <Link href="/login?next=/account" className="block text-center text-sm font-semibold underline">Have an offer? Log in</Link>
            </div>
          ) : p.type === 'tournament' && p.status === 'open' ? (
            <div className="mt-7 space-y-3">
              <Link href={`/programs/${p.slug}/interest`} className={`block w-full bg-accent px-6 py-3 text-center font-semibold text-accent-ink transition hover:brightness-110 ${academy ? 'uppercase tracking-[0.18em]' : 'rounded-full'}`}>
                Register interest
              </Link>
              <p className="text-center text-xs text-muted">No payment now — coaches select teams by age group, and selected players are invited to register.</p>
            </div>
          ) : p.type === 'toddler' && (p.status === 'open' || p.status === 'full') ? (
            <div className="mt-7 space-y-3">
              {p.status === 'open' && (
                <Link href={`/programs/${p.slug}/book`} className="block w-full bg-accent px-6 py-3 text-center font-semibold uppercase tracking-[0.18em] text-accent-ink transition hover:brightness-110">Book the term</Link>
              )}
              <Link href={`/programs/${p.slug}/trial`} className="block w-full border border-line px-6 py-3 text-center font-semibold uppercase tracking-[0.18em] transition hover:border-ink">Book a free trial</Link>
              <p className="text-center text-xs text-muted">{p.status === 'full' ? 'The term is full — book a trial or join the waitlist from the booking page.' : 'Ages 2–5 · 30-minute sessions · parents stay to supervise'}</p>
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
