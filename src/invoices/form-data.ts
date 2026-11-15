import type { Payload } from 'payload'
import type { Invoice } from '../payload-types'
import { localYmd } from '../lib/time'
import { invoiceCatalogue } from './service'

/** What the invoice form needs: the price list and the family accounts to pick from. */
export async function invoiceFormData(p: Payload) {
  const [catalogue, users] = await Promise.all([
    invoiceCatalogue(p),
    p.find({ collection: 'users', where: { roles: { contains: 'parent' } }, sort: 'firstName', limit: 10000, pagination: false, depth: 0, overrideAccess: true, select: { firstName: true, lastName: true, email: true, phone: true } }),
  ])
  const families = users.docs.map((u) => ({ id: u.id, name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email, email: u.email, phone: u.phone ?? '' }))
  return { catalogue, families }
}

/** An invoice as the form edits it. */
export const draftFrom = (inv: Invoice) => ({
  id: inv.id,
  status: inv.status,
  payee: inv.payee === 'club' ? ('club' as const) : ('academy' as const),
  account: inv.account ? (typeof inv.account === 'object' ? inv.account.id : inv.account) : null,
  contactName: inv.contactName,
  contactEmail: inv.contactEmail ?? '',
  contactPhone: inv.contactPhone ?? '',
  playerName: inv.playerName ?? '',
  lines: (inv.items ?? []).map((l) => ({ desc: l.description, qty: String(l.quantity), price: String(l.unitPrice), src: l.source ?? '' })),
  note: inv.note ?? '',
  dueDate: inv.dueDate ? localYmd(new Date(inv.dueDate)) : '',
})
