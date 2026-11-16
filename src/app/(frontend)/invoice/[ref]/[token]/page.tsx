import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { formatAUD, formatDate } from '@/lib/format'
import { paymentsMode, stripeAccounts, stripeFor } from '@/lib/stripe-accounts'
import { invoiceForLink, markInvoicePaid } from '@/invoices/service'
import { lineTotal } from '@/invoices/totals'
import { PayButton } from './PayButton'
import { AccountFirstForm } from './AccountFirstForm'
import { currentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Invoice', robots: { index: false } }

type Search = { session_id?: string; simulated?: string }

/** The family's private invoice page: what it's for, and a button to pay by card. */
export default async function InvoicePayPage({ params, searchParams }: { params: Promise<{ ref: string; token: string }>; searchParams: Promise<Search> }) {
  const [{ ref, token }, sp] = await Promise.all([params, searchParams])
  const p = await payload()
  let inv = await invoiceForLink(p, ref, token)
  if (!inv) {
    return (
      <div className="container-x max-w-2xl py-16">
        <h1 className="font-display text-4xl font-extrabold uppercase">Link not valid</h1>
        <p className="mt-4 text-muted">We couldn’t find this invoice. Please check the link in your email or text, or contact us.</p>
      </div>
    )
  }
  const payee = inv.payee === 'club' ? 'club' : 'academy'
  // Back from Stripe: confirm here too, so the page is right even if the webhook is slow
  if (inv.status !== 'paid' && (sp.session_id || sp.simulated)) {
    try {
      const mode = paymentsMode(payee)
      const ok = mode === 'simulate'
        ? !!sp.simulated
        : await stripeFor(payee).checkout.sessions.retrieve(sp.session_id!).then((s) => s.metadata?.reference === inv!.reference && s.payment_status === 'paid')
      if (ok) inv = (await markInvoicePaid(p, inv.reference, { via: 'card' })) ?? inv
    } catch (e) {
      p.logger.error(e)
    }
  }
  const academy = payee === 'academy'
  const owner = inv.account ? await p.findByID({ collection: 'users', id: typeof inv.account === 'object' ? inv.account.id : inv.account, depth: 0, overrideAccess: true, disableErrors: true }) : null
  // Account first, then pay: logged in → pay; has an account → log in; otherwise create one here
  const me = await currentUser()
  const byEmail = !owner && inv.contactEmail ? (await p.find({ collection: 'users', where: { email: { equals: inv.contactEmail.toLowerCase() } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] : null
  const hasAccount = Boolean((owner ?? byEmail)?.activated)
  const [first, ...rest] = (inv.contactName ?? '').split(' ')
  const here = `/invoice/${inv.reference}/${token}`
  const settings = await p.findGlobal({ slug: 'site-settings', depth: 0 }).catch(() => null)
  return (
    <div data-brand={academy ? 'academy' : undefined} data-page-brand={academy ? 'academy' : undefined}>
      <div className="container-x grid max-w-5xl gap-10 py-14 lg:grid-cols-[1fr_20rem]">
        <div>
          <p className="eyebrow">Invoice {inv.reference}</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold uppercase sm:text-5xl">{inv.status === 'paid' ? 'Paid — thank you' : `${formatAUD(inv.total ?? 0)} to pay`}</h1>
          <p className="mt-3 text-muted">For {inv.contactName}{inv.playerName ? ` · ${inv.playerName}` : ''} · from {stripeAccounts[payee].label}</p>
          <section aria-label="Items" className={`panel mt-8 border border-line ${academy ? '' : 'rounded-2xl'}`}>
            <ul className="divide-y divide-line">
              {(inv.items ?? []).map((l, i) => (
                <li key={i} className="flex justify-between gap-4 p-4 text-sm">
                  <span>{l.quantity > 1 ? `${l.quantity} × ` : ''}{l.description}</span>
                  <span className="font-medium">{formatAUD(lineTotal(l))}</span>
                </li>
              ))}
              <li className="flex justify-between gap-4 p-4 font-semibold"><span>Total</span><span data-total>{formatAUD(inv.total ?? 0)}</span></li>
            </ul>
          </section>
          {inv.note && <p className="mt-6 whitespace-pre-line text-sm text-muted">{inv.note}</p>}
        </div>
        <aside className={`panel h-fit border border-line bg-surface-2 p-6 text-sm ${academy ? '' : 'rounded-2xl'}`}>
          {inv.status === 'paid' ? (
            <div className="space-y-3">
              <p role="status">Your payment of {formatAUD(inv.total ?? 0)} has been received{inv.paidAt ? ` (${formatDate(inv.paidAt)})` : ''}. A receipt has been emailed to you.</p>
              {owner && !owner.activated && <p data-account-note>We’ve saved this payment to an account under <strong>{owner.email}</strong>. Check your email for the link to create your password — then your invoices, bookings and receipts are all in one place.</p>}
              {owner?.activated && <a href="/account" className="inline-block font-semibold underline">Go to your account →</a>}
            </div>
          ) : inv.status === 'sent' ? (
            <div className="space-y-4">
              {inv.dueDate && <p>Due <strong>{formatDate(inv.dueDate, { weekday: 'long', day: 'numeric', month: 'long' })}</strong></p>}
              {me ? (
                <>
                  <p className="text-xs text-muted" data-account-note>Signed in as {me.email} — this invoice will be kept in your account.</p>
                  <PayButton refCode={inv.reference} token={token} label={`Pay ${formatAUD(inv.total ?? 0)}`} academy={academy} />
                </>
              ) : hasAccount ? (
                <div className="space-y-3" data-account-step="login">
                  <p><strong>Step 1:</strong> log in to your account{inv.contactEmail ? <> ({inv.contactEmail})</> : null}, then you’ll come straight back here to pay.</p>
                  <a href={`/login?next=${encodeURIComponent(here)}`} className={`block w-full bg-accent px-6 py-4 text-center font-semibold text-accent-ink hover:brightness-110 ${academy ? 'uppercase tracking-[0.18em]' : 'rounded-full'}`}>Log in to pay</a>
                  <p className="text-xs text-muted">Forgotten your password? <a href="/account/forgot" className="underline">Reset it</a>.</p>
                </div>
              ) : (
                <div className="space-y-3" data-account-step="create">
                  <p><strong>Step 1:</strong> create your account — it keeps this invoice, your receipts and bookings in one place. <strong>Step 2:</strong> pay by card.</p>
                  <AccountFirstForm refCode={inv.reference} token={token} email={inv.contactEmail} firstName={first} lastName={rest.join(' ')} mobile={inv.contactPhone} payLabel={`Pay ${formatAUD(inv.total ?? 0)}`} academy={academy} />
                  <p className="text-xs text-muted">Already have an account under another email? <a href={`/login?next=${encodeURIComponent(here)}`} className="underline">Log in</a> instead.</p>
                </div>
              )}
              <p className="text-xs text-muted">Secure card payment by Stripe. Questions? {settings?.email ? <>Email <a href={`mailto:${settings.email}`} className="underline">{settings.email}</a>.</> : 'Contact us.'}</p>
            </div>
          ) : (
            <p>This invoice is no longer payable{inv.status === 'cancelled' ? ' — it was cancelled' : ''}. Please contact us if you have any questions.</p>
          )}
        </aside>
      </div>
    </div>
  )
}
