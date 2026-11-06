'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CasualSlot, TermSlot } from '@/academy/slots'
import type { PublicCoach } from '@/academy/booking-data'

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const aud = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n)
const time12 = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`
}
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const mondayOf = (ymd: string) => addDays(ymd, -((new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7))
const fmt = (ymd: string, o: Intl.DateTimeFormatOptions) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-AU', { ...o, timeZone: 'UTC' })
const fmtIso = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-AU', { ...o, timeZone: 'Australia/Sydney' })

type Props = {
  mode: 'casual' | 'term'
  slots: CasualSlot[]
  weekly: TermSlot[]
  coaches: PublicCoach[]
  casualPrice: number
  pricePerSession: number
  /** Term families: lower casual price for sessions starting before `until` */
  member?: { price: number; until: string } | null
}

const priceFor = (p: Props, startsAt: string) => (p.member && startsAt <= p.member.until ? p.member.price : p.casualPrice)

type Picked =
  | { mode: 'casual'; slot: CasualSlot }
  | { mode: 'term'; slot: TermSlot }

export function SlotBrowser(props: Props) {
  const [picked, setPicked] = useState<Picked | null>(null)
  return (
    <div>
      {props.mode === 'casual' ? <CasualView slots={props.slots} member={props.member} onPick={(slot) => setPicked({ mode: 'casual', slot })} /> : <TermView weekly={props.weekly} pricePerSession={props.pricePerSession} onPick={(slot) => setPicked({ mode: 'term', slot })} />}
      {picked && (
        <CoachCarousel
          picked={picked}
          coaches={props.coaches.filter((c) => picked.slot.coachIds.includes(c.id))}
          price={picked.mode === 'casual' ? `${aud(priceFor(props, picked.slot.startsAt))}${priceFor(props, picked.slot.startsAt) < props.casualPrice ? ' term member price' : ''}` : aud(props.pricePerSession * picked.slot.sessions.length)}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  )
}

function CasualView({ slots, member, onPick }: { slots: CasualSlot[]; member?: Props['member']; onPick: (s: CasualSlot) => void }) {
  const weeks = useMemo(() => Array.from(new Set(slots.map((s) => mondayOf(s.date)))).sort(), [slots])
  const [week, setWeek] = useState(0)
  const monday = weeks[week]
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const byDate = useMemo(() => {
    const m = new Map<string, CasualSlot[]>()
    for (const s of slots) m.set(s.date, [...(m.get(s.date) ?? []), s])
    return m
  }, [slots])
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={() => setWeek((w) => Math.max(0, w - 1))} disabled={week === 0} className="border border-line px-4 py-2 text-sm disabled:opacity-30">← Prev</button>
        <p className="font-display text-lg font-semibold uppercase">Week of {fmt(monday, { day: 'numeric', month: 'long' })}</p>
        <button type="button" onClick={() => setWeek((w) => Math.min(weeks.length - 1, w + 1))} disabled={week >= weeks.length - 1} className="border border-line px-4 py-2 text-sm disabled:opacity-30">Next →</button>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((d, i) => {
          const list = byDate.get(d) ?? []
          return (
            <div key={d} className={`panel border border-line p-4 ${list.length ? '' : 'opacity-40'}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{DAY[i]}</p>
              <p className="font-display text-xl font-semibold">{fmt(d, { day: 'numeric', month: 'short' })}</p>
              <div className="mt-3 flex flex-wrap gap-2 lg:flex-col">
                {list.length === 0 && <p className="text-xs text-muted">No times</p>}
                {list.map((s) => (
                  <button key={s.startsAt} type="button" onClick={() => onPick(s)} className="border border-white/30 px-3 py-2 text-left text-sm transition hover:border-white hover:bg-white hover:text-black">
                    <span className="font-semibold">{time12(s.time)}</span>
                    <span className="block text-xs opacity-70">
                      {s.coachIds.length} coach{s.coachIds.length === 1 ? '' : 'es'}
                      {member && s.startsAt <= member.until && ` · ${aud(member.price)}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function TermView({ weekly, pricePerSession, onPick }: { weekly: TermSlot[]; pricePerSession: number; onPick: (s: TermSlot) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {WEEKDAYS.map((day, i) => {
        const list = weekly.filter((s) => s.weekday === day)
        const n = list[0]?.sessions.length
        return (
          <div key={day} className={`panel border border-line p-4 ${list.length ? '' : 'opacity-40'}`}>
            <p className="font-display text-xl font-semibold uppercase">{DAY[i]}s</p>
            <p className="text-xs text-muted">{n ? `${n} sessions left · ${aud(pricePerSession * n)}` : 'No weekly times'}</p>
            <div className="mt-3 flex flex-wrap gap-2 lg:flex-col">
              {list.map((s) => (
                <button key={s.time} type="button" onClick={() => onPick(s)} className="border border-white/30 px-3 py-2 text-left text-sm transition hover:border-white hover:bg-white hover:text-black">
                  <span className="font-semibold">{time12(s.time)}</span>
                  <span className="block text-xs opacity-70">{s.coachIds.length} coach{s.coachIds.length === 1 ? '' : 'es'} · from {fmtIso(s.sessions[0], { day: 'numeric', month: 'short' })}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CoachCarousel({ picked, coaches, price, onClose }: { picked: Picked; coaches: PublicCoach[]; price: string; onClose: () => void }) {
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(index + 1)
      if (e.key === 'ArrowLeft') go(index - 1)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  })
  const go = (i: number) => {
    const n = Math.max(0, Math.min(coaches.length - 1, i))
    track.current?.children[n]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    setIndex(n)
  }
  const label =
    picked.mode === 'casual'
      ? `${fmt(picked.slot.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${time12(picked.slot.time)}`
      : `${picked.slot.weekday}s · ${time12(picked.slot.time)} · ${picked.slot.sessions.length} sessions from ${fmtIso(picked.slot.sessions[0], { day: 'numeric', month: 'short' })}`
  const href = (c: PublicCoach) =>
    picked.mode === 'casual'
      ? `/academy/1-on-1/book?coach=${c.id}&start=${encodeURIComponent(picked.slot.startsAt)}`
      : `/academy/1-on-1/book?mode=term&coach=${c.id}&weekday=${picked.slot.weekday}&time=${picked.slot.time}`

  return (
    <div role="dialog" aria-modal="true" aria-label={`Coaches free ${label}`} className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 p-0 backdrop-blur sm:items-center sm:p-6" onClick={onClose}>
      <div data-brand="academy" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto border border-line bg-surface sm:rounded-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">Choose your coach</p>
            <p className="mt-1 font-display text-xl font-semibold">{label}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="px-2 text-2xl leading-none text-muted hover:text-ink">×</button>
        </div>
        <div
          ref={track}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto p-5 [scrollbar-width:none]"
          onScroll={(e) => {
            const el = e.currentTarget
            const w = el.firstElementChild?.clientWidth ?? 1
            setIndex(Math.round(el.scrollLeft / (w + 16)))
          }}
        >
          {coaches.map((c) => {
            const away = picked.mode === 'term' ? picked.slot.awayDates[c.id] ?? [] : []
            return (
              <article key={c.id} className="panel gloss-sheen w-[82%] shrink-0 snap-center border border-line sm:w-[46%]">
                <div className="relative aspect-[4/3] bg-surface-2">
                  {c.photo ? <Image src={c.photo} alt={c.name} fill sizes="(min-width: 640px) 22rem, 80vw" className="object-cover" /> : <div className="grid h-full place-items-center text-muted">{c.name}</div>}
                </div>
                <div className="p-5">
                  <h3 className="font-display text-2xl font-semibold uppercase">{c.name}</h3>
                  {c.bio && <p className="mt-2 text-sm leading-relaxed text-muted">{c.bio}</p>}
                  {c.specialties.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.specialties.map((s) => <span key={s} className="border border-line px-2 py-0.5 text-xs uppercase tracking-wider">{s}</span>)}
                    </div>
                  )}
                  {away.length > 0 && (
                    <p className="mt-3 border border-white/30 px-3 py-2 text-xs">
                      Away {away.length} week{away.length === 1 ? '' : 's'} ({away.map((d) => fmt(d, { day: 'numeric', month: 'short' })).join(', ')}) — a replacement coach covers those sessions.
                    </p>
                  )}
                  <Link href={href(c)} className="mt-5 block bg-white px-5 py-3 text-center text-sm font-semibold uppercase tracking-[0.15em] text-black hover:bg-white/85">
                    {picked.mode === 'term' ? `Book term with ${c.name}` : `Book ${c.name}`} · {price}
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
        {coaches.length > 1 && (
          <div className="flex items-center justify-center gap-4 pb-5">
            <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous coach" className="border border-line px-3 py-1 disabled:opacity-30">←</button>
            <div className="flex gap-1.5" aria-hidden>
              {coaches.map((c, i) => <span key={c.id} className={`h-1.5 w-6 transition ${i === index ? 'bg-white' : 'bg-line'}`} />)}
            </div>
            <button type="button" onClick={() => go(index + 1)} disabled={index >= coaches.length - 1} aria-label="Next coach" className="border border-line px-3 py-1 disabled:opacity-30">→</button>
          </div>
        )}
      </div>
    </div>
  )
}
