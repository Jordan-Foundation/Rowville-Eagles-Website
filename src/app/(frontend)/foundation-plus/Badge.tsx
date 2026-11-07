import type { CabinetBadge } from '@/academy/pdr/badges'

/** Badge artwork, or a simple shield in the area's colour until artwork is uploaded. Unearned = greyed out. */
export function BadgeArt({ badge, size = 96 }: { badge: Pick<CabinetBadge, 'artwork' | 'name' | 'level' | 'earnedAt'> & { area: { colour: string | null; name: string } }; size?: number }) {
  const earned = Boolean(badge.earnedAt)
  const style = { width: size, height: size, filter: earned ? undefined : 'grayscale(1) brightness(0.45)', opacity: earned ? 1 : 0.7 }
  if (badge.artwork) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={badge.artwork} alt={earned ? badge.name : `${badge.name} (not earned yet)`} style={style} className="object-contain" />
  }
  const c = badge.area.colour || '#ffffff'
  return (
    <svg viewBox="0 0 100 100" style={style} role="img" aria-label={earned ? badge.name : `${badge.name} (not earned yet)`}>
      <path d="M50 4 88 18v30c0 24-16 40-38 48C28 88 12 72 12 48V18Z" fill={c} opacity="0.22" stroke={c} strokeWidth="3" />
      <path d="M50 16 76 26v22c0 17-11 29-26 35-15-6-26-18-26-35V26Z" fill={c} />
      <text x="50" y="58" textAnchor="middle" fontSize="28" fontWeight="800" fill="#000" fontFamily="Arial, sans-serif">{badge.level}</text>
      <text x="50" y="74" textAnchor="middle" fontSize="8" fontWeight="700" fill="#000" fontFamily="Arial, sans-serif" letterSpacing="1">LEVEL</text>
    </svg>
  )
}
