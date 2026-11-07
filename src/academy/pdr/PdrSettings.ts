import type { GlobalConfig } from 'payload'
import { isStaff } from '../../access'

export const PdrSettings: GlobalConfig = {
  slug: 'pdr-settings',
  label: 'Foundation+ settings',
  admin: { group: 'Foundation+' },
  access: { read: () => true, update: isStaff },
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        // New plan prices → new Stripe prices (the lookup keys move to them)
        if (JSON.stringify(doc.plans ?? {}) === JSON.stringify(previousDoc?.plans ?? {})) return doc
        try {
          const { syncPlanPrices, clearPriceCache } = await import('./billing/stripe')
          await syncPlanPrices(req.payload)
          clearPriceCache()
        } catch (e) {
          req.payload.logger.error({ err: e, msg: 'Updating Foundation+ prices in Stripe failed — they will sync at the next checkout' })
        }
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'enabled',
      label: 'Show Foundation+ on the website',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Off: families can’t see it anywhere (no pages, links or menu items). Staff and coaches can still preview it at /foundation-plus.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'programName', label: 'Program name', type: 'text', required: true, defaultValue: 'Foundation+', admin: { description: 'Shown to families everywhere, e.g. Foundation+' } },
        { name: 'tagline', type: 'text', defaultValue: 'Level up your game — skills, challenges, badges and coach feedback.' },
      ],
    },
    {
      type: 'collapsible',
      label: 'Plans & prices (AUD incl. GST)',
      admin: { description: 'Also editable on Admin → Prices. Once Stripe is connected, the website shows the prices from Stripe.' },
      fields: [
        {
          name: 'plans',
          type: 'group',
          label: false,
          fields: [
            { type: 'row', fields: [{ name: 'standardMonthly', label: 'Standard / month', type: 'number', defaultValue: 9.95, min: 0 }, { name: 'standardYearly', label: 'Standard / year', type: 'number', defaultValue: 89, min: 0 }] },
            { type: 'row', fields: [{ name: 'premiumMonthly', label: 'Premium / month', type: 'number', defaultValue: 24.95, min: 0 }, { name: 'premiumYearly', label: 'Premium / year', type: 'number', defaultValue: 229, min: 0 }] },
            { type: 'row', fields: [{ name: 'siblingDiscountPct', label: '2nd+ player discount (%)', type: 'number', defaultValue: 25, min: 0, max: 100 }, { name: 'trialDays', label: 'Free Premium trial (days)', type: 'number', defaultValue: 30, min: 0, max: 90 }] },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Video submissions',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'maxClipSeconds', label: 'Longest clip (seconds)', type: 'number', defaultValue: 90, min: 10, max: 600 },
            { name: 'maxFileMB', label: 'Largest file (MB)', type: 'number', defaultValue: 200, min: 10, max: 2000 },
            {
              name: 'retentionMonths',
              label: 'Delete videos after review (months)',
              type: 'number',
              defaultValue: 6,
              min: 1,
              max: 36,
              admin: { description: 'Submitted videos are deleted this long after a coach reviews them. Scores and feedback are kept.' },
            },
          ],
        },
        { name: 'feedbackPerMonth', label: 'Premium feedback-only videos per month', type: 'number', defaultValue: 2, min: 0 },
      ],
    },
    {
      type: 'collapsible',
      label: 'Rankings',
      fields: [{ name: 'minPlayersForRanking', label: 'Show a ranking once this many players have passed a stage', type: 'number', defaultValue: 5, min: 1 }],
    },
  ],
}
