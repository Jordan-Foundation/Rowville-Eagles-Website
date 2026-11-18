'use client'

import { useEffect, useState } from 'react'
import { appInstalledAction, appPushAction } from '@/app/(frontend)/account/app/actions'
import { currentPush, detectDevice, isStandalone, registerSw, subscribePush, type Device } from './device'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
type PushState = 'checking' | 'on' | 'off' | 'denied' | 'unsupported' | 'busy'

const btn = 'inline-flex min-h-12 items-center justify-center text-sm rounded-full bg-brand px-6 py-3 font-semibold text-white hover:brightness-110 disabled:opacity-60 [[data-brand=academy]_&]:rounded-none [[data-brand=academy]_&]:bg-white [[data-brand=academy]_&]:uppercase [[data-brand=academy]_&]:tracking-[0.18em] [[data-brand=academy]_&]:text-black'

/* Simple illustrations of the buttons people need to find */
const ShareIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M12 3v12M8 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" strokeLinecap="round" />
  </svg>
)
const AddIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M12 8v8M8 12h8" strokeLinecap="round" />
  </svg>
)
const DotsIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
  </svg>
)
const BellIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Z" strokeLinejoin="round" /><path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
)
const HomeIcon = ({ src }: { src: string }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt="" className="h-9 w-9 rounded-lg" />
)

function Steps({ items }: { items: { icon: React.ReactNode; text: React.ReactNode }[] }) {
  return (
    <ol className="space-y-3">
      {items.map((s, i) => (
        <li key={i} className="flex items-center gap-4 border border-line p-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center border border-line">{s.icon}</span>
          <span className="text-sm"><strong className="mr-1">{i + 1}.</strong>{s.text}</span>
        </li>
      ))}
    </ol>
  )
}

/**
 * The "Get the app" walkthrough: works out the device, shows the right install steps, then asks for notification
 * permission straight after explaining why. Records both steps on the account.
 */
