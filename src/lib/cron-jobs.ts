import { sweepCampCoaches } from '../camps/staffing'
import { sweepInvoiceReminders } from '../invoices/service'
import { yearlyReminder } from '../academy/yearly-setup'
import { openDuePrograms } from '../academy/release-service'
import { runAnnouncements } from '../academy/announcements'
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
    campCoaches: (payload) => sweepCampCoaches(payload),
    openAcademyPrograms: (payload) => openDuePrograms(payload),
    announcements: (payload) => runAnnouncements(payload),
    invoiceReminders: (payload) => sweepInvoiceReminders(payload),
    yearlySetup: (payload) => yearlyReminder(payload),
    teamMembers: (payload) => syncTeamMembers(payload),
    selectionPaymentReminders: (payload) => runSelectionReminders(payload),
    availabilityReminders: (payload) => sendAvailabilityReminders(payload),
    reportReminders: (payload) => sendReportReminders(payload),
    weeklySummary: (payload) => sendWeeklySummary(payload),
    trialReminders: async (payload) => (await import('./trials')).sendTrialReminders(payload),
    numberReminders: async (payload) => (await import('../numbers/service')).sendNumberReminders(payload),
    accountReminders: (payload) => sendAccountReminders(payload),
    portalLaunchReminders: async (payload) => (await import('../launch/service')).sendLaunchReminders(payload, (globalThis as { __cronNow?: Date }).__cronNow ?? new Date()),
    appReminders: async (payload) => (await import('./app-install')).sendAppReminders(payload, (globalThis as { __cronNow?: Date }).__cronNow ?? new Date()),
    foundationTrialReminders: (payload) => trialReminders(payload),
    foundationChallengeStart: (payload) => announceChallenges(payload),
    foundationChallengeResults: (payload) => finaliseChallenges(payload),
  },
  // Every 5 minutes: time-critical reminders (RFA trials: 1 day, 3 hours and 15 minutes before)
  frequent: {
    rfaTrialReminders: async (payload) => (await import('../academy/trial-list')).sendTrialReminders(payload, (globalThis as { __cronNow?: Date }).__cronNow ?? new Date()),
  },
  // Every hour (Vercel Pro): bulk messages and time-sensitive sweeps, each with its own time limit and able to carry on next run
  messages: {
    sessionLengths: async (payload) => { const r = await (await import('../academy/session-lengths')).applySessionLengths(payload, (globalThis as { __cronNow?: Date }).__cronNow ?? new Date()); return { changed: r.changed.length, skipped: r.skipped.length, trialNights: r.trialNights } },
    portalLaunch: async (payload) => (await import('../launch/service')).launchJob(payload, (globalThis as { __cronNow?: Date }).__cronNow ?? new Date()),
    sessionReminderPushes: async (payload) => (await import('./app-install')).sendSessionReminderPushes(payload, (globalThis as { __cronNow?: Date }).__cronNow ?? new Date()),
    scheduledPromotions: (payload) => runScheduledPromotions(payload),
    reportNotifications: (payload) => notifyReleasedJob(payload),
    foundationLaunchEmails: (payload) => sendLaunchEmails(payload, 100, { deadline: Date.now() + 60_000 }),
    reviewRequests: (payload) => sendReviewRequests(payload),
    smallGroupDeadlines: (payload) => sweepGroups(payload),
    campCoaches: (payload) => sweepCampCoaches(payload),
    openAcademyPrograms: (payload) => openDuePrograms(payload),
    announcements: (payload) => runAnnouncements(payload),
    referrals: async (payload) => (await import('../referrals/service')).runReferralConfirmations(payload),
    sessionSummaries: async (payload) => (await import('../academy/summaries/service')).nudgeCoaches(payload, (globalThis as { __cronNow?: Date }).__cronNow ?? new Date()),
    financeGmail: async (payload) => (await import('../finance/gmail')).importGmailReceipts(payload),
    financeReport: async (payload) => (await import('../finance/report')).runWeeklyFinanceReport(payload),
    staffAlerts: async (payload) => (await import('../staff-feed/service')).runStaffAlerts(payload),
    reflectionReminders: async (payload) => (await import('../reflections/service')).sendReflectionReminders(payload),
    reflectionWelfare: async (payload) => (await import('../reflections/welfare')).retryWelfareChecks(payload),
    reflectionReports: async (payload) => (await import('../reflections/reports')).runWeeklyReports(payload),
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
