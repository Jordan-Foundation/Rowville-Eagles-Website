import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { foundationGate, foundationSettings } from '@/academy/pdr/load'
import { payload } from '@/lib/payload'

export const dynamic = 'force-dynamic'
export async function generateMetadata(): Promise<Metadata> {
  const s = await foundationSettings(await payload())
  return { title: s.name, description: s.tagline || undefined }
}

export default async function FoundationHome() {
  const { p, settings, user } = await foundationGate()
  const kids = user ? (await p.find({ collection: 'participants', where: { account: { equals: user.id } }, sort: 'firstName', depth: 0, limit: 20, overrideAccess: true })).docs : []
  if (kids.length === 1) redirect(`/foundation-plus/${kids[0].id}`)
  return (
    <div className="max-w-3xl">
      <p className="eyebrow">Foundation Academy</p>
      <h1 className="mt-2 font-display text-5xl font-bold uppercase tracking-tight sm:text-6xl">{settings.name}</h1>
      {settings.tagline && <p className="mt-4 text-lg text-muted">{settings.tagline}</p>}
      <ul className="mt-6 space-y-2 text-sm">
        <li>⚽ Six areas — Physical, Passing, Dribbling, Control, Skills and Ball Mastery — each with levels to work through</li>
        <li>🎥 Film your challenge attempt and an Academy coach checks it</li>
        <li>🏅 Earn a badge for every level you complete, and see how you rank</li>
      </ul>
      {!user ? (
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/login?next=/foundation-plus" className="bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-black">Log in</Link>
          <Link href="/academy" className="border border-line px-6 py-3 text-sm font-semibold uppercase tracking-[0.15em]">About the Academy</Link>
        </div>
      ) : kids.length === 0 ? (
        <p className="panel mt-10 border border-line p-6 text-muted">
          Add a player to your account to start. <Link href="/account" className="underline">My account</Link>
        </p>
      ) : (
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {kids.map((k) => (
            <Link key={k.id} href={`/foundation-plus/${k.id}`} className="panel gloss-sheen block border border-line p-6 transition hover:border-white/40">
              <p className="font-display text-2xl font-semibold uppercase">{k.firstName}</p>
              <p className="mt-1 text-sm text-muted">Open {k.firstName}’s report →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
