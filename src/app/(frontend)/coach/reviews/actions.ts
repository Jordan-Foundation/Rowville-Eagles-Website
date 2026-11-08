'use server'

import { redirect } from 'next/navigation'
import { reviewerOrNull } from '@/academy/portal'
import { payload } from '@/lib/payload'
import { reviewSubmission, type Decision } from '@/academy/pdr/review'

export type ReviewState = { error?: string }

export async function reviewAction(_prev: ReviewState, fd: FormData): Promise<ReviewState> {
  const reviewer = await reviewerOrNull()
  if (!reviewer) return { error: 'Please log in as a coach.' }
  const raw = String(fd.get('score') ?? '').trim()
  const score = raw === '' ? null : Number(raw)
  if (score !== null && !Number.isFinite(score)) return { error: 'The score must be a number.' }
  try {
    await reviewSubmission(await payload(), reviewer, Number(fd.get('id')), { decision: String(fd.get('decision')) as Decision, score, feedback: String(fd.get('feedback') ?? '').trim().slice(0, 2000) })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save the review.' }
  }
  redirect('/coach/reviews?done=1')
}
