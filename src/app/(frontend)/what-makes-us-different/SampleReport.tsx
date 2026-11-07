const SCALE = ['Well below', 'Below', 'At', 'Above', 'Well above'] as const
const ROWS: [string, number, string][] = [
  ['Attacking', 3, 'Great at getting into space — keep working on finishing with the weaker foot.'],
  ['Defending', 2, 'Closes down quickly; next step is staying on her feet when tackling.'],
  ['Physical', 3, 'Excellent agility and balance through the ladder work.'],
  ['Passing & Receiving', 4, 'Receives on the half-turn really well — a standout this term.'],
  ['Tactical', 2, 'Starting to scan before receiving; keep building this habit.'],
  ['Character', 4, 'A brilliant teammate — always encouraging others.'],
]

/** A sample report with made-up data (no real player). */
export function SampleReport() {
  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-surface shadow-xl" aria-label="Sample player report with made-up data">
      <div className="flex flex-wrap items-baseline justify-between gap-2 bg-[#0f2a55] px-5 py-4 text-white">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/70">Player report · Term 2</p>
          <p className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Sample Player · 2016s</p>
        </div>
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs">Sample — not a real player</span>
      </div>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Achievement in each strand, on a five-point scale from Well below to Well above</caption>
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            <th scope="col" className="px-4 py-2 font-medium">Strand</th>
            {SCALE.map((s) => <th key={s} scope="col" className="hidden px-1 py-2 text-center font-medium sm:table-cell">{s}</th>)}
            <th scope="col" className="px-4 py-2 font-medium sm:hidden">Rating</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {ROWS.map(([strand, level, comment]) => (
            <tr key={strand} className="align-top">
              <th scope="row" className="px-4 py-3 font-semibold">{strand}<p className="mt-1 text-xs font-normal text-muted">{comment}</p></th>
              {SCALE.map((s, i) => (
                <td key={s} className="hidden px-1 py-3 text-center sm:table-cell">
                  {i === level ? <span aria-label={s} className="inline-block h-4 w-4 rounded-full bg-brand" /> : <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-line" />}
                </td>
              ))}
              <td className="px-4 py-3 text-xs font-semibold sm:hidden">{SCALE[level]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
