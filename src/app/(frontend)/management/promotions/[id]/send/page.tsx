import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { emailLayout } from '@/lib/email-templates'
import { smsBody, type Audience } from '@/promotions/audience'
import { audienceOptions, audiencePreview, defaultCta, emailBlocks, scopeSummary, senderName } from '@/promotions/send'
import { discountLabel } from '@/promotions/rules'
import { AudienceMessageForm, SendButtons } from './Forms'

export const dynamic = 'force-dynamic'
// Sending to a large audience can take a while (one email/text at a time, consent re-checked for each)
export const maxDuration = 300
export const metadata: Metadata = { title: 'Send promotion', robots: { index: false } }

export default async function SendPromotionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireManagement(`/management/promotions/${id}/send`)
  const p = await payload()
  const d = await p.findByID({ collection: 'promotions', id: Number(id), depth: 0, overrideAccess: true, disableErrors: true })
  if (!d) notFound()
  const audience = (d.audience ?? { mode: 'filter' }) as Audience
  const [opts, preview, summary] = await Promise.all([audienceOptions(p), d.audience ? audiencePreview(p, audience) : null, scopeSummary(p, d)])
  const channels = d.channels ?? []
  const sample = { firstName: 'Sam', email: 'sam@example.com' }
  const html = channels.includes('email') && d.subject ? emailLayout(d.brand === 'club' ? 'club' : 'academy', emailBlocks(d, summary, sample), { unsubscribeUrl: '#' }) : null
  const sms = channels.includes('sms') && d.smsText ? smsBody(d.smsText, senderName(d)) : null
  const counts = d.sentCounts as { families: number; audience: number; email: { sent: number; skipped: number }; sms: { sent: number; skipped: number } } | null
  const h2 = 'font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase'

  return (
    <div className="container-x max-w-4xl py-14">
      <Link href={`/management/promotions/${d.id}`} className="text-sm text-muted hover:text-ink">← {d.name}</Link>
      <h1 className="mt-4 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Send to families</h1>
      <p className="mt-2 text-muted">{d.name} · {discountLabel(d)} · {summary || 'nothing picked yet'}</p>

      {d.sentAt ? (
        <section className="mt-8 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950" aria-label="Sent">
          <h2 className="font-semibold">Sent {formatDate(d.sentAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</h2>
          {counts && <p className="mt-1 text-sm">{counts.audience} families got the discount · {counts.email.sent} emailed · {counts.sms.sent} texted · {counts.email.skipped} not emailed and {counts.sms.skipped} not texted (no marketing consent or no mobile).</p>}
          <p className="mt-2 text-sm">Results (uses and revenue) are on the <Link href={`/management/promotions/${d.id}`} className="underline">promotion page</Link>.</p>
        </section>
      ) : (
        <>
          {d.status === 'scheduled' && d.scheduledFor && <p role="status" className="mt-6 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">Scheduled for {formatDate(d.scheduledFor, { weekday: 'long', day: 'numeric', month: 'long' })} (about 6am).</p>}
          <div className="mt-8">
            <AudienceMessageForm
              id={d.id}
              a={audience}
              opts={opts}
              sender={senderName(d)}
              m={{ channels: channels.length || d.audience ? channels : ['email'], subject: d.subject ?? '', message: d.message ?? '', smsText: d.smsText ?? '', ctaPath: d.ctaPath ?? '', defaultCta: defaultCta(d), brand: d.brand ?? 'academy' }}
            />
          </div>
          {preview && (
            <section id="preview" className="mt-12 scroll-mt-24 space-y-6" aria-label="Preview">
              <h2 className={h2}>3. Check and approve</h2>
              <ul className="grid gap-3 sm:grid-cols-3">
                <li className="rounded-2xl border border-line p-4"><p className="text-3xl font-bold">{preview.families}</p><p className="text-sm text-muted">families get the discount</p></li>
                <li className="rounded-2xl border border-line p-4"><p className="text-3xl font-bold">{channels.includes('email') ? preview.email : 0}</p><p className="text-sm text-muted">emails {channels.includes('email') ? `(${preview.families - preview.email} skipped — no consent)` : '(email off)'}</p></li>
                <li className="rounded-2xl border border-line p-4"><p className="text-3xl font-bold">{channels.includes('sms') ? preview.sms : 0}</p><p className="text-sm text-muted">texts {channels.includes('sms') ? `(${preview.families - preview.sms} skipped — no consent or mobile)` : '(texts off)'}</p></li>
              </ul>
              {html && (
                <div>
                  <h3 className="mb-2 font-semibold">Email: “{d.subject}”</h3>
                  <iframe title="Email preview" srcDoc={html} sandbox="" className="h-[640px] w-full rounded-2xl border border-line bg-white" />
                </div>
              )}
              {sms && (
                <div>
                  <h3 className="mb-2 font-semibold">Text message</h3>
                  <p className="max-w-sm rounded-2xl rounded-bl-sm bg-surface-2 px-4 py-3 text-sm">{sms}</p>
                </div>
              )}
              <SendButtons id={d.id} families={preview.families} email={channels.includes('email') ? preview.email : 0} sms={channels.includes('sms') ? preview.sms : 0} scheduledFor={d.status === 'scheduled' ? (d.scheduledFor ?? null) : null} />
            </section>
          )}
        </>
      )}
    </div>
  )
}
