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
import { sendLaunchEmails, trialReminders } from '../academy/pdr/billing/trial'
import { announceChallenges, finaliseChallenges } from '../academy/pdr/challenges'
import { sendReportReminders } from '../academy/reports/service'
import { notifyReleasedJob } from '../academy/reports/review'
import { runScheduledPromotions } from '../promotions/send'
import { sendWeeklySummary } from './weekly-summary'
import { sweepGroups } from '../academy/group-decisions'

type Job = (payload: Payload) => Promise<Record<string, unknown>>

/**
 * Scheduled jobs, grouped by how often Vercel Cron calls them (see vercel.json).
 * Each job must be safe to run twice — logs/flags prevent duplicate emails.
 */
export const cronJobs: Record<string, Record<string, Job>> = {
  // ~6am Melbourne: quick, important jobs first (payments, access, reminders)
  daily: {
    foundationGrace: (payload) => graceSweep(payload),
    smallGroupDeadlines: (payload) => sweepGroups(payload),
    teamMembers: (payload) => syncTeamMembers(payload),
    selectionPaymentReminders: (payload) => runSelectionReminders(payload),
    availabilityReminders: (payload) => sendAvailabilityReminders(payload),
    reportReminders: (payload) => sendReportReminders(payload),
    weeklySummary: (payload) => sendWeeklySummary(payload),
    accountReminders: (payload) => sendAccountReminders(payload),
    foundationTrialReminders: (payload) => trialReminders(payload),
    foundationChallengeStart: (payload) => announceChallenges(payload),
    foundationChallengeResults: (payload) => finaliseChallenges(payload),
  },
  // ~8am Melbourne: bulk messages, each with its own time limit and able to carry on the next day
  messages: {
    scheduledPromotions: (payload) => runScheduledPromotions(payload),
    reportNotifications: (payload) => notifyReleasedJob(payload),
    foundationLaunchEmails: (payload) => sendLaunchEmails(payload, 100, { deadline: Date.now() + 60_000 }),
    reviewRequests: (payload) => sendReviewRequests(payload),
    smallGroupDeadlines: (payload) => sweepGroups(payload),
  },
  // ~3:30am Melbourne: housekeeping
  cleanup: {
    purgeOldInvites,
    foundationVideos: (payload) => purgeSubmissionVideos(payload),
    formThrottle: (payload) => purgeThrottle(payload),
    oldMessageLog: async (payload) => {
      // Email/SMS delivery log: keep 12 months (enough for any query or complaint)
      const r = await payload.delete({ collection: 'message-log', where: { createdAt: { less_than: new Date(Date.now() - 365 * 86_400_000).toISOString() } }, overrideAccess: true, depth: 0 })
      return { deleted: r.docs.length }
    },
  },
}
