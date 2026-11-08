'use client'

import { useActionState, useState } from 'react'
import { PROGRAM_GROUPS } from '@/promotions/rules'
import type { Pickables, PickItem } from '@/promotions/pickables'
import { savePromotionAction, type PromoState } from './actions'

export type PromoValues = {
  id?: number
  name: string
  status: string
  type: 'percent' | 'amount'
  value: string
  usesPerFamily: string
  startsAt: string
  endsAt: string
  everything: boolean
  programGroups: string[]
  programs: number[]
  oneOnOneAll: boolean
  oneOnOneTerms: number[]
  shopAll: boolean
  products: number[]
  tournamentsAll: boolean
  tournamentRounds: number[]
  foundationPlus: boolean
  emails: string
}

const input = 'mt-1 block w-full rounded-lg border border-line px-3 py-2'
const box = 'rounded-2xl border border-line p-4'

function Items({ name, items, picked, disabled }: { name: string; items: PickItem[]; picked: number[]; disabled: boolean }) {
  if (!items.length) return <p className="mt-2 text-sm text-muted">Nothing on sale right now.</p>
  return (
    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
      {items.map((i) => (
        <label key={i.id} className={`flex items-start gap-2 text-sm ${disabled ? 'opacity-50' : ''}`}>
          <input type="checkbox" name={name} value={i.id} defaultChecked={picked.includes(i.id)} disabled={disabled} className="mt-1" />
          <span>{i.label}{i.hint && <span className="block text-xs text-muted">{i.hint}</span>}</span>
        </label>
      ))}
    </div>
  )
}

