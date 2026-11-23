import type { Metadata } from 'next'
import Link from 'next/link'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { formatDate } from '@/lib/format'
import { localYmd } from '@/lib/time'
import { siteUrl } from '@/lib/payments'
import { smsSegments } from '@/launch/render'
import { familyKids, launchSettings, plan, recipients, render, varsFor, type Filter } from '@/launch/service'
import type { User } from '@/payload-types'
import { BodyField, SmsField } from './TemplateEditor'
import { KeepSending } from './KeepSending'
import { cancelScheduleAction, followUpNowAction, saveTemplatesAction, sendLaunchAction, testAction } from './actions'

export const dynamic = 'force-dynamic'
export const maxDuration = 120
export const metadata: Metadata = { title: 'Portal launch', robots: { index: false } }

type Search = { mode?: string; team?: string; rfa?: string; batch?: string; family?: string; kind?: string; confirm?: string; when?: string; sending?: string; done?: string; error?: string }
const sel = 'min-h-10 border border-line bg-surface px-2 text-sm'
const btn = 'min-h-11 bg-white px-5 text-xs font-semibold uppercase tracking-[0.12em] text-black disabled:opacity-60'
const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : ((v as number | null | undefined) ?? null))

/** A weekday at 6:30pm (Melbourne): today if it's still before then on a weekday, otherwise the next weekday. */
function defaultWhen() {
  const now = new Date()
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getTime() + i * 86_400_000)
    const ymd = localYmd(d)
    const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay()
    if (dow === 0 || dow === 6) continue
    if (i === 0 && Number(new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', hour: '2-digit', hourCycle: 'h23' }).format(now)) >= 18) continue
    return `${ymd}T18:30`
  }
  return ''
}

