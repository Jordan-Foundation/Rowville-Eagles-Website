'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { newReference, startCheckout } from '@/lib/payments'
import { allowedAudiences } from '@/lib/shop-access'

export type CartState = { error?: string }

type ClientItem = { productId: number; size: string; quantity: number }

/** All shop sales are paid to the Academy Stripe account. */
const SHOP_PAYEE = 'academy' as const

export async function checkoutCart(_prev: CartState, fd: FormData): Promise<CartState> {
  const s = (k: string) => String(fd.get(k) ?? '').trim()
  let clientItems: ClientItem[]
  try {
    clientItems = JSON.parse(s('items'))
    if (!Array.isArray(clientItems) || clientItems.length === 0 || clientItems.length > 30) throw new Error()
  } catch {
    return { error: 'Your cart is empty.' }
  }

  const contact = { name: s('name'), email: s('email').toLowerCase(), phone: s('phone') }
  const fulfilment = s('fulfilment') === 'post' ? 'post' : 'pickup'
  const shippingAddress = s('address')
  if (!contact.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) return { error: 'Please enter your name and a valid email.' }
  if (fulfilment === 'post' && shippingAddress.length < 10) return { error: 'Please enter a full postal address.' }

  const p = await payload()
  const settings = await p.findGlobal({ slug: 'site-settings' })
  const { user } = await p.auth({ headers: await headers() })
  const userId = user?.collection === 'users' ? user.id : undefined
  const audiences = await allowedAudiences(p, userId)

  // Re-price every line from the database — never trust client prices.
  const items = []
  for (const ci of clientItems) {
    const qty = Math.floor(Number(ci.quantity))
    if (!Number.isFinite(qty) || qty < 1 || qty > 20) return { error: 'Please check the quantities in your cart.' }
    const product = await p.findByID({ collection: 'products', id: ci.productId, depth: 0, disableErrors: true })
    if (!product || product.status !== 'active') return { error: 'An item in your cart is no longer available.' }
    if (!audiences.includes(product.audience)) return { error: `${product.name} is for registered players only — please log in, or remove it from your cart.` }
    const variants = product.variants ?? []
    const variant = variants.find((v) => v.size === ci.size)
    if (variants.length && !variant) return { error: `Please re-select a size for ${product.name}.` }
    if (variant && typeof variant.stock === 'number' && variant.stock < qty) {
      return { error: `Only ${variant.stock} left of ${product.name} (${variant.size}).` }
    }
    items.push({ product: product.id, name: product.name, size: variant?.size ?? 'One size', quantity: qty, unitPrice: product.price })
  }

  const subtotal = items.reduce((n, i) => n + i.unitPrice * i.quantity, 0)
  const postage = fulfilment === 'post' ? (settings.shop?.postageFee ?? 0) : 0
  const reference = newReference(SHOP_PAYEE)

  const order = await p.create({
    collection: 'orders',
    data: {
      reference,
      status: 'pending',
      payee: SHOP_PAYEE,
      account: userId,
      contact,
      items,
      subtotal,
      postage,
      total: subtotal + postage,
      fulfilment,
      shippingAddress: fulfilment === 'post' ? shippingAddress : undefined,
    },
  })

  let url: string
  try {
    const checkout = await startCheckout({
      payee: SHOP_PAYEE,
      kind: 'order',
      reference,
      email: contact.email,
      items: [
        ...items.map((i) => ({ name: i.name, description: `Size: ${i.size}`, unitAmount: i.unitPrice, quantity: i.quantity })),
        ...(postage ? [{ name: 'Postage', unitAmount: postage, quantity: 1 }] : []),
      ],
      cancelPath: '/shop/cart?cancelled=1',
    })
    if (checkout.sessionId) await p.update({ collection: 'orders', id: order.id, data: { stripeCheckoutId: checkout.sessionId } })
    url = checkout.url
  } catch (e) {
    await p.update({ collection: 'orders', id: order.id, data: { status: 'cancelled' } })
    p.logger.error(e)
    return { error: 'We couldn’t start the payment. Please try again shortly.' }
  }
  redirect(url)
}
