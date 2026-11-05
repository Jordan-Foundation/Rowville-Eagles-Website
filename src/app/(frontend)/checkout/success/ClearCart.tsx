'use client'
import { useEffect } from 'react'
import { useCart } from '@/lib/cart'

export function ClearCart() {
  const { clear, count } = useCart()
  useEffect(() => {
    if (count > 0) clear()
  }, [count, clear])
  return null
}
