import Link from 'next/link'
import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { foundationSettings, isStaffOrCoach } from '@/academy/pdr/load'
import { FoundationPlusLogo } from '@/components/FoundationPlusLogo'
import { formStamp } from '@/lib/form-guard'
import { FPLUS } from '@/content/foundation-plus'
import { displayPrices } from '@/academy/pdr/billing/stripe'
import { WaitlistForm } from './_parts/WaitlistForm'
import { Pricing } from './_parts/Pricing'
import { Screens, type Slide } from './_parts/Screens'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Foundation+ — online football training',
  description: 'Foundation Academy’s online training platform: 24 free drills, video challenges checked by coaches, badges, leaderboards and monthly challenges. Try Premium free for a month.',
  alternates: { canonical: '/foundation-plus' },
  openGraph: { title: 'Foundation+ — level up every day', description: 'Online football training from Foundation Academy. Drills, coach-checked video challenges, badges and leaderboards.', type: 'website' },
}

const ICONS: Record<string, React.ReactNode> = {
  drills: <path d="M4 6h16M4 12h16M4 18h10" />,
  video: <path d="M3 6h12v12H3V6Zm12 4 6-3v10l-6-3" />,
  coach: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0" />,
  points: <path d="M5 12l4 4L19 6" />,
  feedback: <path d="M4 5h16v11H8l-4 4V5Zm4 5h8" />,
  badge: <path d="M12 3 20 7v6c0 4-3.5 7-8 8-4.5-1-8-4-8-8V7l8-4Z" />,
  levels: <path d="M4 20h4v-6H4v6Zm6 0h4V10h-4v10Zm6 0h4V4h-4v16Z" />,
  progress: <path d="M5 19 19 5M9 5h10v10" />,
  trophy: <path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M10 15h4v4h-4zM8 21h8" />,
}
const Icon = ({ k }: { k: string }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" aria-hidden>{ICONS[k]}</svg>
)

const SLIDES: Slide[] = [
  { title: 'Your player page', desktop: '/foundation-plus/screens/player-desktop.webp', phone: '/foundation-plus/screens/player-phone.webp', alt: 'Foundation+ player page with six area cards and progress bars' },
  { title: 'Every drill, step by step', desktop: '/foundation-plus/screens/stage-desktop.webp', phone: '/foundation-plus/screens/stage-phone.webp', alt: 'A Foundation+ drill with tutorial videos, the challenge and coaching points' },
  { title: 'Leaderboards', desktop: '/foundation-plus/screens/leaderboard-desktop.webp', phone: '/foundation-plus/screens/leaderboard-phone.webp', alt: 'A Foundation+ leaderboard of verified scores' },
  { title: 'Your Trophy Cabinet', desktop: '/foundation-plus/screens/trophies-desktop.webp', phone: '/foundation-plus/screens/trophies-phone.webp', alt: 'The Foundation+ Trophy Cabinet of badges' },
]

