export const formatAUD = (n: number) =>
  n === 0 ? 'Free' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n)

export const formatDate = (iso?: string | null, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  iso ? new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', ...opts }).format(new Date(iso)) : ''
