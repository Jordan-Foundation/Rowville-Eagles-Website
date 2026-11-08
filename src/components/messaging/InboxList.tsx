import Link from 'next/link'
import type { Conversation } from '@/payload-types'

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '')

export function InboxList({ items, base, empty }: { items: { conv: Conversation; unread: boolean }[]; base: string; empty: string }) {
  if (!items.length) return <p className="border border-line p-6 text-sm text-muted">{empty}</p>
  return (
    <ul className="divide-y divide-line border border-line">
      {items.map(({ conv, unread }) => (
        <li key={conv.id}>
          <Link href={`${base}/${conv.id}`} className="flex items-start justify-between gap-4 p-5 transition hover:bg-black/5">
            <span className="min-w-0">
              <span className={`block ${unread ? 'font-bold' : 'font-semibold'}`}>
                {unread && <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-red-500 align-middle" aria-label="Unread" />}
                {conv.title}
                {!conv.account && <span className="ml-2 border border-amber-500/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600">Unassigned</span>}
              </span>
              <span className="mt-0.5 block truncate text-sm text-muted">{conv.lastPreview}</span>
            </span>
            <span className="shrink-0 text-xs text-muted">{fmt(conv.lastMessageAt)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
