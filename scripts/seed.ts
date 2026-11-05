/**
 * Seeds SAMPLE content for local development. Prices, dates and copy are placeholders
 * for the committee to replace in /admin. Run: npm run seed
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

const para = (text: string) => ({
  root: {
    type: 'root', format: '' as const, indent: 0, version: 1, direction: 'ltr' as const,
    children: text.split('\n\n').map((t) => ({
      type: 'paragraph', format: '' as const, indent: 0, version: 1, direction: 'ltr' as const, textFormat: 0,
      children: [{ type: 'text', text: t, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }],
    })),
  },
})

const payload = await getPayload({ config })

for (const c of ['bookings', 'participants', 'programs', 'teams', 'posts', 'sponsors'] as const) {
  await payload.delete({ collection: c, where: { id: { exists: true } } })
}

const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@rowvilleeagles.local'
const existing = await payload.find({ collection: 'users', where: { email: { equals: adminEmail } } })
if (!existing.docs.length) {
  await payload.create({
    collection: 'users',
    data: { email: adminEmail, password: process.env.SEED_ADMIN_PASSWORD || 'change-me-now', firstName: 'Club', lastName: 'Admin', roles: ['admin'] },
  })
}

await payload.updateGlobal({
  slug: 'site-settings',
  data: {
    clubName: 'Rowville Eagles Football Club',
    tagline: 'Community football in Rowville since 1985 — from MiniRoos to seniors and the Rowville Foundation Academy.',
    email: 'refc.secretary@outlook.com',
    ground: {
      name: 'Rowville Eagles FC',
      address: '208 Dandelion Drive, Rowville VIC 3178',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=208+Dandelion+Drive+Rowville+VIC+3178',
    },
    links: {
      playFootball: 'https://www.playfootball.com.au',
      driblFixtures: '',
      facebook: 'https://www.facebook.com/rowvilleeaglesfc/',
      instagram: 'https://www.instagram.com/rowvilleeaglesfc/',
    },
  },
})

const miniroos = ['U6', 'U7', 'U8', 'U9', 'U10', 'U11']
let order = 0
for (const age of miniroos) {
  for (const n of [1, 2]) {
    await payload.create({
      collection: 'teams',
      data: { name: `${age} Eagles ${n}`, slug: `${age}-eagles-${n}`.toLowerCase(), category: 'miniroos', ageGroup: age, trainingTimes: 'Tue & Thu 5:00pm', order: order++ },
    })
  }
}
for (const t of [
  { name: 'Senior Women', slug: 'senior-women', category: 'senior-women', ageGroup: 'Seniors' },
  { name: 'Senior Men', slug: 'senior-men', category: 'senior-men', ageGroup: 'Seniors' },
  { name: "Men's Reserves", slug: 'mens-reserves', category: 'senior-men', ageGroup: 'Reserves' },
] as const) {
  await payload.create({ collection: 'teams', data: { ...t, trainingTimes: 'Tue & Thu 7:00pm', order: order++ } })
}

const programs = [
  { title: '2027 MiniRoos Registration', slug: '2027-miniroos-registration', type: 'registration', brand: 'club', status: 'open', price: 220, ageRange: 'U5 – U11', startDate: '2027-04-01T00:00:00.000Z', priceNote: 'Club fee only — complete FV registration in PlayFootball after payment', summary: 'Secure your child’s place for the 2027 MiniRoos season. Includes training kit and end-of-season celebration.' },
  { title: '2027 Senior Registration', slug: '2027-senior-registration', type: 'registration', brand: 'club', status: 'open', price: 380, ageRange: '18+', startDate: '2027-02-01T00:00:00.000Z', priceNote: 'Club fee only — FV fees paid in PlayFootball', summary: 'Senior Men, Men’s Reserves and Senior Women. Pre-season starts February.' },
  { title: 'January Holiday Camp', slug: 'january-holiday-camp-2027', type: 'holiday-camp', brand: 'academy', status: 'open', price: 165, capacity: 60, ageRange: 'Ages 5–13', scheduleNote: '3 days · 9am–3pm', location: 'Home ground', startDate: '2027-01-12T22:00:00.000Z', endDate: '2027-01-15T04:00:00.000Z', summary: 'Three days of games, skills stations and mini-tournaments with our senior players and coaches.' },
  { title: 'Eagles Autumn Cup', slug: 'eagles-autumn-cup-2027', type: 'tournament', brand: 'academy', status: 'open', price: 250, ageRange: 'U8 – U12', scheduleNote: 'Per team entry', startDate: '2027-03-20T22:00:00.000Z', summary: 'Our annual junior tournament — enter your team for a full day of football at Rowville.' },
  { title: 'Academy Term 1', slug: 'academy-term-1-2027', type: 'academy-term', brand: 'academy', status: 'open', price: 440, capacity: 24, ageRange: 'Ages 8–14', scheduleNote: 'Weekly · 9 sessions', startDate: '2027-02-02T07:00:00.000Z', summary: 'Weekly high-performance sessions in groups of no more than 12, with an individual development plan and end-of-term review.' },
  { title: 'Academy Trial Session', slug: 'academy-trial', type: 'academy-trial', brand: 'academy', status: 'open', price: 25, ageRange: 'Ages 8–14', scheduleNote: '75 minutes', summary: 'Experience an Academy session and meet the coaching team. Fee credited to your first term.' },
  { title: '1-on-1 Coaching', slug: 'private-coaching', type: 'private-session', brand: 'academy', status: 'open', price: 75, ageRange: 'All ages', scheduleNote: '60 minutes · choose your time', summary: 'Personalised technical sessions with an Academy coach, focused on your player’s individual goals.' },
] as const

for (const p of programs) {
  await payload.create({ collection: 'programs', data: { ...p, description: para(`${p.summary}\n\nThis is sample copy — replace it in the admin with the full program details, what to bring, and cancellation policy.`) } })
}

const posts = [
  { title: '2027 registrations now open', slug: '2027-registrations-open', category: 'Club news', excerpt: 'Pay your club fees online, then complete your Football Victoria registration in PlayFootball.', publishedAt: '2026-11-01T00:00:00.000Z' },
  { title: 'Introducing the Rowville Foundation Academy', slug: 'introducing-foundation-academy', category: 'Academy', excerpt: 'A new elite development environment for committed players, launching Term 1 2027.', publishedAt: '2026-10-20T00:00:00.000Z' },
  { title: 'January holiday camp announced', slug: 'january-holiday-camp', category: 'Community', excerpt: 'Three days of football fun for ages 5–13. Places are limited.', publishedAt: '2026-10-10T00:00:00.000Z' },
] as const
for (const p of posts) {
  await payload.create({ collection: 'posts', data: { ...p, status: 'published', content: para(`${p.excerpt}\n\nSample article — replace in the admin.`) } })
}

for (const [i, name] of ['Your Sponsor', 'Local Partner', 'Community Supporter', 'Major Partner'].entries()) {
  await payload.create({ collection: 'sponsors', data: { name, tier: i === 3 ? 'major' : 'community', order: i } })
}

payload.logger.info(`Seed complete. Admin login: ${adminEmail}`)
process.exit(0)
