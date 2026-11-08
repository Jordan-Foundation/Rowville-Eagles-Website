import type { DashItem } from '@/components/dashboard/DashboardGrid'

/** Management dashboard sections; keys match the badge counts in src/lib/attention.ts. */
export const managementItems: DashItem[] = [
  { key: 'programs', href: '/management/programs', label: 'Programs Overview', icon: 'chart' },
  { key: 'bookings', href: '/management/academy/bookings', label: 'Bookings & cancellations', icon: 'booking' },
  { key: 'payments', href: '/management/academy#payments', label: 'Weekly payments', icon: 'card' },
  { key: 'cover', href: '/management/academy#cover', label: 'Cover', icon: 'swap' },
  { key: 'availability', href: '/management/academy', label: 'Coach availability', icon: 'clock' },
  { key: 'terms', href: '/management/academy/terms', label: 'Academy terms', icon: 'grid' },
  { key: 'selections', href: '/management/selections', label: 'Selections', icon: 'flag' },
  { key: 'teams', href: '/management/teams', label: 'Teams', icon: 'users' },
  { key: 'messages', href: '/management/messages', label: 'Messages', icon: 'chat' },
  { key: 'foundation', href: '/management/programs?program=foundation-plus', label: 'Foundation+', icon: 'star' },
  { key: 'store', href: '/admin/collections/orders', label: 'Store', icon: 'bag' },
  { key: 'curriculum', href: '/management/curriculum', label: 'Curriculum', icon: 'board' },
  { key: 'consent', href: '/management/consent', label: 'Consent review', icon: 'shield' },
  { key: 'prices', href: '/admin/prices', label: 'Set prices', icon: 'dollar' },
  { key: 'settings', href: '/admin', label: 'Settings', icon: 'gear', hint: 'Admin, setup checklist' },
]
