'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Time = { startsAt: string; day: string; time: string }

/** Choose the pack size, then tick that many times with this coach — any days across the break. */
export function PackPicker({ coachId, coachName, times, sizes, price, casual }: { coachId: number; coachName: string; times: Time[]; sizes: number[]; price: number; casual: number }) {
  const router = useRouter()
  const [size, setSize] = useState(sizes[0])
  const [picked, setPicked] = useState<string[]>([])
  const aud = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n)
  const days = [...new Set(times.map((t) => t.day))]
  const full = picked.length >= size
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-sm font-semibold">How many sessions?</legend>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Pack size">
          {sizes.map((n) => (
            <label key={n} className={`cursor-pointer border px-4 py-2 text-sm ${size === n ? 'border-white bg-white text-black' : 'border-line'}`}>
              <input type="radio" name="size" value={n} checked={size === n} onChange={() => { setSize(n); setPicked((p) => p.slice(0, n)) }} className="sr-only" />
              {n} sessions · {aud(n * price)}{casual > price ? ` (save ${aud(n * (casual - price))})` : ''}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">Choose {size} times with {coachName} <span className="font-normal text-muted">— {picked.length} of {size} chosen</span></legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {days.map((d) => (
            <div key={d} className="border border-line p-3">
              <p className="text-sm font-semibold">{d}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {times.filter((t) => t.day === d).map((t) => {
                  const on = picked.includes(t.startsAt)
                  return (
                    <label key={t.startsAt} className={`cursor-pointer border px-2 py-1 text-xs ${on ? 'border-white bg-white text-black' : 'border-line'} ${!on && full ? 'opacity-40' : ''}`}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        aria-label={`${d} ${t.time}`}
                        checked={on}
                        disabled={!on && full}
                        onChange={(e) => { const c = e.currentTarget.checked; setPicked((p) => (c ? [...p, t.startsAt] : p.filter((x) => x !== t.startsAt))) }}
                      />
                      {t.time}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      <button
        type="button"
        disabled={picked.length !== size}
        onClick={() => router.push(`/academy/1-on-1/book?mode=pack&coach=${coachId}&starts=${encodeURIComponent([...picked].sort().join(','))}`)}
        className="min-h-12 w-full bg-white px-6 text-sm font-semibold uppercase tracking-[0.18em] text-black disabled:opacity-40 sm:w-auto"
      >
        {picked.length === size ? `Continue · ${size} sessions · ${aud(size * price)}` : `Choose ${size - picked.length} more`}
      </button>
    </div>
  )
}
