/** After booking: add the sessions to a calendar, open the booking, get directions, and what to bring. */
export function BookingNextSteps({ reference, directions, whatToBring, dropOffPickUp, academy }: {
  reference: string
  directions?: string | null
  whatToBring?: string | null
  dropOffPickUp?: string | null
  academy?: boolean
}) {
  const btn = `inline-flex min-h-11 items-center justify-center gap-2 border px-4 py-2.5 text-sm font-semibold transition ${academy ? 'border-white/40 hover:bg-white hover:text-black' : 'rounded-full border-line bg-surface hover:border-ink'}`
  return (
    <div className="mt-6 text-left">
      <div className="grid gap-3 sm:grid-cols-3">
        <a href={`/calendar/${reference}`} className={btn} download>
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="14" height="13" rx="1.5" /><path d="M3 8h14M7 2v4M13 2v4" /></svg>
          Add to calendar
        </a>
        <a href={`/account/bookings/${reference}`} className={btn}>View booking</a>
        {directions && <a href={directions} target="_blank" rel="noopener" className={btn}>Get directions</a>}
      </div>
      {(whatToBring || dropOffPickUp) && (
        <dl className={`panel mt-4 space-y-3 border border-line p-5 text-sm ${academy ? '' : 'rounded-2xl bg-surface-2'}`}>
          {whatToBring && <div><dt className="font-semibold">What to bring</dt><dd className="mt-1 whitespace-pre-line text-muted">{whatToBring}</dd></div>}
          {dropOffPickUp && <div><dt className="font-semibold">Drop-off &amp; pick-up</dt><dd className="mt-1 whitespace-pre-line text-muted">{dropOffPickUp}</dd></div>}
        </dl>
      )}
    </div>
  )
}
