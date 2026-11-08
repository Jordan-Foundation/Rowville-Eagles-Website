'use client'

import { useActionState, useEffect, useState } from 'react'
import { inputCls } from '@/components/forms/Field'
import { moderate, newThread, noticeAction, replyThread, saveFixture, saveNotice, saveTraining, type TeamState } from './actions'

const btn = 'rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50'
const ghost = 'rounded-full border border-line px-3 py-1 text-xs font-semibold hover:border-brand'
const Msg = ({ s }: { s: TeamState }) => (
  <>
    {s.error && <p role="alert" className="text-sm text-red-700">{s.error}</p>}
    {s.done && <p role="status" className="text-sm text-emerald-700">{s.done}</p>}
  </>
)

export function NoticeForm({ slug, edit, families }: { slug: string; edit?: { id: number; title: string; body: string; pinned: boolean }; families?: number }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(saveNotice, {})
  const [title, setTitle] = useState(edit?.title ?? '')
  const [body, setBody] = useState(edit?.body ?? '')
  // Clear the new-notice form once it's posted
  useEffect(() => {
    if (state.done && !edit) {
      setTitle('')
      setBody('')
    }
  }, [state, edit])
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const send = (e.currentTarget.elements.namedItem('send') as HTMLInputElement | null)?.checked
        const who = families != null ? `${families} famil${families === 1 ? 'y' : 'ies'}` : 'every family on the team'
        if (send && !confirm(`Email and text this to ${who} now?`)) e.preventDefault()
      }}
      className="space-y-3"
    >
      <input type="hidden" name="slug" value={slug} />
      {edit && <input type="hidden" name="id" value={edit.id} />}
      <input name="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title, e.g. Saturday’s game moved to 9am" className={inputCls} />
      <textarea name="body" required rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="The full message for families" className={inputCls} />
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="pinned" defaultChecked={edit?.pinned} /> Pin to top</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="send" /> {edit ? 'Send the update to families again' : `Also email and text ${families != null ? `all ${families} famil${families === 1 ? 'y' : 'ies'}` : 'all families'}`}</label>
        <button disabled={pending} className={btn}>{pending ? 'Saving…' : edit ? 'Save changes' : 'Post notice'}</button>
      </div>
      <Msg s={state} />
    </form>
  )
}

export function NoticeTools({ slug, id, pinned, editing }: { slug: string; id: number; pinned: boolean; editing: { title: string; body: string } }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(noticeAction, {})
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className={ghost}>{open ? 'Close' : 'Edit'}</button>
        {(['pin', 'delete'] as const).map((op) => (
          <form key={op} action={action} onSubmit={(e) => { if (op === 'delete' && !confirm('Delete this notice?')) e.preventDefault() }}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="op" value={op} />
            <button disabled={pending} className={ghost}>{op === 'pin' ? (pinned ? 'Unpin' : 'Pin') : 'Delete'}</button>
          </form>
        ))}
      </div>
      {open && <NoticeForm slug={slug} edit={{ id, pinned, ...editing }} />}
      <Msg s={state} />
    </div>
  )
}

type TrainingRow = { day: string; start: string; end?: string | null; location?: string | null }
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function TrainingForm({ slug, rows }: { slug: string; rows: TrainingRow[] }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(saveTraining, {})
  const [list, setList] = useState<TrainingRow[]>(rows.length ? rows : [{ day: 'Tuesday', start: '17:00', end: '18:00', location: '' }])
  const set = (i: number, k: keyof TrainingRow, v: string) => setList((l) => l.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      {list.map((r, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[9rem_6rem_6rem_1fr_auto]">
          <select name="day" value={r.day} onChange={(e) => set(i, 'day', e.target.value)} className={inputCls} aria-label="Day">{DAYS.map((d) => <option key={d}>{d}</option>)}</select>
          <input name="start" type="time" value={r.start} onChange={(e) => set(i, 'start', e.target.value)} className={inputCls} aria-label="Start" />
          <input name="end" type="time" value={r.end ?? ''} onChange={(e) => set(i, 'end', e.target.value)} className={inputCls} aria-label="End" />
          <input name="location" value={r.location ?? ''} onChange={(e) => set(i, 'location', e.target.value)} placeholder="Location" className={inputCls} />
          <button type="button" onClick={() => setList((l) => l.filter((_, j) => j !== i))} className={ghost}>Remove</button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setList((l) => [...l, { day: 'Thursday', start: '17:00', end: '18:00', location: l.at(-1)?.location ?? '' }])} className={ghost}>Add a session</button>
        <button disabled={pending} className={btn}>{pending ? 'Saving…' : 'Save training'}</button>
      </div>
      <Msg s={state} />
    </form>
  )
}

export function FixtureForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(saveFixture, {})
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[9rem_7rem_1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="op" value="add" />
      <input name="date" type="date" required className={inputCls} aria-label="Date" />
      <input name="time" type="time" className={inputCls} aria-label="Time" />
      <input name="opponent" required placeholder="Opponent" className={inputCls} />
      <input name="venue" placeholder="Venue / pitch" className={inputCls} />
      <button disabled={pending} className={btn}>Add</button>
      <div className="sm:col-span-5"><Msg s={state} /></div>
    </form>
  )
}

export function FixtureTools({ slug, id, result }: { slug: string; id: string; result?: string | null }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(saveFixture, {})
  return (
    <span className="flex flex-wrap items-center gap-2">
      <form action={action} className="flex gap-1">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="fixtureId" value={id} />
        <input type="hidden" name="op" value="result" />
        <input name="result" defaultValue={result ?? ''} placeholder="Result, e.g. W 3–1" className="w-32 rounded-lg border border-line bg-surface px-2 py-1 text-xs" />
        <button disabled={pending} className={ghost}>Save</button>
      </form>
      <form action={action}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="fixtureId" value={id} />
        <input type="hidden" name="op" value="delete" />
        <button disabled={pending} className={ghost}>Remove</button>
      </form>
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
    </span>
  )
}

export function ThreadForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(newThread, {})
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input name="title" required placeholder="Your question, e.g. Do we need shin pads at training?" className={inputCls} />
      <textarea name="body" required rows={3} placeholder="More detail (optional for others to help)" className={inputCls} />
      <button disabled={pending} className={btn}>{pending ? 'Posting…' : 'Ask the team'}</button>
      <Msg s={state} />
    </form>
  )
}

export function ReplyForm({ slug, thread }: { slug: string; thread: number }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(replyThread, {})
  return (
    <form action={action} className="mt-3 flex flex-wrap gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="thread" value={thread} />
      <input name="body" required placeholder="Write a reply…" className={`${inputCls} min-w-60 flex-1`} />
      <button disabled={pending} className={btn}>Reply</button>
      <div className="basis-full"><Msg s={state} /></div>
    </form>
  )
}

export function ModTools({ slug, id, kind, pinned, locked }: { slug: string; id: number; kind: 'thread' | 'reply'; pinned?: boolean; locked?: boolean }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(moderate, {})
  const ops = kind === 'reply' ? [['remove-reply', 'Remove']] : [['pin', pinned ? 'Unpin' : 'Pin'], ['lock', locked ? 'Unlock' : 'Lock'], ['remove', 'Remove']]
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {ops.map(([op, label]) => (
        <form key={op} action={action} onSubmit={(e) => { if (op.startsWith('remove') && !confirm('Remove this post? It is hidden from families but kept for the record.')) e.preventDefault() }}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="op" value={op} />
          <button disabled={pending} className={ghost}>{label}</button>
        </form>
      ))}
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
    </span>
  )
}
