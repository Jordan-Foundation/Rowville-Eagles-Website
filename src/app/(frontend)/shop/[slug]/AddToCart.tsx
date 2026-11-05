'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useCart } from '@/lib/cart'

export function AddToCart(props: { productId: number; slug: string; name: string; price: number; sizes: { size: string; soldOut: boolean }[] }) {
  const cart = useCart()
  const [size, setSize] = useState(props.sizes.length === 1 ? props.sizes[0].size : '')
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const needsSize = props.sizes.length > 0

  return (
    <div className="space-y-6">
      {needsSize && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Size</legend>
          <div className="flex flex-wrap gap-2">
            {props.sizes.map((s) => (
              <button
                key={s.size}
                type="button"
                disabled={s.soldOut}
                onClick={() => setSize(s.size)}
                aria-pressed={size === s.size}
                className={`min-w-12 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:line-through disabled:opacity-40 ${size === s.size ? 'border-brand bg-brand text-white' : 'border-line hover:border-brand'}`}
              >
                {s.size}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium" htmlFor="qty">Qty</label>
        <select id="qty" value={qty} onChange={(e) => setQty(Number(e.target.value))} className="rounded-lg border border-line bg-surface px-3 py-2">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}
        </select>
      </div>
      <button
        type="button"
        disabled={needsSize && !size}
        onClick={() => {
          cart.add({ productId: props.productId, slug: props.slug, name: props.name, size: size || 'One size', quantity: qty, price: props.price })
          setAdded(true)
        }}
        className="w-full rounded-full bg-accent px-6 py-4 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-50"
      >
        {needsSize && !size ? 'Select a size' : 'Add to cart'}
      </button>
      {added && (
        <p className="text-sm" role="status">
          Added ✓ <Link href="/shop/cart" className="font-semibold text-brand underline">View cart ({cart.count})</Link>
        </p>
      )}
    </div>
  )
}
