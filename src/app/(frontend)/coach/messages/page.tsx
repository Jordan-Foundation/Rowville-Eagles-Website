import type { Metadata } from 'next'
import { requireCoach } from '@/academy/portal'
import { payload } from '@/lib/payload'
import { coachFamilies, inbox } from '@/messaging/service'
import { startConversationAction } from '@/messaging/management-actions'
import { InboxList } from '@/components/messaging/InboxList'
import { AutoRefresh } from '@/components/messaging/AutoRefresh'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Messages', robots: { index: false } }

export default async function CoachMessages({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user, coach } = await requireCoach('/coach/messages')
  const { error } = await searchParams
  const p = await payload()
  const [items, families] = await Promise.all([inbox(p, { user, side: 'coach', coach }), coachFamilies(p, coach.id)])
  return (
    <div className="space-y-8">
      <AutoRefresh />
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">Messages</h1>
        <p className="mt-3 max-w-2xl text-muted">Families you coach. Your replies are texted to the parent from the Foundation Academy number (or emailed if they can’t get texts). Every message is kept and admins can see them all.</p>
      </div>
      {error === 'not-yours' && <p role="alert" className="border border-red-400/40 p-3 text-sm text-red-300">You can only message families you coach.</p>}
      {families.length > 0 && (
        <form action={startConversationAction} className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            Message a family
            <select name="account" required className="mt-1 block w-72 border border-line bg-black/40 px-3 py-2 text-sm">
              {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          <button className="bg-white px-4 py-2 text-sm font-semibold text-black">Open</button>
        </form>
      )}
      <InboxList items={items} base="/coach/messages" empty="No messages yet." />
    </div>
  )
}
