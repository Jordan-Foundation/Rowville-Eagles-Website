import { currentUser } from '@/lib/auth'
import { payload } from '@/lib/payload'

export const dynamic = 'force-dynamic'

type Item = { productId: number; slug: string; name: string; size: string; quantity: number; price: number }

/** Keep only well-formed cart lines (display data — prices are re-checked at checkout anyway). */
function clean(v: unknown): Item[] {
  if (!Array.isArray(v)) return []
  return v
    .slice(0, 50)
    .filter((i): i is Item => i && Number.isInteger(i.productId) && typeof i.slug === 'string' && typeof i.name === 'string' && typeof i.size === 'string' && Number.isFinite(i.price) && Number.isInteger(i.quantity) && i.quantity > 0)
    .map((i) => ({ productId: i.productId, slug: i.slug.slice(0, 120), name: i.name.slice(0, 200), size: i.size.slice(0, 40), quantity: Math.min(20, i.quantity), price: i.price }))
}

/** The logged-in family's saved shop cart. */
export async function GET() {
  const user = await currentUser()
  if (!user) return Response.json({ items: [] }, { status: 401 })
  const doc = await (await payload()).findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true, showHiddenFields: true, select: { savedCart: true } })
  return Response.json({ items: clean(doc.savedCart) }, { headers: { 'cache-control': 'private, no-store' } })
}

export async function PUT(req: Request) {
  const user = await currentUser()
  if (!user) return Response.json({ ok: false }, { status: 401 })
  const text = await req.text()
  if (text.length > 20_000) return Response.json({ ok: false }, { status: 413 })
  let items: Item[] = []
  try {
    items = clean(JSON.parse(text))
  } catch {
    return Response.json({ ok: false }, { status: 400 })
  }
  await (await payload()).update({ collection: 'users', id: user.id, data: { savedCart: items }, overrideAccess: true })
  return Response.json({ ok: true })
}
