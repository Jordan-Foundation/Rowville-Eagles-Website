'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { linkGuestRecords } from '@/lib/accounts'
import { recordSignupConsent } from '@/lib/consent'
import { requestMeta } from '@/lib/request-meta'
import { checkoutFailMessage } from '@/lib/payments'
import { InvoiceError, invoiceForLink, startInvoicePayment } from '@/invoices/service'

export type PayInvoiceState = { error?: string }

const MOBILE = /^(\+?61|0)4\d{8}$/
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined)) ?? null

async function pay(ref: string, token: string): Promise<PayInvoiceState> {
  const p = await payload()
  let url: string
  try {
    url = await startInvoicePayment(p, ref, token)
  } catch (e) {
    if (e instanceof InvoiceError) return { error: e.message }
    p.logger.error(e)
    return { error: checkoutFailMessage(e, 'We couldn’t start the payment. Please try again shortly, or contact us.') }
  }
  redirect(url)
}

/** Pay button (logged in): keep the invoice with this account, then start (or carry on) the Stripe checkout. */
export async function payInvoice(_prev: PayInvoiceState, fd: FormData): Promise<PayInvoiceState> {
  const ref = String(fd.get('ref') ?? '').slice(0, 40)
  const token = String(fd.get('token') ?? '').slice(0, 80)
  const user = await currentUser()
  if (!user) return { error: 'Please create your account or log in first, then pay.' }
  const p = await payload()
  const inv = await invoiceForLink(p, ref, token)
  if (inv && !inv.account && inv.status === 'sent') await p.update({ collection: 'invoices', id: inv.id, data: { account: user.id }, overrideAccess: true, depth: 0 })
  return pay(ref, token)
}

/** No account yet: create it (password + consent), log in, keep the invoice with it, then straight to payment. */
export async function createAccountAndPay(_prev: PayInvoiceState, fd: FormData): Promise<PayInvoiceState> {
  const s = (k: string) => String(fd.get(k) ?? '').trim()
  const ref = s('ref').slice(0, 40)
  const token = s('token').slice(0, 80)
  const password = String(fd.get('password') ?? '')
  if (fd.get('serviceConsent') !== 'on') return { error: 'Please agree to receive service messages — we need these to manage your bookings and account.' }
  if (password.length < 8) return { error: 'Please choose a password of at least 8 characters.' }
  if (password !== String(fd.get('confirm') ?? '')) return { error: 'The passwords don’t match.' }
  const mobile = s('mobile').replace(/\s+/g, '')
  if (mobile && !MOBILE.test(mobile)) return { error: 'Please enter an Australian mobile number, e.g. 0412 345 678.' }
  if (!s('firstName') || !s('lastName')) return { error: 'Please enter your first and last name.' }

  const p = await payload()
  const inv = await invoiceForLink(p, ref, token)
  if (!inv) return { error: 'This invoice link isn’t valid. Please contact us.' }
  if (inv.status !== 'sent') return { error: inv.status === 'paid' ? 'This invoice has already been paid — thank you.' : 'This invoice can no longer be paid. Please contact us.' }
  // The email is the one the invoice was sent to (so nobody can attach it to a different address)
  const email = (inv.contactEmail || s('email')).toLowerCase()
  if (!EMAIL.test(email)) return { error: 'Please enter your email address.' }

  const q = { overrideAccess: true, depth: 0 } as const
  const linked = idOf(inv.account) ? await p.findByID({ collection: 'users', id: idOf(inv.account)!, ...q, disableErrors: true }) : null
  const existing = linked ?? (await p.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, ...q })).docs[0] ?? null
  if (existing?.activated) return { error: `There’s already an account for ${existing.email} — please log in to pay.` }
  const data = { password, firstName: s('firstName').slice(0, 60), lastName: s('lastName').slice(0, 60), phone: mobile || inv.contactPhone || undefined, activated: true }
  const user = existing
    ? await p.update({ collection: 'users', id: existing.id, data, ...q })
    : await p.create({ collection: 'users', data: { ...data, email, roles: ['parent'] }, ...q })
  await recordSignupConsent(p, user, { marketingOptIn: fd.get('marketingOptIn') === 'on' }, await requestMeta())
  await linkGuestRecords(p, user)
  if (!inv.account) await p.update({ collection: 'invoices', id: inv.id, data: { account: user.id }, ...q })

  const { token: jwt } = await p.login({ collection: 'users', data: { email: user.email, password } })
  if (jwt) {
    ;(await cookies()).set(`${p.config.cookiePrefix}-token`, jwt, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: p.collections.users.config.auth.tokenExpiration })
  }
  return pay(ref, token)
}
