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

const GUEST_TTL = 5 * 60_000
// Pages that can log someone in without the login form — always re-check after them
const LOGIN_PAGES = /\/(login|account\/activate|foundation-plus\/(start|join|subscribe)|checkout\/success|academy\/1-on-1\/booked)/

function readHint(): { me: Me; fresh: boolean } {
  try {
    const raw = window.localStorage.getItem(HINT)
    if (raw === null) return { me: undefined, fresh: false }
    if (raw.startsWith('guest')) return { me: null, fresh: Date.now() - Number(raw.split(':')[1] ?? 0) < GUEST_TTL }
    return { me: JSON.parse(raw) as { firstName?: string }, fresh: false }
  } catch {
    return { me: undefined, fresh: false }
  }
}

function writeHint(v: Me) {
  try {
    if (v === undefined) window.localStorage.removeItem(HINT)
    else window.localStorage.setItem(HINT, v === null ? `guest:${Date.now()}` : JSON.stringify({ firstName: v.firstName ?? '' }))
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
    const hint = readHint() // remembered answer first (no flash), then confirm with the server
    me = hint.me
    window.addEventListener('refc-auth', () => {
      writeHint(undefined)
      void load()
    })
    // Visitors who aren't logged in (checked in the last 10 minutes) skip the check; logging in re-checks at once
    const fromLogin = (() => { try { return LOGIN_PAGES.test(new URL(document.referrer).pathname) } catch { return false } })()
    if (!hint.fresh || fromLogin) void load()
    queueMicrotask(emit)
  }
  return () => listeners.delete(cb)
}

export function useMe(): Me {
  return useSyncExternalStore(subscribe, () => me, () => undefined)
}
