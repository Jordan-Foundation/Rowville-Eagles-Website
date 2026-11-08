'use client'

import { useSyncExternalStore } from 'react'

/** Cart lives in the browser only (display data). Prices are always re-checked on the server at checkout. */
export type CartItem = { productId: number; slug: string; name: string; size: string; quantity: number; price: number }

const KEY = 'refc-cart-v1'
const EVENT = 'refc-cart'
const EMPTY: CartItem[] = []
let cache: { raw: string | null; items: CartItem[] } = { raw: null, items: EMPTY }

function read(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw !== cache.raw) cache = { raw, items: raw ? (JSON.parse(raw) as CartItem[]) : EMPTY }
    return cache.items
  } catch {
    return EMPTY
  }
}

function write(items: CartItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* storage unavailable — cart lasts for this page view only */
    cache = { raw: null, items }
  }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

/** For the account sync (CartSync): read and replace the whole cart. */
export const readCart = () => (typeof window === 'undefined' ? EMPTY : read())
export const replaceCart = (items: CartItem[]) => write(items)
export const CART_EVENT = EVENT

/** Two carts as one: same item and size → the larger quantity. */
export function mergeCarts(a: CartItem[], b: CartItem[]): CartItem[] {
  const out = [...a]
  for (const item of b) {
    const i = out.findIndex((x) => x.productId === item.productId && x.size === item.size)
    if (i === -1) out.push(item)
    else out[i] = { ...out[i], quantity: Math.min(20, Math.max(out[i].quantity, item.quantity)) }
  }
  return out
}

export function useCart() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY)
  const same = (a: CartItem, b: Pick<CartItem, 'productId' | 'size'>) => a.productId === b.productId && a.size === b.size
  return {
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    subtotal: items.reduce((n, i) => n + i.quantity * i.price, 0),
    add(item: CartItem) {
      const existing = items.find((i) => same(i, item))
      write(existing ? items.map((i) => (same(i, item) ? { ...i, quantity: Math.min(20, i.quantity + item.quantity) } : i)) : [...items, item])
    },
    setQuantity(item: CartItem, quantity: number) {
      write(quantity <= 0 ? items.filter((i) => !same(i, item)) : items.map((i) => (same(i, item) ? { ...i, quantity: Math.min(20, quantity) } : i)))
    },
    clear: () => write([]),
  }
}
