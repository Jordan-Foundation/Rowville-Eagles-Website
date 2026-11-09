'use client'

import { useActionState, useState } from 'react'
import { newCalendarLink, saveAlerts, type SettingsState } from './settings-actions'

type Alerts = Record<'bookingEmail' | 'bookingText' | 'cancelEmail' | 'cancelText' | 'replyEmail' | 'replyText', boolean>

export function AlertSettings({ alerts, hasPhone }: { alerts: Alerts; hasPhone: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveAlerts, {})
  const rows: [string, keyof Alerts, keyof Alerts][] = [
    ['A family books with me', 'bookingEmail', 'bookingText'],
    ['A family cancels', 'cancelEmail', 'cancelText'],
    ['A parent sends me a message', 'replyEmail', 'replyText'],
  ]
  return (
    <form action={action} className="space-y-4">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted"><th className="py-2 font-medium">Tell me when…</th><th className="w-16 py-2 text-center font-medium">Email</th><th className="w-16 py-2 text-center font-medium">Text</th></tr></thead>
        <tbody className="divide-y divide-line">
          {rows.map(([label, e, t]) => (
            <tr key={label}>
              <td className="py-3">{label}</td>
              <td className="text-center"><input type="checkbox" name={e} defaultChecked={alerts[e]} aria-label={`${label} — email`} className="h-5 w-5" /></td>
              <td className="text-center">
                <input type="checkbox" name={t} defaultChecked={alerts[t]} disabled={!hasPhone} aria-label={`${label} — text`} className="h-5 w-5" />
                {/* No mobile yet: keep the text setting as it is (a disabled box isn't sent with the form) */}
                {!hasPhone && alerts[t] && <input type="hidden" name={t} value="on" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!hasPhone && <p className="text-xs text-muted">Add your mobile to your account to get texts.</p>}
      <div className="flex items-center gap-3">
        <button disabled={pending} className="min-h-11 bg-white px-5 text-sm font-semibold uppercase tracking-[0.12em] text-black disabled:opacity-60">{pending ? 'Saving…' : 'Save alerts'}</button>
        {state.saved && <p role="status" className="text-sm text-emerald-300">{state.saved}</p>}
        {state.error && <p role="alert" className="text-sm text-red-300">{state.error}</p>}
      </div>
    </form>
  )
}

export function CalendarLink({ url }: { url: string | null }) {
  const [copied, setCopied] = useState(false)
  if (!url)
    return (
      <form action={newCalendarLink}>
        <button className="min-h-11 bg-white px-5 text-sm font-semibold uppercase tracking-[0.12em] text-black">Get my calendar link</button>
      </form>
    )
  const webcal = url.replace(/^https?:/, 'webcal:')
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <a href={webcal} className="min-h-11 bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-black">Add to my phone calendar</a>
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true) } catch { window.prompt('Copy this link', url) } }} className="min-h-11 border border-line px-4 text-sm font-semibold">{copied ? 'Copied ✓' : 'Copy link'}</button>
      </div>
      <p className="break-all text-xs text-muted">{url}</p>
      <p className="text-xs text-muted">Google Calendar: Settings → Add calendar → From URL, and paste the link. Keep it private — anyone with it can see your timetable (first names only).</p>
      <form action={newCalendarLink}><button className="text-xs text-muted underline">Make a new link (the old one stops working)</button></form>
    </div>
  )
}
