'use client'

import { useEffect } from 'react'
import { CART_EVENT, mergeCarts, readCart, replaceCart, type CartItem } from '@/lib/cart'
import { useMe } from '@/lib/use-me'

/**
 * Logged-in families: the shop cart is saved to their account, so it's there on their phone and computer.
 * On login the saved and local carts are merged; after that every change is saved (a moment later).
 */
export function CartSync() {
  const me = useMe()
  const loggedIn = Boolean(me)
  useEffect(() => {
    if (!loggedIn) return
    let stop = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let last = ''
    const save = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const body = JSON.stringify(readCart())
        if (body === last) return
        last = body
        void fetch('/shop/cart/saved', { method: 'PUT', credentials: 'include', headers: { 'content-type': 'application/json' }, body }).catch(() => {})
      }, 800)
    }
    void fetch('/shop/cart/saved', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<{ items: CartItem[] }>) : { items: [] }))
      .then(({ items }) => {
        if (stop) return
        const merged = mergeCarts(readCart(), items)
        last = JSON.stringify(items)
        if (JSON.stringify(merged) !== JSON.stringify(readCart())) replaceCart(merged)
        save()
        window.addEventListener(CART_EVENT, save)
      })
      .catch(() => {})
    return () => {
      stop = true
      clearTimeout(timer)
      window.removeEventListener(CART_EVENT, save)
    }
  }, [loggedIn])
  return null
}
