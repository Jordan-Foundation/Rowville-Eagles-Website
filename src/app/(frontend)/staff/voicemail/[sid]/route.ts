import { currentUser } from '@/lib/auth'
import { hasRole } from '@/access'
import { fetchRecording } from '@/lib/twilio'
import { siteUrl } from '@/lib/payments'

/** Play a voicemail (admins/committee only) — streamed from Twilio so its link is never shared. */
export async function GET(_req: Request, { params }: { params: Promise<{ sid: string }> }) {
  const { sid } = await params
  const user = await currentUser()
  if (!user) return Response.redirect(`${siteUrl()}/login?next=/staff/voicemail/${encodeURIComponent(sid)}`, 302)
  if (!hasRole(user as never, 'admin', 'committee')) return new Response('Not allowed', { status: 403 })
  const res = await fetchRecording(sid)
  if (!res?.body) return new Response('Recording not found (it may not be ready yet — try again in a minute)', { status: 404 })
  return new Response(res.body, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'private, no-store' } })
}
