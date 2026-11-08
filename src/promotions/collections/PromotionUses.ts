import type { CollectionConfig } from 'payload'
import { isStaff } from '../../access'

/** Each time a family's checkout used a promotion. Pending until paid; only paid (and very recent pending) uses count towards "uses per family". */
export const PromotionUses: CollectionConfig = {
  slug: 'promotion-uses',
  labels: { singular: 'Promotion use', plural: 'Promotion uses' },
  admin: { group: 'Promotions', defaultColumns: ['promotion', 'account', 'kind', 'reference', 'amountOff', 'status', 'createdAt'] },
  access: { read: isStaff, create: () => false, update: () => false, delete: isStaff },
  defaultSort: '-createdAt',
  fields: [
    { name: 'promotion', type: 'relationship', relationTo: 'promotions', required: true, index: true },
    { name: 'account', type: 'relationship', relationTo: 'users', required: true, index: true },
    { type: 'row', fields: [
      { name: 'kind', type: 'select', required: true, options: ['program', '1on1', 'shop', 'tournament', 'fplus'] },
      { name: 'reference', type: 'text', required: true, index: true },
      { name: 'status', type: 'select', required: true, defaultValue: 'pending', index: true, options: ['pending', 'paid', 'cancelled'] },
    ] },
    { type: 'row', fields: [
      { name: 'amountOff', label: 'Discount (AUD)', type: 'number', required: true },
      { name: 'paidAmount', label: 'Paid (AUD)', type: 'number' },
    ] },
  ],
}
