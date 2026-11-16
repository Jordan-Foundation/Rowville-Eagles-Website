import { financeOrNull } from '@/finance/access'
import { authUrl, gmailConfigured } from '@/finance/gmail'

export const dynamic = 'force-dynamic'

/** Admin clicks “Connect Gmail” → Google’s sign-in (read-only access). */
export async function GET() {
  const user = await financeOrNull()
  if (!user) return new Response('Admins only', { status: 403 })
  if (!gmailConfigured()) return Response.redirect(new URL('/management/finance/settings?error=Add%20GOOGLE_CLIENT_ID%20and%20GOOGLE_CLIENT_SECRET%20in%20Vercel%20first.', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'), 302)
  return Response.redirect(authUrl(user.id), 302)
}