/** Portal launch: who gets it, preview + test, send now or schedule, tracking, the reminder and the 1-on-1 follow-up. */
export default async function LaunchPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireManagement('/management/launch')
  const sp = await searchParams
  const p = await payload()
  const filter: Filter = { mode: sp.mode === 'not_activated' ? 'not_activated' : 'all', team: Number(sp.team) || null, rfa: sp.rfa === '1', batch: Number(sp.batch) || null }
  const [g, list, { docs: teams }, { docs: batches }] = await Promise.all([
    launchSettings(p),
    recipients(p, filter),
    p.find({ collection: 'teams', where: { type: { equals: 'rowville' }, archived: { not_equals: true } }, sort: 'name', limit: 200, depth: 0, overrideAccess: true, pagination: false, select: { name: true } }),
    p.find({ collection: 'import-batches', where: { status: { equals: 'imported' } }, sort: '-createdAt', limit: 50, depth: 0, overrideAccess: true, pagination: false, select: { fileName: true, createdAt: true } }),
  ])
  const all = filter.mode === 'all' && !filter.team && !filter.rfa && !filter.batch ? list : await recipients(p, {})
  const kids = await familyKids(p, [...new Set(list.map((u) => rel(u.familyAccount) ?? u.id))])
  const kidsOf = (u: User) => kids.get(rel(u.familyAccount) ?? u.id) ?? []
  const pl = await plan(p, filter)
  const run = g.run ?? {}
  // Preview with a real family (nothing is saved: the links are placeholders)
  const fam = all.find((u) => String(u.id) === sp.family) ?? all[0]
  const kind = sp.kind === 'followup' ? 'followup' : 'launch'
  const preview = fam ? render(g, kind, await varsFor(p, fam, { links: { activation: `${siteUrl()}/account/activate?invite=preview`, short: `${siteUrl()}/a/abc1234` } }), Boolean(fam.activated)) : null
  const qs = (extra: Record<string, string | number | null | undefined>) => {
    const u = new URLSearchParams()
    for (const [k, v] of Object.entries({ mode: filter.mode === 'not_activated' ? 'not_activated' : null, team: filter.team, rfa: filter.rfa ? 1 : null, batch: filter.batch, ...extra })) if (v !== null && v !== undefined && v !== '') u.set(k, String(v))
    return `/management/launch?${u}`
  }
  const problems = all.filter((u) => u.launch?.emailStatus === 'bounced' || u.launch?.emailStatus === 'failed' || u.launch?.smsStatus === 'failed' || u.launch?.followUpStatus === 'bounced')
  const activated = all.filter((u) => u.activated).length
  const hidden = (
    <>
      <input type="hidden" name="mode" value={filter.mode} />
      {filter.team && <input type="hidden" name="team" value={filter.team} />}
      {filter.rfa && <input type="hidden" name="rfa" value="1" />}
      {filter.batch && <input type="hidden" name="batch" value={filter.batch} />}
    </>
  )

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Portal launch</h1>
        <p className="mt-2 max-w-3xl text-muted">The launch email and text to every imported family: the new website, what it does, and how to add it to their phone. One email per parent (siblings together), one text per mobile. Each parent’s button is their own link to set a password.</p>
        <p className="mt-2 text-sm text-muted" data-launch-stats>{all.length} parents · {all.filter((u) => u.launch?.emailAt).length} sent the launch · {activated} activated · {all.filter((u) => u.launch?.followUpAt).length} sent the 1-on-1 follow-up</p>
      </div>
      {(sp.done || sp.error) && <p role={sp.error ? 'alert' : 'status'} className={`border p-3 text-sm ${sp.error ? 'border-red-400/40 text-red-200' : 'border-emerald-400/40 text-emerald-200'}`}>{sp.error ?? sp.done}</p>}
      {(sp.sending || run.status === 'sending') && <KeepSending />}
      {run.status === 'scheduled' && run.scheduledFor && (
        <form action={cancelScheduleAction} className="flex flex-wrap items-center gap-3 border border-amber-400/60 p-4 text-sm" data-scheduled>
          <span>Scheduled for <strong>{formatDate(run.scheduledFor, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}</strong> (starts on the hourly run after that time).</span>
          <button className="underline">Cancel schedule</button>
        </form>
      )}

      <section aria-label="Recipients" className="space-y-3">
        <h2 className="font-display text-2xl font-semibold uppercase">Recipients</h2>
        <form className="flex flex-wrap items-end gap-3 text-sm">
          <label className="grid gap-1 text-xs text-muted">Show<select name="mode" defaultValue={filter.mode} className={sel}><option value="all">All imported families</option><option value="not_activated">Not yet activated</option></select></label>
          <label className="grid gap-1 text-xs text-muted">Team<select name="team" defaultValue={filter.team ?? ''} className={sel}><option value="">Any team</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="flex items-center gap-2 pb-2"><input type="checkbox" name="rfa" value="1" defaultChecked={filter.rfa} /> RFA only</label>
          <label className="grid gap-1 text-xs text-muted">Import<select name="batch" defaultValue={filter.batch ?? ''} className={sel}><option value="">Any import</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.fileName} ({formatDate(b.createdAt, { day: 'numeric', month: 'short' })})</option>)}</select></label>
          <button className="min-h-10 border border-line px-4 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white">Filter</button>
        </form>
        <div className="max-h-[28rem] overflow-auto border border-line">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="sticky top-0 bg-surface text-xs text-muted"><tr>{['Parent', 'Players', 'Account', 'Launch email', 'Text', 'Reminder', '1-on-1 follow-up'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {list.map((u) => (
                <tr key={u.id} data-recipient={u.email}>
                  <td className="px-3 py-2">{u.firstName} {u.lastName}<span className="block text-xs text-muted">{u.email}{rel(u.familyAccount) ? ' · Parent 2' : ''}</span></td>
                  <td className="px-3 py-2 text-xs">{kidsOf(u).map((k) => k.name).join(', ')}</td>
                  <td className="px-3 py-2 text-xs" data-activated={u.activated ? 'yes' : 'no'}>{u.activated ? 'Activated' : 'Not yet'}</td>
                  <td className="px-3 py-2 text-xs" data-email-status={u.launch?.emailStatus ?? ''}>{u.launch?.emailAt ? `${u.launch.emailStatus ?? 'sent'} · ${formatDate(u.launch.emailAt, { day: 'numeric', month: 'short' })}` : u.launch?.unsubscribedAt ? 'Unsubscribed' : '—'}</td>
                  <td className="px-3 py-2 text-xs" data-sms-status={u.launch?.smsStatus ?? ''}>{u.launch?.smsStatus ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">{u.launch?.reminderAt ? formatDate(u.launch.reminderAt, { day: 'numeric', month: 'short' }) : '—'}</td>
                  <td className="px-3 py-2 text-xs" data-followup={u.launch?.followUpAt ? 'yes' : 'no'}>{u.launch?.followUpAt ? `${u.launch.followUpStatus ?? 'sent'} · ${formatDate(u.launch.followUpAt, { day: 'numeric', month: 'short' })}` : '—'}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={7} className="p-4 text-muted">No imported families match. <Link href="/management/players/import" className="underline">Import players</Link> first.</td></tr>}
            </tbody>
          </table>
        </div>
        {problems.length > 0 && (
          <div className="border border-red-400/40 p-4 text-sm" data-problems>
            <p className="font-semibold">Bounced or failed — fix their details in the player’s family record and send again</p>
            <ul className="mt-2 space-y-1">{problems.map((u) => <li key={u.id}>{u.firstName} {u.lastName} · {u.email} · {u.phone ?? 'no mobile'} — {[u.launch?.emailStatus === 'bounced' || u.launch?.emailStatus === 'failed' ? `email ${u.launch.emailStatus}` : null, u.launch?.smsStatus === 'failed' ? 'text failed' : null, u.launch?.followUpStatus === 'bounced' ? 'follow-up bounced' : null].filter(Boolean).join(', ')}</li>)}</ul>
          </div>
        )}
      </section>

      <section aria-label="Preview" className="space-y-3">
        <h2 className="font-display text-2xl font-semibold uppercase">Preview &amp; test</h2>
        <form className="flex flex-wrap items-end gap-3 text-sm">
          {hidden}
          <label className="grid gap-1 text-xs text-muted">Family<select name="family" defaultValue={fam?.id} className={sel}>{all.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} — {(kids.get(rel(u.familyAccount) ?? u.id) ?? []).map((k) => k.name).join(', ') || u.email}</option>)}</select></label>
          <label className="grid gap-1 text-xs text-muted">Message<select name="kind" defaultValue={kind} className={sel}><option value="launch">Launch email + text</option><option value="followup">1-on-1 follow-up</option></select></label>
          <button className="min-h-10 border border-line px-4 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white">Preview</button>
        </form>
        {preview && fam && (
          <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
            <div>
              <p className="text-sm">Subject: <strong data-preview-subject>{preview.subject}</strong></p>
              <iframe title="Email preview" srcDoc={preview.html} className="mt-2 h-[640px] w-full border border-line bg-white" sandbox="" />
            </div>
            <div className="space-y-3">
              {preview.sms && (
                <div className="border border-line p-3 text-sm" data-preview-sms>
                  <p className="text-xs uppercase tracking-wider text-muted">Text</p>
                  <p className="mt-1 whitespace-pre-wrap">{preview.sms}</p>
                  <p className="mt-2 text-xs text-muted">{smsSegments(preview.sms).length} characters · {smsSegments(preview.sms).segments} segment{smsSegments(preview.sms).segments === 1 ? '' : 's'}{smsSegments(preview.sms).unicode ? ' · Unicode' : ''}</p>
                </div>
              )}
              <form action={testAction}>
                <input type="hidden" name="family" value={fam.id} />
                <input type="hidden" name="kind" value={kind} />
                <button className={btn}>Send test to me</button>
                <p className="mt-1 text-xs text-muted">Email{kind === 'launch' ? ' and text' : ''} to you, with this family’s details. Nothing is recorded for the family.</p>
              </form>
            </div>
          </div>
        )}
      </section>

      <section aria-label="Send" className="space-y-3 border-2 border-amber-400/60 p-5">
        <h2 className="font-display text-2xl font-semibold uppercase">Send the launch</h2>
        <p className="text-sm text-muted">To the filtered recipients above who haven’t had it yet (parents already sent are skipped, as are unsubscribed parents and opted-out mobiles).</p>
        {sp.confirm ? (
          <form action={sendLaunchAction} className="space-y-3" aria-label="Confirm send">
            {hidden}
            <input type="hidden" name="confirm" value="yes" />
            <input type="hidden" name="when" value={sp.when ?? ''} />
            <p className="text-lg font-semibold" data-confirm-counts>{pl.emails} email{pl.emails === 1 ? '' : 's'} and {pl.texts} text{pl.texts === 1 ? '' : 's'} will go out {sp.when ? `at ${sp.when.replace('T', ' ')}` : 'now'}.</p>
            <div className="flex gap-3"><button className={btn} disabled={!pl.emails}>Yes, {sp.when ? 'schedule it' : 'send now'}</button><Link href={qs({})} className="self-center text-sm underline">Cancel</Link></div>
          </form>
        ) : (
          <div className="flex flex-wrap items-end gap-6">
            <form className="flex items-end gap-3">
              {hidden}
              <input type="hidden" name="confirm" value="1" />
              <button className={btn} disabled={!pl.emails}>Send now…</button>
            </form>
            <form className="flex flex-wrap items-end gap-3">
              {hidden}
              <input type="hidden" name="confirm" value="1" />
              <label className="grid gap-1 text-xs text-muted">Schedule for (Melbourne time)<input type="datetime-local" name="when" defaultValue={defaultWhen()} className={sel} /></label>
              <button className="min-h-11 border border-white px-5 text-xs font-semibold uppercase tracking-[0.12em]" disabled={!pl.emails}>Schedule…</button>
            </form>
            <p className="text-sm text-muted" data-plan>{pl.emails} email{pl.emails === 1 ? '' : 's'} · {pl.texts} text{pl.texts === 1 ? '' : 's'} waiting</p>
          </div>
        )}
      </section>

      <section aria-label="1-on-1 follow-up" className="space-y-3 border border-line p-5">
        <h2 className="font-display text-2xl font-semibold uppercase">1-on-1 follow-up</h2>
        <p className="text-sm text-muted">Goes automatically {g.followUpDays} days after each parent’s launch email, from 6:30pm{g.followUpPaused ? ' — currently paused' : ''}. Parents who haven’t opened their account get the “Open my account” section at the top. Email only.</p>
        <form action={followUpNowAction} className="flex flex-wrap items-center gap-3 text-sm">
          {hidden}
          <label className="flex items-center gap-2"><input type="checkbox" name="confirm" /> Send it now to the filtered parents who’ve had the launch but not the follow-up ({list.filter((u) => u.launch?.emailAt && !u.launch?.followUpAt && !u.launch?.unsubscribedAt).length})</label>
          <button className="min-h-10 border border-line px-4 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white">Send follow-up now</button>
        </form>
      </section>

      <section aria-label="Templates" id="templates" className="space-y-4">
        <h2 className="font-display text-2xl font-semibold uppercase">Messages</h2>
        <p className="text-sm text-muted">Merge fields: {'{{parent_first_name}} {{player_names}} {{player_numbers_list}} {{activation_link}} {{short_link}} {{portal_url}} {{club_phone}} {{unsubscribe_link}} {{one_on_one_hours}} {{book_link}}'}. Formatting: **bold**, *italic*, lines starting “- ” or “1. ”, and [[Button text|{'{{link}}'}]] on its own line for a button. The unsubscribe link is added to the footer of every email.</p>
        <form action={saveTemplatesAction} className="space-y-6" aria-label="Messages">
          <fieldset className="space-y-2 border border-line p-4">
            <legend className="px-1 font-semibold">Launch email</legend>
            <label className="grid gap-1 text-sm">Subject<input name="launchSubject" defaultValue={g.launchSubject} className="border border-line bg-surface p-2 text-sm" /></label>
            <BodyField name="launchBody" initial={g.launchBody} label="Launch email" />
          </fieldset>
          <fieldset className="space-y-2 border border-line p-4">
            <legend className="px-1 font-semibold">Launch text</legend>
            <SmsField name="launchSms" initial={g.launchSms} />
          </fieldset>
          <fieldset className="space-y-2 border border-line p-4">
            <legend className="px-1 font-semibold">1-on-1 follow-up email</legend>
            <label className="grid gap-1 text-sm">Subject<input name="followUpSubject" defaultValue={g.followUpSubject} className="border border-line bg-surface p-2 text-sm" /></label>
            <BodyField name="followUpBody" initial={g.followUpBody} label="Follow-up email" />
          </fieldset>
          <fieldset className="flex flex-wrap gap-6 border border-line p-4 text-sm">
            <legend className="px-1 font-semibold">Timing</legend>
            <label className="flex items-center gap-2"><input type="checkbox" name="reminderEnabled" defaultChecked={g.reminderEnabled} /> Reminder email (one only) to parents not activated after <input type="number" name="reminderDays" min={1} max={60} defaultValue={g.reminderDays} className="w-16 border border-line bg-surface px-2" /> days</label>
            <label className="flex items-center gap-2">Follow-up <input type="number" name="followUpDays" min={1} max={60} defaultValue={g.followUpDays} className="w-16 border border-line bg-surface px-2" /> days after the launch email</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="followUpPaused" defaultChecked={Boolean(g.followUpPaused)} /> Pause the automatic follow-up</label>
          </fieldset>
          <button className={btn}>Save messages</button>
        </form>
      </section>
    </div>
  )
}
