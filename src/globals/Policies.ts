import type { GlobalConfig } from 'payload'
import { refreshGlobal } from '../lib/revalidate'
import { isStaff } from '../access'
import { POLICIES } from '../lib/policies'

/**
 * Club & Academy policies linked from every "I agree…" checkbox. Each can be written here, or point to an existing
 * document (e.g. Football Victoria's Member Protection policy). Shown at /policies/<name>.
 */
export const Policies: GlobalConfig = {
  slug: 'policies',
  label: 'Policies',
  admin: { group: 'Club', description: 'Linked from every booking form. Paste the text, or a link to the document (PDF or Football Victoria page).' },
  access: { read: () => true, update: isStaff },
  hooks: { afterChange: [refreshGlobal] },
  fields: POLICIES.map((p) => ({
    type: 'collapsible' as const,
    label: p.title,
    fields: [
      { name: `${p.key}Link`, label: 'Link to the document (optional)', type: 'text' as const, admin: { description: 'If set, the policy link opens this instead of the text below.' } },
      { name: `${p.key}Text`, label: 'Policy text', type: 'textarea' as const, admin: { rows: 12, description: 'Blank line between paragraphs. Lines starting with "## " become headings.' } },
      { name: `${p.key}Updated`, label: 'Last updated', type: 'date' as const, admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
    ],
  })),
}
