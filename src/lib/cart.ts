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
