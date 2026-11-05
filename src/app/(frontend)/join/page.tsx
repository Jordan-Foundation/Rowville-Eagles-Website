import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { currentSeason } from '@/lib/age'
import { clubTrialOptions } from '@/lib/trial-options'
import { JoinForm } from './JoinForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Join us',
  description: 'Register for Rowville Eagles trials — MiniRoos, juniors and seniors. Choose a trial night or register your interest.',
}

const steps = [
  { t: 'Register', d: 'Tell us about your player — it takes two minutes.' },
  { t: 'Trial night', d: 'Pick a trial night, or we’ll email you when dates are set.' },
  { t: 'Get your offer', d: 'Successful players receive an invitation to create an account and register.' },
]

export default async function JoinPage() {
  const p = await payload()
  const settings = await p.findGlobal({ slug: 'site-settings', depth: 0 })
  const season = currentSeason(settings.season)
  const trials = await clubTrialOptions(p)

  return (
    <>
      <section className="pitch-lines bg-[#0f2a55] text-white">
        <div className="container-x py-16 md:py-20">
          <p className="eyebrow">MiniRoos · Juniors · Seniors</p>
          <h1 className="mt-3 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase leading-none sm:text-7xl">
            Join us for <span className="text-accent">{season}</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/75">Every Eagle starts with a trial. Register below and we’ll see you at the ground.</p>
          <ol className="mt-10 grid gap-3 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.t} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <span className="font-[family-name:var(--font-barlow)] text-3xl font-bold text-accent">0{i + 1}</span>
                <p className="mt-1 font-semibold">{s.t}</p>
                <p className="text-sm text-white/60">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <div className="container-x max-w-3xl py-14">
        <JoinForm season={season} trials={trials} />
      </div>
    </>
  )
}
