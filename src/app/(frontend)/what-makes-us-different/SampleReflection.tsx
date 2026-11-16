/** A made-up example of a player's match reflection, as it looks in the player portal. */
const GREAT = [
  ['Passing', 'I scanned before I got the ball and played it forward first time'],
  ['Physical', 'Kept running hard right to the end of the second half'],
  ['Control', 'Good first touch on the wing with a defender close'],
]
const IMPROVE = [
  ['Dribbling', 'Lost the ball dribbling into two players — pass earlier'],
  ['Skills', 'Shoot earlier with my left foot'],
  ['Physical', 'Get back quicker after we lose the ball'],
]

export function SampleReflection() {
  const tag = 'mr-2 inline-block rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink'
  return (
    <figure className="mx-auto w-full max-w-md" aria-label="Example match reflection (made-up player)">
      <div className="rounded-[2rem] border border-line bg-surface p-6 shadow-xl shadow-black/10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Match reflection</p>
        <p className="mt-1 font-[family-name:var(--font-barlow)] text-2xl font-extrabold uppercase leading-tight">U10 Eagles vs Knox City</p>
        <p className="mt-1 text-sm text-muted">Saturday · How did it feel? <span aria-label="Good">🙂</span> Good</p>
        <div className="mt-5">
          <p className="text-sm font-bold">✅ Did well</p>
          <ul className="mt-2 space-y-2 text-sm">{GREAT.map(([p, t]) => <li key={t}><span className={tag}>{p}</span>{t}</li>)}</ul>
        </div>
        <div className="mt-5">
          <p className="text-sm font-bold">↗ To work on</p>
          <ul className="mt-2 space-y-2 text-sm">{IMPROVE.map(([p, t]) => <li key={t}><span className={tag}>{p}</span>{t}</li>)}</ul>
        </div>
        <p className="mt-5 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-ink">🎯 Focus for next game: check my shoulder before every pass</p>
        <p className="mt-3 rounded-xl border border-line px-4 py-3 text-sm">💬 <strong>Coach:</strong> Loved your scanning on Saturday — keep it up!</p>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted">Example reflection — made-up player</figcaption>
    </figure>
  )
}
