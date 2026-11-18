import type { GlobalConfig } from 'payload'
import { refreshGlobal } from '../lib/revalidate'
import { parseGoogleIds, unrecognisedGoogleParts } from '../tracking/config'
import { isStaff } from '../access'


/** The club's Meta ad account number — it was once entered here by mistake; a pixel ID is a different number. */
const AD_ACCOUNT = '472931888098255'
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
      name: 'alertEmails',
      label: 'Daily summary emails',
      type: 'text',
      admin: { description: 'Who gets the 8pm summary of bookings, payments, trial sign-ups and problems (separate with commas). Leave empty to use the Management people whose mobile is in “Text alerts” below.' },
    },
    {
      name: 'smsAlertNumbers',
      label: 'Urgent text alerts',
      type: 'text',
      admin: { description: 'Mobiles that get a text whenever someone texts the club’s number, and for urgent website events (a session in the next 48 hours booked, cancelled or moved; cover needed; a trial sign-up — held overnight and sent at 7am), e.g. 0412 345 678, 0498 765 432 (separate with commas). Leave empty for none.' },
      validate: (v: unknown) => {
        const list = String(v ?? '').split(',').map((x) => x.replace(/[\s()-]/g, '')).filter(Boolean)
        return list.every((x) => /^(\+?61|0)4\d{8}$/.test(x)) ? true : 'Use Australian mobile numbers separated by commas, e.g. 0412 345 678.'
      },
    },
    {
      name: 'tracking',
      label: 'Ad tracking (Meta & Google)',
      type: 'group',
      admin: { description: 'Lets Meta and Google Ads see which ads bring bookings. Only runs on the live website, never on Management, coach or private-link pages, and never sends names, emails or children’s details. Leave a box empty to switch that one off. Changes apply straight away.' },
      fields: [
        { name: 'metaPixelId', label: 'Meta Pixel ID', type: 'text', admin: { description: 'The pixel’s ID (Meta Events Manager → Data sources → your pixel), numbers only — not the ad account number.' }, validate: (v: unknown) => (!v ? true : String(v).trim() === AD_ACCOUNT ? 'That’s the club’s Meta ad account number, not a pixel. Use the pixel ID from Events Manager → Data sources.' : /^\d{8,20}$/.test(String(v).trim()) ? true : 'A Meta Pixel ID is 8–20 digits.') },
        {
          name: 'googleTagIds',
          label: 'Google tag ID(s)',
          type: 'text',
          admin: { description: 'Every ID here is loaded on every public page, e.g. G-ABC123 (Google Analytics), AW-123456789 (Google Ads) — separate them with commas. The conversion labels below are sent to the AW- ID.' },
          validate: (v: unknown) => {
            const bad = unrecognisedGoogleParts(String(v ?? ''))
            return bad.length ? `Not a Google tag ID: ${bad.map((b) => `“${b}”`).join(', ')}. Use IDs like G-ABC123 or AW-123456789, separated by commas.` : true
          },
          // Saved in a clean form (plain hyphens and commas) whatever was pasted in
          hooks: { beforeChange: [({ value }) => (typeof value === 'string' && !unrecognisedGoogleParts(value).length ? parseGoogleIds(value).join(', ') : value)] },
        },
        { type: 'row', fields: [
          { name: 'adsLeadLabel', label: 'Google Ads conversion label — free trial / enquiry', type: 'text', admin: { description: 'The part after the “/” in send_to, e.g. AbC-D_efG' } },
          { name: 'adsPurchaseLabel', label: 'Google Ads conversion label — paid booking', type: 'text' },
        ] },
      ],
    },
  ],
}
