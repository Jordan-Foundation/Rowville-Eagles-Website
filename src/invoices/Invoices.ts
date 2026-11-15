import type { CollectionConfig } from 'payload'
import { hasRole, isStaff, type WithRoles } from '../access'
import { invoiceTotal } from './totals'

/**
 * Invoices Management creates after the fact (e.g. a one-off session) for any mix of items: shop items,
 * programs, session prices or a custom line. The family gets an email and/or text with a private pay link
 * (/invoice/<reference>/<token>) and pays by card through the chosen Stripe account.
 */
export const Invoices: CollectionConfig = {
  slug: 'invoices',
  labels: { singular: 'Invoice', plural: 'Invoices' },
  admin: {
    group: 'Club',
    useAsTitle: 'reference',
    defaultColumns: ['reference', 'contactName', 'total', 'status', 'dueDate', 'createdAt'],
    description: 'Use Management → Invoices to create, send and track invoices.',
  },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: () => false },
  defaultSort: '-createdAt',
  hooks: {
    beforeChange: [
      ({ data }) => {
        // The total is always worked out from the lines
        if (data.items) data.total = invoiceTotal(data.items)
        return data
      },
    ],
  },
  fields: [
    { type: 'row', fields: [
      { name: 'reference', type: 'text', required: true, unique: true, index: true, admin: { readOnly: true } },
      {
        name: 'payee',
        label: 'Paid to',
        type: 'select',
        required: true,
        defaultValue: 'academy',
        options: [{ label: 'Rowville Foundation Academy', value: 'academy' }, { label: 'Rowville Eagles Football Club', value: 'club' }],
        admin: { description: 'Which Stripe account the payment goes to' },
      },
      {
        name: 'status',
        type: 'select',
        required: true,
        index: true,
        defaultValue: 'draft',
        options: [
          { label: 'Draft (not sent)', value: 'draft' },
          { label: 'Sent — waiting for payment', value: 'sent' },
          { label: 'Paid', value: 'paid' },
          { label: 'Cancelled', value: 'cancelled' },
          { label: 'Refunded', value: 'refunded' },
        ],
      },
    ] },
    { name: 'account', label: 'Family account', type: 'relationship', relationTo: 'users', index: true },
    { type: 'row', fields: [
      { name: 'contactName', label: 'Name', type: 'text', required: true },
      { name: 'contactEmail', label: 'Email', type: 'email' },
      { name: 'contactPhone', label: 'Mobile', type: 'text' },
    ] },
    { name: 'playerName', label: 'Player', type: 'text', admin: { description: 'Optional — shown on the invoice' } },
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { type: 'row', fields: [
          { name: 'description', type: 'text', required: true },
          { name: 'quantity', type: 'number', required: true, defaultValue: 1, min: 1 },
          { name: 'unitPrice', label: 'Price each (AUD)', type: 'number', required: true, min: 0 },
        ] },
        { name: 'source', type: 'text', admin: { hidden: true } },
      ],
    },
    { name: 'total', type: 'number', admin: { readOnly: true, description: 'AUD incl. GST — worked out from the items' } },
    { name: 'note', label: 'Note to the family', type: 'textarea' },
    { type: 'row', fields: [
      { name: 'dueDate', type: 'date', index: true, admin: { date: { pickerAppearance: 'dayOnly' } } },
      { name: 'sentAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'remindedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'paidAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    ] },
    {
      name: 'paidVia',
      type: 'select',
      options: [{ label: 'Card (online)', value: 'card' }, { label: 'Marked paid by Management (cash / bank transfer)', value: 'manual' }],
      admin: { readOnly: true },
    },
    { name: 'paymentNote', type: 'text', admin: { readOnly: true } },
    { name: 'token', type: 'text', required: true, access: { read: ({ req }) => hasRole(req.user as WithRoles, 'admin', 'committee') }, admin: { hidden: true } },
    { name: 'stripeCheckoutId', type: 'text', admin: { readOnly: true } },
    { name: 'createdBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
  ],
}
