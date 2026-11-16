import type { Metadata } from 'next'
import Link from 'next/link'
import { payload } from '@/lib/payload'
import { currentAcademyTerm } from '@/lib/rfa-trials'
import { REFERRAL_PROGRAMS, isReferralProgram, type ReferralProgram } from '@/referrals/programs'
import { inviteFor, referralSettings, resolveCode } from '@/referrals/service'
import { RememberCode } from './RememberCode'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'You’re invited', robots: { index: false } }

/** Where each program's button goes (the Eagles go to trial registration, never straight to payment). */
async function targets(): Promise<Record<ReferralProgram, { href: string; cta: string }>> {
  const p = await payload()
  const next = async (type: string) => (await p.find({ collection: 'programs', where: { type: { equals: type }, status: { in: ['open', 'full'] }, or: [{ endDate: { greater_than: new Date().toISOString() } }, { endDate: { exists: false } }] }, sort: 'startDate', limit: 1, pagination: false, depth: 0 })).docs[0]
  const [term, camp, mini] = await Promise.all([currentAcademyTerm(p), next('holiday-camp'), next('toddler')])
  return {
    'academy-term': { href: term?.slug ? `/programs/${term.slug}` : '/academy', cta: 'See training times & sign up' },
    'holiday-camp': { href: camp?.slug ? `/programs/${camp.slug}` : '/programs', cta: 'See camp dates & book' },
    'mini-ballers': { href: mini?.slug ? `/programs/${mini.slug}` : '/programs', cta: 'Book a session' },
    'one-on-one': { href: '/academy/1-on-1', cta: 'Pick a time & book' },
    eagles: { href: '/join', cta: 'Register for a trial' },
  }
}

/** The page a referral link opens: "[Parent] invited you", their recommended program first, then the rest. */
export default async function ReferPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ i?: string; p?: string }> }) {
  const [{ code }, sp] = await Promise.all([params, searchParams])
  const p = await payload()
  const hit = await resolveCode(p, decodeURIComponent(code))
  const on = (await referralSettings(p)).enabled
  if (!hit || !on) {
    return (
      <div className="container-x max-w-2xl py-16">
        <h1 className="font-display text-4xl font-extrabold uppercase">Welcome to Rowville</h1>
        <p className="mt-4 text-muted">This invite link isn’t active, but you’re very welcome — <Link href="/programs" className="font-semibold underline">see everything we offer</Link>.</p>
      </div>
    )
  }
  const invite = await inviteFor(p, hit.code, sp.i)
  const featured: ReferralProgram = (invite?.featured as ReferralProgram) ?? (isReferralProgram(sp.p) ? sp.p : 'academy-term')
  const go = await targets()
  const hero = REFERRAL_PROGRAMS.find((x) => x.value === featured)!
  const rest = REFERRAL_PROGRAMS.filter((x) => x.value !== featured)
  const who = hit.parent?.firstName || 'A Rowville family'
  return (
    <div>
      <RememberCode value={invite ? `${hit.code}.${invite.token}` : hit.code} />
      <section className="pitch-lines relative overflow-hidden bg-[#0f2a55] text-white">
        <div className="container-x relative py-16 md:py-24">
          <p className="eyebrow">You’re invited</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold uppercase leading-[0.95] sm:text-6xl">{who} invited you to join us</h1>
          <p className="mt-4 max-w-xl text-lg text-white/75">Rowville Eagles and the Rowville Foundation Academy — football for every age and stage. {who} thinks you’ll love:</p>
          <div className="mt-8 max-w-2xl rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur" data-featured={hero.value}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Recommended for you</p>
            <h2 className="mt-2 font-display text-3xl font-bold">{hero.label}</h2>
            <p className="mt-2 text-white/80">{hero.blurb}</p>
            <Link href={go[hero.value].href} className="mt-5 inline-block rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink transition hover:brightness-110">{go[hero.value].cta}</Link>
          </div>
          <p className="mt-6 text-sm text-white/60">Referral code <strong className="text-white">{hit.code}</strong> is saved for you — it’s added automatically when you sign up or book.</p>
        </div>
      </section>
      <section className="container-x py-12">
        <h2 className="font-display text-2xl font-bold uppercase">More ways to play</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {rest.map((x) => (
            <li key={x.value} className="flex flex-col rounded-2xl border border-line bg-surface p-6" data-program={x.value}>
              <h3 className="font-display text-xl font-bold">{x.label}</h3>
              <p className="mt-2 flex-1 text-sm text-muted">{x.blurb}</p>
              <Link href={go[x.value].href} className="mt-4 inline-block self-start rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:border-brand">{go[x.value].cta}</Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
