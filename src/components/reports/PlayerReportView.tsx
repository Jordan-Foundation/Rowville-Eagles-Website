import { Crest } from '@/components/Logos'
import { RATINGS, RATING_LABEL, type Rating } from '@/academy/curriculum/levels'

export type ReportRow = { strand: string; standard?: string | null; rating: Rating | null; comment?: string | null }
export type ReportViewProps = {
  eyebrow: string // e.g. "Player report · Mid-year 2027"
  title: string // e.g. "Ava Smith · Age 9"
  badge?: string
  rows: ReportRow[]
  overall?: string | null
  footer?: string | null // e.g. "Coach Sam Rossi · released 3 Jul 2027"
  showStandards?: boolean
}

/**
 * The player report card (the same design as the sample on “Why us”): one row per strand with the rating on the
 * five-point scale, the coach's strand comment, and the overall comment. Prints cleanly (Save as PDF).
 */
export function PlayerReportView({ eyebrow, title, badge, rows, overall, footer, showStandards = true }: ReportViewProps) {
  return (
    <figure className="report-card overflow-hidden rounded-2xl border border-line bg-surface shadow-xl print:shadow-none" aria-label={`${eyebrow}: ${title}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 bg-[#0f2a55] px-5 py-4 text-white print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
        <div className="flex items-center gap-3">
          <Crest className="hidden h-12 w-auto print:block" preload />
          <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/70">{eyebrow}</p>
          <p className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">{title}</p>
          </div>
        </div>
        {badge && <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs">{badge}</span>}
      </div>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Achievement in each strand, on a five-point scale from Well below to Well above the standard for this level</caption>
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            <th scope="col" className="px-4 py-2 font-medium">Strand</th>
            {RATINGS.map((r) => <th key={r} scope="col" className="hidden w-16 px-1 py-2 text-center font-medium sm:table-cell print:table-cell">{RATING_LABEL[r]}</th>)}
            <th scope="col" className="px-4 py-2 font-medium sm:hidden print:hidden">Rating</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => {
            const level = row.rating ? RATINGS.indexOf(row.rating) : -1
            return (
              <tr key={row.strand} className="break-inside-avoid align-top">
                <th scope="row" className="px-4 py-3 font-semibold">
                  {row.strand}
                  {showStandards && row.standard && (
                    <>
                      <p className="mt-1 hidden text-xs font-normal italic text-muted sm:block print:block">{row.standard}</p>
                      {/* Phones: the long standard folds away */}
                      <details className="mt-1 text-xs font-normal text-muted sm:hidden print:hidden">
                        <summary className="cursor-pointer py-1 font-semibold text-brand [[data-brand=academy]_&]:text-ink">What this means</summary>
                        <p className="italic">{row.standard}</p>
                      </details>
                    </>
                  )}
                  {row.comment && <p className="mt-1.5 text-sm font-normal">{row.comment}</p>}
                </th>
                {RATINGS.map((r, i) => (
                  <td key={r} className="hidden px-1 py-3 text-center sm:table-cell print:table-cell">
                    {i === level ? <span aria-label={RATING_LABEL[r]} className="inline-block h-4 w-4 rounded-full bg-brand print:[print-color-adjust:exact]" /> : <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-line print:[print-color-adjust:exact]" />}
                  </td>
                ))}
                <td className="px-4 py-3 text-xs font-semibold sm:hidden print:hidden">{level >= 0 ? RATING_LABEL[row.rating!] : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {overall && (
        <div className="break-inside-avoid border-t border-line px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Coach’s comment</p>
          <p className="mt-2 whitespace-pre-line">{overall}</p>
        </div>
      )}
      {footer && <figcaption className="border-t border-line px-5 py-3 text-xs text-muted">{footer}</figcaption>}
    </figure>
  )
}
