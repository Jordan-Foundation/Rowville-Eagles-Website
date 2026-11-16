'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { COMMENT_MAX, COMMENT_MIN, FEELINGS, FOCUS_MAX, MOMENTS_PER_TYPE, type MomentType } from '@/reflections/rules'
import { saveReflectionAction, type ReflectAuth, type ReflectPayload } from './actions'

type Pillar = { id: number; name: string; hint?: string | null }
type Moment = { type: MomentType; pillar: number | null; comment: string }

const input = 'mt-1 block w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink outline-none focus:border-ink'
const len = (s: string) => s.replace(/\s+/g, ' ').trim().length
const momentOk = (m: Moment) => Boolean(m.pillar) && len(m.comment) >= COMMENT_MIN && len(m.comment) <= COMMENT_MAX

function blank(type: MomentType, from: Moment[]): Moment[] {
  const list = from.filter((m) => m.type === type)
  return Array.from({ length: MOMENTS_PER_TYPE }, (_, i) => list[i] ?? { type, pillar: null, comment: '' })
}

export function ReflectForm({ auth, pillars, initial, playerName, submittedBefore }: {
  auth: ReflectAuth
  pillars: Pillar[]
  initial: ReflectPayload
  playerName: string
  submittedBefore: boolean
}) {
  const [feeling, setFeeling] = useState<number | null>(initial.feeling)
  const [great, setGreat] = useState<Moment[]>(blank('great', initial.moments))
  const [improve, setImprove] = useState<Moment[]>(blank('improve', initial.moments))
  const [focus, setFocus] = useState(initial.focus)
  const [step, setStep] = useState(submittedBefore ? 3 : 0)
  const [submitted, setSubmitted] = useState(submittedBefore)
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errors, setErrors] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [pending, start] = useTransition()
  const first = useRef(true)

  const data = (): ReflectPayload => ({ feeling, moments: [...great, ...improve], focus })

  // Autosave drafts a moment after typing stops (submitted reflections save with the button)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (submitted) return
    setSaved('saving')
    const t = setTimeout(async () => {
      const res = await saveReflectionAction(auth, data(), false)
      setSaved(res.ok ? 'saved' : 'error')
      if (!res.ok && res.errors[0]) setErrors(res.errors)
    }, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeling, great, improve, focus])

  const submit = () => start(async () => {
    setErrors([])
    const res = await saveReflectionAction(auth, data(), true)
    if (res.ok) { setSubmitted(true); setDone(true); setSaved('saved') } else setErrors(res.errors)
  })

  const greatOk = great.every(momentOk)
  const improveOk = improve.every(momentOk)
  const focusOk = len(focus) >= 3 && len(focus) <= FOCUS_MAX

  if (done) {
    return (
      <div role="status" className="rounded-2xl border-2 border-accent p-6 text-center">
        <p className="text-4xl">🎉</p>
        <h2 className="mt-2 font-display text-2xl font-bold uppercase">Reflection done!</h2>
        <p className="mt-2 text-muted">Great work, {playerName}. Your focus for next game: <strong className="text-ink">{focus.trim()}</strong></p>
        <p className="mt-2 text-sm text-muted">You can still change it until the reflection closes.</p>
        <button type="button" onClick={() => { setDone(false); setStep(3) }} className="mt-4 rounded-full border border-line px-5 py-2.5 text-sm font-semibold">Edit my reflection</button>
      </div>
    )
  }

  const editor = (list: Moment[], set: (m: Moment[]) => void, type: MomentType) => (
    <ol className="space-y-5">
      {list.map((m, i) => {
        const n = len(m.comment)
        return (
          <li key={i} className="rounded-2xl border border-line p-4" data-moment={`${type}-${i + 1}`}>
            <p className="font-semibold">{type === 'great' ? 'Did well' : 'To work on'} #{i + 1}</p>
            <fieldset className="mt-2">
              <legend className="text-sm text-muted">Which skill area?</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {pillars.map((p) => (
                  <label key={p.id} title={p.hint ?? undefined} className="cursor-pointer rounded-full border border-line px-3.5 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-white">
                    <input type="radio" className="sr-only" name={`${type}-${i}-pillar`} value={p.id} checked={m.pillar === p.id} onChange={() => set(list.map((x, j) => (j === i ? { ...x, pillar: p.id } : x)))} />
                    {p.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="mt-3 block text-sm font-medium">
              {type === 'great' ? 'What happened?' : 'What would you do differently?'}
              <textarea
                name={`${type}-${i}-comment`}
                rows={2}
                maxLength={COMMENT_MAX + 20}
                value={m.comment}
                onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, comment: e.target.value } : x)))}
                className={input}
                placeholder={type === 'great' ? 'e.g. I scanned before I got the ball and played it forward first time' : 'e.g. I lost the ball when I dribbled into two players — next time pass earlier'}
              />
            </label>
            <p className={`mt-1 text-xs ${n > COMMENT_MAX ? 'text-red-600' : 'text-muted'}`}>{n < COMMENT_MIN ? `At least ${COMMENT_MIN} characters (${n})` : `${n}/${COMMENT_MAX}`}</p>
          </li>
        )
      })}
    </ol>
  )

  const steps = ['How did it go?', 'Did well', 'To work on', 'Next game']
  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-xs font-semibold uppercase" aria-label="Steps">
        {steps.map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined} className={`rounded-full px-3 py-1 ${i === step ? 'bg-ink text-surface' : i < step ? 'bg-surface-2' : 'border border-line text-muted'}`}>{i + 1}. {s}</li>)}
      </ol>

      {step === 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold uppercase">How did you feel about the game?</h2>
          <p className="text-sm text-muted">Optional — win or lose, every game teaches you something.</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="How you felt">
            {FEELINGS.map((f) => (
              <button key={f.value} type="button" role="radio" aria-checked={feeling === f.value} onClick={() => setFeeling(feeling === f.value ? null : f.value)} className={`flex w-20 flex-col items-center rounded-2xl border px-2 py-3 ${feeling === f.value ? 'border-brand ring-2 ring-brand' : 'border-line'}`}>
                <span className="text-3xl" aria-hidden>{f.emoji}</span><span className="mt-1 text-xs">{f.label}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setStep(1)} className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink">Next: 3 things you did well</button>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold uppercase">3 things you did well</h2>
          {editor(great, setGreat, 'great')}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setStep(0)} className="rounded-full border border-line px-5 py-3 font-semibold">Back</button>
            <button type="button" disabled={!greatOk} onClick={() => setStep(2)} className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink disabled:opacity-50">Next: 3 things to work on</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold uppercase">3 things to work on</h2>
          {editor(improve, setImprove, 'improve')}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setStep(1)} className="rounded-full border border-line px-5 py-3 font-semibold">Back</button>
            <button type="button" disabled={!improveOk} onClick={() => setStep(3)} className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink disabled:opacity-50">Next: your focus</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          {submitted && (
            <>
              <h2 className="font-display text-2xl font-bold uppercase">Your reflection</h2>
              <div className="flex flex-wrap gap-2 text-sm">
                <button type="button" onClick={() => setStep(0)} className="rounded-full border border-line px-4 py-2">Edit feeling</button>
                <button type="button" onClick={() => setStep(1)} className="rounded-full border border-line px-4 py-2">Edit “did well”</button>
                <button type="button" onClick={() => setStep(2)} className="rounded-full border border-line px-4 py-2">Edit “to work on”</button>
              </div>
            </>
          )}
          <label className="block">
            <span className="font-display text-2xl font-bold uppercase">Your focus for next game</span>
            <span className="mt-1 block text-sm text-muted">One thing you’ll try to do. We’ll show it to you before your next game.</span>
            <input name="focus" value={focus} maxLength={FOCUS_MAX + 20} onChange={(e) => setFocus(e.target.value)} className={input} placeholder="e.g. Check my shoulder before every pass" />
          </label>
          {errors.length > 0 && <ul role="alert" className="list-disc space-y-1 rounded-lg border border-red-500/40 bg-red-500/10 py-3 pl-8 pr-4 text-sm">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          <div className="flex flex-wrap gap-2">
            {!submitted && <button type="button" onClick={() => setStep(2)} className="rounded-full border border-line px-5 py-3 font-semibold">Back</button>}
            <button type="button" disabled={!focusOk || !greatOk || !improveOk || pending} onClick={submit} className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink disabled:opacity-50">{pending ? 'Saving…' : submitted ? 'Save changes' : 'Submit my reflection'}</button>
          </div>
        </section>
      )}

      <p className="text-xs text-muted" aria-live="polite" data-autosave={saved}>
        {submitted ? 'Submitted — you can edit until it closes.' : saved === 'saving' ? 'Saving draft…' : saved === 'saved' ? 'Draft saved' : saved === 'error' ? 'Couldn’t save the draft — check your connection' : 'Your answers save as you go.'}
      </p>
    </div>
  )
}