export function InstallGuide({ appName, icon, publicKey, installed: installedBefore, pushBefore }: { appName: string; icon: string; publicKey: string; installed: boolean; pushBefore: boolean }) {
  const [device, setDevice] = useState<Device | null>(null)
  const [standalone, setStandalone] = useState(false)
  const [installed, setInstalled] = useState(installedBefore)
  const [prompt, setPrompt] = useState<InstallEvent | null>(null)
  const [push, setPush] = useState<PushState>('checking')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    setDevice(detectDevice(navigator.userAgent, navigator.maxTouchPoints))
    const sa = isStandalone()
    setStandalone(sa)
    if (sa) {
      setInstalled(true)
      appInstalledAction().catch(() => null)
    }
    registerSw().catch(() => null)
    currentPush().then(setPush).catch(() => setPush('unsupported'))
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      appInstalledAction().catch(() => null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // Already on for this device (e.g. turned on earlier): make sure the account knows
  useEffect(() => {
    if (push !== 'on' || pushBefore) return
    ;(async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) await appPushAction(sub.toJSON() as never, navigator.userAgent.slice(0, 120))
    })().catch(() => null)
  }, [push, pushBefore])

  const install = async () => {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    setPrompt(null)
    if (outcome === 'accepted') {
      setInstalled(true)
      await appInstalledAction()
    }
  }

  const turnOn = async () => {
    setPush('busy')
    setMsg(null)
    try {
      const r = await subscribePush(publicKey)
      if (r.unsupported) return setPush('unsupported')
      if (!r.sub) return setPush(r.denied ? 'denied' : 'off')
      const saved = await appPushAction(r.sub as never, navigator.userAgent.slice(0, 120))
      if ('error' in saved && saved.error) {
        setMsg(saved.error)
        return setPush('off')
      }
      setPush('on')
    } catch {
      setMsg('This browser didn’t allow notifications.')
      setPush('off')
    }
  }

  if (!device) return null
  const iphone = device === 'iphone-safari' || device === 'iphone-other'
  // iPhone: notifications only work inside the installed app
  const canAskPush = iphone ? standalone : true
  const pushDone = push === 'on'

  return (
    <div className="space-y-8" data-device={device} data-installed={installed ? 'yes' : 'no'} data-push={push}>
      <ol className="flex gap-3 text-xs uppercase tracking-[0.2em]" aria-label="Progress">
        <li className={`border px-3 py-2 ${installed ? 'border-emerald-400 text-emerald-300' : 'border-line text-muted'}`}>{installed ? '✓ ' : '1. '}Install app</li>
        <li className={`border px-3 py-2 ${pushDone ? 'border-emerald-400 text-emerald-300' : 'border-line text-muted'}`}>{pushDone ? '✓ ' : '2. '}Turn on notifications</li>
      </ol>

      {/* Step 1: install */}
      {!installed && (
        <section className="space-y-4" aria-labelledby="install-h">
          <h2 id="install-h" className="font-display text-2xl font-semibold uppercase">1. Add {appName} to your home screen</h2>
          {device === 'iphone-other' && (
            <div className="border border-amber-400/50 bg-amber-400/10 p-4 text-sm" data-step="open-safari">
              <p className="font-semibold">Open this page in Safari first</p>
              <p className="mt-1">iPhones can only add apps to the Home Screen from Safari. Copy this link and paste it into Safari:</p>
              <p className="mt-3 flex flex-wrap gap-2">
                <code className="border border-line px-2 py-1">{typeof window !== 'undefined' ? window.location.href.split('?')[0] : ''}</code>
                <button type="button" className="underline" onClick={() => navigator.clipboard?.writeText(window.location.href.split('?')[0]).then(() => setMsg('Link copied — now open Safari and paste it.'))}>Copy link</button>
              </p>
            </div>
          )}
          {iphone && (
            <Steps
              items={[
                { icon: <ShareIcon />, text: <>Tap the <strong>Share</strong> button at the bottom of Safari (top on iPad).</> },
                { icon: <AddIcon />, text: <>Scroll down and tap <strong>Add to Home Screen</strong>.</> },
                { icon: <span className="text-xs font-bold text-sky-500">Add</span>, text: <>Tap <strong>Add</strong> in the top corner.</> },
                { icon: <HomeIcon src={icon} />, text: <>Open <strong>{appName}</strong> from your Home Screen, log in if asked, and come back to this page to turn on notifications.</> },
              ]}
            />
          )}
          {(device === 'android' || device === 'desktop') && (
            <>
              {prompt ? (
                <button type="button" onClick={install} className={btn} data-install-button>Install app</button>
              ) : (
                <Steps
                  items={
                    device === 'android'
                      ? [
                          { icon: <DotsIcon />, text: <>In Chrome, tap the menu <strong>⋮</strong> at the top right.</> },
                          { icon: <AddIcon />, text: <>Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>) → <strong>Install</strong>.</> },
                          { icon: <HomeIcon src={icon} />, text: <>Open <strong>{appName}</strong> from your home screen.</> },
                        ]
                      : [
                          { icon: <AddIcon />, text: <>Click the <strong>install</strong> icon at the right of the address bar (Chrome or Edge), or the menu → <strong>Install {appName}</strong>.</> },
                          { icon: <HomeIcon src={icon} />, text: <>Open <strong>{appName}</strong> from your apps or dock.</> },
                        ]
                  }
                />
              )}
              <p className="text-sm text-muted">Already installed it? <button type="button" className="underline" onClick={() => { setInstalled(true); appInstalledAction().catch(() => null) }}>I’ve installed the app</button></p>
            </>
          )}
        </section>
      )}

      {/* Step 2: notifications — explain why, then ask */}
      {!pushDone && (
        <section className="space-y-4" aria-labelledby="push-h">
          <h2 id="push-h" className="font-display text-2xl font-semibold uppercase">{installed ? '2. ' : 'Then: '}Turn on notifications</h2>
          <p className="text-muted">We’ll only notify you about things that matter: session reminders, changes or cancellations (like weather), team updates, new camp and 1-on-1 times, messages from coaches, and your player’s progress. You can turn any of these off in your account preferences.</p>
          {!canAskPush ? (
            <p className="border border-line p-4 text-sm" data-step="install-first">On iPhone, notifications can only be turned on <strong>inside the app</strong>. {installed ? <>Open <strong>{appName}</strong> from your Home Screen, then tap “Turn on notifications”.</> : <>Add it to your Home Screen (above), open it from there, then tap “Turn on notifications”.</>}</p>
          ) : push === 'denied' ? (
            <div className="border border-amber-400/50 bg-amber-400/10 p-4 text-sm" data-step="denied">
              <p className="font-semibold">Notifications are blocked on this device</p>
              {iphone ? (
                <p className="mt-1">Open your iPhone’s <strong>Settings</strong> → <strong>Notifications</strong> → <strong>{appName}</strong> → turn on <strong>Allow Notifications</strong>. Then come back here and reload.</p>
              ) : device === 'android' ? (
                <p className="mt-1">Press and hold the <strong>{appName}</strong> icon → <strong>App info</strong> → <strong>Notifications</strong> → turn them on. (In Chrome: menu ⋮ → <strong>Settings</strong> → <strong>Site settings</strong> → <strong>Notifications</strong> → allow this site.) Then reload this page.</p>
              ) : (
                <p className="mt-1">Click the lock or settings icon at the left of the address bar → <strong>Notifications</strong> → <strong>Allow</strong>, then reload this page.</p>
              )}
            </div>
          ) : push === 'unsupported' ? (
            <p className="border border-line p-4 text-sm">This browser can’t show notifications. {iphone ? 'Make sure you’ve opened the app from your Home Screen (iOS 16.4 or later).' : 'Try Chrome, Edge or Safari.'} You’ll still get emails.</p>
          ) : (
            <button type="button" onClick={turnOn} disabled={push === 'busy' || push === 'checking'} className={btn} data-push-button>
              <span className="mr-2"><BellIcon /></span>Turn on notifications
            </button>
          )}
        </section>
      )}

      {installed && pushDone && (
        <p role="status" className="border border-emerald-400/50 bg-emerald-400/10 p-4 font-semibold" data-app-done>
          You’re all set — {appName} is on your phone and notifications are on. 🎉
        </p>
      )}
      {msg && <p role="alert" className="text-sm text-amber-200">{msg}</p>}
    </div>
  )
}
