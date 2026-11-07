import type { CollectionConfig } from 'payload'
import { isStaff } from '../../../access'

/** People waiting for Foundation+ to launch. They get one email to claim their free month when it goes live. */
export const FplusWaitlist: CollectionConfig = {
  slug: 'fplus-waitlist',
  labels: { singular: 'Waitlist sign-up', plural: 'Foundation+ waitlist' },
  admin: { group: 'Foundation+', useAsTitle: 'email', defaultColumns: ['email', 'source', 'createdAt', 'notifiedAt', 'claimedAt'] },
  access: { read: isStaff, create: () => false, update: isStaff, delete: isStaff },
  defaultSort: '-createdAt',
  fields: [
    { name: 'email', type: 'email', required: true, unique: true, index: true },
    { type: 'row', fields: [{ name: 'source', type: 'text', admin: { readOnly: true } }, { name: 'notifiedAt', label: 'Launch email sent', type: 'date', admin: { readOnly: true } }, { name: 'claimedAt', label: 'Free month claimed', type: 'date', admin: { readOnly: true } }] },
    { name: 'wording', label: 'What they agreed to', type: 'text', admin: { readOnly: true } },
  ],
}

/** Short-lived record of public form submissions (hashed), for rate limiting. Cleared after a day. */
export const FormThrottle: CollectionConfig = {
  slug: 'form-throttle',
  admin: { hidden: true },
  access: { read: () => false, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'key', type: 'text', required: true, index: true },
    { name: 'form', type: 'text', index: true },
  ],
}
