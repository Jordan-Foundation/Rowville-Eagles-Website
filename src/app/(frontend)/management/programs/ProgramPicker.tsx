'use client'

import { useRouter } from 'next/navigation'

/** Phones: pick the program from a dropdown instead of scrolling the tabs. */
export function ProgramPicker({ programs, current }: { programs: { key: string; label: string }[]; current: string }) {
  const router = useRouter()
  return (
    <label className="block text-xs text-muted sm:hidden">
      Program
      <select aria-label="Program" value={current} onChange={(e) => router.push(`/management/programs?program=${e.target.value}`)} className="mt-1 block min-h-11 w-full border border-line bg-black/40 px-3 text-base text-ink">
        {programs.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
    </label>
  )
}
