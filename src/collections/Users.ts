import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { hasRole, isAdminField } from '../access'
import { toE164 } from '../lib/sms'

/**
 * One account type for everyone: committee, coaches, parents and adult players.
 * Junior players are NOT accounts — they are Participants owned by a parent/guardian
 * (see Participants) to meet Child Safe Standards and privacy obligations.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'firstName', 'lastName', 'roles'],
    group: 'People',
  },
  auth: { tokenExpiration: 60 * 60 * 24 * 14, cookies: { sameSite: 'Lax' } },
  hooks: {
    beforeDelete: [
      async ({ id, req }) => {
        const { totalDocs } = await req.payload.count({ collection: 'academy-coaches', where: { user: { equals: id } }, overrideAccess: true, req })
        if (totalDocs > 0) {
          throw new APIError(
            'This user has a Foundation Academy coach profile. Untick “Active” on their coach profile (and remove the Coach role) instead of deleting them, so their booking history is kept.',
            400,
            undefined,
            true,
          )
        }
      },
    ],
    afterLogin: [
      async ({ user, req }) => {
        if (!user.activated) await req.payload.update({ collection: 'users', id: user.id, data: { activated: true }, overrideAccess: true, req })
        // Pick up anything booked or bought as a guest with this email
        try {
          const { linkGuestRecords } = await import('../lib/accounts') // lazy: avoids an import cycle with the config
          await linkGuestRecords(req.payload, user, req)
        } catch (e) {
          req.payload.logger.error({ err: e, msg: `Linking guest records failed for user ${user.id}` })
        }
      },
    ],
  },
  access: {
    admin: ({ req: { user } }) => hasRole(user as never, 'admin', 'committee', 'coach'),
    read: ({ req: { user } }) => {
      if (!user) return false
      if (hasRole(user as never, 'admin', 'committee')) return true
      return { id: { equals: user.id } }
    },
    create: () => true, // public sign-up for parents/players
    update: ({ req: { user } }) => {
      if (!user) return false
      if (hasRole(user as never, 'admin')) return true
      return { id: { equals: user.id } }
    },
    delete: ({ req: { user } }) => hasRole(user as never, 'admin'),
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'firstName', type: 'text' },
        { name: 'lastName', type: 'text' },
      ],
    },
    { name: 'phone', label: 'Mobile', type: 'text' },
    { name: 'stripeCustomerAcademy', type: 'text', index: true, admin: { hidden: true }, access: { create: () => false, update: () => false } },
    // Emailed login link (one use, 20 minutes): only a hash of the token is stored
    { name: 'loginLinkHash', type: 'text', index: true, admin: { hidden: true }, access: { read: () => false, create: () => false, update: () => false } },
    { name: 'loginLinkExpires', type: 'date', admin: { hidden: true }, access: { read: () => false, create: () => false, update: () => false } },
    // The shop cart, so it follows the family between phone and computer (prices are always re-checked at checkout)
    { name: 'savedCart', type: 'json', admin: { hidden: true }, access: { read: () => false, create: () => false, update: () => false } },
    {
      // Normalised copy of the mobile (+614…) so replies and calls from Twilio can be matched to the account
      name: 'phoneE164',
      type: 'text',
      index: true,
      admin: { hidden: true },
      access: { create: () => false, update: () => false },
      hooks: { beforeChange: [({ siblingData, value }) => ('phone' in siblingData ? toE164(siblingData.phone) : value)] },
    },
    {
      type: 'collapsible',
      label: 'Communication preferences',
      admin: {
        initCollapsed: true,
        description: 'Change these from the member’s own preferences page so every change is recorded in Consent records.',
      },
      fields: [
        { name: 'serviceConsentAt', type: 'date', access: { update: isAdminField }, admin: { readOnly: true } },
        { name: 'marketingEmail', type: 'checkbox', defaultValue: false, access: { create: isAdminField, update: isAdminField }, admin: { readOnly: true } },
        { name: 'marketingSms', type: 'checkbox', defaultValue: false, access: { create: isAdminField, update: isAdminField }, admin: { readOnly: true } },
        {
          name: 'smsOptOut',
          label: 'Replied STOP (no SMS at all)',
          type: 'checkbox',
          defaultValue: false,
          access: { create: isAdminField, update: isAdminField },
          admin: { readOnly: true },
        },
        {
          name: 'consentReviewStatus', index: true,
          type: 'select',
          defaultValue: 'new',
          access: { create: isAdminField, update: isAdminField },
          options: [
            { label: 'New account (chose on sign-up)', value: 'new' },
            { label: 'Existing member — needs review', value: 'pending' },
            { label: 'Confirm email sent', value: 'sent' },
            { label: 'Confirmed', value: 'confirmed' },
          ],
          admin: { readOnly: true },
        },
      ],
    },
    {
      name: 'activated',
      type: 'checkbox',
      defaultValue: false,
      admin: { readOnly: true, position: 'sidebar', description: 'Has set their own password / logged in' },
    },
    {
      name: 'reviewRequestSentAt',
      label: 'Google review request sent',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'accountReminderSentAt',
      label: 'Create-account reminder sent',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar', description: 'The one reminder sent to a guest who hasn’t set up their account yet', date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      defaultValue: ['parent'],
      saveToJWT: true,
      access: { create: isAdminField, update: isAdminField },
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Committee', value: 'committee' },
        { label: 'Coach', value: 'coach' },
        { label: 'Parent / Guardian', value: 'parent' },
        { label: 'Player (18+)', value: 'player' },
      ],
    },
    {
      name: 'wwcc',
      label: 'Working With Children Check',
      type: 'group',
      admin: { condition: (data) => data?.roles?.includes('coach') },
      access: { read: isAdminField, update: isAdminField },
      fields: [
        { name: 'number', type: 'text' },
        { name: 'expiry', type: 'date' },
      ],
    },
  ],
}
