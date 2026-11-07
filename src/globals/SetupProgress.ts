import type { GlobalConfig } from 'payload'
import { isStaff } from '../access'

/** Which manual setup steps the owner has ticked (shown on Admin → Setup checklist). */
export const SetupProgress: GlobalConfig = {
  slug: 'setup-progress',
  label: 'Setup progress',
  admin: { hidden: true },
  access: { read: isStaff, update: isStaff },
  fields: [{ name: 'ticked', type: 'json' }],
}
