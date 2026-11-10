import type { DashItem } from '@/components/dashboard/DashboardGrid'

/** Management dashboard sections; keys match the badge counts in src/lib/attention.ts. */
export const managementItems: DashItem[] = [
  { key: 'programs', href: '/management/programs', label: 'Programs Overview', icon: 'chart' },
  { key: 'dates', href: '/management/dates', label: 'Set dates', icon: 'calendar' },
  { key: 'prices', href: '/management/prices', label: 'Set prices', icon: 'dollar' },
  { key: 'money', href: '/management/money', label: 'Money summary', icon: 'chart', hint: 'Month & term, by Stripe account' },
  { key: 'bookings', href: '/management/academy/bookings', label: 'Bookings & cancellations', icon: 'booking' },
  { key: 'payments', href: '/management/academy#payments', label: 'Weekly payments', icon: 'card' },
  { key: 'cover', href: '/management/academy#cover', label: 'Cover', icon: 'swap' },
  { key: 'availability', href: '/management/academy', label: 'Coach availability', icon: 'clock' },
  { key: 'terms', href: '/management/academy/terms', label: 'Academy terms', icon: 'grid' },
  { key: 'camps', href: '/management/camps', label: 'Holiday camps', icon: 'users', hint: 'Groups & coaches' },
  { key: 'selections', href: '/management/selections', label: 'Selections', icon: 'flag' },
  { key: 'teams', href: '/management/teams', label: 'Teams', icon: 'users' },
  { key: 'messages', href: '/management/messages', label: 'Messages', icon: 'chat' },
  { key: 'broadcast', href: '/management/broadcast', label: 'Email a group', icon: 'megaphone', hint: 'Group, team or report round' },
  { key: 'promotions', href: '/management/promotions', label: 'Promotions', icon: 'megaphone' },
  { key: 'foundation', href: '/management/foundation-plus', label: 'Foundation+', icon: 'star' },
  { key: 'store', href: '/management/store', label: 'Store', icon: 'bag' },
  { key: 'reports', href: '/management/reports', label: 'Reports', icon: 'report', hint: 'Player reports' },
  { key: 'curriculum', href: '/management/curriculum', label: 'Curriculum', icon: 'board' },
  { key: 'consent', href: '/management/consent', label: 'Consent review', icon: 'shield' },
  { key: 'settings', href: '/admin', label: 'Settings', icon: 'gear', hint: 'Admin, setup checklist' },
]