export function PromotionForm({ v, pick }: { v: PromoValues; pick: Pickables }) {
  const [state, action, pending] = useActionState<PromoState, FormData>(savePromotionAction, {})
  const [all, setAll] = useState(v.everything)
  const [oneAll, setOneAll] = useState(v.oneOnOneAll)
  const [shopAll, setShopAll] = useState(v.shopAll)
  const [tourAll, setTourAll] = useState(v.tournamentsAll)
  const [groups, setGroups] = useState<string[]>(v.programGroups)
  const [type, setType] = useState(v.type)
  const btn = 'rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50'
  return (
    <form action={action} className="space-y-8">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <section className="grid gap-4 sm:grid-cols-[1fr_9rem_9rem]">
        <label className="text-sm font-semibold">Name families will see<input name="name" required defaultValue={v.name} placeholder="e.g. Winter special" className={input} /></label>
        <label className="text-sm font-semibold">Discount<select name="type" value={type} onChange={(e) => setType(e.target.value as 'percent' | 'amount')} className={input}><option value="percent">% off</option><option value="amount">$ off</option></select></label>
        <label className="text-sm font-semibold">{type === 'percent' ? 'Percent' : 'Dollars'}<input name="value" required inputMode="decimal" defaultValue={v.value} placeholder={type === 'percent' ? '20' : '15'} className={input} /></label>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold">Starts <span className="font-normal text-muted">(optional)</span><input name="startsAt" type="datetime-local" defaultValue={v.startsAt} className={input} /></label>
        <label className="text-sm font-semibold">Ends <span className="font-normal text-muted">(optional)</span><input name="endsAt" type="datetime-local" defaultValue={v.endsAt} className={input} /></label>
        <label className="text-sm font-semibold">Uses per family <span className="font-normal text-muted">(empty = no limit)</span><input name="usesPerFamily" type="number" min={1} max={100} defaultValue={v.usesPerFamily} className={input} /></label>
      </section>
      <p className="-mt-4 text-xs text-muted">{type === 'percent' ? 'Taken off each booking or order.' : 'Taken off each booking or order (never more than its price).'} Melbourne time. A family gets their single best promotion on each purchase.</p>

      <fieldset className="space-y-4">
        <legend className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">What it applies to</legend>
        <label className="flex items-start gap-3 rounded-2xl border-2 border-brand/40 p-4">
          <input type="checkbox" name="everything" checked={all} onChange={(e) => setAll(e.target.checked)} className="mt-1" />
          <span>
            <span className="font-semibold">Everything on the website</span>
            <span className="block text-sm text-muted">1-on-1s, camps, programs, Mini Ballers, terms, trials, registrations, tournament fees, shop and Foundation+</span>
          </span>
        </label>
        <div className={`grid gap-4 lg:grid-cols-2 ${all ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={all}>
          <div className={box}>
            <h3 className="font-semibold">1-on-1 sessions</h3>
            <label className="mt-2 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="oneOnOneAll" checked={oneAll} onChange={(e) => setOneAll(e.target.checked)} disabled={all} /> All 1-on-1s (casual, term and weekly)</label>
            <Items name="oneOnOneTerms" items={pick.terms} picked={v.oneOnOneTerms} disabled={all || oneAll} />
          </div>
          <div className={box}>
            <h3 className="font-semibold">Shop</h3>
            <label className="mt-2 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="shopAll" checked={shopAll} onChange={(e) => setShopAll(e.target.checked)} disabled={all} /> Everything in the shop</label>
            <Items name="products" items={pick.products} picked={v.products} disabled={all || shopAll} />
          </div>
          {pick.programsByGroup.map((g) => {
            const meta = PROGRAM_GROUPS.find((x) => x.value === g.group)
            const whole = groups.includes(g.group)
            return (
              <div key={g.group} className={box}>
                <h3 className="font-semibold">{g.label}</h3>
                {meta && (
                  <label className="mt-2 flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" name="programGroups" value={g.group} checked={whole} disabled={all} onChange={(e) => setGroups((cur) => (e.target.checked ? [...cur, g.group] : cur.filter((x) => x !== g.group)))} /> {meta.label} <span className="font-normal text-muted">(incl. future ones)</span>
                  </label>
                )}
                <Items name="programs" items={g.items} picked={v.programs} disabled={all || whole} />
              </div>
            )
          })}
          <div className={box}>
            <h3 className="font-semibold">Tournament fees</h3>
            <label className="mt-2 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="tournamentsAll" checked={tourAll} onChange={(e) => setTourAll(e.target.checked)} disabled={all} /> All tournament fees</label>
            <Items name="tournamentRounds" items={pick.rounds} picked={v.tournamentRounds} disabled={all || tourAll} />
          </div>
          <div className={box}>
            <h3 className="font-semibold">Foundation+</h3>
            <label className="mt-2 flex items-start gap-2 text-sm font-semibold"><input type="checkbox" name="foundationPlus" defaultChecked={v.foundationPlus} disabled={all} className="mt-1" /> <span>Foundation+ plans<span className="block text-xs font-normal text-muted">First payment only; not during the free trial; replaces the 2nd-player discount when bigger.</span></span></label>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Families</legend>
        <p className="mt-1 text-sm text-muted">Only these accounts get the discount. Paste their account emails (one per line). Choosing an audience and sending the email/text comes in the next step.</p>
        <textarea name="emails" rows={4} defaultValue={v.emails} placeholder={'parent@example.com\nanother@example.com'} className={input} aria-label="Family account emails" />
      </fieldset>

      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <div className="flex flex-wrap gap-3">
        <button name="intent" value={v.status === 'live' ? 'save' : 'draft'} disabled={pending} className={`${btn} border border-line`}>{pending ? 'Saving…' : v.status === 'live' ? 'Save changes' : 'Save draft'}</button>
        {v.status !== 'live' && <button name="intent" value="live" disabled={pending} className={`${btn} bg-emerald-600 text-white`}>Make live</button>}
        {v.status === 'live' && <button name="intent" value="end" disabled={pending} className={`${btn} bg-red-600 text-white`}>End now</button>}
      </div>
    </form>
  )
}
