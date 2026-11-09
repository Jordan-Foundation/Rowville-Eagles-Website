import { redirect } from 'next/navigation'
import { requireCoach } from '@/academy/portal'
import { payload } from '@/lib/payload'
import { conversationFor } from '@/messaging/service'

export const dynamic = 'force-dynamic'

/** "Message" button on a roster: open (or start) the conversation with a family this coach coaches. */
export default async function OpenConversation({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const { coach } = await requireCoach('/coach/messages')
  const id = Number((await searchParams).account)
  const p = await payload()
  const account = id ? await p.findByID({ collection: 'users', id, depth: 0, overrideAccess: true, disableErrors: true }) : null
  if (!account) redirect('/coach/messages')
  const conv = await conversationFor(p, { account })
  if (!(conv.coaches ?? []).map((c) => (typeof c === 'object' ? c.id : c)).includes(coach.id)) redirect('/coach/messages?error=not-yours')
  redirect(`/coach/messages/${conv.id}`)
}
