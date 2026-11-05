'use client'

import { useRouter } from 'next/navigation'

type Group = { label: string; teams: { slug: string; name: string }[] }

export function TeamSelect({ groups, value }: { groups: Group[]; value?: string }) {
  const router = useRouter()
  return (
    <label className="block w-full max-w-md">
      <span className="mb-2 block text-sm font-medium text-white/80">Select a team</span>
      <span className="relative block">
      <select
        value={value ?? ''}
        onChange={(e) => router.push(e.target.value ? `/fixtures?team=${e.target.value}` : '/fixtures', { scroll: false })}
        className="w-full cursor-pointer appearance-none rounded-xl border border-white/20 bg-white/10 px-4 py-3.5 pr-12 text-lg font-semibold text-white backdrop-blur outline-none transition hover:border-white/40 focus:border-accent"
      >
        <option value="" className="text-black">All teams</option>
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label} className="text-black">
            {g.teams.map((t) => (
              <option key={t.slug} value={t.slug} className="text-black">
                {t.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2" aria-hidden>
        <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </svg>
      </span>
    </label>
  )
}
