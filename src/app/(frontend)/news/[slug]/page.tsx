import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import { cache } from 'react'
import { payload, formatDate } from '@/lib/payload'
import { describe, jsonLd, mediaUrl, siteBase } from '@/lib/seo'

export const revalidate = 3600
export const generateStaticParams = () => [] as { slug: string }[]

const getPost = cache(async (slug: string) => {
  const { docs } = await (await payload()).find({ pagination: false, collection: 'posts', where: { slug: { equals: slug }, status: { equals: 'published' } }, limit: 1, depth: 1 })
  return docs[0] ?? null
})

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = await getPost((await params).slug)
  if (!post) return { title: 'News' }
  const image = mediaUrl(post.heroImage)
  return {
    title: post.title,
    description: describe(post.excerpt),
    alternates: { canonical: `/news/${post.slug}` },
    openGraph: { type: 'article', title: post.title, description: describe(post.excerpt), publishedTime: post.publishedAt ?? undefined, ...(image ? { images: [image] } : {}) },
  }
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()
  return (
    <article className="container-x max-w-3xl py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ '@context': 'https://schema.org', '@type': 'NewsArticle', headline: post.title, description: post.excerpt, datePublished: post.publishedAt, image: mediaUrl(post.heroImage), url: `${siteBase()}/news/${post.slug}`, publisher: { '@id': `${siteBase()}/#club` } }) }} />
      <p className="text-xs font-semibold uppercase tracking-wider text-brand">{post.category} · {formatDate(post.publishedAt)}</p>
      <h1 className="mt-3 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase leading-none">{post.title}</h1>
      <p className="mt-6 text-xl text-muted">{post.excerpt}</p>
      <div className="mt-10 [&_p]:mb-5 [&_p]:text-lg [&_p]:leading-relaxed">{post.content && <RichText data={post.content} />}</div>
    </article>
  )
}
