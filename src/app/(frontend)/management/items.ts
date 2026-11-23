import type { DashItem } from '@/components/dashboard/DashboardGrid'

/** Management dashboard sections; keys match the badge counts in src/lib/attention.ts. */
/** Shown to admins only. */
export const ADMIN_ONLY = new Set(['refunds', 'finance'])

export const managementItems: DashItem[] = [
  { key: 'programs', href: '/management/programs', label: 'Programs Overview', icon: 'chart' },
  { key: 'yearly', href: '/management/yearly-setup', label: 'Yearly setup', icon: 'calendar', hint: 'Next year’s terms & holidays' },
  { key: 'dates', href: '/management/dates', label: 'Set dates', icon: 'calendar' },
  { key: 'prices', href: '/management/prices', label: 'Set prices', icon: 'dollar' },
  { key: 'lengths', href: '/management/session-lengths', label: 'Session lengths', icon: 'clock', hint: 'Minutes per age group, e.g. U7 = 60' },
  { key: 'hours', href: '/management/booking-hours', label: 'Booking hours', icon: 'clock', hint: '1-on-1 hours, closed dates, back-to-back' },
  { key: 'finance', href: '/management/finance', label: 'Finance', icon: 'dollar', hint: 'Income, coach pay, expenses' },
  { key: 'invoices', href: '/management/invoices', label: 'Invoices', icon: 'dollar', hint: 'Charge after the fact' },
  { key: 'refunds', href: '/management/refunds', label: 'Refunds', icon: 'card', hint: 'Admins only' },
  { key: 'bookings', href: '/management/academy/bookings', label: 'Bookings & cancellations', icon: 'booking' },
  { key: 'payments', href: '/management/academy#payments', label: 'Weekly payments', icon: 'card' },
  { key: 'cover', href: '/management/academy#cover', label: 'Cover', icon: 'swap' },
  { key: 'import', href: '/management/players/import', label: 'Import players', icon: 'users', hint: 'Existing players & families from Excel' },
  { key: 'events', href: '/admin/collections/events', label: 'Events calendar', icon: 'calendar', hint: 'Club events on the website (camps are added automatically)' },
  { key: 'enquiries', href: '/admin/collections/enquiries', label: 'Senior enquiries', icon: 'users', hint: 'Also emailed to the secretary' },
  { key: 'pages', href: '/admin/globals/senior-teams', label: 'Senior team pages', icon: 'board', hint: 'Team, coach, league and training' },
  { key: 'committee', href: '/admin/globals/about', label: 'About & committee', icon: 'users', hint: 'History and committee pages' },
  { key: 'launch', href: '/management/launch', label: 'Portal launch', icon: 'megaphone', hint: 'Launch email & text, 1-on-1 follow-up' },
  { key: 'coaches', href: '/management/coaches', label: 'Coaches', icon: 'users', hint: 'Add coaches, check WWCC' },
  { key: 'summaries', href: '/management/summaries', label: 'Session summaries', icon: 'report', hint: 'After 1-on-1s & small groups' },
  { key: 'numbers', href: '/management/numbers', label: 'Player numbers', icon: 'users', hint: 'Shirt numbers by year of birth' },
  { key: 'fitout', href: '/management/fitout', label: 'Fitout', icon: 'bag', hint: 'Record sizes, export the kit order' },
  { key: 'kititems', href: '/management/fitout/items', label: 'Kit items & sizes', icon: 'gear' },
  { key: 'ranges', href: '/management/numbers/ranges', label: 'Number ranges', icon: 'grid' },
  { key: 'availability', href: '/management/academy', label: 'Coach availability', icon: 'clock' },
  { key: 'terms', href: '/management/academy/terms', label: 'Academy setup', icon: 'grid', hint: 'Terms, training times, groups' },
  { key: 'camps', href: '/management/camps', label: 'Holiday camps', icon: 'users', hint: 'Groups & coaches' },
  { key: 'selections', href: '/management/selections/trialists?program=eagles', label: 'Eagles selections', icon: 'flag', hint: 'Trialists, selected players, teams' },
  { key: 'tournaments', href: '/management/selections/trialists?program=rfa', label: 'Tournament teams', icon: 'flag', hint: 'RFA tournament trialists & teams' },
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
  { key: 'communication', label: 'Communication', hint: 'Messages, audience, emails, offers', icon: 'chat', items: by(['messages', 'enquiries', 'events', 'launch', 'notifications', 'audience', 'broadcast', 'announcements', 'promotions', 'referrals']) },
  { key: 'settings', label: 'Settings', hint: 'Dates, prices, booking hours, yearly setup', icon: 'gear', items: by(['import', 'yearly', 'dates', 'prices', 'hours', 'lengths', 'pages', 'committee', 'curriculum', 'consent', 'settings']) },
  { key: 'kit', label: 'Kit & numbers', hint: 'Player numbers, fitout, kit sizes', icon: 'bag', items: by(['numbers', 'fitout', 'kititems', 'ranges']) },
  solo('programs'),
  solo('camps'),
  solo('store'),
]

/** Sections and their buttons for this person (Finance and Refunds are admins only). */
export const sectionsFor = (admin: boolean) => managementSections.map((s) => ({ ...s, items: s.items.filter((i) => admin || !ADMIN_ONLY.has(i.key)) })).filter((s) => s.items.length)
