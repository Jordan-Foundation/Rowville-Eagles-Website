import type { CollectionConfig, GlobalConfig } from 'payload'
import { isStaff } from '../access'
import { refreshGlobal } from '../lib/revalidate'
import { REFERRAL_PROGRAMS } from './programs'

const programOptions = REFERRAL_PROGRAMS.map((p) => ({ label: p.label, value: p.value }))
const readOnly = { readOnly: true } as const

/** A link a parent made for one friend (the parent shares it themselves — the club never sends invites). */
export const ReferralInvites: CollectionConfig = {
  slug: 'referral-invites',
  labels: { singular: 'Referral invite', plural: 'Referral invites' },
  admin: { group: 'Referrals', useAsTitle: 'inviteeName', defaultColumns: ['inviteeName', 'referrer', 'featured', 'status', 'createdAt'], description: 'Links parents created in Refer a Friend.' },
  access: { read: isStaff, create: () => false, update: isStaff, delete: () => false },
  defaultSort: '-createdAt',
  fields: [
    { name: 'token', type: 'text', required: true, unique: true, index: true, admin: { readOnly: true } },
    { type: 'row', fields: [
      { name: 'referrer', label: 'Player who gets the credit', type: 'relationship', relationTo: 'participants', required: true, index: true },
      { name: 'sentBy', label: 'Parent', type: 'relationship', relationTo: 'users', required: true, index: true },
    ] },
    { type: 'row', fields: [
      { name: 'inviteeName', label: 'Friend’s name', type: 'text' },
      { name: 'inviteeEmail', label: 'Email', type: 'email', index: true },
      { name: 'inviteePhone', label: 'Mobile', type: 'text', index: true },
    ] },
    { name: 'featured', label: 'Program recommended', type: 'select', required: true, options: programOptions },
    { name: 'status', type: 'select', required: true, defaultValue: 'invited', index: true, options: [
      { label: 'Invited', value: 'invited' }, { label: 'Signed up', value: 'signed_up' }, { label: 'Trial registered', value: 'trial_registered' }, { label: 'Paid', value: 'paid' }, { label: 'Expired', value: 'expired' },
    ] },
    { name: 'account', label: 'Their account (once they sign up)', type: 'relationship', relationTo: 'users', admin: readOnly },
    { name: 'expiresAt', type: 'date', admin: readOnly },
  ],
}

/** One per referred player (their first qualifying purchase). */
export const Referrals: CollectionConfig = {
  slug: 'referrals',
  labels: { singular: 'Referral', plural: 'Referrals' },
  admin: { group: 'Referrals', useAsTitle: 'reference', defaultColumns: ['reference', 'referrer', 'referred', 'program', 'status', 'confirmAfter'], description: 'Use Management → Referrals.' },
  access: { read: isStaff, create: () => false, update: isStaff, delete: () => false },
  defaultSort: '-createdAt',
  fields: [
    { type: 'row', fields: [
      { name: 'referrer', label: 'Referring player', type: 'relationship', relationTo: 'participants', required: true, index: true },
      { name: 'referrerAccount', label: 'Referring family', type: 'relationship', relationTo: 'users', index: true },
    ] },
    { type: 'row', fields: [
      { name: 'referred', label: 'Referred player', type: 'relationship', relationTo: 'participants', required: true, unique: true, index: true },
      { name: 'referredAccount', label: 'Referred family', type: 'relationship', relationTo: 'users', index: true },
    ] },
    { type: 'row', fields: [
      { name: 'invite', type: 'relationship', relationTo: 'referral-invites' },
      { name: 'attribution', type: 'select', required: true, options: [{ label: 'Referral code', value: 'code' }, { label: 'Matched an invite', value: 'invite_match' }, { label: 'Set by Management', value: 'manual' }] },
      { name: 'program', type: 'select', required: true, index: true, options: programOptions },
    ] },
    { type: 'row', fields: [
      { name: 'sourceKind', type: 'select', required: true, options: ['booking', 'academy'] },
      { name: 'sourceId', type: 'number', required: true, index: true },
      { name: 'reference', type: 'text', index: true },
      { name: 'amount', type: 'number' },
    ] },
    { type: 'row', fields: [
      { name: 'paidAt', type: 'date', required: true },
      { name: 'confirmAfter', type: 'date', required: true, index: true },
      { name: 'status', type: 'select', required: true, defaultValue: 'pending', index: true, options: [{ label: 'Pending', value: 'pending' }, { label: 'Confirmed', value: 'confirmed' }, { label: 'Voided', value: 'voided' }] },
      { name: 'confirmedAt', type: 'date' },
    ] },
    { name: 'reviewFlag', label: 'Needs a look', type: 'text', admin: { description: 'e.g. refunded after it was confirmed' } },
    { name: 'history', type: 'array', admin: { readOnly: true }, fields: [{ type: 'row', fields: [{ name: 'at', type: 'date' }, { name: 'action', type: 'text' }, { name: 'by', type: 'relationship', relationTo: 'users' }] }, { name: 'note', type: 'text' }] },
  ],
}

