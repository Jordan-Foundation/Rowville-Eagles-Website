import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import type { Media } from '@/payload-types'

export const revalidate = 3600
export const metadata: Metadata = {
  title: 'Committee',
  description: 'The volunteers who run Rowville Eagles Football Club.',
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')

/** About → Committee: the volunteer committee (edited in the admin under Club → About page → Committee). */
export default async function CommitteePage() {
  const about = await (await payload()).findGlobal({ slug: 'about', depth: 1 })
  const people = about.committee ?? []
  return (
    <>
      <section className="pitch-lines bg-[#0f2a55] text-white">
        <div className="container-x py-16 md:py-20">
          <p className="eyebrow">About the club</p>
          <h1 className="mt-3 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase leading-none sm:text-7xl">Our <span className="text-accent">committee</span></h1>
          <p className="mt-5 max-w-xl text-lg text-white/75">Rowville Eagles is run by volunteers. These are the people who keep the club going on and off the pitch.</p>
        </div>
      </section>
      <section className="container-x py-14">
        {people.length ? (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-committee>
            {people.map((c) => {
              const photo = typeof c.photo === 'object' && c.photo ? (c.photo as Media) : null
              return (
                <li key={c.id ?? c.name} className="rounded-2xl border border-line p-6" data-member={c.name}>
                  <div className="flex items-center gap-4">
                    {photo?.url ? (
                      <Image src={photo.url} alt={c.name} width={72} height={72} className="h-18 w-18 rounded-full object-cover" />
                    ) : (
                      <span aria-hidden className="grid h-18 w-18 place-items-center rounded-full bg-brand/10 font-[family-name:var(--font-barlow)] text-2xl font-bold text-brand">{initials(c.name)}</span>
                    )}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-brand">{c.role}</p>
                      <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">{c.name}</h2>
                    </div>
                  </div>
                  {c.bio && <p className="mt-4 text-sm text-muted">{c.bio}</p>}
                  {c.email && <p className="mt-3 text-sm"><a href={`mailto:${c.email}`} className="font-semibold text-brand underline">{c.email}</a></p>}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-muted">Committee details are coming soon. In the meantime, contact the club secretary at <a href="mailto:refc.secretary@outlook.com" className="font-semibold text-brand underline">refc.secretary@outlook.com</a>.</p>
        )}
        <p className="mt-10 text-sm text-muted">Interested in volunteering? <a href="mailto:refc.secretary@outlook.com" className="font-semibold text-brand underline">Get in touch</a> — <Link href="/about/history" className="underline">read our history</Link>.</p>
      </section>
    </>
  )
}
