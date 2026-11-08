import { PlayerReportView, type ReportRow } from '@/components/reports/PlayerReportView'

const ROWS: ReportRow[] = [
  { strand: 'Attacking', rating: 'above', comment: 'Great at getting into space — keep working on finishing with the weaker foot.' },
  { strand: 'Defending', rating: 'at', comment: 'Closes down quickly; next step is staying on her feet when tackling.' },
  { strand: 'Physical', rating: 'above', comment: 'Excellent agility and balance through the ladder work.' },
  { strand: 'Passing & Receiving', rating: 'well_above', comment: 'Receives on the half-turn really well — a standout this term.' },
  { strand: 'Tactical', rating: 'at', comment: 'Starting to scan before receiving; keep building this habit.' },
  { strand: 'Character', rating: 'well_above', comment: 'A brilliant teammate — always encouraging others.' },
]

/** A sample report with made-up data (no real player). */
export function SampleReport() {
  return <PlayerReportView eyebrow="Player report · Term 2" title="Sample Player · 2016s" badge="Sample — not a real player" rows={ROWS} showStandards={false} />
}
