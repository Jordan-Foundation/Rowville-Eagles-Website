import type { RfaTournament } from '@/payload-types'
import { localYmd } from '@/lib/time'

const input = 'min-h-10 w-full border border-line bg-surface px-2 text-sm'
const hm = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))

/** The tournament's fields (create and edit). */
export function TournamentFields({ t }: { t?: RfaTournament }) {
  const d = (iso?: string | null) => (iso ? localYmd(new Date(iso)) : '')
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-xs text-muted sm:col-span-2">Name<input name="name" required defaultValue={t?.name} placeholder="Easter Cup 2027" className={input} /></label>
      <label className="grid gap-1 text-xs text-muted">Start date<input name="startDate" type="date" required defaultValue={d(t?.startDate)} className={input} /></label>
      <label className="grid gap-1 text-xs text-muted">End date (optional)<input name="endDate" type="date" defaultValue={d(t?.endDate)} className={input} /></label>
      <label className="grid gap-1 text-xs text-muted">Venue<input name="venue" defaultValue={t?.venue ?? ''} className={input} /></label>
      <label className="grid gap-1 text-xs text-muted">Age group(s)<input name="ageGroups" defaultValue={t?.ageGroups ?? ''} placeholder="U10, U11" className={input} /></label>
      <label className="grid gap-1 text-xs text-muted">Squad size limit<input name="squadSize" type="number" min={1} max={40} defaultValue={t?.squadSize ?? 10} className={input} /></label>
      <label className="grid gap-1 text-xs text-muted">Fee per player (AUD, optional)<input name="fee" type="number" min={0} step="0.01" defaultValue={t?.fee ?? ''} className={input} /></label>
      <label className="grid gap-1 text-xs text-muted">RSVP deadline<input name="rsvpDate" type="date" required defaultValue={d(t?.rsvpDeadline)} className={input} /></label>
      <label className="grid gap-1 text-xs text-muted">at<input name="rsvpTime" type="time" defaultValue={t?.rsvpDeadline ? hm(t.rsvpDeadline) : '20:00'} className={input} /></label>
      <label className="grid gap-1 text-xs text-muted sm:col-span-2">Arrival time<input name="arrivalTime" defaultValue={t?.arrivalTime ?? ''} placeholder="Arrive 8:15am for a 9am first game" className={input} /></label>
      <label className="grid gap-1 text-xs text-muted sm:col-span-2">What to bring<textarea name="whatToBring" rows={2} defaultValue={t?.whatToBring ?? ''} className={input} /></label>
      <label className="grid gap-1 text-xs text-muted sm:col-span-2">Other details<textarea name="details" rows={2} defaultValue={t?.details ?? ''} className={input} /></label>
    </div>
  )
}
