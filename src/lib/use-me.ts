'use client'

import { useEffect, useState } from 'react'

/** Lightweight client check of who's logged in (re-checks after login/logout events). */
export function useMe() {
  const [me, setMe] = useState<{ firstName?: string } | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch('/api/users/me', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : { user: null }))
        .then((d) => alive && setMe(d.user ?? null))
        .catch(() => alive && setMe(null))
    load()
    window.addEventListener('refc-auth', load)
    return () => {
      alive = false
      window.removeEventListener('refc-auth', load)
    }
  }, [])
  return me
}
