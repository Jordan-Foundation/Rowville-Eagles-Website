'use client'

import { useEffect, useState } from 'react'
import { removePushAction, savePushAction } from '@/app/(frontend)/coach/summaries/actions'

const toKey = (b64: string) => {
  const s = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(s)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

/** "Turn on notifications" for this phone (session-summary reminders and other coach alerts). */
export function PushToggle({ publicKey, compact = false, label = 'Get a notification when session summaries are due.' }: { publicKey: string; compact?: boolean; label?: string }) {
  const [state, setState] = useState<'checking' | 'unsupported' | 'ios-install' | 'off' | 'on' | 'blocked' | 'busy'>('checking')
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    ;(async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return setState(ios && !standalone ? 'ios-install' : 'unsupported')
      if (Notification.permission === 'denied') return setState('blocked')
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      setState(sub ? 'on' : 'off')
    })().catch(() => setState('unsupported'))
  }, [])
  const turnOn = async () => {
    setState('busy'); setMsg(null)
    try {
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }))
      await navigator.serviceWorker.ready
      if ((await Notification.requestPermission()) !== 'granted') return setState('blocked')
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) })
      const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      const r = await savePushAction(j, navigator.userAgent.slice(0, 120))
      if ('error' in r && r.error) { setMsg(r.error); return setState('off') }
      setState('on')
    } catch {
      setMsg('This browser didn’t allow notifications.'); setState('off')
    }
  }
  const turnOff = async () => {
    setState('busy')
    const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription()
    if (sub) { await removePushAction(sub.endpoint); await sub.unsubscribe() }
    setState('off')
  }
  if (state === 'checking') return null
  if (compact && state === 'on') return null
  const box = 'border border-line p-4 text-sm'
  return (
    <div className={box} data-push={state}>
      {state === 'on' && <p>🔔 Notifications are on for this phone. <button type="button" onClick={turnOff} className="underline">Turn off</button></p>}
      {(state === 'off' || state === 'busy') && <p className="flex flex-wrap items-center gap-3"><span>{label}</span><button type="button" onClick={turnOn} disabled={state === 'busy'} className="min-h-10 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-black disabled:opacity-60">Turn on notifications</button></p>}
      {state === 'ios-install' && <p>To get notifications on iPhone: open this site in Safari → Share → <strong>Add to Home Screen</strong>, open the portal from your home screen, then come back here and turn them on.</p>}
      {state === 'blocked' && <p>Notifications are blocked for this site — allow them in your phone’s settings for this browser, then reload.</p>}
      {state === 'unsupported' && !compact && <p>This browser can’t show notifications — you’ll still get the email.</p>}
      {msg && <p role="alert" className="mt-2 text-red-300">{msg}</p>}
    </div>
  )
}
