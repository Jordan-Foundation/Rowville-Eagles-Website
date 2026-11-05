import type { GlobalConfig } from 'payload'
import { isStaff } from '../access'

/** About page content. Any empty field falls back to the default copy in the page component. */
export const About: GlobalConfig = {
  slug: 'about',
  label: 'About page',
  admin: { group: 'Club' },
  access: { read: () => true, update: isStaff },
  fields: [
    { name: 'intro', type: 'textarea', admin: { description: 'Opening paragraph under the page title' } },
    { name: 'mission', label: 'Mission statement', type: 'textarea' },
    {
      name: 'values',
      type: 'array',
      maxRows: 6,
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'text', type: 'textarea', required: true },
      ],
    },
    { name: 'historyIntro', label: 'History — introduction', type: 'textarea' },
    {
      name: 'milestones',
      label: 'History — timeline',
      type: 'array',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'year', type: 'text', required: true },
            { name: 'title', type: 'text', required: true },
          ],
        },
        { name: 'text', type: 'textarea' },
      ],
    },
    { name: 'childSafe', label: 'Child Safe commitment', type: 'textarea' },
  ],
}
