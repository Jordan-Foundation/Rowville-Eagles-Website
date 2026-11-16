import { redirect } from 'next/navigation'

/** The money summary now lives in Finance → Income (old links and bookmarks still work). */
export default async function MoneyMoved({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString()
  redirect(`/management/finance/income${qs ? `?${qs}` : ''}`)
}
