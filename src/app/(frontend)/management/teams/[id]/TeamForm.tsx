'use client'

import { useActionState } from 'react'
import { saveTeam, type TeamEditState } from './actions'

type Props = {
  team: { id: number; name: string; type: string; category?: string | null; ageGroup?: string | null; competition?: string | null; trainingTimes?: string | null; driblUrl?: string | null; coaches: number[]; sections: Record<string, boolean> }
  categories: { label: string; value: string }[]
  people: { id: number; name: string }[]
}
const input = 'mt-1 block w-full min-h-10 border border-line bg-black/40 px-3'

export function TeamForm({ team, categories, people }: Props) {
  const [state, action, pending] = useActionState<TeamEditState, FormData>(saveTeam, {})
  const sec = (k: string, label: string) => (
    <label key={k} className="flex items-center gap-2"><input type="checkbox" name={`sec-${k}`} defaultChecked={team.sections[k] !== false} /> {label}</label>
  )
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="id" value={team.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Team name<input name="name" defaultValue={team.name} required className={input} /></label>
        {team.type !== 'tournament' && (
          <label className="text-sm">Category
            <select name="category" defaultValue={team.category ?? ''} className={input}><option value="">—</option>{categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          </label>
        )}
        <label className="text-sm">Age group<input name="ageGroup" defaultValue={team.ageGroup ?? ''} placeholder="e.g. 2017s" className={input} /></label>
        <label className="text-sm">Competition / division<input name="competition" defaultValue={team.competition ?? ''} className={input} /></label>
        <label className="text-sm">Training (public summary)<input name="trainingTimes" defaultValue={team.trainingTimes ?? ''} placeholder="Tue & Thu 5:00pm" className={input} /></label>
        <label className="text-sm">Fixtures link (Dribl)<input name="driblUrl" type="url" defaultValue={team.driblUrl ?? ''} placeholder="https://…" className={input} /></label>
      </div>
      <fieldset className="text-sm">
        <legend className="font-semibold">Coaches &amp; managers</legend>
        <p className="text-xs text-muted">They can post notices, edit training and fixtures, see the player list and moderate Team Chat.</p>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {people.map((u) => <label key={u.id} className="flex items-center gap-2"><input type="checkbox" name="coaches" value={u.id} defaultChecked={team.coaches.includes(u.id)} /> {u.name}</label>)}
        </div>
      </fieldset>
      <fieldset className="text-sm">
        <legend className="font-semibold">Team page sections</legend>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          {team.type === 'tournament' && sec('info', 'Tournament info')}
          {sec('notices', 'Notice board')}{sec('fixtures', 'Fixtures & results')}{team.type !== 'tournament' && sec('training', 'Training schedule')}{sec('forum', 'Team Chat')}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="min-h-11 bg-white px-5 text-sm font-semibold uppercase tracking-[0.12em] text-black disabled:opacity-60">{pending ? 'Saving…' : 'Save team'}</button>
        {state.saved && <span role="status" className="text-sm text-emerald-300">{state.saved}</span>}
        {state.error && <span role="alert" className="text-sm text-red-300">{state.error}</span>}
      </div>
    </form>
  )
}