/** Rewards for reaching a number of confirmed referrals — add more here, no code changes needed. */
export const ReferralMilestones: CollectionConfig = {
  slug: 'referral-milestones',
  labels: { singular: 'Referral reward', plural: 'Referral rewards (milestones)' },
  admin: { group: 'Referrals', useAsTitle: 'rewardName', defaultColumns: ['threshold', 'rewardName', 'rewardType', 'active'], description: 'Each player unlocks each reward once, when they reach that many confirmed referrals.' },
  access: { read: () => true, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: 'threshold',
  fields: [
    { type: 'row', fields: [
      { name: 'threshold', label: 'Confirmed referrals needed', type: 'number', required: true, min: 1, unique: true },
      { name: 'rewardName', label: 'Reward', type: 'text', required: true },
      { name: 'rewardType', type: 'select', required: true, defaultValue: 'physical_item', options: [{ label: 'Physical item (claimed with a size, posted/handed out)', value: 'physical_item' }, { label: 'Free 1-on-1 session (credit)', value: 'one_on_one_credit' }, { label: 'Free Academy term (100% off one term)', value: 'academy_term_credit' }] },
    ] },
    { name: 'sizes', type: 'text', admin: { description: 'Physical items: sizes to choose from, separated by commas (leave empty for no size)', condition: (d) => d?.rewardType === 'physical_item' } },
    { type: 'row', fields: [{ name: 'active', type: 'checkbox', defaultValue: true }, { name: 'sortOrder', type: 'number', defaultValue: 0 }] },
  ],
}

/** A reward a player has unlocked. */
export const ReferralRewards: CollectionConfig = {
  slug: 'referral-rewards',
  labels: { singular: 'Unlocked reward', plural: 'Unlocked rewards' },
  admin: { group: 'Referrals', defaultColumns: ['participant', 'milestone', 'status', 'size', 'createdAt'], description: 'Use Management → Referrals → Rewards.' },
  access: { read: isStaff, create: () => false, update: isStaff, delete: () => false },
  defaultSort: '-createdAt',
  indexes: [{ fields: ['participant', 'milestone'], unique: true }],
  fields: [
    { type: 'row', fields: [
      { name: 'participant', label: 'Player', type: 'relationship', relationTo: 'participants', required: true, index: true },
      { name: 'account', label: 'Family', type: 'relationship', relationTo: 'users', index: true },
      { name: 'milestone', type: 'relationship', relationTo: 'referral-milestones', required: true, index: true },
    ] },
    { type: 'row', fields: [
      { name: 'status', type: 'select', required: true, defaultValue: 'unlocked', index: true, options: [
        { label: 'Unlocked', value: 'unlocked' }, { label: 'Claimed — to fulfil', value: 'claimed' }, { label: 'Fulfilled', value: 'fulfilled' }, { label: 'Redeemed', value: 'redeemed' }, { label: 'On hold (needs review)', value: 'held' },
      ] },
      { name: 'size', type: 'text' },
    ] },
    { type: 'row', fields: [
      { name: 'claimedAt', type: 'date' },
      { name: 'fulfilledAt', type: 'date' },
    ] },
    { type: 'row', fields: [
      { name: 'credit', label: '1-on-1 credit', type: 'relationship', relationTo: 'academy-credits', admin: readOnly },
      { name: 'promotion', label: 'Free term promotion', type: 'relationship', relationTo: 'promotions', admin: readOnly },
    ] },
    { name: 'note', type: 'text' },
  ],
}

/** Settings: how long until a referral counts, and invite limits. */
export const ReferralSettings: GlobalConfig = {
  slug: 'referral-settings',
  label: 'Referral settings',
  admin: { group: 'Referrals' },
  access: { read: isStaff, update: isStaff },
  hooks: { afterChange: [refreshGlobal] },
  fields: [
    { name: 'enabled', label: 'Refer a Friend is on', type: 'checkbox', defaultValue: true },
    {
      name: 'windows',
      label: 'Refund window (days after payment) — a referral counts once this has passed, or once the program has started, whichever is first',
      type: 'group',
      admin: { description: '1-on-1s count once the player’s first session has gone ahead (after that the 1-on-1 refund policy no longer allows a refund).' },
      fields: [{ type: 'row', fields: [
        { name: 'eagles', label: 'Rowville Eagles registration', type: 'number', defaultValue: 14, min: 0 },
        { name: 'academyTerm', label: 'Academy term', type: 'number', defaultValue: 14, min: 0 },
        { name: 'holidayCamp', label: 'Holiday camp', type: 'number', defaultValue: 14, min: 0 },
        { name: 'miniBallers', label: 'Mini Ballers', type: 'number', defaultValue: 14, min: 0 },
      ] }],
    },
    { type: 'row', fields: [
      { name: 'dailyInviteLimit', label: 'Invite links per parent per day', type: 'number', defaultValue: 10, min: 1 },
      { name: 'inviteExpiryDays', label: 'Invites expire after (days)', type: 'number', defaultValue: 60, min: 1, admin: { description: 'Only the invite’s status — a referral code already saved on a family’s account keeps working' } },
    ] },
  ],
}
