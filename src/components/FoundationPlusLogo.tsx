/* eslint-disable @next/next/no-img-element */
/**
 * The official Foundation+ logo files (public/brand/foundation-plus — supplied artwork, never redrawn).
 * tone: 'white' on dark backgrounds, 'black' on light ones.
 */
export type FplusVariant = 'horizontal' | 'mark' | 'stacked' | 'wordmark'
const RATIO: Record<FplusVariant, number> = { horizontal: 884.3 / 234, mark: 302 / 234, stacked: 667.1 / 423.7, wordmark: 735.9 / 118 }

export function FoundationPlusLogo({ variant = 'horizontal', tone = 'white', height = 28, className, alt = 'Foundation+' }: { variant?: FplusVariant; tone?: 'white' | 'black'; height?: number; className?: string; alt?: string }) {
  const width = Math.round(height * RATIO[variant])
  return (
    <img
      src={`/brand/foundation-plus/foundation-plus_${variant}_${tone}.svg`}
      alt={alt}
      width={width}
      height={height}
      className={className}
      // Fixed size so it never collapses inside flex/inline wrappers (global img max-width: 100%)
      style={{ height, width, maxWidth: 'none', display: 'block', flexShrink: 0 }}
    />
  )
}
