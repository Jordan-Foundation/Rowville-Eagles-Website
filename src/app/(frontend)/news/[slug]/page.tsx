import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { payload, formatDate } from '@/lib/payload'

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { docs } = await (await payload()).find({ collection: 'posts', where: { slug: { equals: slug }, status: { equals: 'published' } }, limit: 1 })
  const post = docs[0]
  if (!post) notFound()
  return (
    <article className="container-x max-w-3xl py-16">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand">{post.category} · {formatDate(post.publishedAt)}</p>
      <h1 className="mt-3 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase leading-none">{post.title}</h1>
      <p className="mt-6 text-xl text-muted">{post.excerpt}</p>
      <div className="mt-10 [&_p]:mb-5 [&_p]:text-lg [&_p]:leading-relaxed">{post.content && <RichText data={post.content} />}</div>
    </article>
  )
}
