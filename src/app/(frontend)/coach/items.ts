import type { DashItem } from '@/components/dashboard/DashboardGrid'

/** Coach dashboard sections; keys match the badge counts in src/lib/attention.ts. */
export const coachItems: DashItem[] = [
  { key: 'today', href: '/coach/today', label: 'Training day', icon: 'whistle', hint: 'Rosters & attendance' },
  { key: 'messages', href: '/coach/messages', label: 'Messages', icon: 'chat' },
  { key: 'broadcast', href: '/coach/broadcast', label: 'Message a group', icon: 'megaphone', hint: 'Group or team' },
  { key: 'sessions', href: '/coach/sessions', label: 'My sessions', icon: 'calendar', hint: '1-on-1s' },
  { key: 'attendance', href: '/coach/sessions', label: 'Attendance', icon: 'check', hint: 'Sessions to mark' },
  { key: 'availability', href: '/coach#availability', label: 'Availability', icon: 'clock' },
  { key: 'groups', href: '/coach/groups', label: 'Academy groups', icon: 'grid' },
  { key: 'teams', href: '/coach/teams', label: 'Teams', icon: 'users', hint: 'Team Chat' },
  { key: 'reports', href: '/coach/reports', label: 'Reports', icon: 'report', hint: 'Player reports' },
  { key: 'reviews', href: '/coach/reviews', label: 'Video reviews', icon: 'video', hint: 'Foundation+' },
  { key: 'share', href: '/coach/share', label: 'Share links', icon: 'link' },
  { key: 'players', href: '/coach/players', label: 'Players', icon: 'child' },
  { key: 'profile', href: '/coach/profile', label: 'My profile', icon: 'user' },
]
