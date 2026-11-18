/** Which install steps to show (pure — unit tested). */
export type Device = 'iphone-safari' | 'iphone-other' | 'android' | 'desktop'

export function detectDevice(ua: string, maxTouchPoints = 0): Device {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|Instagram|FBAN|FBAV|Line\/|Snapchat|; wv\)/.test(ua) ? 'iphone-other' : 'iphone-safari'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

/** Is the page running as the installed app? */
export const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)

const toKey = (b64: string) => {
  const s = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from([...atob(s)].map((c) => c.charCodeAt(0)))
}

export async function registerSw() {
  if (!('serviceWorker' in navigator)) return null
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }))
  await navigator.serviceWorker.ready
  return reg
}

/** Ask for permission and subscribe this device. */
export async function subscribePush(publicKey: string): Promise<{ sub?: PushSubscriptionJSON; denied?: boolean; unsupported?: boolean }> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return { unsupported: true }
  const reg = await registerSw()
  if (!reg) return { unsupported: true }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { denied: perm === 'denied' }
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }))
  return { sub: sub.toJSON() }
}

/** Already subscribed on this device? */
export async function currentPush(): Promise<'on' | 'off' | 'denied' | 'unsupported'> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}
