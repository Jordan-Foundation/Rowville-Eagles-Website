import { FoundationMark } from './Logos'

/**
 * RFA signature backdrop: 60° slant lines + oversized gloss Foundation triangle.
 * Place inside a `relative overflow-hidden` section on any academy page.
 */
export function AcademyBackdrop({ size = 'lg' }: { size?: 'lg' | 'md' | 'sm' }) {
  const h = { lg: 'h-[46rem]', md: 'h-[30rem]', sm: 'h-[20rem]' }[size]
  return (
    <>
      <div className="slant-lines pointer-events-none absolute inset-0" aria-hidden />
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id="rfa-gloss" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.45" stopColor="#6b6b70" />
            <stop offset="1" stopColor="#1a1a1c" />
          </linearGradient>
        </defs>
      </svg>
      <FoundationMark
        className={`pointer-events-none absolute -right-24 top-1/2 ${h} w-auto -translate-y-1/2 opacity-[0.07] md:right-[-6rem] lg:opacity-[0.12]`}
        ink="url(#rfa-gloss)"
        title=""
      />
    </>
  )
}
