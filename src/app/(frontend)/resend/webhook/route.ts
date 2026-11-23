import { payload } from '@/lib/payload'
import { verifySvix } from '@/launch/resend-webhook'

/**
 * Resend delivery events (Resend → Webhooks → https://<site>/resend/webhook, events email.delivered and email.bounced,
 * signing secret in RESEND_WEBHOOK_SECRET). Marks the launch / follow-up email delivered or bounced.
 */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  const body = await req.text()
  if (!secret || !verifySvix({ secret, id: req.headers.get('svix-id'), timestamp: req.headers.get('svix-timestamp'), signature: req.headers.get('svix-signature'), body })) return new Response('Forbidden', { status: 403 })
  let evt: { type?: string; data?: { to?: string[] | string; subject?: string } }
  try {
    evt = JSON.parse(body)
  } catch {
    return new Response('Bad request', { status: 400 })
  }
  const status = evt.type === 'email.delivered' ? 'delivered' : evt.type === 'email.bounced' ? 'bounced' : null
  const to = (Array.isArray(evt.data?.to) ? evt.data?.to[0] : evt.data?.to)?.toLowerCase()
  if (!status || !to) return new Response('ok')
  const p = await payload()
  const { docs } = await p.find({ collection: 'users', where: { email: { equals: to } }, limit: 1, depth: 0, overrideAccess: true })
  const u = docs[0]
  const subject = evt.data?.subject ?? ''
  if (u?.launch) {
    const isFollow = u.launch.followUpSubject && subject === u.launch.followUpSubject
    const isLaunch = u.launch.emailSubject && (subject === u.launch.emailSubject || subject === `Reminder: ${u.launch.emailSubject}` || subject.replace(/^Reminder: /, '') === u.launch.emailSubject.replace(/^Reminder: /, ''))
    if (isFollow || isLaunch) {
      // A bounce always wins over a later "delivered" for the same address
      const current = isFollow ? u.launch.followUpStatus : u.launch.emailStatus
      if (!(current === 'bounced' && status === 'delivered')) await p.update({ collection: 'users', id: u.id, overrideAccess: true, context: { skipWelcome: true }, data: { launch: { ...u.launch, ...(isFollow ? { followUpStatus: status } : { emailStatus: status }) } } })
    }
  }
  return new Response('ok')
}
