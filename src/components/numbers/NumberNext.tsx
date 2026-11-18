'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** After an RFA term / Eagles registration is paid: go on to "Pick your number" (after a moment, so the confirmation is seen and tracked). */
export function NumberNext({ kids }: { kids: { id: number; name: string }[] }) {
  const router = useRouter()
  useEffect(() => {
    if (kids.length !== 1) return
    const t = setTimeout(() => router.push(`/account/players/${kids[0].id}/number`), 2500)
    return () => clearTimeout(t)
  }, [kids, router])
  return (
    <div className="mt-6 rounded-2xl border-2 border-accent bg-accent/10 p-5 text-left" data-number-next>
      <p className="font-semibold">Next: pick {kids.map((k) => k.name).join(' and ')}’s shirt number</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {kids.map((k) => <Link key={k.id} href={`/account/players/${k.id}/number`} className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink">Pick {k.name}’s number →</Link>)}
      </div>
    </div>
  )
}
