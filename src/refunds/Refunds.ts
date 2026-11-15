import type { CollectionConfig } from 'payload'
import { isStaff } from '../access'

/**
 * Every refund made from Management → Refunds: what, how much, why, who, and Stripe's refund IDs.
 * Written by the server only (it's the record of money given back), never edited.
 */
export const Refunds: CollectionConfig = {
  slug: 'refunds',
  labels: { singular: 'Refund', plural: 'Refunds' },
  admin: { group: 'Club', useAsTitle: 'reference', defaultColumns: ['reference', 'description', 'amount', 'status', 'createdAt'], description: 'Made from Management → Refunds (admins only).' },
  access: { read: isStaff, create: () => false, update: () => false, delete: () => false },
  defaultSort: '-createdAt',
  fields: [
    { type: 'row', fields: [
      { name: 'kind', type: 'select', required: true, index: true, options: ['booking', 'academy', 'order', 'invoice'] },
      { name: 'docId', type: 'number', required: true, index: true },
      { name: 'reference', type: 'text', index: true },
      { name: 'payee', type: 'select', options: ['academy', 'club'] },
    ] },
    { name: 'category', type: 'text', admin: { description: 'Money summary line' } },
    { name: 'account', type: 'relationship', relationTo: 'users', index: true },
    { name: 'description', type: 'text' },
    { name: 'playerName', type: 'text' },
    { type: 'row', fields: [
      { name: 'amount', label: 'Refunded (AUD)', type: 'number', required: true },
      { name: 'status', type: 'select', required: true, options: ['refunded', 'simulated', 'failed'] },
      { name: 'cancelled', label: 'Booking cancelled too', type: 'checkbox' },
    ] },
    { name: 'reason', type: 'textarea' },
    { name: 'error', type: 'text' },
    { name: 'stripeRefundIds', type: 'text' },
    { name: 'nonce', type: 'text', unique: true, admin: { hidden: true } },
    { name: 'by', type: 'relationship', relationTo: 'users' },
  ],
}
