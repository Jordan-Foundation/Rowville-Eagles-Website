'use client'

import { useSyncExternalStore } from 'react'

/**
 * Who's logged in, for client components (header, forms). One shared check per page instead of one per component,
 * and the last answer is remembered in the browser so the header shows "My account" straight away instead of
 * flashing "Login" while the check runs. Re-checks after login/logout (the "refc-auth" event).
 */
type Me = { firstName?: string } | null | undefined
const HINT = 'refc-me'

let me: Me = undefined
let started = false
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function readHint(): Me {
  try {
    const raw = window.localStorage.getItem(HINT)
    if (raw === null) return undefined
    return raw === 'guest' ? null : (JSON.parse(raw) as { firstName?: string })
  } catch {
    return undefined
  }
}

function writeHint(v: Me) {
  try {
    if (v === undefined) window.localStorage.removeItem(HINT)
    else window.localStorage.setItem(HINT, v === null ? 'guest' : JSON.stringify({ firstName: v.firstName ?? '' }))
  } catch {
    /* storage blocked — the live check still works */
  }
}

function load() {
  if (inflight) return inflight
  inflight = fetch('/api/users/me', { credentials: 'include' })
    .then((r) => (r.ok ? r.json() : { user: null }))
    .then((d) => {
      me = d.user ? { firstName: d.user.firstName } : null
      writeHint(me)
    })
    .catch(() => {
      if (me === undefined) me = null
    })
    .finally(() => {
      inflight = null
      emit()
    })
  return inflight
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  if (!started) {
    started = true
    me = readHint() // remembered answer first (no flash), then confirm with the server
    window.addEventListener('refc-auth', () => {
      writeHint(undefined)
      void load()
    })
    void load()
    queueMicrotask(emit)
  }
  return () => listeners.delete(cb)
}

export function useMe(): Me {
  return useSyncExternalStore(subscribe, () => me, () => undefined)
}
