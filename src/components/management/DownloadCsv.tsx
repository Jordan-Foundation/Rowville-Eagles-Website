/** "Download CSV" link for a Management list (opens in Excel / Google Sheets). */
export function DownloadCsv({ list, params, label = 'Download CSV' }: { list: string; params?: Record<string, string | number | undefined | null>; label?: string }) {
  const qs = new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)])).toString()
  return (
    <a href={`/management/export/${list}${qs ? `?${qs}` : ''}`} download className="inline-flex min-h-10 items-center gap-2 border border-line px-3 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M8 2v8m0 0L5 7m3 3 3-3M3 13h10" /></svg>
      {label}
    </a>
  )
}
