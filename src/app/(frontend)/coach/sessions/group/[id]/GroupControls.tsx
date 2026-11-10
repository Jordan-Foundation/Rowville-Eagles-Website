'use client'

import { useActionState, useState } from 'react'
import { groupDecisionAction, type FoundPlayer, type GroupDecisionState } from '../actions'
import { FindPlayer } from '../new/GroupForm'

const btn = 'border border-line px-3 py-1.5 text-xs font-semibold uppercase tracking-wider disabled:opacity-50'
const field = 'mt-1 block w-full border border-line bg-black/40 px-3 py-2.5 text-sm'

function Result({ state }: { state: GroupDecisionState }) {
  if (state.error) return <p role="alert" className="mt-2 w-full text-sm text-red-300">{state.error}</p>
  if (state.done) return <p role="status" className="mt-2 w-full text-sm text-emerald-300">{state.done}</p>
  return null
}

/** Buttons for one player who hasn't paid: send the link again, or give the place to someone else. */
export function PlaceActions({ groupId, inviteId, player, canResend }: { groupId: number; inviteId: number; player: string; canResend: boolean }) {
  const [state, action, pending] = useActionState<GroupDecisionState, FormData>(groupDecisionAction, {})
  const [replacing, setReplacing] = useState(false)
  const [mode, setMode] = useState<'find' | 'new'>('find')
  const [found, setFound] = useState<FoundPlayer | undefined>()
  const [fresh, setFresh] = useState({ playerFirstName: '', playerLastName: '', parentFirstName: '', parentLastName: '', email: '', mobile: '' })
  const player2 = mode === 'find' ? (found ? { kind: 'existing', participantId: found.id } : null) : { kind: 'new', ...fresh }
  return (
    <div className="w-full sm:w-auto">
      <form action={action} className="flex flex-wrap justify-end gap-2">
        <input type="hidden" name="group" value={groupId} />
        <input type="hidden" name="invite" value={inviteId} />
        {canResend && <button name="do" value="resend" disabled={pending} className={btn}>Resend link</button>}
        <button type="button" onClick={() => setReplacing((r) => !r)} className={btn}>{replacing ? 'Close' : 'Invite someone else'}</button>
        <Result state={state} />
      </form>
      {replacing && !state.done && (
        <form action={action} className="mt-3 border border-line p-4 text-left">
          <input type="hidden" name="group" value={groupId} />
          <input type="hidden" name="invite" value={inviteId} />
          <input type="hidden" name="player" value={JSON.stringify(player2)} />
          <p className="text-sm">Give {player}’s place to someone else, at the same price.</p>
          <div className="mt-2 flex gap-2 text-xs">
            {(['find', 'new'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={`${btn} ${mode === m ? 'bg-white text-black' : ''}`}>{m === 'find' ? 'Find a player' : 'New player'}</button>
            ))}
          </div>
          {mode === 'find' ? (
            <FindPlayer found={found} index={0} onPick={setFound} taken={[]} label={`Replacement for ${player} — search by name`} />
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {([['playerFirstName', 'Player first name'], ['playerLastName', 'Player last name'], ['parentFirstName', 'Parent first name'], ['parentLastName', 'Parent last name'], ['email', 'Parent email'], ['mobile', 'Parent mobile']] as const).map(([k, label]) => (
                <label key={k} className="block text-sm">
                  {label}
                  <input value={fresh[k]} onChange={(e) => setFresh((f) => ({ ...f, [k]: e.target.value }))} type={k === 'email' ? 'email' : k === 'mobile' ? 'tel' : 'text'} aria-label={`Replacement — ${label}`} className={field} />
                </label>
              ))}
            </div>
          )}
          <button name="do" value="replace" disabled={pending} className="mt-4 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-black disabled:opacity-50">{pending ? 'Sending…' : 'Send them a link'}</button>
          <Result state={state} />
        </form>
      )}
    </div>
  )
}

