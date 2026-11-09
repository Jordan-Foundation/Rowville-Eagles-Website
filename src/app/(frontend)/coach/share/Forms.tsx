'use client'

import { useActionState, useState } from 'react'
import { createShareAction, linkAction, type ShareState } from './actions'

const field = 'mt-1 block w-full border border-line bg-black/40 px-3 py-2.5 text-sm'

export function ShareForm({ casual, weekly, holdChoices, defaultHold }: { casual: { value: string; label: string; group: string }[]; weekly: { value: string; label: string }[]; holdChoices: number[]; defaultHold: number }) {
  const [state, action, pending] = useActionState<ShareState, FormData>(createShareAction, {})
  const [mode, setMode] = useState<'casual' | 'term'>(casual.length || !weekly.length ? 'casual' : 'term')
  const [slot, setSlot] = useState('')
  const [mobile, setMobile] = useState('')
  const [copied, setCopied] = useState(false)
  const groups = [...new Set(casual.map((c) => c.group))]
  return (
    <form action={action} className="space-y-5">
      <div className="flex flex-wrap gap-2 text-sm" role="radiogroup" aria-label="Type of booking">
        {(['casual', 'term'] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => { setMode(m); setSlot('') }} className={`border px-3 py-1.5 ${mode === m ? 'border-white bg-white text-black' : 'border-line'}`}>
            {m === 'casual' ? `One session (${casual.length} open)` : `Whole term, weekly (${weekly.length} open)`}
          </button>
        ))}
      </div>
      <label className="block text-sm">
        Time
        <select name="slot" required value={slot} onChange={(e) => setSlot(e.target.value)} className={field}>
          <option value="">Choose one of your open times…</option>
          {mode === 'casual'
            ? groups.map((g) => (
                <optgroup key={g} label={g}>
                  {casual.filter((c) => c.group === g).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </optgroup>
              ))
            : weekly.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">Parent first name<input name="firstName" required className={field} /></label>
        <label className="block text-sm">Parent last name<input name="lastName" required className={field} /></label>
        <label className="block text-sm">Email<input name="email" type="email" required className={field} /></label>
        <label className="block text-sm">Mobile <span className="text-muted">(optional — to text the link)</span><input name="mobile" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="0412 345 678" className={field} /></label>
        <label className="block text-sm">Player first name <span className="text-muted">(optional)</span><input name="playerFirstName" className={field} /></label>
        <label className="block text-sm">
          Hold the time for
          <select name="holdHours" defaultValue={String(defaultHold)} className={field}>
            {holdChoices.map((h) => <option key={h} value={h}>{h === 0 ? 'Don’t hold — just send the link' : `${h} hours`}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-sm">Message <span className="text-muted">(optional — shown in the email and on the booking page)</span><textarea name="message" rows={2} maxLength={500} className={field} placeholder="Great to meet you today — here’s the time we talked about." /></label>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="viaEmail" defaultChecked /> Email the link</label>
        <label className={`flex items-center gap-2 ${mobile ? '' : 'text-muted'}`}><input type="checkbox" name="viaSms" defaultChecked disabled={!mobile} /> Text the link</label>
      </div>
      <button disabled={pending} className="bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-black disabled:opacity-50">{pending ? 'Sending…' : 'Create & send link'}</button>
      {state.error && <p role="alert" className="text-sm text-red-300">{state.error}</p>}
      {state.url && (
        <div role="status" className="border border-emerald-400/40 p-4 text-sm">
          <p className="text-emerald-200">{state.sent}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input readOnly value={state.url} aria-label="Booking link" className="min-w-0 flex-1 border border-line bg-black/40 px-3 py-2 text-xs" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(state.url!); setCopied(true) } catch { window.prompt('Copy this link', state.url!) } }} className="min-h-10 border border-line px-3 text-xs font-semibold uppercase tracking-[0.15em]">{copied ? 'Copied ✓' : 'Copy'}</button>
            <a href={`https://wa.me/${waNumber(mobile)}?text=${encodeURIComponent(`Here’s your link to book a Foundation Academy 1-on-1: ${state.url}`)}`} target="_blank" rel="noopener" className="min-h-10 border border-line px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.15em]">WhatsApp</a>
            <button type="button" onClick={() => navigator.share?.({ title: 'Book a 1-on-1', url: state.url! }).catch(() => {})} className="min-h-10 border border-line px-3 text-xs font-semibold uppercase tracking-[0.15em] sm:hidden">Share…</button>
          </div>
          <p className="mt-2 text-xs text-muted">The link can’t be shown again after you leave this page (it’s stored securely) — use Resend if you need it later.</p>
        </div>
      )}
    </form>
  )
}

/** wa.me wants the number in international form without "+" (empty opens WhatsApp's contact picker). */
const waNumber = (m: string) => {
  const d = m.replace(/\D/g, '')
  return /^04\d{8}$/.test(d) ? `61${d.slice(1)}` : /^614\d{8}$/.test(d) ? d : ''
}

export function LinkButtons({ id, canResend }: { id: number; canResend: boolean }) {
  const [state, action, pending] = useActionState<ShareState, FormData>(linkAction, {})
  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="id" value={id} />
      {canResend && <button name="do" value="resend" disabled={pending} className="border border-line px-3 py-1.5 text-xs font-semibold uppercase tracking-wider">Resend</button>}
      <button name="do" value="cancel" disabled={pending} className="border border-line px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-200">Cancel</button>
      {state.error && <p role="alert" className="w-full text-right text-xs text-red-300">{state.error}</p>}
      {state.sent && <p role="status" className="w-full text-right text-xs text-emerald-300">{state.sent}</p>}
    </form>
  )
}
