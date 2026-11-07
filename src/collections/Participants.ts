import type { CollectionConfig } from 'payload'
import { isAdminField, staffOrOwner } from '../access'

/** A player (often a child) managed by an account holder. Foundation for the player development portal. */
export const Participants: CollectionConfig = {
  slug: 'participants',
  admin: {
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'dateOfBirth', 'team', 'account'],
    group: 'People',
  },
  access: {
    read: staffOrOwner('account'),
    create: ({ req: { user } }) => Boolean(user),
    update: staffOrOwner('account'),
    delete: staffOrOwner('account'),
  },
  hooks: {
    beforeChange: [
      ({ data }) => ({ ...data, fullName: `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() }),
    ],
  },
  fields: [
    { name: 'fullName', type: 'text', admin: { hidden: true } },
    {
      type: 'row',
      fields: [
        { name: 'firstName', type: 'text', required: true },
        { name: 'lastName', type: 'text', required: true },
      ],
    },
    { name: 'dateOfBirth', type: 'date', required: true },
    {
      name: 'gender',
      type: 'select',
      options: ['female', 'male', 'non-binary', 'prefer-not-to-say'],
    },
    { name: 'account', type: 'relationship', relationTo: 'users', required: true, label: 'Parent / account holder' },
    { name: 'team', type: 'relationship', relationTo: 'teams' },
    { name: 'ffaNumber', label: 'FFA / PlayFootball number', type: 'text' },
    {
      name: 'football',
      label: 'Football details',
      type: 'group',
      admin: { description: 'Shared with the player’s coaches. Filled in from their first 1-on-1 booking; families can update it in their account.' },
      fields: [
        { type: 'row', fields: [{ name: 'currentClub', type: 'text' }, { name: 'position', type: 'text' }] },
        { name: 'goals', label: 'Main goals', type: 'textarea' },
      ],
    },
    {
      name: 'medical',
      type: 'group',
      fields: [
        { name: 'conditions', type: 'textarea' },
        { name: 'emergencyContact', type: 'text' },
        { name: 'emergencyPhone', type: 'text' },
      ],
    },
    { name: 'photoConsent', type: 'checkbox', defaultValue: false },
    {
      name: 'pdr',
      label: 'Foundation+',
      type: 'group',
      admin: { description: 'Foundation+ plan, leaderboard privacy and parental consent.' },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'tier',
              label: 'Plan',
              type: 'select',
              defaultValue: 'free',
              options: [
                { label: 'Free', value: 'free' },
                { label: 'Standard', value: 'standard' },
                { label: 'Premium', value: 'premium' },
              ],
              access: { update: isAdminField },
            },
            { name: 'subscriptionId', label: 'Stripe subscription', type: 'text', index: true, admin: { readOnly: true } },
            { name: 'subscriptionStatus', label: 'Subscription status', type: 'text', admin: { readOnly: true } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'plan', type: 'text', admin: { readOnly: true, description: 'e.g. premium_month' } },
            { name: 'trialEndsAt', label: 'Free trial ends', type: 'date', admin: { readOnly: true } },
            { name: 'currentPeriodEnd', label: 'Paid until', type: 'date', admin: { readOnly: true } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'cancelAtPeriodEnd', label: 'Cancels at period end', type: 'checkbox', admin: { readOnly: true } },
            { name: 'pastDueSince', label: 'Payment failing since', type: 'date', admin: { readOnly: true } },
            { name: 'trialUsedAt', label: 'Free month used', type: 'date', admin: { readOnly: true } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'leaderboardOptOut', label: 'Hide from leaderboards', type: 'checkbox', defaultValue: false },
            { name: 'leaderboardName', label: 'Leaderboard name', type: 'text', admin: { description: 'Default: first name + last initial, e.g. Mia T.' } },
            { name: 'consentAt', label: 'Parent/guardian consent given', type: 'date', admin: { readOnly: true } },
          ],
        },
      ],
    },
    {
      name: 'memberships',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Rowville player (team registration paid)', value: 'rowville' },
        { label: 'RFA (Academy term enrolled)', value: 'rfa' },
        { label: 'Foundation+ player (paid or trialling)', value: 'foundation-plus' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Added automatically when registration / Academy term is paid. Edit by hand for players registered outside the website.',
      },
    },
    {
      name: 'registrationOffer',
      label: 'Team registration offer',
      type: 'group',
      admin: { description: 'Set automatically when the committee offers a place after trials.' },
      fields: [
        { type: 'row', fields: [
          { name: 'program', type: 'relationship', relationTo: 'programs' },
          { name: 'status', type: 'select', options: ['offered', 'paid'] },
        ] },
      ],
    },
  ],
}
