/** Admin list column: show money as $1,234.50 instead of a bare number. */
export function MoneyCell({ cellData }: { cellData?: unknown }) {
  if (typeof cellData !== 'number') return <span>—</span>
  return <span>{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cellData)}</span>
}
