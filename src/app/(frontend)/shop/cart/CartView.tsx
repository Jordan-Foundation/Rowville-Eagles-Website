'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useCart } from '@/lib/cart'
import { formatAUD } from '@/lib/format'
import { Field, Input, inputCls } from '@/components/forms/Field'
import { checkoutCart, type CartState } from './actions'

export function CartView({ postageFee, pickupNote, cancelled }: { postageFee: number; pickupNote: string; cancelled: boolean }) {
  const cart = useCart()
  const [fulfilment, setFulfilment] = useState<'pickup' | 'post'>('pickup')
  const [state, action] = useActionState<CartState, FormData>(checkoutCart, {})
  const postage = fulfilment === 'post' ? postageFee : 0

  if (cart.items.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface-2 p-10 text-center">
        <p className="text-lg">Your cart is empty.</p>
        <Link href="/shop" className="mt-4 inline-block font-semibold text-brand underline">Browse the shop</Link>
      </div>
    )
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_24rem]">
      <div>
        {cancelled && <p className="mb-6 rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm">Payment was cancelled — nothing was charged.</p>}
        <ul className="divide-y divide-line border-y border-line">
          {cart.items.map((i) => (
            <li key={`${i.productId}-${i.size}`} className="flex flex-wrap items-center justify-between gap-4 py-5">
              <div>
                <Link href={`/shop/${i.slug}`} className="font-semibold hover:text-brand">{i.name}</Link>
                <p className="text-sm text-muted">Size {i.size} · {formatAUD(i.price)}</p>
              </div>
              <div className="flex items-center gap-4">
                <select
                  aria-label={`Quantity of ${i.name}`}
                  value={i.quantity}
                  onChange={(e) => cart.setQuantity(i, Number(e.target.value))}
                  className="rounded-lg border border-line bg-surface px-3 py-2"
                >
                  {Array.from({ length: 10 }, (_, n) => n + 1).map((n) => <option key={n}>{n}</option>)}
                </select>
                <span className="w-20 text-right font-semibold">{formatAUD(i.price * i.quantity)}</span>
                <button type="button" onClick={() => cart.setQuantity(i, 0)} className="text-sm text-muted hover:text-red-600">Remove</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <form action={action} className="h-fit space-y-4 rounded-2xl border border-line bg-surface-2 p-7 lg:sticky lg:top-24">
        <input type="hidden" name="items" value={JSON.stringify(cart.items.map(({ productId, size, quantity }) => ({ productId, size, quantity })))} />
        <Input label="Full name" name="name" autoComplete="name" required />
        <Input label="Email" name="email" type="email" autoComplete="email" required />
        <Input label="Mobile" name="phone" type="tel" autoComplete="tel" />
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Delivery</legend>
          <div className="grid gap-2">
            {(['pickup', 'post'] as const).map((f) => (
              <label key={f} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm has-[:checked]:border-brand">
                <input type="radio" name="fulfilment" value={f} checked={fulfilment === f} onChange={() => setFulfilment(f)} className="mt-0.5" />
                <span>
                  <span className="font-medium">{f === 'pickup' ? 'Pick up at the club — free' : `Post — ${formatAUD(postageFee)}`}</span>
                  {f === 'pickup' && <span className="block text-muted">{pickupNote}</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {fulfilment === 'post' && (
          <Field label="Postal address">
            <textarea name="address" rows={3} required autoComplete="street-address" className={inputCls} />
          </Field>
        )}
        <dl className="space-y-1 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatAUD(cart.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Postage</dt><dd>{formatAUD(postage)}</dd></div>
          <div className="flex justify-between pt-2 text-lg font-bold"><dt>Total</dt><dd>{formatAUD(cart.subtotal + postage)}</dd></div>
        </dl>
        {state.error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">{state.error}</p>}
        <Pay />
        <p className="text-center text-xs text-muted">Secure payment by Stripe · Paid to Rowville Foundation Academy</p>
      </form>
    </div>
  )
}

function Pay() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="w-full rounded-full bg-accent px-6 py-4 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60">
      {pending ? 'Starting secure checkout…' : 'Checkout'}
    </button>
  )
}
