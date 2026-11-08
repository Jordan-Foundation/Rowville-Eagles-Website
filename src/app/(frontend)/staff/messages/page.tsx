import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { hasRole } from '@/access'
import { payload } from '@/lib/payload'
import { inbox } from '@/messaging/service'
import { InboxList } from '@/components/messaging/InboxList'
import { AutoRefresh } from '@/components/messaging/AutoRefresh'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Messages', robots: { index: false } }

export default async function StaffMessages({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await currentUser()
  if (!user || !hasRole(user, 'admin', 'committee')) redirect('/login?next=/staff/messages')
  const filter = (await searchParams).filter === 'unassigned' ? 'unassigned' : 'all'
  const p = await payload()
  const items = await inbox(p, { user, side: 'staff' }, { filter })
  const unassigned = filter === 'all' ? items.filter((i) => !i.conv.account).length : items.length
  return (
    <div className="container-x py-14">
      <AutoRefresh />
      <p className="eyebrow !text-brand">Staff</p>
      <h1 className="mt-2 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Messages</h1>
      <p className="mt-2 max-w-2xl text-muted">Every conversation with families — texts to the Foundation Academy number, portal messages, and coach replies.</p>
      <div className="mt-6 flex gap-2 text-sm">
        <Link href="/staff/messages" className={`px-4 py-2 ${filter === 'all' ? 'bg-ink text-surface' : 'border border-line'}`}>All</Link>
        <Link href="/staff/messages?filter=unassigned" className={`px-4 py-2 ${filter === 'unassigned' ? 'bg-ink text-surface' : 'border border-line'}`}>Unassigned{unassigned ? ` (${unassigned})` : ''}</Link>
      </div>
      <div className="mt-6"><InboxList items={items} base="/staff/messages" empty="No messages yet." /></div>
    </div>
  )
}
