import { payload } from '@/lib/payload'
import { siteUrl } from '@/lib/payments'
import { createInvite } from '@/lib/invites'

export const dynamic = 'force-dynamic'

/** Short links in the launch text (rowvilleeagles.com.au/a/<code>) → the parent's activation link (or sign in). */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const p = await payload()
  const user = /^[A-Za-z0-9]{4,12}$/.test(code) ? (await p.find({ collection: 'users', where: { 'launch.shortCode': { equals: code } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] : null
  if (!user) return Response.redirect(`${siteUrl()}/account/activate?expired=1`, 303)
  if (user.activated) return Response.redirect(`${siteUrl()}/login?next=${encodeURIComponent('/account/app')}`, 303)
  if (!user.launch?.shortCodeExpires || new Date(user.launch.shortCodeExpires) < new Date()) return Response.redirect(`${siteUrl()}/account/activate?expired=1&code=${code}`, 303)
  const token = await createInvite(p, { userId: user.id, email: user.email, purpose: 'create-account', ttlDays: 14 })
  return Response.redirect(`${siteUrl()}/account/activate?invite=${token}&next=/account/app`, 303)
}
