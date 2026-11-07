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

const SPONSORS = [
  { name: 'iBuild Renovations', logoUrl: '/sponsors/ibuild-renovations.png' },
  { name: 'D&R Cleaning Services', logoUrl: '/sponsors/dr-cleaning-services.png', tileColor: '#0b1045' },
  { name: 'Coles', logoUrl: '/sponsors/coles.png' },
  { name: 'COJO Group', logoUrl: '/sponsors/cojo-group.png' },
  { name: 'CGD Partners', logoUrl: '/sponsors/cgd-partners.png' },
  { name: 'Old Cars Removed', logoUrl: '/sponsors/old-cars-removed.png', tileColor: '#2595d2' },
  { name: 'KTD', logoUrl: '/sponsors/ktd.png' },
  { name: 'Continental Steel', logoUrl: '/sponsors/continental-steel.png' },
  { name: 'IC Build', logoUrl: '/sponsors/ic-build.png' },
]

// On hosted deployments (vercel-build) the seed only fills an EMPTY database and never deletes anything.
const hosted = process.env.SEED_ONLY_IF_EMPTY === 'true'
if (hosted) {
  if (process.env.SEED_SAMPLE_CONTENT !== 'true') {
    payload.logger.info('Seed skipped (SEED_SAMPLE_CONTENT is not "true").')
    process.exit(0)
  }
  const { totalDocs } = await payload.count({ collection: 'programs' })
  if (totalDocs > 0) {
    payload.logger.info('Seed skipped — database already has content.')
    process.exit(0)
  }
}

for (const c of ['academy-registrations', 'academy-term-slots', 'academy-sessions', 'academy-bookings', 'academy-reminder-log', 'academy-availability', 'academy-coaches', 'academy-terms', 'selection-entries', 'trial-sessions', 'bookings', 'orders', 'products', 'participants', 'programs', 'teams', 'posts', 'sponsors'] as const) {
  await payload.delete({ collection: c, where: { id: { exists: true } } })
}

// Admin account: hosted deployments require SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD (no default password online).
const adminEmail = process.env.SEED_ADMIN_EMAIL || (hosted ? '' : 'admin@rowvilleeagles.local')
const adminPassword = process.env.SEED_ADMIN_PASSWORD || (hosted ? '' : 'change-me-now')
if (adminEmail && adminPassword) {
  const existing = await payload.find({ collection: 'users', where: { email: { equals: adminEmail } } })
  if (!existing.docs.length) {
    await payload.create({
      collection: 'users',
      data: { email: adminEmail, password: adminPassword, firstName: 'Club', lastName: 'Admin', roles: ['admin'] },
    })
  }
}

await payload.updateGlobal({
  slug: 'site-settings',
  data: {
    clubName: 'Rowville Eagles Football Club',
    tagline: 'Community football in Rowville since 1985 — from MiniRoos to seniors and the Rowville Foundation Academy.',
    email: 'refc.secretary@outlook.com',
    season: 2027,
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
      data: { type: 'rowville', name: `${age} Eagles ${n}`, slug: `${age}-eagles-${n}`.toLowerCase(), category: 'miniroos', ageGroup: age, trainingTimes: 'Tue & Thu 5:00pm', order: order++ },
    })
  }
}
for (const t of [
  { name: 'Senior Women', slug: 'senior-women', category: 'senior-women', ageGroup: 'Seniors' },
  { name: 'Senior Men', slug: 'senior-men', category: 'senior-men', ageGroup: 'Seniors' },
  { name: "Men's Reserves", slug: 'mens-reserves', category: 'senior-men', ageGroup: 'Reserves' },
] as const) {
  await payload.create({ collection: 'teams', data: { ...t, type: 'rowville', trainingTimes: 'Tue & Thu 7:00pm', order: order++ } })
}

