/** Placeholder crest — replace with the official logo SVG once supplied. */
export function Crest({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 56" className={className} aria-hidden="true">
      <path d="M24 2 44 9v18c0 13-8.5 22.5-20 27C12.5 49.5 4 40 4 27V9L24 2Z" fill="var(--brand)" stroke="var(--accent)" strokeWidth="2.5" />
      <path d="M12 30c5-1 8-4 12-10 4 6 7 9 12 10-5 1-8 3-12 8-4-5-7-7-12-8Z" fill="var(--accent)" />
    </svg>
  )
}
