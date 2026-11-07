import { currentUser } from '@/lib/auth'
import { payload } from '@/lib/payload'
import { siteUrl } from '@/lib/payments'
import { billingMode, billingPortalUrl } from '@/academy/pdr/billing/stripe'
import { ownsPlayer } from '@/academy/pdr/billing/subscribe'
import type { Participant } from '@/payload-types'

/** "Manage plan": Stripe's billing portal (change plan, update card, cancel at period end). */
export async function GET(req: Request) {
  const player = Number(new URL(req.url).searchParams.get('player'))
  const user = await currentUser()
  if (!user) return Response.redirect(`${siteUrl()}/login?next=${encodeURIComponent(`/foundation-plus/billing?player=${player}`)}`, 302)
  const p = await payload()
  const kid = (await p.findByID({ collection: 'participants', id: player, depth: 0, overrideAccess: true, disableErrors: true })) as Participant | null
  if (!ownsPlayer(kid, user)) return new Response('Not found', { status: 404 })
  const back = `${siteUrl()}/foundation-plus/${player}`
  if (billingMode() !== 'stripe') return Response.redirect(`${back}?billing=unavailable`, 302)
  try {
    return Response.redirect(await billingPortalUrl(p, user, back), 302)
  } catch (e) {
    p.logger.error({ err: e, msg: 'Opening the Stripe billing portal failed' })
    return Response.redirect(`${back}?billing=error`, 302)
  }
}
