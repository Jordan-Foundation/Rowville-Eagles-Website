import type { Metadata } from 'next'
import { payload, formatAUD } from '@/lib/payload'
import { groupInfo } from '@/lib/age-groups'
import { getAgeRules } from '@/lib/age-rules'
import { clubTrialOptions } from '@/lib/trial-options'
import { JoinForm } from './JoinForm'
import { contactPrefill, familyKids } from '@/lib/family-kids'
import { currentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Join us',
  description: 'Register for Rowville Eagles trials — MiniRoos, juniors and seniors. Choose a trial night or register your interest.',
}

const steps = [
  { t: 'Register', d: 'Tell us about your player — it takes two minutes.' },
  { t: 'Trial night', d: 'Pick a trial night, or we’ll email you when dates are set.' },
  { t: 'Get your offer', d: 'Coaches place players in teams. You’ll get an email with your offer.' },
  { t: 'Pay & play', d: 'Pay the club fee from your account, then finish the Football Victoria step in PlayFootball.' },
]

const kindName = { miniroos: 'MiniRoos', junior: 'Juniors', senior: 'Seniors', 'too-young': '' } as const

export default async function JoinPage() {
  const p = await payload()
  const me = await currentUser()
  const rules = await getAgeRules(p)
  const season = rules.season
  const trials = await clubTrialOptions(p)
  // Who plays where this season: MiniRoos and junior birth years, then seniors
  const groups = Array.from({ length: 18 - rules.miniMin }, (_, i) => groupInfo(season - rules.miniMin - i, rules))
  const { docs: fees } = await p.find({ pagination: false, collection: 'programs', where: { type: { equals: 'registration' }, status: { not_equals: 'draft' } }, sort: 'title', limit: 20, depth: 0 })

  return (
    <>
      <section className="pitch-lines bg-[#0f2a55] text-white">
        <div className="container-x py-16 md:py-20">
          <p className="eyebrow">MiniRoos · Juniors · Seniors</p>
          <h1 className="mt-3 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase leading-none sm:text-7xl">
            Join us for <span className="text-accent">{season}</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/75">Every Eagle starts with a trial. Register below and we’ll see you at the ground.</p>
          <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
      <div className="container-x grid max-w-5xl gap-6 pt-14 md:grid-cols-2">
        <section className="rounded-2xl border border-line p-6">
          <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Age groups for {season}</h2>
          <p className="mt-1 text-sm text-muted">Players are grouped by year of birth.</p>
          <table className="mt-4 w-full text-sm">
            <thead><tr className="text-left text-muted"><th className="py-1.5 font-medium">Born in</th><th className="py-1.5 font-medium">Plays in</th><th className="py-1.5 font-medium">Group</th></tr></thead>
            <tbody className="divide-y divide-line">
              {groups.map((g) => (
                <tr key={g.birthYear}><td className="py-1.5 font-medium">{g.birthYear}</td><td className="py-1.5">{g.hint}</td><td className="py-1.5 text-muted">{kindName[g.kind]}</td></tr>
              ))}
              <tr><td className="py-1.5 font-medium">{season - 18} or earlier</td><td className="py-1.5">Seniors</td><td className="py-1.5 text-muted">Seniors</td></tr>
            </tbody>
          </table>
        </section>
        <div className="space-y-6">
          <section className="rounded-2xl border border-line p-6">
            <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Trial nights</h2>
            {trials.length ? (
              <ul className="mt-3 space-y-2 text-sm">
                {trials.map((t) => (
                  <li key={t.id}>
                    <span className="font-medium">{t.label}</span>
                    {t.birthYears.length > 0 && <span className="block text-muted">For players born {t.birthYears.slice().sort().join(', ')}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">Trial dates aren’t set yet. Register below and we’ll email you as soon as they are.</p>
            )}
          </section>
          <section className="rounded-2xl border border-line p-6">
            <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Club fees</h2>
            {fees.length ? (
              <ul className="mt-3 divide-y divide-line text-sm">
                {fees.map((f) => (
                  <li key={f.id} className="flex justify-between gap-4 py-2">
                    <span>{f.title}{f.ageRange && <span className="block text-xs text-muted">{f.ageRange}</span>}</span>
                    <span className="font-semibold">{f.price ? formatAUD(f.price) : "TBC"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">Fees for {season} will be shown in your offer.</p>
            )}
            <p className="mt-3 text-xs text-muted">Nothing to pay to trial. You only pay once you accept a place.</p>
          </section>
        </div>
      </div>
      <div className="container-x max-w-3xl py-14">
        <h2 className="mb-6 font-[family-name:var(--font-barlow)] text-3xl font-bold uppercase">Register for trials</h2>
        <JoinForm rules={rules} trials={trials} kids={await familyKids(p, me?.id)} prefill={contactPrefill(me)} />
      </div>
    </>
  )
}
