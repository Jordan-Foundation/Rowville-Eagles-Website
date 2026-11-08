/** The policies families agree to when booking. Each lives at /policies/<slug>. */
export const POLICIES = [
  { key: 'codeOfConduct', slug: 'code-of-conduct', title: 'Code of Conduct' },
  { key: 'childSafe', slug: 'child-safe', title: 'Child Safe policy' },
  { key: 'refunds', slug: 'refunds', title: 'Refunds & cancellations' },
  { key: 'academyTerms', slug: 'academy-terms', title: 'Foundation Academy terms' },
  { key: 'privacy', slug: 'privacy', title: 'Privacy policy' },
] as const
export type PolicyKey = (typeof POLICIES)[number]['key']
export const policyHref = (key: PolicyKey) => `/policies/${POLICIES.find((p) => p.key === key)!.slug}`
