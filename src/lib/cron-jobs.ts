import type { Payload } from 'payload'
import { purgeOldInvites } from './invites'

type Job = (payload: Payload) => Promise<Record<string, unknown>>

/**
 * Scheduled jobs, grouped by how often Vercel Cron calls them (see vercel.json).
 * Each job must be safe to run twice — logs/flags prevent duplicate emails.
 */
export const cronJobs: Record<string, Record<string, Job>> = {
  daily: {
    purgeOldInvites,
  },
}
