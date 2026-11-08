/** "You're paying: Rowville Foundation Academy" — shown just above every pay button, so families know who charges them. */
export function PayeeChip({ label, className = '' }: { label: string; className?: string }) {
  const academy = /academy/i.test(label)
  return (
    <p className={`flex flex-wrap items-center justify-center gap-2 text-xs text-muted ${className}`}>
      <span className={`inline-flex items-center gap-1.5 border px-3 py-1 font-semibold text-ink ${academy ? 'border-white/40' : 'rounded-full border-line bg-surface'}`}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="7" width="10" height="7" rx="1" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></svg>
        You’re paying {label}
      </span>
      <span>Secure payment by Stripe</span>
    </p>
  )
}
