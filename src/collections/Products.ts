import type { CollectionConfig } from 'payload'
import { isStaff, publishedOrStaff } from '../access'

/** Uniforms & apparel. All shop revenue is paid to the Academy Stripe account. */
export const Products: CollectionConfig = {
  slug: 'products',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'category', 'price', 'status'], group: 'Shop' },
  access: { read: publishedOrStaff('status', ['active']), create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: 'order',
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
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
