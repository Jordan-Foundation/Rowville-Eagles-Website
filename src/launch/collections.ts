import type { GlobalConfig } from 'payload'
import { isStaff } from '../access'
import { DEFAULT_COPY } from './render'

/** Portal launch: the launch email + text, the reminder and the 1-on-1 follow-up (all editable), and the current send. */
export const PortalLaunch: GlobalConfig = {
  slug: 'portal-launch',
  label: 'Portal launch',
  admin: { group: 'People', hidden: true },
  access: { read: isStaff, update: isStaff },
  fields: [
    { name: 'launchSubject', type: 'text', defaultValue: DEFAULT_COPY.launchSubject },
    { name: 'launchBody', type: 'textarea', defaultValue: DEFAULT_COPY.launchBody },
    { name: 'launchSms', type: 'textarea', defaultValue: DEFAULT_COPY.launchSms },
    { name: 'followUpSubject', type: 'text', defaultValue: DEFAULT_COPY.followUpSubject },
    { name: 'followUpBody', type: 'textarea', defaultValue: DEFAULT_COPY.followUpBody },
    { type: 'row', fields: [
      { name: 'reminderEnabled', type: 'checkbox', defaultValue: true },
      { name: 'reminderDays', type: 'number', defaultValue: 5, min: 1, max: 60 },
      { name: 'followUpDays', type: 'number', defaultValue: 7, min: 1, max: 60 },
      { name: 'followUpPaused', type: 'checkbox', defaultValue: false },
    ] },
    {
      name: 'run',
      type: 'group',
      fields: [
        { name: 'status', type: 'select', defaultValue: 'idle', options: ['idle', 'scheduled', 'sending', 'done'] },
        { name: 'scheduledFor', type: 'date' },
        { name: 'filter', type: 'json' },
        { name: 'by', type: 'relationship', relationTo: 'users' },
        { name: 'startedAt', type: 'date' },
        { name: 'finishedAt', type: 'date' },
        { name: 'counts', type: 'json' },
      ],
    },
  ],
}
