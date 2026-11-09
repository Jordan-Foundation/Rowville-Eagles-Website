import Link from 'next/link'
import { dialable, formatPhone, isMobile } from '@/lib/phone'

/** One-tap Call / Text / Message for a parent (coach portal). */
export function ContactButtons({ name, phone, accountId, compact = false }: { name?: string; phone?: string | null; accountId?: number | null; compact?: boolean }) {
  const tel = dialable(phone)
  const btn = `inline-flex min-h-10 items-center justify-center gap-1.5 border border-line px-3 text-xs font-semibold uppercase tracking-[0.12em] transition hover:border-white hover:bg-white hover:text-black`
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!compact && (name || phone) && (
        <p className="mr-1 text-sm">
          {name}
          {phone && <span className="ml-1 text-muted">· {formatPhone(phone)}</span>}
        </p>
      )}
      {tel && <a href={`tel:${tel}`} className={btn} aria-label={`Call ${name ?? 'parent'}`}>Call</a>}
      {tel && isMobile(phone) && <a href={`sms:${tel}`} className={btn} aria-label={`Text ${name ?? 'parent'}`}>Text</a>}
      {accountId && <Link href={`/coach/messages/open?account=${accountId}`} className={btn} aria-label={`Message ${name ?? 'parent'}`}>Message</Link>}
    </div>
  )
}

/** Red MEDICAL badge with the note, or a quiet "No medical notes". */
export function MedicalBadge({ note, quiet = true }: { note?: string | null; quiet?: boolean }) {
  if (note?.trim())
    return (
      <p className="mt-1 text-sm">
        <span className="mr-1.5 bg-red-600 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">Medical</span>
        {note}
      </p>
    )
  return quiet ? <p className="mt-1 text-sm text-muted">No medical notes</p> : null
}