const programs = [
  { title: '2027 MiniRoos Registration', slug: '2027-miniroos-registration', type: 'registration', brand: 'club', status: 'open', price: 220, ageRange: 'U5 – U11', startDate: '2027-04-01T00:00:00.000Z', priceNote: 'Club fee only — complete FV registration in PlayFootball after payment', summary: 'Secure your child’s place for the 2027 MiniRoos season. Includes training kit and end-of-season celebration.' },
  { title: '2027 Senior Registration', slug: '2027-senior-registration', type: 'registration', brand: 'club', status: 'open', price: 380, ageRange: '18+', startDate: '2027-02-01T00:00:00.000Z', priceNote: 'Club fee only — FV fees paid in PlayFootball', summary: 'Senior Men, Men’s Reserves and Senior Women. Pre-season starts February.' },
  { title: 'January Holiday Camp', slug: 'january-holiday-camp-2027', type: 'holiday-camp', brand: 'academy', status: 'open', price: 165, capacity: 60, ageRange: 'Ages 5–13', scheduleNote: '3 days · 9am–3pm', location: 'Home ground', startDate: '2027-01-12T22:00:00.000Z', endDate: '2027-01-15T04:00:00.000Z', summary: 'Three days of games, skills stations and mini-tournaments with our senior players and coaches.' },
  { title: 'Eagles Autumn Cup', slug: 'eagles-autumn-cup-2027', type: 'tournament', brand: 'academy', status: 'open', price: 250, ageRange: 'U8 – U12', scheduleNote: 'Per team entry', startDate: '2027-03-20T22:00:00.000Z', summary: 'Our annual junior tournament — enter your team for a full day of football at Rowville.' },
  { title: 'Academy Term 1', slug: 'academy-term-1-2027', type: 'academy-term', brand: 'academy', status: 'open', price: 440, capacity: 24, ageRange: 'U8 – U14', scheduleNote: 'Tuesdays & Thursdays · 9 weeks', location: '208 Dandelion Drive, Rowville', startDate: '2027-02-01T13:00:00.000Z', endDate: '2027-04-01T12:00:00.000Z', trialPrice: 0, summary: 'Weekly high-performance sessions in groups of no more than 12, with an individual development plan and end-of-term review.',
    weeklySessions: [
      { day: 'Tuesday', startTime: '17:30', durationMinutes: 75, birthYears: [2017, 2018, 2019, 2020], trialSpots: 3 },
      { day: 'Thursday', startTime: '17:30', durationMinutes: 75, birthYears: [2014, 2015, 2016], trialSpots: 3 },
    ] },
  { title: '1-on-1 Coaching', slug: 'private-coaching', type: 'private-session', brand: 'academy', status: 'open', price: 75, ageRange: 'All ages', scheduleNote: '60 minutes · choose your time', summary: 'Personalised technical sessions with an Academy coach, focused on your player’s individual goals.' },
] as const

// Bookable slots for 1-on-1s and trials: next three weeks (Melbourne evenings ≈ 07:00–09:00 UTC)
const slotsFrom = (days: number[], hoursUtc: number[], capacity: number) => {
  const out: { start: string; capacity: number; coach?: string }[] = []
  const base = new Date()
  base.setUTCHours(0, 0, 0, 0)
  for (let d = 1; d <= 21; d++) {
    const day = new Date(base.getTime() + d * 86400000)
    if (!days.includes(day.getUTCDay())) continue
    for (const h of hoursUtc) out.push({ start: new Date(day.getTime() + h * 3600000).toISOString(), capacity })
  }
  return out
}
const slotsFor: Record<string, ReturnType<typeof slotsFrom>> = {
  'private-coaching': slotsFrom([1, 3], [6, 7, 8], 1),
}

for (const p of programs) {
  const weeklySessions = 'weeklySessions' in p ? p.weeklySessions.map((w) => ({ ...w, birthYears: [...w.birthYears] })) : undefined
  await payload.create({ collection: 'programs', data: { ...p, weeklySessions, slots: slotsFor[p.slug], description: para(`${p.summary}\n\nThis is sample copy — replace it in the admin with the full program details, what to bring, and cancellation policy.`) } })
}

// Club trial dates: MiniRoos published (open for booking); juniors/seniors not yet set → expressions of interest
for (const t of [
  { title: 'MiniRoos trials — night 1', start: '2027-01-19T06:30:00.000Z', birthYears: [2016, 2017, 2018, 2019, 2020, 2021], capacityPerAgeGroup: 20, status: 'published' },
  { title: 'MiniRoos trials — night 2', start: '2027-01-21T06:30:00.000Z', birthYears: [2016, 2017, 2018, 2019, 2020, 2021], capacityPerAgeGroup: 20, status: 'published' },
] as const) {
  await payload.create({ collection: 'trial-sessions', data: { ...t, birthYears: [...t.birthYears] } })
}

