import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { payload, formatDate } from '@/lib/payload'

export const revalidate = 3600
export const metadata: Metadata = { title: 'News', description: 'Club news, match reports, tournament results and announcements from Rowville Eagles FC and the Foundation Academy.' }

export default async function NewsPage() {
  const { docs } = await (await payload()).find({ pagination: false, collection: 'posts', where: { status: { equals: 'published' } }, depth: 1, limit: 30 })
  return (
    <div className="container-x py-16">
      <h1 className="font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase sm:text-6xl">Club News</h1>
      <div className="mt-10 divide-y divide-line border-y border-line">
        {docs.map((post) => (
          <Link key={post.id} href={`/news/${post.slug}`} className="group flex items-start gap-5 py-7">
            <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">{post.category} · {formatDate(post.publishedAt)}</p>
            <h2 className="mt-2 text-2xl font-semibold group-hover:text-brand">{post.title}</h2>
            <p className="mt-2 max-w-3xl text-muted">{post.excerpt}</p>
            </div>
            {typeof post.heroImage === 'object' && post.heroImage?.url && (
              <Image src={post.heroImage.url} alt="" width={240} height={160} sizes="(min-width: 640px) 12rem, 6rem" className="aspect-[3/2] w-24 shrink-0 rounded-xl object-cover sm:w-48" />
            )}
          </Link>
        ))}
      </div>
      {docs.length === 0 && <p className="mt-8 text-muted">No news yet.</p>}
    </div>
  )
}
