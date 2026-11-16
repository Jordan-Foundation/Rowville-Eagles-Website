import { randomBytes } from 'node:crypto'
import type { Payload } from 'payload'
import type { Invoice } from '../payload-types'
import { emailLayout, esc, type Block } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { sendSms } from '../lib/sms'
import { formatAUD, formatDate } from '../lib/format'
import { localYmd } from '../lib/time'
import { newReference, siteUrl, startCheckout } from '../lib/payments'
import { paymentsMode, stripeFor, type Payee } from '../lib/stripe-accounts'
import { accountLink, ensureAccount } from '../lib/accounts'
import { invoiceProblem, invoiceTotal, isOverdue, lineTotal, type InvoiceLine } from './totals'

const q = { overrideAccess: true, depth: 0 } as const
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined)) ?? null
const SIGN: Record<Payee, string> = { academy: 'Foundation Academy', club: 'Rowville Eagles' }
const brandOf = (inv: Pick<Invoice, 'payee'>): Payee => (inv.payee === 'club' ? 'club' : 'academy')

export class InvoiceError extends Error {}

/** The family's private pay link. */
export const invoiceLink = (inv: Pick<Invoice, 'reference' | 'token'>) => `${siteUrl()}/invoice/${inv.reference}/${inv.token}`

/** Everything the site charges for, to pick from when adding a line (from the Set prices list). */
export async function invoiceCatalogue(p: Payload) {
  const { loadPrices } = await import('../components/admin/prices-data')
  const sections = await loadPrices(p)
  return sections
    .filter((s) => !/Foundation\+/.test(s.title))
    .map((s) => ({
      group: s.title,
      items: s.rows.flatMap((r) =>
        r.fields
          .filter((f) => f.unit === 'aud' && typeof f.value === 'number' && f.value > 0)
          .map((f) => ({ key: f.key, label: r.fields.filter((x) => x.unit === 'aud').length > 1 ? `${r.title} — ${f.label}` : r.title, price: f.value as number })),
      ),
    }))
    .filter((g) => g.items.length)
}

export type InvoiceInput = {
  payee: Payee
  account?: number | null
  contactName: string
  contactEmail?: string | null
  contactPhone?: string | null
  playerName?: string | null
  items: (InvoiceLine & { source?: string | null })[]
  note?: string | null
  dueDate?: string | null
}

