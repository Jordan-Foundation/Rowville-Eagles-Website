import { payload } from '@/lib/payload'
import { readTwilioRequest } from '@/lib/twilio-inbound'

/** Twilio delivery reports for launch texts (StatusCallback): delivered / undelivered / failed. */
export async function POST(req: Request) {
  const params = await readTwilioRequest(req)
  if (!params) return new Response('Forbidden', { status: 403 })
  const sid = params.MessageSid ?? params.SmsSid
  const status = (params.MessageStatus ?? params.SmsStatus ?? '').toLowerCase()
  if (!sid || !['delivered', 'undelivered', 'failed'].includes(status)) return new Response('ok')
  const p = await payload()
  const { docs } = await p.find({ collection: 'users', where: { 'launch.smsSid': { equals: sid } }, limit: 10, depth: 0, overrideAccess: true })
  for (const u of docs) await p.update({ collection: 'users', id: u.id, overrideAccess: true, context: { skipWelcome: true }, data: { launch: { ...(u.launch ?? {}), smsStatus: status === 'delivered' ? 'delivered' : 'failed' } } })
  await p.update({ collection: 'message-log', where: { providerId: { equals: sid } }, data: { status: status === 'delivered' ? 'sent' : 'failed', ...(status !== 'delivered' ? { error: `Twilio: ${status}${params.ErrorCode ? ` (${params.ErrorCode})` : ''}` } : {}) }, overrideAccess: true }).catch(() => null)
  return new Response('ok')
}
