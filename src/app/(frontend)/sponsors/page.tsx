import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { SponsorCard } from '@/components/SponsorLogo'

export const revalidate = 3600
export const metadata: Metadata = {
  title: 'Our Sponsors',
  description: 'The local businesses who support Rowville Eagles Football Club and the Rowville Foundation Academy.',
}

const tiers = [
  { value: 'major', label: 'Major partners' },
  { value: 'gold', label: 'Gold partners' },
  { value: 'silver', label: 'Silver partners' },
  { value: 'community', label: 'Community partners' },
] as const

export default async function SponsorsPage() {
  const p = await payload()
  const [{ docs }, settings] = await Promise.all([
    p.find({ pagination: false, collection: 'sponsors', limit: 100, depth: 1, sort: 'order' }),
    p.findGlobal({ slug: 'site-settings', depth: 0 }),
  ])
  const groups = tiers.map((t) => ({ ...t, items: docs.filter((d) => d.tier === t.value) })).filter((g) => g.items.length)
  const single = groups.length === 1

  return (
    <>
      <section className="pitch-lines bg-[#0f2a55] text-white">
        <div className="container-x py-16 md:py-20">
          <p className="eyebrow">Thank you</p>
          <h1 className="mt-3 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase sm:text-6xl">Our Sponsors</h1>
          <p className="mt-4 max-w-xl text-lg text-white/75">
            Community football runs on community support. These businesses keep our fees down, our kit on and our club growing — please support them too.
          </p>
        </div>
      </section>
      <div className="container-x space-y-16 py-14">
        {groups.map((g) => (
          <section key={g.value}>
            {!single && <h2 className="font-[family-name:var(--font-barlow)] text-3xl font-bold uppercase">{g.label}</h2>}
            <div className={`mt-6 grid gap-5 ${g.value === 'major' ? 'sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
              {g.items.map((s) => (
                <figure key={s.id}>
                  <SponsorCard sponsor={s} size={g.value === 'major' ? 'lg' : 'md'} />
                  <figcaption className="mt-3">
                    <p className="font-semibold">{s.name}</p>
                    {s.blurb && <p className="text-sm text-muted">{s.blurb}</p>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
        <section className="rounded-3xl bg-surface-2 p-8 md:flex md:items-center md:justify-between md:p-10">
          <div>
            <h2 className="font-[family-name:var(--font-barlow)] text-3xl font-bold uppercase">Become a sponsor</h2>
            <p className="mt-2 max-w-xl text-muted">Fence signage, kit branding, website and social media exposure to hundreds of local families every week.</p>
          </div>
          {settings.email && (
            <a href={`mailto:${settings.email}?subject=Sponsorship%20enquiry`} className="mt-6 inline-block rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink hover:brightness-110 md:mt-0">
              Enquire about sponsorship
            </a>
          )}
        </section>
      </div>
    </>
  )
}