/** Create or update (while unpaid). Works out the total; fills contact details from the family account. */
export async function saveInvoice(p: Payload, input: InvoiceInput, o: { id?: number; by?: number } = {}) {
  const items = input.items
    .filter((l) => (l.description ?? '').trim())
    .map((l) => ({ description: String(l.description).trim().slice(0, 200), quantity: Math.max(1, Math.floor(Number(l.quantity) || 1)), unitPrice: Math.round(Number(l.unitPrice) * 100) / 100, source: l.source || undefined }))
  const problem = invoiceProblem(items)
  if (problem) throw new InvoiceError(problem)
  let { contactName, contactEmail, contactPhone } = input
  if (input.account) {
    const u = await p.findByID({ collection: 'users', id: input.account, ...q, disableErrors: true })
    if (!u) throw new InvoiceError('That family account no longer exists.')
    contactName ||= [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email
    contactEmail ||= u.email
    contactPhone ||= u.phone ?? null
  }
  // Someone typed in by hand who already has an account under that email: link it
  let account = input.account || null
  if (!account && contactEmail?.trim()) {
    const u = (await p.find({ collection: 'users', where: { email: { equals: contactEmail.trim().toLowerCase() } }, limit: 1, pagination: false, ...q })).docs[0]
    if (u) account = u.id
  }
  if (!contactName?.trim()) throw new InvoiceError('Add who the invoice is for.')
  if (!contactEmail && !contactPhone) throw new InvoiceError('Add an email or a mobile number so the family can get the invoice.')
  const data = {
    payee: input.payee,
    account,
    contactName: contactName.trim().slice(0, 120),
    contactEmail: contactEmail?.trim().toLowerCase() || null,
    contactPhone: contactPhone?.replace(/\s+/g, '') || null,
    playerName: input.playerName?.trim().slice(0, 120) || null,
    items,
    total: invoiceTotal(items),
    note: input.note?.trim().slice(0, 2000) || null,
    dueDate: input.dueDate || null,
  }
  if (o.id) {
    const cur = await p.findByID({ collection: 'invoices', id: o.id, ...q })
    if (cur.status !== 'draft' && cur.status !== 'sent') throw new InvoiceError('Only unpaid invoices can be changed.')
    // The Stripe account can only change before a payment has been started
    if (cur.payee !== input.payee && cur.stripeCheckoutId) throw new InvoiceError('A payment has already been started with the other Stripe account — cancel this invoice and create a new one.')
    return p.update({ collection: 'invoices', id: o.id, data, ...q })
  }
  return p.create({ collection: 'invoices', data: { ...data, reference: newReference(input.payee), token: randomBytes(18).toString('base64url'), status: 'draft', createdBy: o.by ?? null }, ...q })
}

function emailBlocks(inv: Invoice, kind: 'invoice' | 'reminder' | 'receipt', account?: { label: string; href: string }): Block[] {
  const rows: [string, string][] = [
    ...(inv.items ?? []).map((l) => [`${l.quantity && l.quantity > 1 ? `${l.quantity} × ` : ''}${l.description}`, formatAUD(lineTotal(l))] as [string, string]),
    ['Total', formatAUD(inv.total ?? 0)],
    ...(inv.playerName ? ([['Player', inv.playerName]] as [string, string][]) : []),
    ...(kind !== 'receipt' && inv.dueDate ? ([['Due', formatDate(inv.dueDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })]] as [string, string][]) : []),
    ['Reference', inv.reference],
  ]
  const first = inv.contactName.split(' ')[0]
  const intro = {
    invoice: `Hi ${esc(first)} — here’s your invoice. Use the button below to log in (or create your account if you don’t have one yet), then pay securely by card.`,
    reminder: `Hi ${esc(first)} — a friendly reminder that this invoice ${inv.dueDate ? `was due ${esc(formatDate(inv.dueDate, { day: 'numeric', month: 'long' }))}` : 'is still unpaid'}. If you’ve already paid, please ignore this.`,
    receipt: `Thanks ${esc(first)} — we’ve received your payment of ${esc(formatAUD(inv.total ?? 0))}.`,
  }[kind]
  return [{
    heading: { invoice: `Invoice ${inv.reference}`, reminder: `Reminder: invoice ${inv.reference}`, receipt: `Payment received — ${inv.reference}` }[kind],
    intro: `${intro}${inv.note && kind !== 'receipt' ? `<br><br>${esc(inv.note).replace(/\n/g, '<br>')}` : ''}`,
    rows,
    ...(kind === 'receipt'
      ? account ? { cta: account, after: account.label === 'Create your account' ? 'We’ve saved this payment to an account under your email. Create your password to see your invoices, bookings and receipts in one place.' : 'You’ll find this invoice in your account.' } : {}
      : { cta: { label: `Pay ${formatAUD(inv.total ?? 0)}`, href: invoiceLink(inv) } }),
  }]
}

const smsText = (inv: Invoice, reminder: boolean) =>
  `${reminder ? 'Reminder: invoice' : 'Invoice'} ${inv.reference} for ${formatAUD(inv.total ?? 0)}${inv.dueDate ? `, due ${formatDate(inv.dueDate, { day: 'numeric', month: 'short' })}` : ''}. Pay by card: ${invoiceLink(inv)} – ${SIGN[brandOf(inv)]}`

