import type { DashItem } from '@/components/dashboard/DashboardGrid'

/** Management dashboard sections; keys match the badge counts in src/lib/attention.ts. */
/** Shown to admins only. */
export const ADMIN_ONLY = new Set(['refunds', 'finance'])

export const managementItems: DashItem[] = [
  { key: 'programs', href: '/management/programs', label: 'Programs Overview', icon: 'chart' },
  { key: 'yearly', href: '/management/yearly-setup', label: 'Yearly setup', icon: 'calendar', hint: 'Next year’s terms & holidays' },
  { key: 'dates', href: '/management/dates', label: 'Set dates', icon: 'calendar' },
  { key: 'prices', href: '/management/prices', label: 'Set prices', icon: 'dollar' },
  { key: 'finance', href: '/management/finance', label: 'Finance', icon: 'dollar', hint: 'Income, coach pay, expenses' },
  { key: 'invoices', href: '/management/invoices', label: 'Invoices', icon: 'dollar', hint: 'Charge after the fact' },
  { key: 'refunds', href: '/management/refunds', label: 'Refunds', icon: 'card', hint: 'Admins only' },
  { key: 'bookings', href: '/management/academy/bookings', label: 'Bookings & cancellations', icon: 'booking' },
  { key: 'payments', href: '/management/academy#payments', label: 'Weekly payments', icon: 'card' },
  { key: 'cover', href: '/management/academy#cover', label: 'Cover', icon: 'swap' },
  { key: 'coaches', href: '/management/coaches', label: 'Coaches', icon: 'users', hint: 'Add coaches, check WWCC' },
  { key: 'summaries', href: '/management/summaries', label: 'Session summaries', icon: 'report', hint: 'After 1-on-1s & small groups' },
  { key: 'availability', href: '/management/academy', label: 'Coach availability', icon: 'clock' },
  { key: 'terms', href: '/management/academy/terms', label: 'Academy setup', icon: 'grid', hint: 'Terms, training times, groups' },
  { key: 'camps', href: '/management/camps', label: 'Holiday camps', icon: 'users', hint: 'Groups & coaches' },
  { key: 'selections', href: '/management/selections?kind=rowville', label: 'Eagles selections', icon: 'flag', hint: 'Rowville Eagles trials' },
  { key: 'tournaments', href: '/management/selections?kind=tournament', label: 'Tournament teams', icon: 'flag', hint: 'Tournament team selections' },
  { key: 'teams', href: '/management/teams', label: 'Teams', icon: 'users' },
  { key: 'messages', href: '/management/messages', label: 'Messages', icon: 'chat' },
  { key: 'notifications', href: '/management/notifications', label: 'Notifications', icon: 'bell', hint: 'Bookings, payments, trials' },
  { key: 'audience', href: '/management/audience', label: 'Audience', icon: 'users', hint: 'Who we reach, where from, search' },
  { key: 'broadcast', href: '/management/broadcast', label: 'Email a group', icon: 'megaphone', hint: 'Group, team or report round' },
  { key: 'promotions', href: '/management/promotions', label: 'Promotions', icon: 'megaphone' },
  { key: 'reflections', href: '/management/reflections', label: 'Match reflections', icon: 'report', hint: 'Dashboard, welfare & AI reports' },
  { key: 'referrals', href: '/management/referrals', label: 'Referrals', icon: 'users', hint: 'Refer a Friend & rewards' },
  { key: 'announcements', href: '/management/announcements', label: 'Announcements', icon: 'megaphone', hint: 'Registrations open' },
  { key: 'foundation', href: '/management/foundation-plus', label: 'Foundation+', icon: 'star' },
  { key: 'store', href: '/management/store', label: 'Store', icon: 'bag' },
  { key: 'reports', href: '/management/reports', label: 'Reports', icon: 'report', hint: 'Player reports' },
  { key: 'curriculum', href: '/management/curriculum', label: 'Curriculum', icon: 'board' },
  { key: 'consent', href: '/management/consent', label: 'Consent review', icon: 'shield' },
  { key: 'settings', href: '/admin', label: 'Admin', icon: 'gear', hint: 'All site settings, setup checklist' },
]

const by = (keys: string[]) => keys.map((k) => managementItems.find((i) => i.key === k)!)

/** The dashboard shows these categories (plus a "Needs attention" list); each opens a page with its buttons.
 * A section with `href` is a single button that goes straight to its page. */
export type ManagementSection = { key: string; label: string; hint: string; icon: string; items: DashItem[]; href?: string }
const solo = (key: string): ManagementSection => { const i = by([key])[0]; return { key, label: i.label, hint: i.hint ?? '', icon: i.icon, items: [i], href: i.href } }
export const managementSections: ManagementSection[] = [
  { key: 'refc', label: 'REFC', hint: 'Eagles selections, teams, reflections, reports', icon: 'flag', items: by(['selections', 'teams', 'reflections', 'reports']) },
  { key: 'coaches', label: 'Coaches', hint: 'Add coaches, summaries, availability, cover', icon: 'users', items: by(['coaches', 'summaries', 'availability', 'cover']) },
  { key: 'finances', label: 'Finances', hint: 'Finance, invoices, refunds, payments', icon: 'dollar', items: by(['finance', 'invoices', 'refunds', 'payments']) },
  { key: 'academy', label: 'Foundation Academy', hint: 'Bookings, academy setup, tournaments, Foundation+', icon: 'grid', items: by(['bookings', 'terms', 'tournaments', 'foundation']) },
  { key: 'communication', label: 'Communication', hint: 'Messages, audience, emails, offers', icon: 'chat', items: by(['messages', 'notifications', 'audience', 'broadcast', 'announcements', 'promotions', 'referrals']) },
  { key: 'settings', label: 'Settings', hint: 'Dates, prices, yearly setup, curriculum', icon: 'gear', items: by(['yearly', 'dates', 'prices', 'curriculum', 'consent', 'settings']) },
  solo('programs'),
  solo('camps'),
  solo('store'),
]

/** Sections and their buttons for this person (Finance and Refunds are admins only). */
export const sectionsFor = (admin: boolean) => managementSections.map((s) => ({ ...s, items: s.items.filter((i) => admin || !ADMIN_ONLY.has(i.key)) })).filter((s) => s.items.length)
