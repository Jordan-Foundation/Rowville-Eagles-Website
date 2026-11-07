import type { Payload } from 'payload'

/**
 * Everything the club/academy owner still has to do outside the code (accounts, keys, content).
 * Items with a check tick themselves off; the rest are ticked by hand on the admin Setup page.
 * Secrets are never shown — only whether they're present.
 */
export type SetupItem = {
  key: string
  title: string
  how: string
  /** auto: worked out from settings/data; manual: ticked on the page */
  status: 'done' | 'todo' | 'later'
  auto: boolean
  note?: string
  href?: string
}
export type SetupGroup = { title: string; items: SetupItem[] }

const has = (...names: string[]) => names.every((n) => Boolean(process.env[n]))
const mode = (name: string) => (process.env[name]?.startsWith('sk_live') ? 'live' : process.env[name]?.startsWith('sk_test') ? 'test' : null)
const site = () => process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://<your site>')

export async function setupChecklist(payload: Payload, ticked: Record<string, boolean>): Promise<SetupGroup[]> {
  const q = { overrideAccess: true } as const
  const diff = await payload.findGlobal({ slug: 'difference-page', depth: 0, overrideAccess: true }).catch(() => null)
  const diffPhotos = [diff?.hero?.image, diff?.coaches?.image, diff?.pathways?.image].filter(Boolean).length + ((diff?.community?.photos as unknown[] | null)?.length ? 1 : 0)
  const [academy, fplus, programs, slots, placeholders, badges, noArt, stagesLive] = await Promise.all([
    payload.findGlobal({ slug: 'academy-settings', depth: 0, ...q }).catch(() => null),
    payload.findGlobal({ slug: 'pdr-settings', depth: 0, ...q }).catch(() => null),
    payload.find({ collection: 'programs', where: { type: { equals: 'academy-term' }, status: { in: ['open', 'full'] } }, limit: 50, depth: 0, ...q }),
    payload.find({ collection: 'academy-term-slots', limit: 500, depth: 0, ...q, select: { program: true } }),
    payload.count({ collection: 'pdr-stages', where: { placeholder: { equals: true } }, ...q }),
    payload.count({ collection: 'pdr-badges', where: { placeholder: { equals: true } }, ...q }),
    payload.count({ collection: 'pdr-badges', where: { artwork: { exists: false } }, ...q }),
    payload.find({ collection: 'pdr-stages', where: { published: { equals: true } }, limit: 500, depth: 1, ...q, select: { code: true, tutorialVideo: true, demoVideo: true } }),
  ])
  const slotPrograms = new Set(slots.docs.map((s) => (typeof s.program === 'object' ? s.program.id : s.program)))
  const termsWithout = programs.docs.filter((p) => !slotPrograms.has(p.id))
  const missingVideos = stagesLive.docs.filter((s) => [s.tutorialVideo, s.demoVideo].some((v) => !v || typeof v !== 'object' || !v.streamUid))
  const manual = (key: string, title: string, how: string, o: Partial<SetupItem> = {}): SetupItem => ({ key, title, how, status: ticked[key] ? 'done' : (o.status ?? 'todo'), auto: false, ...o, ...(ticked[key] ? { status: 'done' } : {}) })
  const auto = (key: string, title: string, how: string, ok: boolean, o: Partial<SetupItem> = {}): SetupItem => ({ key, title, how, auto: true, ...o, status: ok ? 'done' : (o.status ?? 'todo') })
  const clubMode = mode('STRIPE_SECRET_KEY_CLUB')
  const academyMode = mode('STRIPE_SECRET_KEY_ACADEMY')

  return [
    {
      title: 'Email',
      items: [
        auto('resend', 'Email sending (Resend)', 'Vercel → Settings → Environment Variables: RESEND_API_KEY.', has('RESEND_API_KEY')),
        manual('resend-domain', 'Sending domain verified in Resend', 'Resend → Domains → add rowvilleeagles.com.au and add the DNS records it shows, so emails don’t land in spam.'),
      ],
    },
    {
      title: 'Payments (Stripe)',
      items: [
        auto('stripe-club', 'Club Stripe account connected', 'Vercel env: STRIPE_SECRET_KEY_CLUB and STRIPE_WEBHOOK_SECRET_CLUB. Webhook URL: ' + site() + '/stripe/webhook/club', has('STRIPE_SECRET_KEY_CLUB', 'STRIPE_WEBHOOK_SECRET_CLUB'), { note: clubMode ? `${clubMode} mode` : undefined }),
        auto('stripe-academy', 'Academy Stripe account connected', 'Vercel env: STRIPE_SECRET_KEY_ACADEMY and STRIPE_WEBHOOK_SECRET_ACADEMY. Webhook URL: ' + site() + '/stripe/webhook/academy (events: checkout.session.*, invoice.paid, invoice.payment_failed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted)', has('STRIPE_SECRET_KEY_ACADEMY', 'STRIPE_WEBHOOK_SECRET_ACADEMY'), { note: academyMode ? `${academyMode} mode` : undefined }),
        manual('stripe-portal', 'Stripe customer portal turned on (Foundation+ “Manage plan”)', 'Academy Stripe account → Settings → Billing → Customer portal: allow updating payment methods, switching plans (add the Foundation+ products) and cancelling at the end of the billing period. Save it in test mode and again in live mode.'),
        manual('stripe-entity', 'Academy Stripe account is in Foundation Sports Australia’s name', 'Stripe → Settings → Business: Foundation Sports Australia Pty Ltd, ABN 51 685 528 143.'),
        manual('stripe-tested', 'Test payments checked in test mode', 'With test keys: book a casual 1-on-1, a term (upfront and weekly), a camp, a shop order; try a declined card (4000 0000 0000 0002) and a refund.'),
        auto('stripe-live', 'Switched to live keys', 'Replace the sk_test keys with sk_live keys (and the live webhook secrets) when you’re ready to take real payments.', clubMode === 'live' && academyMode === 'live', { status: 'later' }),
      ],
    },
    {
      title: 'Scheduled jobs',
      items: [
        auto('cron', 'Daily jobs secured', 'Vercel env: CRON_SECRET (any long random string). Runs reminders, video clean-up and team syncs each morning.', has('CRON_SECRET')),
        manual('vercel-pro', 'Vercel Pro plan', 'Needed for hourly jobs (SMS reminders 24h before each 1-on-1) and for commercial use.', { status: 'later' }),
      ],
    },
    {
      title: 'Phone & SMS (Twilio)',
      items: [
        manual('twilio-bundle', 'Australian regulatory bundle approved', 'Twilio → Phone Numbers → Regulatory Compliance. In review — 1–3 business days.'),
        manual('twilio-number', 'Number +61 495 101 515 bought (SMS + Voice)', 'Twilio → Buy a number, once the bundle is approved.'),
        auto('twilio-env', 'Twilio connected', 'Vercel env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (+61495101515). Add only once the number is active.', has('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM')),
        manual('twilio-webhooks', 'Number webhooks set', `On the number: “A message comes in” → ${site()}/twilio/sms (POST); “A call comes in” → ${site()}/twilio/voice (POST); “Call status changes” → ${site()}/twilio/voice/status (POST).`),
        auto('call-forward', 'Call forwarding number', 'Admin → Foundation Academy → Academy settings → Phone calls (or Vercel env CALL_FORWARD_TO).', Boolean(academy?.callForwardTo || process.env.CALL_FORWARD_TO), { href: '/admin/globals/academy-settings' }),
      ],
    },
    {
      title: 'Foundation Academy',
      items: [
        auto('google-review', 'Google review link', 'Admin → Academy settings → Google review link (from your Google Business Profile → “Ask for reviews”).', Boolean(academy?.googleReviewUrl), { href: '/admin/globals/academy-settings' }),
        auto('term-slots', 'Training times added to open Academy term programs', 'Staff → Academy terms → Add a training time.', termsWithout.length === 0, { note: termsWithout.length ? `Missing: ${termsWithout.map((p) => p.title).join(', ')}` : undefined, href: '/staff/academy/terms' }),
        manual('prices-reviewed', 'Prices checked', 'Admin → Prices: 1-on-1 ($80/$85/$70), group terms ($25 per session, $20 on 2 nights a week), camps, registrations, tournaments, shop.', { href: '/admin/prices' }),
        manual('trial-years', 'Trial-night years of birth checked', 'Admin → Programs → each Academy term → Weekly training nights. For the 2027 season MiniRoos are born 2016–2021.'),
      ],
    },
    {
      title: 'Website content',
      items: [
        manual('wmud-copy', '“What Makes Us Different” copy checked', 'Admin → Club → What Makes Us Different: read each section (drafted from your notes) and adjust anything — especially the lesson-stage one-liners, curriculum strands and term months.', { href: '/admin/globals/difference-page' }),
        auto('wmud-photos', '“What Makes Us Different” photos added', 'Hero (2400×1350), coaches (1600×1200), pathways (1600×1200) and 3–4 Community Night photos (1200×1200). Only children with photo consent.', diffPhotos >= 4, { note: `${diffPhotos} of 4 added`, href: '/admin/globals/difference-page' }),
      ],
    },
    {
      title: 'Foundation+',
      items: [
        auto('stream', 'Cloudflare Stream connected', 'Vercel env: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_STREAM_TOKEN (Stream: Edit), CLOUDFLARE_STREAM_CUSTOMER_CODE. Only needed when you’re ready to launch.', has('CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_STREAM_TOKEN', 'CLOUDFLARE_STREAM_CUSTOMER_CODE'), { status: 'later' }),
        auto('stages', 'All stages written', 'Admin → Foundation+ content map → click each PLACEHOLDER stage, write it and tick “Visible to players”.', placeholders.totalDocs === 0, { note: placeholders.totalDocs ? `${placeholders.totalDocs} placeholder stage${placeholders.totalDocs === 1 ? '' : 's'} left` : undefined, href: '/admin/pdr' }),
        auto('stage-videos', 'Tutorial and demo videos for live stages', 'Upload clips to Cloudflare Stream, then paste each video ID into Foundation+ → Video library.', missingVideos.length === 0, { note: missingVideos.length ? `Missing on: ${missingVideos.slice(0, 6).map((s) => s.code).join(', ')}${missingVideos.length > 6 ? '…' : ''}` : undefined, href: '/admin/collections/pdr-videos' }),
        auto('badges', 'Badges named', 'Admin → Foundation+ → Badges: give each PLACEHOLDER badge its name.', badges.totalDocs === 0, { note: badges.totalDocs ? `${badges.totalDocs} to name` : undefined, href: '/admin/collections/pdr-badges' }),
        auto('badge-art', 'Badge artwork uploaded', 'Admin → Foundation+ → Badges → Artwork (square PNG, transparent background).', noArt.totalDocs === 0, { note: noArt.totalDocs ? `${noArt.totalDocs} without artwork (a simple emblem is shown until then)` : undefined, href: '/admin/collections/pdr-badges' }),
        manual('retention', 'Video retention decided', `Foundation+ settings → “Delete videos after review (months)” — currently ${fplus?.retentionMonths ?? 6} months.`, { href: '/admin/globals/pdr-settings' }),
        manual('fplus-plans', 'Foundation+ prices confirmed', 'Admin → Prices → Foundation+ plans (Standard $9.95/mo or $89/yr, Premium $24.95/mo or $229/yr, 25% off 2nd+ player).', { href: '/admin/prices' }),
        manual('fplus-screens', 'Foundation+ page screenshots (optional)', 'The page uses real screenshots with made-up players. To use your own, send desktop shots (2560×1600) and phone shots (1170×2532) of: player page, a drill page, a leaderboard, the Trophy Cabinet.', { status: 'later', href: '/foundation-plus' }),
        auto('fplus-on', 'Foundation+ switched on for families', 'Foundation+ settings → “Show Foundation+ on the website”.', Boolean(fplus?.enabled), { status: 'later', href: '/admin/globals/pdr-settings' }),
      ],
    },
  ]
}