/** Email and/or text the invoice (or a reminder). Marks a draft as sent. */
export async function sendInvoice(p: Payload, id: number, o: { email: boolean; sms: boolean; reminder?: boolean }) {
  const inv = await p.findByID({ collection: 'invoices', id, ...q, showHiddenFields: true })
  if (inv.status !== 'draft' && inv.status !== 'sent') throw new InvoiceError('This invoice is no longer waiting for payment.')
  const brand = brandOf(inv)
  const user = inv.account ? await p.findByID({ collection: 'users', id: idOf(inv.account)!, ...q, disableErrors: true }) : null
  const settings = await p.findGlobal({ slug: 'site-settings', depth: 0 }).catch(() => null)
  const result = { email: false, sms: false }
  if (o.email && inv.contactEmail) {
    result.email = await sendEmail(p, {
      to: inv.contactEmail,
      subject: o.reminder ? `Reminder: invoice ${inv.reference} (${formatAUD(inv.total ?? 0)})` : `Invoice ${inv.reference} — ${formatAUD(inv.total ?? 0)}`,
      html: emailLayout(brand, emailBlocks(inv, o.reminder ? 'reminder' : 'invoice')),
      sender: brand,
      replyTo: settings?.email || undefined,
      userId: user?.id,
    })
  }
  if (o.sms && inv.contactPhone) {
    const r = await sendSms(p, { to: inv.contactPhone, body: smsText(inv, !!o.reminder), kind: o.reminder ? 'reminder' : 'service', optedOut: user?.smsOptOut, userId: user?.id })
    // Without Twilio (local development) the text is only written to the log
    result.sms = r.sent || (r.reason === 'not_configured' && process.env.NODE_ENV !== 'production')
  }
  if (!result.email && !result.sms) throw new InvoiceError(o.email && !inv.contactEmail && o.sms && !inv.contactPhone ? 'There’s no email or mobile number on this invoice.' : 'The invoice couldn’t be sent — check the email and mobile number (or that email and texts are set up).')
  const now = new Date().toISOString()
  await p.update({ collection: 'invoices', id, data: o.reminder ? { remindedAt: now } : { status: 'sent', sentAt: inv.sentAt ?? now }, ...q })
  return result
}

/** The invoice behind a pay link (token must match). Drafts aren't visible to families yet. */
export async function invoiceForLink(p: Payload, reference: string, token: string) {
  const inv = (await p.find({ collection: 'invoices', where: { reference: { equals: reference } }, limit: 1, pagination: false, ...q, showHiddenFields: true })).docs[0]
  if (!inv || !token || inv.token !== token || inv.status === 'draft') return null
  return inv
}

/** Start (or carry on) the card payment; returns the Stripe checkout URL. */
export async function startInvoicePayment(p: Payload, reference: string, token: string) {
  const inv = await invoiceForLink(p, reference, token)
  if (!inv) throw new InvoiceError('This invoice link isn’t valid. Please contact us.')
  if (inv.status === 'paid') throw new InvoiceError('This invoice has already been paid — thank you.')
  if (inv.status !== 'sent') throw new InvoiceError('This invoice has been cancelled. Please contact us if you think that’s a mistake.')
  const payee = brandOf(inv)
  // Re-use a checkout that's still open, so a family can't start two payments for one invoice
  if (inv.stripeCheckoutId && paymentsMode(payee) === 'stripe') {
    const s = await stripeFor(payee).checkout.sessions.retrieve(inv.stripeCheckoutId).catch(() => null)
    if (s?.status === 'open' && s.url && s.amount_total === Math.round((inv.total ?? 0) * 100)) return s.url
    if (s?.payment_status === 'paid') {
      await markInvoicePaid(p, inv.reference, { via: 'card' })
      throw new InvoiceError('This invoice has already been paid — thank you.')
    }
  }
  const path = `/invoice/${inv.reference}/${inv.token}`
  const checkout = await startCheckout({
    payee,
    kind: 'invoice',
    reference: inv.reference,
    email: inv.contactEmail || '',
    items: (inv.items ?? []).map((l) => ({ name: l.description, ...(inv.playerName ? { description: inv.playerName } : {}), unitAmount: l.unitPrice, quantity: l.quantity })),
    successPath: path,
    cancelPath: path,
    expiresInMinutes: 60,
  })
  if (checkout.sessionId) await p.update({ collection: 'invoices', id: inv.id, data: { stripeCheckoutId: checkout.sessionId }, ...q })
  return checkout.url
}

