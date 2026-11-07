import Link from 'next/link'
import type { ServerProps } from 'payload'
import { hasRole } from '@/access'
import { setupChecklist } from '@/lib/setup-checklist'

/** Admin dashboard: how many setup steps are left. */
export async function SetupCard({ payload, user }: ServerProps) {
  if (!user || !hasRole(user as never, 'admin', 'committee')) return null
  const ticked = ((await payload.findGlobal({ slug: 'setup-progress', depth: 0, overrideAccess: true })).ticked as Record<string, boolean>) ?? {}
  const items = (await setupChecklist(payload, ticked)).flatMap((g) => g.items)
  const todo = items.filter((i) => i.status === 'todo').length
  return (
    <div style={{ marginBottom: 16, padding: '14px 18px', border: '1px solid var(--theme-elevation-150)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderLeft: `4px solid ${todo ? '#f59e0b' : '#22c55e'}` }}>
      <span><strong>Setup checklist</strong> — {todo ? `${todo} thing${todo === 1 ? '' : 's'} for you to do` : 'all done for now'}.</span>
      <Link href="/admin/setup" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }}>Open checklist</Link>
    </div>
  )
}
