import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { payload, formatDate } from '@/lib/payload'
import { POLICIES } from '@/lib/policies'
import { clubBrand, telHref } from '@/academy/brand'

export const revalidate = 300

const find = (slug: string) => POLICIES.find((p) => p.slug === slug)

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = find((await params).slug)
  return p ? { title: p.title, description: `${p.title} — Rowville Eagles FC and Foundation Academy.` } : {}
}

export function generateStaticParams() {
  return POLICIES.map((p) => ({ slug: p.slug }))
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const policy = find((await params).slug)
  if (!policy) notFound()
  const g = (await (await payload()).findGlobal({ slug: 'policies', depth: 0 })) as unknown as Record<string, string | null | undefined>
  const link = g[`${policy.key}Link`]?.trim()
  if (link && /^https?:\/\//.test(link)) redirect(link)
  const text = g[`${policy.key}Text`]?.trim()
  const updated = g[`${policy.key}Updated`]
  const blocks = (text ?? '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  return (
    <div className="container-x max-w-3xl py-14">
      <p className="eyebrow !text-brand">Policies</p>
      <h1 className="mt-2 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">{policy.title}</h1>
      {updated && <p className="mt-2 text-sm text-muted">Last updated {formatDate(updated, { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
      {blocks.length ? (
        <div className="mt-8 space-y-4 leading-relaxed">
          {blocks.map((b, i) => (b.startsWith('## ') ? <h2 key={i} className="pt-4 text-xl font-bold">{b.slice(3)}</h2> : <p key={i} className="whitespace-pre-line">{b}</p>))}
        </div>
      ) : (
        <p className="mt-8 rounded-2xl border border-line p-6">
          For a copy of our {policy.title.toLowerCase()}, call <a href={telHref(clubBrand.phone)} className="underline">{clubBrand.phone}</a> or email{' '}
          <a href={`mailto:${clubBrand.email}`} className="underline">{clubBrand.email}</a>.
        </p>
      )}
      <nav aria-label="Other policies" className="mt-12 flex flex-wrap gap-2 text-sm">
        {POLICIES.filter((p) => p.key !== policy.key).map((p) => <Link key={p.slug} href={`/policies/${p.slug}`} className="rounded-full border border-line px-3 py-1 hover:border-ink">{p.title}</Link>)}
      </nav>
    </div>
  )
}