export default async function FoundationPlusPage() {
  const p = await payload()
  const [settings, user, s] = await Promise.all([foundationSettings(p), currentUser(), p.findGlobal({ slug: 'pdr-settings', depth: 0, overrideAccess: true })])
  const live = settings.enabled
  const kids = user && (live || isStaffOrCoach(user)) ? (await p.find({ pagination: false, collection: 'participants', where: { account: { equals: user.id } }, sort: 'firstName', depth: 0, limit: 20, overrideAccess: true })).docs : []
  const plan = s.plans ?? {}
  const prices = await displayPrices(p)
  const trialDays = plan.trialDays ?? 30
  const stamp = formStamp()
  const primary = live ? 'Start your free month' : 'Join the waitlist'
  const tiers = FPLUS.tiers

  return (
    <div data-page-brand="fplus" className="bg-white text-[#0b0b0c]">
      {/* HERO */}
      <section className="fp-ink relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background:repeating-linear-gradient(-60deg,#fff_0_1px,transparent_1px_28px)]" />
        <div className="container-x relative grid gap-12 py-16 sm:py-24 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <h1><FoundationPlusLogo variant="horizontal" tone="white" height={72} alt="Foundation+" className="max-w-full" /></h1>
            {!live && <p className="fp-label mt-8 inline-block border border-white/40 px-3 py-1.5 text-[11px]">Coming soon</p>}
            <p className="fp-heading mt-6 text-5xl leading-[0.95] sm:text-7xl">{FPLUS.hero.headline}</p>
            <p className="mt-6 max-w-xl text-lg text-white/75">{FPLUS.hero.line}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#free-month" className="fp-label bg-white px-7 py-4 text-xs text-[#0b0b0c] transition hover:bg-white/85">{live ? 'Start your free month' : 'Join the waitlist'}</a>
              <a href="#pricing" className="fp-label border border-white/40 px-7 py-4 text-xs transition hover:border-white">See pricing</a>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-xs">
            <div className="overflow-hidden rounded-[2.2rem] border-[7px] border-[#2a2a2e] bg-black shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SLIDES[0].phone} alt="Foundation+ on a phone: the player page" className="block aspect-[9/19.5] w-full object-cover object-top" />
            </div>
          </div>
        </div>
        {kids.length > 0 && (
          <div className="border-t border-white/10">
            <div className="container-x flex flex-wrap items-center gap-3 py-5">
              <span className="fp-label text-[11px] text-white/60">Your players</span>
              {kids.map((k) => (
                <Link key={k.id} href={`/foundation-plus/${k.id}`} className="fp-label border border-white/40 px-4 py-2 text-[11px] hover:border-white">Open {k.firstName}’s player page →</Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* FEATURES */}
      <section aria-labelledby="features-h" className="py-20">
        <div className="container-x">
          <p className="fp-label text-xs text-[#0b0b0c]/60">What you get</p>
          <h2 id="features-h" className="fp-heading mt-3 text-4xl sm:text-5xl">Train like an academy player — anywhere</h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {tiers.map((t) => (
              <div key={t.key} className={`border p-7 ${t.key === 'premium' ? 'border-[#0b0b0c] bg-[#0b0b0c] text-white' : 'border-[#0b0b0c]/15'}`}>
                <p className="fp-heading text-3xl">{t.name}</p>
                <p className="mt-1 text-sm opacity-70">{t.intro}</p>
                <ul className="mt-6 space-y-5">
                  {t.features.map((f) => (
                    <li key={f.title} className="flex gap-4">
                      <span className={`grid h-11 w-11 shrink-0 place-items-center ${t.key === 'premium' ? 'bg-white text-[#0b0b0c]' : 'bg-[#0b0b0c] text-white'}`}><Icon k={f.icon} /></span>
                      <span>
                        <span className="block font-semibold">{f.title}</span>
                        <span className="block text-sm opacity-75">{f.text}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SCREENSHOTS */}
      <section aria-labelledby="screens-h" className="fp-ink py-20">
        <div className="container-x">
          <p className="fp-label text-xs text-white/60">Inside Foundation+</p>
          <h2 id="screens-h" className="fp-heading mt-3 text-4xl sm:text-5xl">On your laptop. On your phone.</h2>
          <div className="mt-12"><Screens slides={SLIDES} /></div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section aria-labelledby="how-h" className="py-20">
        <div className="container-x">
          <p className="fp-label text-xs text-[#0b0b0c]/60">How it works</p>
          <h2 id="how-h" className="fp-heading mt-3 text-4xl sm:text-5xl">Three steps to your first drill</h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {FPLUS.steps.map((st, n) => (
              <li key={st.title} className="relative border-t-4 border-[#0b0b0c] pt-6">
                <span className="fp-heading text-6xl text-[#0b0b0c]/15">0{n + 1}</span>
                <p className="mt-2 text-xl font-bold">{st.title}</p>
                <p className="mt-2 text-[#0b0b0c]/70">{st.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" aria-labelledby="pricing-h" className="scroll-mt-24 bg-[#f4f4f5] py-20">
        <div className="container-x">
          <p className="fp-label text-center text-xs text-[#0b0b0c]/60">Pricing</p>
          <h2 id="pricing-h" className="fp-heading mt-3 text-center text-4xl sm:text-5xl">Start free. Go further.</h2>
          <div className="mt-10">
            <Pricing
              live={live}
              sibling={plan.siblingDiscountPct ?? 25}
              trialDays={trialDays}
              plans={[
                { key: 'free', name: 'Free', monthly: 0, yearly: 0, blurb: 'Level 1 of every area.', points: ['24 drills', 'Video challenges + leaderboards', 'Coaching points and feedback', 'Badges'] },
                { key: 'standard', name: 'Standard', monthly: prices.standard_month, yearly: prices.standard_year, blurb: 'Everything in Free, plus:', points: ['Levels 2 and 3 unlocked', '3× the coaching', 'More levels on the way'] },
                { key: 'premium', name: 'Premium', monthly: prices.premium_month, yearly: prices.premium_year, blurb: 'Everything in Standard, plus:', points: ['2 feedback videos a month', 'Members-only monthly challenges', 'Prizes for challenge winners'] },
              ]}
            />
          </div>
        </div>
      </section>

      {/* FREE MONTH / WAITLIST */}
      <section id="free-month" aria-labelledby="free-h" className="fp-ink scroll-mt-24 py-20">
        <div className="container-x max-w-3xl">
          <p className="fp-label text-xs text-white/60">{live ? 'Free trial' : 'Coming soon'}</p>
          <h2 id="free-h" className="fp-heading mt-3 text-4xl sm:text-5xl">Try Premium free for 1 month</h2>
          <p className="mt-4 text-white/75">
            {live
              ? 'Enter your email and we’ll send you a secure link to create your player portal account and start your free month.'
              : 'Foundation+ is launching soon. Join the waitlist and we’ll email you a link to claim your free month of Premium the moment it goes live.'}
          </p>
          <div className="relative mt-8"><WaitlistForm stamp={stamp} live={live} /></div>
          <p className="mt-4 text-xs text-white/50">We’ll only use your email for this. {live ? 'A card is needed to start the trial; cancel any time before it ends and you won’t be charged.' : 'No card needed to join the waitlist.'}</p>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-h" className="py-20">
        <div className="container-x max-w-3xl">
          <p className="fp-label text-xs text-[#0b0b0c]/60">FAQ</p>
          <h2 id="faq-h" className="fp-heading mt-3 text-4xl sm:text-5xl">Questions</h2>
          <div className="mt-10 divide-y divide-[#0b0b0c]/15 border-y border-[#0b0b0c]/15">
            {FPLUS.faq.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}<span aria-hidden className="text-2xl transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-[#0b0b0c]/75">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="fp-ink py-20 text-center">
        <div className="container-x">
          <FoundationPlusLogo variant="mark" tone="white" height={56} className="mx-auto" alt="" />
          <h2 className="fp-heading mt-6 text-4xl sm:text-6xl">Ready to train?</h2>
          <a href="#free-month" className="fp-label mt-8 inline-block bg-white px-8 py-4 text-xs text-[#0b0b0c] transition hover:bg-white/85">{primary}</a>
        </div>
      </section>
    </div>
  )
}