// Foundation Academy: Term 1 2027 collecting coach availability (Sydney midnight 1 Feb = 31 Jan 13:00 UTC)
const term = await payload.create({
  collection: 'academy-terms',
  data: {
    name: 'Term 1 2027',
    status: 'open',
    // Sample school term: Mon 1 Feb – Thu 1 Apr 2027 (replace with the real Victorian term dates)
    startDate: '2027-01-31T13:00:00.000Z',
    endDate: '2027-03-31T13:00:00.000Z',
    availabilityDeadline: '2027-01-15T07:00:00.000Z',
    pricePerSession: 80,
    casualPrice: 85,
    termMemberPrice: 70,
    termMemberWindowDays: 14,
    sessionMinutes: 60,
  },
})
const academyProgram = (await payload.find({ collection: 'programs', where: { slug: { equals: 'academy-term-1-2027' } }, limit: 1 })).docs[0]
if (academyProgram) await payload.update({ collection: 'programs', id: academyProgram.id, data: { academyTerm: term.id } })

// Sample coach accounts (local development only — hosted deploys never get default passwords)
if (!hosted) {
  for (const [first, last, email] of [['Sam', 'Rossi', 'coach@rowvilleeagles.local'], ['Priya', 'Nair', 'coach2@rowvilleeagles.local']]) {
    const found = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1 })
    const coachUser = found.docs[0] ?? (await payload.create({ collection: 'users', data: { email, password: 'change-me-now', firstName: first, lastName: last, roles: ['coach'], activated: true } }))
    const coachProfile = await payload.create({
      collection: 'academy-coaches',
      data: { user: coachUser.id, displayName: `Coach ${first}`, active: true, bio: `Sample bio for Coach ${first} — replace in the coach portal.`, specialties: [{ label: 'Ball mastery' }, { label: 'Finishing' }] },
    })
    const slots =
      first === 'Sam'
        ? [{ weekday: 'Tuesday', startTime: '17:00' }, { weekday: 'Tuesday', startTime: '18:00' }, { weekday: 'Saturday', startTime: '09:00' }, { weekday: 'Saturday', startTime: '10:00' }]
        : [{ weekday: 'Tuesday', startTime: '17:00' }, { weekday: 'Thursday', startTime: '16:00' }, { weekday: 'Saturday', startTime: '09:00' }]
    await payload.create({
      collection: 'academy-availability',
      data: { coach: coachProfile.id, term: term.id, slots: slots as { weekday: 'Tuesday' | 'Thursday' | 'Saturday'; startTime: string }[], submittedAt: new Date().toISOString() },
    })
  }
}

const teamIds = Object.fromEntries((await payload.find({ collection: 'teams', limit: 100, depth: 0 })).docs.map((t) => [t.slug, t.id]))

const posts = [
  { title: '2027 registrations now open', slug: '2027-registrations-open', category: 'Club news', excerpt: 'Pay your club fees online, then complete your Football Victoria registration in PlayFootball.', publishedAt: '2026-11-01T00:00:00.000Z' },
  { title: 'Introducing the Rowville Foundation Academy', slug: 'introducing-foundation-academy', category: 'Academy', excerpt: 'A new elite development environment for committed players, launching Term 1 2027.', publishedAt: '2026-10-20T00:00:00.000Z' },
  { title: 'Seniors open pre-season with a win', slug: 'seniors-preseason-win', category: 'Seniors', excerpt: 'Sample match report — the Senior Men opened pre-season with a strong performance. Replace with a real report.', publishedAt: '2026-11-03T00:00:00.000Z', teams: ['senior-men', 'mens-reserves'] },
  { title: 'U9s shine at the Spring Cup', slug: 'u9-spring-cup', category: 'Tournament', excerpt: 'Sample tournament wrap — our U9 teams played six games across the day. Replace with real results.', publishedAt: '2026-10-28T00:00:00.000Z', teams: ['u9-eagles-1', 'u9-eagles-2'] },
  { title: 'Senior Women finish the season strong', slug: 'senior-women-season-wrap', category: 'Match report', excerpt: 'Sample season wrap for the Senior Women. Replace with the real story.', publishedAt: '2026-10-15T00:00:00.000Z', teams: ['senior-women'] },
  { title: 'January holiday camp announced', slug: 'january-holiday-camp', category: 'Community', excerpt: 'Three days of football fun for ages 5–13. Places are limited.', publishedAt: '2026-10-10T00:00:00.000Z' },
] as const
for (const p of posts) {
  const teams = 'teams' in p ? p.teams.map((slug) => teamIds[slug]).filter(Boolean) : []
  await payload.create({ collection: 'posts', data: { ...p, teams, status: 'published', content: para(`${p.excerpt}\n\nSample article — replace in the admin.`) } })
}

