import type { CollectionConfig, GlobalConfig } from 'payload'
import { isAdmin } from '../access'

/** A phone or browser that agreed to notifications (one row per device). Users only ever add their own, through the site. */
export const PushSubscriptions: CollectionConfig = {
  slug: 'push-subscriptions',
  labels: { singular: 'Notification device', plural: 'Notification devices' },
  admin: { group: 'People', hidden: true },
  access: { read: isAdmin, create: () => false, update: () => false, delete: isAdmin },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'endpoint', type: 'text', required: true, unique: true, index: true },
    { name: 'p256dh', type: 'text', required: true },
    { name: 'auth', type: 'text', required: true },
    { name: 'device', type: 'text' },
    { name: 'lastSentAt', type: 'date' },
  ],
}

/** The site's own notification keys, made automatically the first time they're needed. Never shown anywhere. */
export const PushKeys: GlobalConfig = {
  slug: 'push-keys',
  admin: { hidden: true },
  access: { read: () => false, update: () => false },
  fields: [
    { name: 'publicKey', type: 'text' },
    { name: 'privateKey', type: 'text' },
  ],
}
