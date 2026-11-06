import type { Metadata } from 'next'
import { CoachNav } from './CoachNav'

export const metadata: Metadata = { title: { default: 'Coach portal', template: '%s · Coach portal' }, robots: { index: false } }

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-brand="academy" data-page-brand="academy" className="min-h-[70vh]">
      <div className="border-b border-line bg-surface-2">
        <div className="container-x flex flex-wrap items-center justify-between gap-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Foundation Academy · Coach portal</p>
          <CoachNav />
        </div>
      </div>
      <div className="container-x py-12">{children}</div>
    </div>
  )
}
