import type { Payload } from 'payload'

/**
 * Finds sample/placeholder wording that must not go live ("This is sample copy — replace it in the admin…").
 * Shown on the Setup checklist with a link to each place, so nothing slips through.
 */
const PATTERN = /\b(sample (copy|article|bio|match report|tournament wrap|season wrap|player|school term)|this is sample|replace (it )?in (the )?(admin|coach portal)|replace with (a )?real|replace with the real|lorem ipsum|placeholder)\b/i

export const hasSampleText = (text: unknown) => PATTERN.test(typeof text === 'string' ? text : JSON.stringify(text ?? ''))

export type SampleHit = { where: string; href: string }

export async function findSampleText(p: Payload): Promise<SampleHit[]> {
  const q = { depth: 0, overrideAccess: true, limit: 500 } as const
  const [posts, programs, coaches, products, terms] = await Promise.all([
    p.find({ collection: 'posts', ...q, where: { status: { equals: 'published' } } }),
    p.find({ collection: 'programs', ...q, where: { status: { not_equals: 'closed' } } }),
    p.find({ collection: 'academy-coaches', ...q, where: { active: { equals: true } } }),
    p.find({ collection: 'products', ...q, where: { status: { equals: 'active' } } }),
    p.find({ collection: 'academy-terms', ...q, where: { status: { not_equals: 'closed' } } }),
  ])
  const hits: SampleHit[] = []
  for (const d of posts.docs) if (hasSampleText([d.title, d.excerpt, d.content])) hits.push({ where: `News: ${d.title}`, href: `/admin/collections/posts/${d.id}` })
  for (const d of programs.docs) if (hasSampleText([d.title, d.summary, d.description, d.scheduleNote])) hits.push({ where: `Program: ${d.title}`, href: `/admin/collections/programs/${d.id}` })
  for (const d of coaches.docs) if (hasSampleText(d.bio)) hits.push({ where: `Coach bio: ${d.displayName}`, href: `/admin/collections/academy-coaches/${d.id}` })
  for (const d of products.docs) if (hasSampleText([d.name, d.description])) hits.push({ where: `Shop: ${d.name}`, href: `/admin/collections/products/${d.id}` })
  for (const d of terms.docs) if (hasSampleText([d.name, (d as unknown as { notes?: string }).notes])) hits.push({ where: `Academy term: ${d.name}`, href: `/admin/collections/academy-terms/${d.id}` })
  return hits
}
