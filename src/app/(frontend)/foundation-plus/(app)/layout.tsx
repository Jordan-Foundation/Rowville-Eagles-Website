import { AcademyBackdrop } from '@/components/AcademyBackdrop'
import { foundationGate } from '@/academy/pdr/load'

export default async function FoundationLayout({ children }: { children: React.ReactNode }) {
  const { preview, settings } = await foundationGate()
  return (
    <div data-brand="academy" data-page-brand="academy" className="relative min-h-[70vh] overflow-hidden">
      <AcademyBackdrop size="sm" />
      {preview && (
        <p className="relative border-b border-amber-400/40 bg-amber-400/10 px-4 py-2 text-center text-sm text-amber-200">
          Preview — {settings.name} is hidden from families. Turn it on in the admin: Foundation+ → Foundation+ settings.
        </p>
      )}
      <div className="container-x relative py-12">{children}</div>
    </div>
  )
}
