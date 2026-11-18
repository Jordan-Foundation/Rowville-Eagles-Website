import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { hasRole, isAdminField, type WithRoles } from '../access'
import type { FieldAccess } from 'payload'

const isStaffField: FieldAccess = ({ req: { user } }) => hasRole(user as WithRoles, 'admin', 'committee')
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
    afterChange: [
      async ({ doc, previousDoc, operation, req, context }) => {
        // Refer a Friend: an invited family has signed up
        if (operation === 'create') await (await import('../referrals/service')).advanceInvites(req.payload, { email: doc.email, phone: doc.phone, status: 'signed_up', account: doc.id }).catch(() => null)
        // A family has set up their account (any route: invite link, login link, sign-up): welcome email with the app guide
        if (doc.activated && !previousDoc?.activated && !doc.app?.welcomeSentAt && !context?.skipWelcome) {
          await (await import('../lib/app-install')).sendWelcomeEmail(req.payload, doc, req).catch((e) => req.payload.logger.error({ err: e, msg: `Welcome email to user ${doc.id} failed` }))
        }
        return doc
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
    { name: 'referralCode', label: 'Referred with code', type: 'text', index: true, admin: { position: 'sidebar', readOnly: true, description: 'The referral code this family arrived with' } },
    { name: 'referralCodeAt', type: 'date', admin: { position: 'sidebar', readOnly: true, hidden: true } },
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
      name: 'app',
      label: 'App & notifications',
      type: 'group',
      admin: { position: 'sidebar', description: 'Recorded by the site when the app is installed and notifications are turned on' },
      access: { update: isStaffField },
      fields: [
        { name: 'installedAt', label: 'App installed', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'pushEnabledAt', label: 'Notifications turned on', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'cardSnoozedUntil', label: '“Get the app” hidden until', type: 'date', admin: { readOnly: true } },
        { name: 'welcomeSentAt', label: 'Welcome email sent', type: 'date', admin: { readOnly: true } },
        { name: 'reminderSentAt', label: 'App reminder email sent', type: 'date', admin: { readOnly: true } },
      ],
    },
    {
      name: 'notify',
      label: 'Notification types',
      type: 'group',
      admin: { description: 'Phone notifications this person gets (all on for new accounts; they can turn each off in their account)' },
      fields: [
        { name: 'reminders', label: 'Session reminders', type: 'checkbox', defaultValue: true },
        { name: 'changes', label: 'Changes and cancellations', type: 'checkbox', defaultValue: true },
        { name: 'teams', label: 'Fixtures and team updates', type: 'checkbox', defaultValue: true },
        { name: 'openings', label: 'New holiday camps and 1-on-1 times', type: 'checkbox', defaultValue: true },
        { name: 'messages', label: 'Messages from coaches and the club', type: 'checkbox', defaultValue: true },
        { name: 'progress', label: 'Progress, badges and reports', type: 'checkbox', defaultValue: true },
      ],
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
      admin: { condition: (data) => data?.roles?.includes('coach'), description: 'The coach enters these when they sign up (Management → Coaches checks them).' },
      access: { read: isStaffField, update: isStaffField },
      fields: [
        { name: 'number', type: 'text' },
        { name: 'expiry', type: 'date' },
        { name: 'photo', label: 'Photo of the card', type: 'upload', relationTo: 'wwcc-files' },
        { type: 'row', fields: [
          { name: 'submittedAt', label: 'Sent by the coach', type: 'date', admin: { readOnly: true } },
          { name: 'checkedAt', label: 'Checked by Management', type: 'date', admin: { readOnly: true } },
          { name: 'checkedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
        ] },
      ],
    },
    { name: 'coachInvitedAt', label: 'Coach sign-up link sent', type: 'date', admin: { readOnly: true, position: 'sidebar', condition: (data) => data?.roles?.includes('coach') } },
  ],
}
