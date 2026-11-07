import type { Payload } from 'payload'
import { purgeOldInvites } from './invites'
import { sendAvailabilityReminders } from '../academy/reminders'
import { sendAccountReminders } from './account-reminders'
import { sendReviewRequests } from '../academy/review-requests'
import { runSelectionReminders } from '../selections/payment'
import { syncTeamMembers } from '../teams/service'
import { purgeSubmissionVideos } from '../academy/pdr/review'
import { purgeThrottle } from './form-guard'
import { graceSweep } from '../academy/pdr/billing/sync'

type Job = (payload: Payload) => Promise<Record<string, unknown>>

/**
 * Scheduled jobs, grouped by how often Vercel Cron calls them (see vercel.json).
 * Each job must be safe to run twice — logs/flags prevent duplicate emails.
 */
export const cronJobs: Record<string, Record<string, Job>> = {
  daily: {
    purgeOldInvites,
    availabilityReminders: (payload) => sendAvailabilityReminders(payload),
    accountReminders: (payload) => sendAccountReminders(payload),
    reviewRequests: (payload) => sendReviewRequests(payload),
    selectionPaymentReminders: (payload) => runSelectionReminders(payload),
    teamMembers: (payload) => syncTeamMembers(payload),
    foundationVideos: (payload) => purgeSubmissionVideos(payload),
    formThrottle: (payload) => purgeThrottle(payload),
    foundationGrace: (payload) => graceSweep(payload),
  },
}