const kitSizes = ['YS', 'YM', 'YL', 'S', 'M', 'L', 'XL', '2XL'].map((size) => ({ size, stock: 15 }))
const products = [
  { name: 'Home Playing Shirt', slug: 'home-playing-shirt', category: 'kit', brand: 'club', audiences: ['rowville'], price: 55, description: 'Official Rowville Eagles home shirt in royal blue.', variants: kitSizes },
  { name: 'Playing Shorts', slug: 'playing-shorts', category: 'kit', brand: 'club', audiences: ['rowville'], price: 30, variants: kitSizes },
  { name: 'Playing Socks', slug: 'playing-socks', category: 'kit', brand: 'club', audiences: ['rowville'], price: 15, variants: ['Junior', 'Senior'].map((size) => ({ size, stock: 30 })) },
  { name: 'Training Top', slug: 'training-top', category: 'training', brand: 'club', audiences: ['rowville'], price: 45, variants: kitSizes },
  { name: 'RFA Training Shirt', slug: 'rfa-training-shirt', category: 'training', brand: 'academy', audiences: ['rfa'], price: 50, description: 'Rowville Foundation Academy training shirt — black.', variants: kitSizes },
  { name: 'RFA Hoodie', slug: 'rfa-hoodie', category: 'apparel', brand: 'academy', audiences: ['rfa'], price: 75, variants: kitSizes.map((v) => ({ ...v, stock: v.size === 'XL' ? 0 : 8 })) },
  { name: 'Eagles Supporter Tee', slug: 'supporter-tee', category: 'apparel', brand: 'club', audiences: ['everyone'], price: 35, variants: kitSizes },
  { name: 'Eagles Supporter Scarf', slug: 'supporter-scarf', category: 'accessories', brand: 'club', audiences: ['everyone'], price: 25, variants: [] },
  { name: 'Drink Bottle', slug: 'drink-bottle', category: 'accessories', brand: 'club', audiences: ['everyone'], price: 12, variants: [] },
  { name: 'Foundation+ Training Top', slug: 'foundation-plus-training-top', category: 'training', brand: 'academy', audiences: ['foundation-plus'], price: 49, description: 'Members-only Foundation+ training top.', variants: kitSizes },
] as const
for (const [i, pr] of products.entries()) {
  await payload.create({ collection: 'products', data: { ...pr, audiences: [...pr.audiences], variants: [...pr.variants], status: 'active', order: i } })
}

for (const [i, sp] of SPONSORS.entries()) {
  await payload.create({ collection: 'sponsors', data: { ...sp, tier: 'community', order: i } })
}

// Player Development Report content (only adds what's missing)
const { seedPdr } = await import('../src/academy/pdr/seed')
payload.logger.info(`PDR content: ${JSON.stringify(await seedPdr(payload))}`)
{
  const { monthKey } = await import('../src/academy/pdr/challenge-rules')
  await payload.create({
    collection: 'pdr-challenges',
    data: {
      title: '60-second juggling',
      month: monthKey(new Date()),
      published: true,
      description: 'How many juggles can you do in 60 seconds? Feet, thighs and head all count. If the ball drops, pick it up and keep going.',
      rules: 'Film from the side so your whole body and the ball are in view. Start the timer on camera, or have someone count down out loud.',
      unit: 'juggles',
      direction: 'higher',
      groupBy: 'birthYear',
      winnersPerGroup: 1,
      prize: 'Foundation+ hoodie',
    },
  })
}

payload.logger.info(`Seed complete.${adminEmail ? ` Admin login: ${adminEmail}` : ''}`)
process.exit(0)
