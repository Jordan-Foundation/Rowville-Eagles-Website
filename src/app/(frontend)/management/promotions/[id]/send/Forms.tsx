'use client'

import { useActionState, useState } from 'react'
import { OPT_OUT, SMS_MAX, type Audience } from '@/promotions/audience'
import { approveSendAction, saveSendAction, scheduleAction, type SendState } from './actions'

const input = 'mt-1 block w-full rounded-lg border border-line px-3 py-2'
const box = 'rounded-2xl border border-line p-4'
type Opts = { history: { key: string; label: string }[]; teams: { id: number; label: string }[]; years: number[] }
export type MessageValues = { channels: string[]; subject: string; message: string; smsText: string; ctaPath: string; defaultCta: string; brand: string }

const MEMBERSHIPS = [{ v: 'rowville', l: 'Rowville players' }, { v: 'rfa', l: 'RFA (Academy) players' }, { v: 'foundation-plus', l: 'Foundation+ members' }]

export function AudienceMessageForm({ id, a, m, opts, sender }: { id: number; a: Audience; m: MessageValues; opts: Opts; sender: string }) {
  const [state, action, pending] = useActionState<SendState, FormData>(saveSendAction, {})
  const [mode, setMode] = useState(a.mode)
  const [sms, setSms] = useState(m.smsText)
  const suffix = ` – ${sender}. ${OPT_OUT}`
  const check = (name: string, value: string | number, on: boolean, label: string) => (
    <label key={`${name}-${value}`} className="flex items-center gap-2 text-sm"><input type="checkbox" name={name} value={value} defaultChecked={on} /> {label}</label>
  )
  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="id" value={id} />
      <fieldset className="space-y-3">
        <legend className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">1. Who gets it</legend>
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          {(['all', 'filter', 'picked'] as const).map((x) => (
            <label key={x} className="flex items-center gap-2"><input type="radio" name="mode" value={x} checked={mode === x} onChange={() => setMode(x)} /> {x === 'all' ? 'All families' : x === 'filter' ? 'Families matching…' : 'Only families I pick'}</label>
          ))}
        </div>
        {mode === 'filter' && (
          <>
            <p className="text-xs text-muted">Within a box any tick counts; when you tick in several boxes, a family must match each of them.</p>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className={box}><h3 className="mb-2 font-semibold">Membership</h3>{MEMBERSHIPS.map((x) => check('memberships', x.v, (a.memberships ?? []).includes(x.v), x.l))}</div>
              <div className={box}><h3 className="mb-2 font-semibold">Player born in</h3><div className="grid grid-cols-3 gap-1 sm:grid-cols-4">{opts.years.map((y) => check('birthYears', y, (a.birthYears ?? []).includes(y), String(y)))}</div></div>
              <div className={`${box} max-h-72 overflow-y-auto`}><h3 className="mb-2 font-semibold">Has booked or bought</h3>{opts.history.map((x) => check('history', x.key, (a.history ?? []).includes(x.key), x.label))}</div>
              <div className={`${box} max-h-72 overflow-y-auto`}><h3 className="mb-2 font-semibold">Team</h3>{opts.teams.length ? opts.teams.map((t) => check('teams', t.id, (a.teams ?? []).includes(t.id), t.label)) : <p className="text-sm text-muted">No teams.</p>}</div>
            </div>
          </>
        )}
        {mode !== 'all' && (
          <label className="block text-sm font-semibold">{mode === 'picked' ? 'Family account emails' : 'Also include (optional)'}
            <textarea name="emails" rows={3} defaultValue={a.emails ?? ''} placeholder={'parent@example.com\nanother@example.com'} className={input} />
          </label>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">2. The message</legend>
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <label className="flex items-center gap-2"><input type="checkbox" name="channels" value="email" defaultChecked={m.channels.includes('email')} /> Email</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="channels" value="sms" defaultChecked={m.channels.includes('sms')} /> Text message</label>
          <label className="flex items-center gap-2">Sent as
            <select name="brand" defaultValue={m.brand} className="rounded-lg border border-line px-2 py-1 font-normal"><option value="academy">Foundation Academy</option><option value="club">Rowville Eagles FC</option></select>
          </label>
        </div>
        <p className="text-xs text-muted">Only families who said yes to offers by email/text get messages (checked again at the moment it sends). Untick both to just give the discount without a message.</p>
        <label className="block text-sm font-semibold">Email subject<input name="subject" defaultValue={m.subject} maxLength={120} placeholder="e.g. 20% off winter holiday camps" className={input} /></label>
        <label className="block text-sm font-semibold">Email message<textarea name="message" rows={5} defaultValue={m.message} maxLength={3000} placeholder="A couple of friendly sentences. The offer, what it’s on, dates and a Book now button are added for you." className={input} /></label>
        <label className="block text-sm font-semibold">Button goes to<input name="ctaPath" defaultValue={m.ctaPath} placeholder={m.defaultCta} className={input} /></label>
        <label className="block text-sm font-semibold">Text message
          <textarea name="smsText" rows={3} value={sms} onChange={(e) => setSms(e.target.value)} maxLength={SMS_MAX} placeholder="e.g. 20% off holiday camps for Rowville families this week — book at rowvilleeagles.com.au/programs" className={input} />
          <span className="mt-1 block text-xs font-normal text-muted">{sms.length + suffix.length} characters incl. “{suffix.trim()}” (added automatically){sms.length + suffix.length > 160 ? ' — over 160 is sent as 2+ texts' : ''}</span>
        </label>
      </fieldset>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Saving…' : 'Save & preview'}</button>
    </form>
  )
}

export function SendButtons({ id, families, email, sms, scheduledFor }: { id: number; families: number; email: number; sms: number; scheduledFor: string | null }) {
  const [sendState, send, sending] = useActionState<SendState, FormData>(approveSendAction, {})
  const [schedState, schedule, scheduling] = useActionState<SendState, FormData>(scheduleAction, {})
  const msg = (s: SendState) => (s.ok || s.error) && <p role={s.error ? 'alert' : 'status'} className={`text-sm ${s.error ? 'text-red-700' : 'text-emerald-800'}`}>{s.error ?? s.ok}</p>
  return (
    <div className="space-y-4">
      <form action={send} onSubmit={(e) => { if (!confirm(`Send now? ${families} families get the discount; ${email} emails and ${sms} texts go out.`)) e.preventDefault() }}>
        <input type="hidden" name="id" value={id} />
        <button disabled={sending || !!sendState.ok} className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{sending ? 'Sending…' : 'Approve & send now'}</button>
      </form>
      {msg(sendState)}
      {!sendState.ok && (
        <form action={schedule} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={id} />
          <label className="text-sm font-semibold">Or send on<input type="date" name="date" className="mt-1 block rounded-lg border border-line px-3 py-2" /></label>
          <button disabled={scheduling} className="rounded-full border border-line px-5 py-2 text-sm font-semibold">Schedule (about 6am)</button>
          {scheduledFor && <button name="cancel" value="1" className="rounded-full border border-line px-5 py-2 text-sm">Cancel schedule</button>}
        </form>
      )}
      {msg(schedState)}
    </div>
  )
}
