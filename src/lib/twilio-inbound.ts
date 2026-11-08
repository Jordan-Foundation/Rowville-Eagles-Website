import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { academyBrand } from '../academy/brand'
import { sendEmail } from './email'
import { emailLayout, esc } from './email-templates'
import { siteUrl } from './payments'
import { toE164 } from './sms'
import { validTwilioSignature } from './twilio'

/**
 * Webhooks from Twilio: check the signature and return the posted fields, or null if it isn't genuinely
 * from Twilio. Twilio signs the exact URL configured on the number, so we accept the public site URL
 * as well as the URL the request arrived on (they differ behind proxies).
 */
export async function readTwilioRequest(req: Request): Promise<Record<string, string> | null> {
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!token) return null
  const params: Record<string, string> = {}
  // POST (the default): fields in the body. GET (if chosen in Twilio): fields in the address, which is signed as a whole.
  const isGet = req.method === 'GET'
  if (isGet) {
    new URL(req.url).searchParams.forEach((v, k) => (params[k] = v))
  } else {
    const form = await req.formData().catch(() => null)
    if (!form) return null
    form.forEach((v, k) => {
      if (typeof v === 'string') params[k] = v
    })
  }
  const urls = signatureUrls(req.url, siteUrl(), req.headers.get('x-forwarded-host'))
  return validTwilioSignature(token, req.headers.get('x-twilio-signature'), urls, isGet ? {} : params) ? params : null
}

/**
 * Every form of the address Twilio may have signed: the public site address, the address the request
 * arrived on, and the forwarded host — each with and without the default port (Twilio includes ":443" for
 * some requests, such as the follow-up after a forwarded call, and not for others).
 */
export function signatureUrls(requestUrl: string, site: string, forwardedHost?: string | null) {
  const u = new URL(requestUrl)
  const path = `${u.pathname}${u.search}`
  const bases = [site.replace(/\/$/, ''), `${u.protocol}//${u.host}`, ...(forwardedHost ? [`https://${forwardedHost}`] : [])]
  const out = new Set<string>()
  for (const b of bases) {
    const x = new URL(b)
    const def = x.protocol === 'https:' ? '443' : '80'
    // …and with or without a trailing slash (an address entered as /twilio/voice/ is redirected here)
    const paths = [path, u.pathname.endsWith('/') ? path.replace(/\/(\?|$)/, '$1') : `${u.pathname}/${u.search}`]
    for (const pth of paths) {
      out.add(`${x.protocol}//${x.hostname}${x.port && x.port !== def ? `:${x.port}` : ''}${pth}`)
      out.add(`${x.protocol}//${x.hostname}:${x.port || def}${pth}`)
    }
  }
  return [...out]
}

/** Accounts whose mobile matches the number (a number can belong to two parents' accounts). */
export async function usersByPhone(payload: Payload, phone: string | undefined) {
  const e164 = toE164(phone)
  if (!e164) return []
  const { docs } = await payload.find({ collection: 'users', where: { phoneE164: { equals: e164 } }, limit: 5, depth: 0, overrideAccess: true })
  return docs as User[]
}

export const who = (users: User[], phone: string) =>
  users.length ? `${users.map((u) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email).join(' / ')} (${phone})` : phone

/** Prettier AU display: +61451525684 → 0451 525 684 */
export const localNumber = (e164: string) => (/^\+614\d{8}$/.test(e164) ? `0${e164.slice(3, 6)} ${e164.slice(6, 9)} ${e164.slice(9)}` : e164)

export async function emailAcademyInbox(payload: Payload, o: { subject: string; heading: string; intro: string; rows: [string, string][]; cta?: { label: string; href: string }; after?: string }) {
  const html = emailLayout('academy', [{ heading: o.heading, intro: o.intro, rows: o.rows, cta: o.cta, after: o.after }])
  await sendEmail(payload, { to: academyBrand.email, subject: o.subject, html, sender: 'academy' })
}

export const accountLinks = (users: User[]) => users.map((u) => `${siteUrl()}/admin/collections/users/${u.id}`).join(' ')
export { esc }

/** The address this request came in on (e.g. https://club.vercel.app), for absolute follow-up URLs in TwiML. */
export function requestOrigin(req: Request) {
  const host = req.headers.get('x-forwarded-host') || new URL(req.url).host
  const proto = req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '')
  return `${proto}://${host}`
}
