'use client'

import { useState } from 'react'

type Plan = { key: 'free' | 'standard' | 'premium'; name: string; monthly: number; yearly: number; blurb: string; points: string[] }
const aud = (n: number) => (n === 0 ? '$0' : n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: n % 1 ? 2 : 0 }))

export function Pricing({ plans, sibling, trialDays, live }: { plans: Plan[]; sibling: number; trialDays: number; live: boolean }) {
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  return (
    <div>
      <div role="radiogroup" aria-label="Billing period" className="mx-auto flex w-fit border border-[#0b0b0c]">
        {(['monthly', 'yearly'] as const).map((p) => (
          <button key={p} role="radio" aria-checked={period === p} onClick={() => setPeriod(p)} className={`fp-label px-5 py-2.5 text-xs ${period === p ? 'bg-[#0b0b0c] text-white' : 'text-[#0b0b0c]'}`}>
            {p === 'monthly' ? 'Monthly' : 'Yearly — save more'}
          </button>
        ))}
      </div>
      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {plans.map((pl) => {
          const price = period === 'monthly' ? pl.monthly : pl.yearly
          const premium = pl.key === 'premium'
          return (
            <div key={pl.key} className={`relative flex flex-col border p-7 ${premium ? 'border-[#0b0b0c] bg-[#0b0b0c] text-white' : 'border-[#0b0b0c]/20 bg-white'}`}>
              {premium && <span className="fp-label absolute -top-3 left-7 bg-white px-2 py-1 text-[10px] text-[#0b0b0c] ring-1 ring-[#0b0b0c]">{trialDays} days free</span>}
              <p className="fp-label text-xs opacity-70">{pl.name}</p>
              <p className="fp-heading mt-3 text-5xl">{aud(price)}<span className="ml-1 text-base not-italic opacity-60">{pl.key === 'free' ? '' : period === 'monthly' ? '/month' : '/year'}</span></p>
              <p className="mt-2 text-sm opacity-75">{pl.blurb}</p>
              <ul className="mt-6 flex-1 space-y-2 text-sm">
                {pl.points.map((x) => <li key={x} className="flex gap-2"><span aria-hidden>+</span>{x}</li>)}
              </ul>
              <a href={!live ? '#free-month' : pl.key === 'free' ? '/foundation-plus/join' : pl.key === 'premium' && period === 'monthly' ? '#free-month' : `/foundation-plus/subscribe?plan=${pl.key}_${period === 'monthly' ? 'month' : 'year'}`} className={`fp-label mt-8 block px-5 py-3.5 text-center text-xs transition ${premium ? 'bg-white text-[#0b0b0c] hover:bg-white/85' : 'bg-[#0b0b0c] text-white hover:bg-[#0b0b0c]/85'}`}>
                {!live ? 'Join the waitlist' : pl.key === 'premium' ? (period === 'monthly' ? 'Start your free month' : 'Choose Premium yearly') : pl.key === 'free' ? 'Start free' : 'Choose Standard'}
              </a>
            </div>
          )
        })}
      </div>
      {sibling > 0 && <p className="mt-6 text-center text-sm opacity-70">2nd and later players in the same family save {sibling}%. Prices in AUD, including GST.</p>}
    </div>
  )
}
