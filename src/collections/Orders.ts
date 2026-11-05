import type { CollectionConfig } from 'payload'
import { isStaff, staffOrOwner } from '../access'

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'reference',
    defaultColumns: ['reference', 'contact.name', 'total', 'fulfilment', 'status', 'createdAt'],
    group: 'Shop',
  },
  access: { read: staffOrOwner('account'), create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: '-createdAt',
  fields: [
    { name: 'reference', type: 'text', required: true, unique: true, admin: { readOnly: true } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Awaiting payment', value: 'pending' },
        { label: 'Paid — to fulfil', value: 'paid' },
        { label: 'Ready for pickup', value: 'ready' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Refunded', value: 'refunded' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'payee', type: 'select', required: true, defaultValue: 'academy', options: ['club', 'academy'], admin: { readOnly: true, position: 'sidebar' } },
    { name: 'account', type: 'relationship', relationTo: 'users', admin: { position: 'sidebar' } },
    {
      name: 'contact',
      type: 'group',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'email', type: 'email', required: true },
        { name: 'phone', type: 'text' },
      ],
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      admin: { readOnly: true },
      fields: [
        { name: 'product', type: 'relationship', relationTo: 'products' },
        { name: 'name', type: 'text' },
        { name: 'size', type: 'text' },
        { name: 'quantity', type: 'number' },
        { name: 'unitPrice', type: 'number' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'subtotal', type: 'number', admin: { readOnly: true } },
        { name: 'postage', type: 'number', admin: { readOnly: true } },
        { name: 'total', type: 'number', required: true, admin: { readOnly: true } },
      ],
    },
    { name: 'fulfilment', type: 'select', required: true, options: [{ label: 'Pick up at club', value: 'pickup' }, { label: 'Post', value: 'post' }] },
    { name: 'shippingAddress', type: 'textarea', admin: { condition: (d) => d?.fulfilment === 'post' } },
    { name: 'stripeCheckoutId', type: 'text', admin: { readOnly: true } },
    { name: 'notes', type: 'textarea', admin: { description: 'Internal notes' } },
  ],
}