/** Paid (webhook, return page, or Management marking a cash/bank payment). Idempotent; emails a receipt. */
export async function markInvoicePaid(p: Payload, reference: string, o: { via: 'card' | 'manual'; note?: string }) {
  const inv = (await p.find({ collection: 'invoices', where: { reference: { equals: reference } }, limit: 1, pagination: false, ...q, showHiddenFields: true })).docs[0]
  if (!inv) return undefined
  if (inv.status === 'paid') return inv
  // A card payment still counts if the invoice was cancelled meanwhile (the money has been taken)
  if (o.via === 'manual' && inv.status !== 'sent' && inv.status !== 'draft') throw new InvoiceError('Only unpaid invoices can be marked paid.')
  let paid = await p.update({ collection: 'invoices', id: inv.id, data: { status: 'paid', paidAt: new Date().toISOString(), paidVia: o.via, paymentNote: o.note?.slice(0, 200) || null }, ...q })
  if (o.via === 'card' && inv.status === 'cancelled') p.logger.warn(`Invoice ${reference} was paid by card after it was cancelled — refund it in Stripe if needed.`)
  const email = paid.contactEmail
  if (email) {
    const brand = brandOf(paid)
    // Paid without an account: set one up under their email (like any other booking) so the invoice is kept with it
    let link: { label: string; href: string } | undefined
    try {
      const user = paid.account
        ? await p.findByID({ collection: 'users', id: idOf(paid.account)!, ...q })
        : (await ensureAccount(p, { email, firstName: paid.contactName.split(' ')[0], lastName: paid.contactName.split(' ').slice(1).join(' ') || null, phone: paid.contactPhone })).user
      if (!paid.account) paid = await p.update({ collection: 'invoices', id: paid.id, data: { account: user.id }, ...q, showHiddenFields: true })
      link = await accountLink(p, user)
    } catch (e) {
      p.logger.error({ err: e, msg: `Could not link invoice ${reference} to an account` })
    }
    await sendEmail(p, { to: email, subject: `Payment received — invoice ${paid.reference}`, html: emailLayout(brand, emailBlocks(paid, 'receipt', link)), sender: brand, userId: idOf(paid.account) ?? undefined }).catch((e) => p.logger.error({ err: e, msg: `Receipt for ${reference} failed` }))
  }
  return paid
}

export async function cancelInvoice(p: Payload, id: number) {
  const inv = await p.findByID({ collection: 'invoices', id, ...q })
  if (inv.status !== 'draft' && inv.status !== 'sent') throw new InvoiceError('Only unpaid invoices can be cancelled.')
  return p.update({ collection: 'invoices', id, data: { status: 'cancelled' }, ...q })
}

/** Paid invoices refunded in Stripe: record it here so the money summary matches. */
export async function markInvoiceRefunded(p: Payload, id: number) {
  const inv = await p.findByID({ collection: 'invoices', id, ...q })
  if (inv.status !== 'paid') throw new InvoiceError('Only paid invoices can be marked refunded.')
  return p.update({ collection: 'invoices', id, data: { status: 'refunded' }, ...q })
}

/** Daily: one automatic reminder (email + text) the day after an invoice falls due. */
export async function sweepInvoiceReminders(p: Payload, now = new Date()) {
  const today = localYmd(now)
  const { docs } = await p.find({ collection: 'invoices', where: { status: { equals: 'sent' }, dueDate: { less_than: now.toISOString() }, remindedAt: { exists: false } }, limit: 200, pagination: false, ...q })
  let sent = 0
  for (const inv of docs) {
    if (!isOverdue(inv, today, localYmd)) continue
    try {
      await sendInvoice(p, inv.id, { email: true, sms: true, reminder: true })
      sent++
    } catch (e) {
      p.logger.error({ err: e, msg: `Invoice reminder ${inv.reference} failed` })
      await p.update({ collection: 'invoices', id: inv.id, data: { remindedAt: now.toISOString() }, ...q })
    }
  }
  return { reminders: sent }
}

/** Unpaid invoices past their due date (Management badge). */
export async function overdueInvoices(p: Payload, now = new Date()) {
  const { docs } = await p.find({ collection: 'invoices', where: { status: { equals: 'sent' }, dueDate: { less_than: now.toISOString() } }, limit: 500, pagination: false, ...q, select: { status: true, dueDate: true } })
  return docs.filter((d) => isOverdue(d, localYmd(now), localYmd)).length
}
