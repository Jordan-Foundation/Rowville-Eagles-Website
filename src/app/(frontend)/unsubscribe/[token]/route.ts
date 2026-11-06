import { payload } from '@/lib/payload'
import { recordConsent } from '@/lib/consent'
import { CONSENT_WORDING } from '@/lib/consent-wording'
import { readUnsubscribeToken } from '@/lib/unsubscribe-token'
import { siteUrl } from '@/lib/payments'

export const dynamic = 'force-dynamic'

/** Unsubscribe immediately (idempotent). Returns whether the user was found. */
async function unsubscribe(token: string, req: Request) {
  const parsed = readUnsubscribeToken(token)
  if (!parsed) return false
  const p = await payload()
  const user = await p.findByID({ collection: 'users', id: parsed.userId, depth: 0, overrideAccess: true, disableErrors: true })
  if (!user) return false
  if (user.marketingEmail) {
    await recordConsent(
      p,
      user,
      { channel: 'marketing_email', action: 'withdrawn', wording: CONSENT_WORDING.unsubscribeLink, source: 'unsubscribe_link', basis: 'express' },
      { ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(), userAgent: req.headers.get('user-agent') },
    )
  }
  return true
}

/** Link clicked in the email footer. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const ok = await unsubscribe((await params).token, req)
  return Response.redirect(`${siteUrl()}/unsubscribed${ok ? '' : '?invalid=1'}`, 303)
}

/** RFC 8058 one-click unsubscribe (the "Unsubscribe" button Gmail/Outlook show at the top of the email). */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const ok = await unsubscribe((await params).token, req)
  return new Response(ok ? 'Unsubscribed' : 'Invalid link', { status: ok ? 200 : 400 })
}
