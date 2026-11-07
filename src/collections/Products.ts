import type { CollectionConfig } from 'payload'
import { hasRole, isStaff, publishedOrStaff, type WithRoles } from '../access'

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'item'

/** Uniforms & apparel. All shop revenue is paid to the Academy Stripe account. */
export const Products: CollectionConfig = {
  slug: 'products',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'category', 'price', 'audiences', 'status'], group: 'Shop' },
  access: { read: publishedOrStaff('status', ['active']), create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: 'order',
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data && !(data.audiences?.length) && !(data.teams?.length) && !(data.accounts?.length)) data.audiences = ['everyone']
        return data
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'slug',
      label: 'Web address',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar', description: 'Fills itself in from the name — /shop/<this>. Only change it if you need to.' },
      hooks: {
        beforeValidate: [
          async ({ value, data, originalDoc, req }) => {
            const given = typeof value === 'string' ? slugify(value) : ''
            if (given) return given
            if (originalDoc?.slug) return originalDoc.slug
            const base = slugify(String(data?.name ?? ''))
            for (let n = 1; n < 50; n++) {
              const candidate = n === 1 ? base : `${base}-${n}`
              const { totalDocs } = await req.payload.count({ collection: 'products', where: { slug: { equals: candidate } }, overrideAccess: true, req })
              if (!totalDocs) return candidate
            }
            return `${base}-${Date.now()}`
          },
        ],
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'category',
          type: 'select',
          required: true,
          options: [
            { label: 'Playing kit', value: 'kit' },
            { label: 'Training wear', value: 'training' },
            { label: 'Supporter apparel', value: 'apparel' },
            { label: 'Accessories', value: 'accessories' },
          ],
        },
        {
          name: 'brand',
          type: 'select',
          defaultValue: 'club',
          options: [
            { label: 'Rowville Eagles', value: 'club' },
            { label: 'Rowville Foundation Academy', value: 'academy' },
          ],
        },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'active',
          options: [
            { label: 'Active', value: 'active' },
            { label: 'Hidden', value: 'hidden' },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Who can buy this',
      admin: { description: 'Anyone who matches at least one of these can buy it. Pick “Everyone” for supporter gear.' },
      fields: [
        {
          name: 'audiences',
          label: 'Groups',
          type: 'select',
          hasMany: true,
          defaultValue: ['everyone'],
          options: [
            { label: 'Everyone — supporter gear', value: 'everyone' },
            { label: 'Registered Rowville players', value: 'rowville' },
            { label: 'RFA players', value: 'rfa' },
            { label: 'Foundation+ members', value: 'foundation-plus' },
          ],
        },
        {
          name: 'teams',
          label: 'Specific teams',
          type: 'relationship',
          relationTo: 'teams',
          hasMany: true,
          filterOptions: { archived: { not_equals: true } },
          admin: { description: 'Players on these teams (and their coaches), e.g. a team hoodie.' },
        },
        {
          name: 'accounts',
          label: 'Specific accounts',
          type: 'relationship',
          relationTo: 'users',
          hasMany: true,
          access: { read: ({ req: { user } }) => hasRole(user as WithRoles, 'admin', 'committee') },
          admin: { description: 'Hand-picked families (search by name or email).' },
        },
        {
          name: 'othersSee',
          label: 'People who can’t buy it',
          type: 'radio',
          defaultValue: 'locked',
          options: [
            { label: 'Show it locked (with a log-in / join button)', value: 'locked' },
            { label: 'Hide it completely', value: 'hidden' },
          ],
          admin: { layout: 'horizontal', description: 'Ignored for “Everyone” items.' },
        },
      ],
    },
    { name: 'price', type: 'number', required: true, min: 0, admin: { description: 'AUD incl. GST' } },
    { name: 'description', type: 'textarea' },
    { name: 'images', type: 'upload', relationTo: 'media', hasMany: true },
    {
      name: 'variants',
      label: 'Sizes & stock',
      type: 'array',
      admin: { description: 'Leave stock empty for unlimited / made-to-order.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'size', type: 'text', required: true },
            { name: 'stock', type: 'number', min: 0 },
          ],
        },
      ],
    },
    { name: 'order', type: 'number', defaultValue: 0 },
  ],
}
