import { NextResponse } from 'next/server'
import { payload } from '@/lib/payload'
import { bookPath, findShareLink } from '@/academy/share-links'

/** A coach's share link: open the booking with the coach and time chosen and the family's details filled in. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const p = await payload()
  const link = await findShareLink(p, token)
  if (!link) return NextResponse.redirect(new URL('/academy/1-on-1?link=expired', req.url))
  if (!link.openedAt) await p.update({ collection: 'academy-share-links', id: link.id, overrideAccess: true, data: { openedAt: new Date().toISOString() } })
  return NextResponse.redirect(new URL(bookPath(link, token), req.url))
}
