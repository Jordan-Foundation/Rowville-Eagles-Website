import type { GlobalConfig } from 'payload'
import { isStaff } from '../access'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  admin: { group: 'Club' },
  access: { read: () => true, update: isStaff },
  fields: [
    { name: 'clubName', type: 'text', defaultValue: 'Rowville Eagles Football Club' },
    { name: 'tagline', type: 'text' },
    { name: 'email', type: 'email' },
    { name: 'phone', type: 'text' },
    {
      name: 'ground',
      type: 'group',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'address', type: 'text' },
        { name: 'mapUrl', type: 'text' },
      ],
    },
    {
      name: 'shop',
      type: 'group',
      fields: [
        { name: 'postageFee', type: 'number', defaultValue: 12, admin: { description: 'Flat postage (AUD)' } },
        { name: 'pickupNote', type: 'text', defaultValue: 'Collect from the canteen on training nights' },
      ],
    },
    {
      name: 'links',
      type: 'group',
      fields: [
        { name: 'playFootball', type: 'text', label: 'PlayFootball registration URL' },
        { name: 'driblFixtures', type: 'text', label: 'Dribl fixtures URL' },
        { name: 'facebook', type: 'text' },
        { name: 'instagram', type: 'text' },
      ],
    },
  ],
}