/** What happens to the group: go ahead with who's paid, or cancel and refund everyone. */
export function GroupDecisions({ groupId, paid, waiting, shortfall, onlyPaid, oneOnOnePrice }: { groupId: number; paid: number; waiting: number; shortfall: boolean; onlyPaid?: { name: string; paid: string }; oneOnOnePrice?: string }) {
  const [state, action, pending] = useActionState<GroupDecisionState, FormData>(groupDecisionAction, {})
  const [cancelling, setCancelling] = useState(false)
  if (state.done && /cancelled|refunded/i.test(state.done)) return <p role="status" className="border border-emerald-400/40 p-4 text-sm text-emerald-200">{state.done}</p>
  return (
    <section aria-label="What happens next" className={`border p-5 ${shortfall ? 'border-amber-400/60 bg-amber-400/5' : 'border-line'}`}>
      <h2 className="font-display text-xl font-semibold uppercase">{shortfall ? 'Your decision' : 'If someone doesn’t pay'}</h2>
      <p className="mt-1 text-sm text-muted">
        {shortfall
          ? `The payment deadline has passed: ${paid} paid, ${waiting} not. Invite someone else or resend a link above, or choose below.`
          : 'You can give an unpaid place to someone else, resend a link, go ahead with the players who’ve paid, or cancel.'}
      </p>
      <form action={action} className="mt-4 flex flex-wrap gap-3">
        <input type="hidden" name="group" value={groupId} />
        {waiting > 0 && paid >= 2 && (
          <button name="do" value="smaller" disabled={pending} onClick={(e) => { if (!window.confirm(`Go ahead with the ${paid} players who’ve paid? They keep their price.`)) e.preventDefault() }} className="bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-black disabled:opacity-50">
            Go ahead with {paid} players
          </button>
        )}
        {paid === 1 && onlyPaid && (
          <button
            name="do"
            value="one-on-one"
            disabled={pending}
            onClick={(e) => { if (!window.confirm(`Cancel the group and offer ${onlyPaid.name} a 1-on-1 at the same time instead? Their ${onlyPaid.paid} is refunded and they get a link to book the 1-on-1${oneOnOnePrice ? ` (${oneOnOnePrice})` : ''}, held for them.`)) e.preventDefault() }}
            className="bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-black disabled:opacity-50"
          >
            Offer {onlyPaid.name} a 1-on-1 instead
          </button>
        )}
        <button type="button" onClick={() => setCancelling((v) => !v)} className={`${btn} text-red-200`}>Cancel the group…</button>
        {cancelling && (
          <div className="w-full border border-red-400/40 p-4">
            <label className="block text-sm">Reason (sent to families)<textarea name="reason" rows={2} maxLength={500} className={field} placeholder="Not enough players this time." /></label>
            <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" className="mt-1" /> Cancel the whole group and refund everyone who has paid</label>
            <button name="do" value="cancel" disabled={pending} className="mt-3 bg-red-500 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-50">{pending ? 'Cancelling…' : 'Cancel and refund'}</button>
          </div>
        )}
        <Result state={state} />
      </form>
    </section>
  )
}

/** One-off group, everyone paid: where the term offer stands, and a button to offer it. */
export function CoachTermOffer({ groupId, status, yes, total, weeks, rate }: { groupId: number; status: string; yes: number; total: number; weeks: number; rate: string }) {
  const [state, action, pending] = useActionState<GroupDecisionState, FormData>(groupDecisionAction, {})
  return (
    <section aria-label="Term offer" className="border border-line p-5">
      <h2 className="font-display text-xl font-semibold uppercase">Book the whole term together</h2>
      <p className="mt-1 text-sm text-muted">
        {status === 'proposed'
          ? `Offered — ${yes} of ${total} families have said yes. The rest of the term is held for you until they answer.`
          : status === 'accepted'
            ? 'Every family said yes — the group is booking the rest of the term.'
            : `${weeks} more weeks at ${rate} a session. Families can ask from their link, or you can offer it now.${status === 'declined' || status === 'expired' ? ' (Last time not every family could commit.)' : ''}`}
      </p>
      {status !== 'proposed' && status !== 'accepted' && (
        <form action={action} className="mt-4">
          <input type="hidden" name="group" value={groupId} />
          <button name="do" value="term-offer" disabled={pending} className="bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-black disabled:opacity-50">{pending ? 'Offering…' : 'Offer the term'}</button>
          <Result state={state} />
        </form>
      )}
    </section>
  )
}

/** Add a player to a running group — they pay the group's price for the sessions left. */
export function AddPlayer({ groupId, rate }: { groupId: number; rate: string }) {
  const [state, action, pending] = useActionState<GroupDecisionState, FormData>(groupDecisionAction, {})
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'find' | 'new'>('find')
  const [found, setFound] = useState<FoundPlayer | undefined>()
  const [fresh, setFresh] = useState({ playerFirstName: '', playerLastName: '', parentFirstName: '', parentLastName: '', email: '', mobile: '' })
  const player = mode === 'find' ? (found ? { kind: 'existing', participantId: found.id } : null) : { kind: 'new', ...fresh }
  return (
    <section aria-label="Add a player" className="border border-line p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold uppercase">Add a player</h2>
          <p className="text-sm text-muted">They pay {rate} a session for the sessions left. Everyone else keeps their price.</p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className={btn}>{open ? 'Close' : 'Add a player'}</button>
      </div>
      {open && !state.done && (
        <form action={action} className="mt-4">
          <input type="hidden" name="group" value={groupId} />
          <input type="hidden" name="player" value={JSON.stringify(player)} />
          <div className="flex gap-2 text-xs">
            {(['find', 'new'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={`${btn} ${mode === m ? 'bg-white text-black' : ''}`}>{m === 'find' ? 'Find a player' : 'New player'}</button>
            ))}
          </div>
          {mode === 'find' ? (
            <FindPlayer found={found} index={0} onPick={setFound} taken={[]} label="New player — search by name" />
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {([['playerFirstName', 'Player first name'], ['playerLastName', 'Player last name'], ['parentFirstName', 'Parent first name'], ['parentLastName', 'Parent last name'], ['email', 'Parent email'], ['mobile', 'Parent mobile']] as const).map(([k, label]) => (
                <label key={k} className="block text-sm">
                  {label}
                  <input value={fresh[k]} onChange={(e) => setFresh((f) => ({ ...f, [k]: e.target.value }))} type={k === 'email' ? 'email' : k === 'mobile' ? 'tel' : 'text'} aria-label={`New player — ${label}`} className={field} />
                </label>
              ))}
            </div>
          )}
          <button name="do" value="add" disabled={pending} className="mt-4 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-black disabled:opacity-50">{pending ? 'Sending…' : 'Send them a link'}</button>
        </form>
      )}
      <Result state={state} />
    </section>
  )
}
