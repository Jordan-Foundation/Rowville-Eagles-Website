import type { GlobalConfig } from 'payload'
import { refreshGlobal } from '../lib/revalidate'
import { isStaff } from '../access'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  admin: { group: 'Club' },
  access: { read: () => true, update: isStaff },
  hooks: { afterChange: [refreshGlobal] },
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
    {
      name: 'tracking',
      label: 'Ad tracking (Meta & Google)',
      type: 'group',
      admin: { description: 'Lets Meta and Google Ads see which ads bring bookings. Only runs on the live website, never on Management, coach or private-link pages, and never sends names, emails or children’s details. Leave a box empty to switch that one off. Changes apply straight away.' },
      fields: [
        { name: 'metaPixelId', label: 'Meta Pixel ID', type: 'text', admin: { description: 'Numbers only, e.g. 472931888098255 (Meta Events Manager → Data sources)' }, validate: (v: unknown) => (!v || /^\d{8,20}$/.test(String(v).trim()) ? true : 'A Meta Pixel ID is 8–20 digits.') },
        {
          name: 'googleTagIds',
          label: 'Google tag ID(s)',
          type: 'text',
          admin: { description: 'e.g. AW-123456789 (Google Ads) — add a Google Analytics ID too with a comma: AW-123456789, G-ABC123' },
          validate: (v: unknown) => (!v || String(v).split(',').every((x) => /^(AW|G|GT)-[A-Z0-9]+$/i.test(x.trim())) ? true : 'Use IDs like AW-123456789 or G-ABC123, separated by commas.'),
        },
        { type: 'row', fields: [
          { name: 'adsLeadLabel', label: 'Google Ads conversion label — free trial / enquiry', type: 'text', admin: { description: 'The part after the “/” in send_to, e.g. AbC-D_efG' } },
          { name: 'adsPurchaseLabel', label: 'Google Ads conversion label — paid booking', type: 'text' },
        ] },
      ],
    },
  ],
}
