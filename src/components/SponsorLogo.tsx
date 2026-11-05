import Image from 'next/image'
import type { Media, Sponsor } from '@/payload-types'

export function sponsorLogoSrc(s: Sponsor) {
  const m = typeof s.logo === 'object' ? (s.logo as Media | null) : null
  return m?.url || s.logoUrl || null
}

/** Uniform logo card: white card with the logo contained, or a full-bleed tile for logos with their own background. */
export function SponsorCard({ sponsor, size = 'md' }: { sponsor: Sponsor; size?: 'md' | 'lg' }) {
  const src = sponsorLogoSrc(sponsor)
  const h = size === 'lg' ? 'h-40' : 'h-28'
  const tile = Boolean(sponsor.tileColor)
  const inner = src ? (
    <Image
      src={src}
      alt={sponsor.name}
      fill
      sizes="(min-width: 1024px) 20vw, 45vw"
      className={`transition duration-300 group-hover:scale-[1.04] ${tile ? 'object-contain p-1' : 'object-contain p-5'}`}
    />
  ) : (
    <span className="font-[family-name:var(--font-barlow)] text-xl font-bold uppercase text-muted">{sponsor.name}</span>
  )
  const cls = `group relative grid ${h} place-items-center overflow-hidden rounded-2xl border border-line transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5`
  const style = tile ? { background: sponsor.tileColor! } : { background: '#fff' }
  return sponsor.website ? (
    <a href={sponsor.website} target="_blank" rel="noopener sponsored" className={cls} style={style} title={sponsor.name}>
      {inner}
    </a>
  ) : (
    <div className={cls} style={style} title={sponsor.name}>
      {inner}
    </div>
  )
}
