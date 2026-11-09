import Link from 'next/link'
import type { ReactNode } from 'react'

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : typeof v === 'number' ? v : null)

/** A family or player name that opens their Management page (plain text when there's no account / player record). */
export function PersonLink({ kind, of, children, className = '' }: { kind: 'family' | 'player'; of: unknown; children: ReactNode; className?: string }) {
  const id = idOf(of)
  if (!id) return <span className={className}>{children}</span>
  return <Link href={`/management/${kind === 'family' ? 'families' : 'players'}/${id}`} className={`underline decoration-white/30 underline-offset-2 hover:decoration-current ${className}`}>{children}</Link>
}
