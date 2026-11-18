import webpush from 'web-push'
import type { Payload } from 'payload'
import { siteUrl } from '../lib/payments'

/**
 * Web push (coach portal). The keys are made once and kept in the database, so nothing needs setting up.
 * iPhones only receive these when the portal is added to the home screen (Apple's rule).
 */
export async function pushKeys(p: Payload) {
  const g = (await p.findGlobal({ slug: 'push-keys', overrideAccess: true, depth: 0 })) as { publicKey?: string | null; privateKey?: string | null }
  if (g.publicKey && g.privateKey) return { publicKey: g.publicKey, privateKey: g.privateKey }
  const k = webpush.generateVAPIDKeys()
  await p.updateGlobal({ slug: 'push-keys', data: { publicKey: k.publicKey, privateKey: k.privateKey }, overrideAccess: true })
  return k
}

/** Save this device for the signed-in user (the same device again just updates). */
export async function saveSubscription(p: Payload, userId: number, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, device?: string) {
  if (!/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error('Not a valid notification subscription')
  const { docs } = await p.find({ collection: 'push-subscriptions', where: { endpoint: { equals: sub.endpoint } }, limit: 1, depth: 0, overrideAccess: true })
  const data = { user: userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, device: (device ?? '').slice(0, 120) }
  if (docs[0]) await p.update({ collection: 'push-subscriptions', id: docs[0].id, data, overrideAccess: true })
  else await p.create({ collection: 'push-subscriptions', data, overrideAccess: true })
}

export async function removeSubscription(p: Payload, userId: number, endpoint: string) {
  await p.delete({ collection: 'push-subscriptions', where: { endpoint: { equals: endpoint }, user: { equals: userId } }, overrideAccess: true })
}

export const hasPush = async (p: Payload, userId: number) => (await p.count({ collection: 'push-subscriptions', where: { user: { equals: userId } }, overrideAccess: true })).totalDocs > 0

/** Send a notification to every device a user has turned on. Dead devices are removed. Returns how many it reached. */
export async function pushTo(p: Payload, userId: number, msg: { title: string; body: string; url: string; tag?: string; icon?: string }) {
  const { docs } = await p.find({ collection: 'push-subscriptions', where: { user: { equals: userId } }, limit: 20, depth: 0, overrideAccess: true })
  if (!docs.length) return 0
  const keys = await pushKeys(p)
  const mock = process.env.NODE_ENV !== 'production' && process.env.PUSH_MOCK === '1'
  let reached = 0
  for (const d of docs) {
    const payload = JSON.stringify({ ...msg, url: msg.url.startsWith('http') ? msg.url : `${siteUrl()}${msg.url}` })
    try {
      if (mock) p.logger.info(`[push mock] to=user:${userId} ${payload}`)
      else await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, { vapidDetails: { subject: siteUrl().startsWith('https://') ? siteUrl() : 'https://www.rowvilleeagles.com.au', ...keys }, TTL: 12 * 3600 })
      reached++
      await p.update({ collection: 'push-subscriptions', id: d.id, data: { lastSentAt: new Date().toISOString() }, overrideAccess: true })
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await p.delete({ collection: 'push-subscriptions', id: d.id, overrideAccess: true })
      else p.logger.error({ err: e, msg: 'Push failed' })
    }
  }
  return reached
}

/** Everyone in Management (admins and committee) who turned notifications on, on any of their devices. */
export async function pushStaff(p: Payload, msg: { title: string; body: string; url: string; tag?: string }) {
  const { docs: subs } = await p.find({ collection: 'push-subscriptions', limit: 500, depth: 0, overrideAccess: true, pagination: false, select: { user: true } })
  const userIds = [...new Set(subs.map((s) => (typeof s.user === 'object' ? s.user.id : s.user)))]
  if (!userIds.length) return 0
  const { docs: staff } = await p.find({ collection: 'users', where: { id: { in: userIds }, roles: { in: ['admin', 'committee'] } }, limit: 100, depth: 0, overrideAccess: true, pagination: false, select: { email: true } })
  let reached = 0
  for (const u of staff) reached += await pushTo(p, u.id, msg)
  return reached
}
