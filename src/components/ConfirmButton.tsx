'use client'

/** A submit button that asks "are you sure?" first (for actions that are easy to tap by mistake). */
export function ConfirmButton({ message, className, children, name, value }: { message: string; className?: string; children: React.ReactNode; name?: string; value?: string }) {
  return (
    <button type="submit" name={name} value={value} className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault() }}>
      {children}
    </button>
  )
}
