import { redirect } from 'next/navigation'
import { financeOrNull } from '@/finance/access'
import { checkState, connect } from '@/finance/gmail'
import { payload } from '@/lib/payload'

export const dynamic = 'force-dynamic'

/** Google sends the admin back here after they allow read-only access. */
export async function GET(req: Request) {
  const user = await financeOrNull()
  if (!user) return new Response('Admins only', { status: 403 })
  const u = new URL(req.url)
  const code = u.searchParams.get('code')
  const state = u.searchParams.get('state') ?? ''
  let msg: string
  if (u.searchParams.get('error')) msg = `error=${encodeURIComponent(`Google: ${u.searchParams.get('error')}`)}`
  else if (!code || !checkState(state, user.id)) msg = 'error=That%20sign-in%20link%20expired%20%E2%80%94%20try%20again.'
  else {
    try {
      const email = await connect(await payload(), code)
      msg = `done=${encodeURIComponent(`Connected ${email ?? 'the inbox'} (read-only). Receipts are checked every 3 hours.`)}`
    } catch (e) {
      msg = `error=${encodeURIComponent(e instanceof Error ? e.message : 'Couldn’t connect.')}`
    }
  }
  redirect(`/management/finance/settings?${msg}`)
}
