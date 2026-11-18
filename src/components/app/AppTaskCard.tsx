'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { appInstalledAction, appPushAction, snoozeAppAction } from '@/app/(frontend)/account/app/actions'
import { isStandalone } from './device'

/**
 * Homepage task: "Get the … app" with progress (Install app / Turn on notifications). Shown until both are done;
 * "Remind me later" hides it for 7 days. Opening the portal from the home screen records the install automatically.
 */
export function AppTaskCard({ appName, installed: wasInstalled, push: wasPush, show }: { appName: string; installed: boolean; push: boolean; show: boolean }) {
  const [installed, setInstalled] = useState(wasInstalled)
  const [push, setPush] = useState(wasPush)
  useEffect(() => {
    if (!wasInstalled && isStandalone()) {
      setInstalled(true)
      appInstalledAction().catch(() => null)
    }
    if (!wasPush && 'serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
      navigator.serviceWorker.getRegistration().then(async (reg) => {
        const sub = await reg?.pushManager.getSubscription()
        if (!sub) return
        const r = await appPushAction(sub.toJSON() as never, navigator.userAgent.slice(0, 120))
        if ('ok' in r) setPush(true)
      }).catch(() => null)
    }
  }, [wasInstalled, wasPush])
  if (!show || (installed && push)) return null
  const step = (done: boolean, label: string) => (
    <li className={`flex items-center gap-2 ${done ? 'text-emerald-300' : 'text-muted'}`} data-done={done ? 'yes' : 'no'}>
      <span aria-hidden="true" className={`grid h-5 w-5 place-items-center rounded-full border text-[11px] ${done ? 'border-emerald-400 bg-emerald-400/20' : 'border-line'}`}>{done ? '✓' : ''}</span>
      {label}{done ? <span className="sr-only"> (done)</span> : null}
    </li>
  )
  return (
    <section className="mt-6 rounded-xl border-2 border-accent bg-accent/10 px-5 py-4" data-app-card aria-labelledby="app-card-h">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="app-card-h" className="font-semibold">Get the {appName} app</h2>
          <p className="mt-1 text-sm text-muted">Session reminders, instant changes and cancellations, team updates and messages — straight to your phone.</p>
          <ul className="mt-3 flex flex-wrap gap-4 text-sm">
            {step(installed, 'Install app')}
            {step(push, 'Turn on notifications')}
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/account/app" className="inline-flex min-h-11 items-center text-sm rounded-full bg-brand px-6 py-3 font-semibold text-white hover:brightness-110 disabled:opacity-60 [[data-brand=academy]_&]:rounded-none [[data-brand=academy]_&]:bg-white [[data-brand=academy]_&]:uppercase [[data-brand=academy]_&]:tracking-[0.18em] [[data-brand=academy]_&]:text-black">{installed ? 'Turn on notifications' : 'Get the app'}</Link>
          <form action={snoozeAppAction}><button className="text-sm text-muted underline">Remind me later</button></form>
        </div>
      </div>
    </section>
  )
}
