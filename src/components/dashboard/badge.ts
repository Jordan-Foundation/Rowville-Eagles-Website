/** Badge text: hidden at 0, "99+" above 99 (pure — unit tested). */
export const badgeText = (n: number | null | undefined) => (!n || n <= 0 ? null : n > 99 ? '99+' : String(n))
export const badgeLabel = (label: string, n: number | null | undefined) => (badgeText(n) ? `${label}, ${n! > 99 ? 'more than 99' : n} need${n === 1 ? 's' : ''} attention` : label)
