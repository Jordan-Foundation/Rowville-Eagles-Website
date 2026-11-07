import type { GlobalConfig } from 'payload'
import { isStaff } from '../access'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  admin: { group: 'Club' },
  access: { read: () => true, update: isStaff },
  fields: [
    { name: 'clubName', type: 'text', defaultValue: 'Rowville Eagles Football Club' },
    { name: 'tagline', type: 'text' },
    { name: 'season', label: 'Season (year)', type: 'number', defaultValue: 2027, admin: { description: 'Age groups are worked out from this: MiniRoos age group = season − year of birth (e.g. 2026: born 2017 → 9s). Change it each season and every group rolls over.' } },
    {
      name: 'ageGroups',
      label: 'Age group rules (MiniRoos)',
      type: 'group',
      admin: { description: 'Football Victoria / FA MiniRoos rules. Players can move up freely; down only if they can’t take part in their rightful group.' },
      fields: [
        { type: 'row', fields: [
          { name: 'miniMin', label: 'Youngest MiniRoos group', type: 'number', defaultValue: 6, min: 3, max: 12, admin: { description: 'e.g. 6 = 6s' } },
          { name: 'miniMax', label: 'Oldest MiniRoos group', type: 'number', defaultValue: 11, min: 6, max: 14, admin: { description: 'e.g. 11 = 11s' } },
          { name: 'maxDown', label: 'Most groups a player can move down', type: 'number', defaultValue: 2, min: 0, max: 5 },
          { name: 'warnDown', label: 'Warn when moving down this many', type: 'number', defaultValue: 2, min: 1, max: 5 },
        ] },
      ],
    },
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
