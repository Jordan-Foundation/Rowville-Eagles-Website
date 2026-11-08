'use client'

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="no-print rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110">
      Print / Save as PDF
    </button>
  )
}
