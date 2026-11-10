import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { emailLayout } from '@/lib/email-templates'
import { smsBody } from '@/promotions/audience'
import { announcementAudience, emailBlocks } from '@/academy/announcements'
import { announcementAction } from '../actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Announcement', robots: { index: false } }
const input = 'mt-1 block w-full border border-line bg-surface px-3 py-2 text-sm'

/** Preview (the real email and text), who it goes to, edit, approve & send — or don't send. */
export default async function AnnouncementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string; error?: string }> }) {
  const { id } = await params
  await requireManagement(`/management/announcements/${id}`)
  const sp = await searchParams
  const p = await payload()
  const a = await p.findByID({ collection: 'announcements', id: Number(id), depth: 0, overrideAccess: true, disableErrors: true })
  if (!a) notFound()
  const program = await p.findByID({ collection: 'programs', id: typeof a.program === 'object' ? a.program.id : a.program, depth: 0, overrideAccess: true })
  const html = emailLayout('academy', await emailBlocks(p, a, program, { firstName: 'Sam' }), { unsubscribeUrl: '#unsubscribe' })
  const audience = await announcementAudience(p, a)
  const editable = a.status === 'needs-approval' || a.status === 'scheduled'
  const counts = a.sentCounts as { audience: number; email: { sent: number; skipped: number; failed: number }; sms: { sent: number; skipped: number; failed: number }; finished: boolean } | null
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/management/announcements" className="text-sm text-muted hover:text-ink">← Announcements</Link>
        <h1 className="mt-2 font-display text-3xl font-semibold uppercase tracking-tight">{a.subject}</h1>
        <p className="mt-1 text-sm text-muted">{a.kind === 'reminder' ? 'Reminder to families who haven’t registered' : 'Registrations are open'} · {program.title}</p>
      </div>
      {(sp.done || sp.error) && <p role={sp.error ? 'alert' : 'status'} className={`border p-4 text-sm ${sp.error ? 'border-red-400/40 text-red-200' : 'border-emerald-400/40 text-emerald-200'}`}>{sp.error ?? sp.done}</p>}
      {a.status === 'needs-approval' && <p role="note" className="border border-amber-400/50 bg-amber-400/10 p-4 text-sm">This is the first announcement of {a.year} — check it and approve it to send. After this, announcements go out automatically when each term opens.</p>}
      <dl className="panel grid gap-4 border border-line p-5 text-sm sm:grid-cols-3">
        <div><dt className="text-muted">Opted-in families</dt><dd className="font-display text-2xl font-semibold" data-audience>{audience.ids.length}</dd></div>
        <div><dt className="text-muted">Will get the email</dt><dd className="font-display text-2xl font-semibold">{audience.email}</dd></div>
        <div><dt className="text-muted">Will get the text</dt><dd className="font-display text-2xl font-semibold">{audience.sms}</dd></div>
      </dl>
      {counts && <p className="text-sm">Sent {a.sentAt ? formatDate(a.sentAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''}: {counts.email.sent} emails, {counts.sms.sent} texts{counts.email.skipped + counts.sms.skipped ? ` (${counts.email.skipped + counts.sms.skipped} skipped — no longer opted in)` : ''}{counts.finished ? '' : ' — still sending'}.</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <form action={announcementAction} className="space-y-4">
          <input type="hidden" name="id" value={a.id} />
          <label className="block text-sm">Subject<input name="subject" defaultValue={a.subject} disabled={!editable} className={input} /></label>
          <label className="block text-sm">Email message<textarea name="message" rows={8} defaultValue={a.message} disabled={!editable} className={input} /></label>
          <label className="block text-sm">Text message<textarea name="smsText" rows={3} defaultValue={a.smsText ?? ''} disabled={!editable} className={input} /></label>
          <p className="text-xs text-muted">The text ends “– Foundation Academy. Reply STOP to opt out”. Each email has an unsubscribe link. Only families opted in to marketing are sent anything — checked again at the moment of sending.</p>
          {editable && (
            <div className="flex flex-wrap gap-2">
              <button name="do" value="save" className="min-h-10 border border-line px-4 text-xs font-semibold uppercase tracking-[0.12em]">Save wording</button>
              {a.status === 'needs-approval' && <button name="do" value="approve" className="min-h-10 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-black">Approve &amp; send now</button>}
              <button name="do" value="cancel" className="min-h-10 border border-line px-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Don’t send</button>
            </div>
          )}
        </form>
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Email preview</p>
          <iframe title="Email preview" srcDoc={html} className="h-[34rem] w-full border border-line bg-white" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Text preview</p>
          <p className="border border-line p-3 text-sm" data-sms-preview>{a.smsText ? smsBody(a.smsText, 'Foundation Academy') : '(no text)'}</p>
        </div>
      </div>
    </div>
  )
}
