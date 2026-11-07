import * as migration_20261105_081406_initial from './20261105_081406_initial';
import * as migration_20261105_091033_about_page_and_team_dribl_links from './20261105_091033_about_page_and_team_dribl_links';
import * as migration_20261105_095659_trials_memberships_accounts from './20261105_095659_trials_memberships_accounts';
import * as migration_20261105_104026_sponsor_logos from './20261105_104026_sponsor_logos';
import * as migration_20261105_110000_sponsor_logo_backfill from './20261105_110000_sponsor_logo_backfill';
import * as migration_20261105_122821_admin_created_records from './20261105_122821_admin_created_records';
import * as migration_20261106_110441_consent_invites_message_log from './20261106_110441_consent_invites_message_log';
import * as migration_20261106_115745_academy_terms_coaches_availability from './20261106_115745_academy_terms_coaches_availability';
import * as migration_20261106_121446_remove_term_sessions_skip_dates from './20261106_121446_remove_term_sessions_skip_dates';
import * as migration_20261106_121459_weekend_times_away_periods from './20261106_121459_weekend_times_away_periods';
import * as migration_20261106_122301_academy_reminder_log from './20261106_122301_academy_reminder_log';
import * as migration_20261106_123856_academy_bookings_sessions from './20261106_123856_academy_bookings_sessions';
import * as migration_20261106_133721_academy_weekly_payments from './20261106_133721_academy_weekly_payments';
import * as migration_20261106_140019_academy_weekly_schedule from './20261106_140019_academy_weekly_schedule';
import * as migration_20261106_141649_account_reminder from './20261106_141649_account_reminder';
import * as migration_20261106_145310_player_profile_coach_sessions from './20261106_145310_player_profile_coach_sessions';
import * as migration_20261106_202041_academy_cancellations_credits from './20261106_202041_academy_cancellations_credits';
import * as migration_20261106_211833_stage14_session_credits_member_price from './20261106_211833_stage14_session_credits_member_price';
import * as migration_20261107_004109_booking_reschedule from './20261107_004109_booking_reschedule';
import * as migration_20261107_013526_birth_year_age_groups from './20261107_013526_birth_year_age_groups';
import * as migration_20261107_015825_selection_rounds_entries from './20261107_015825_selection_rounds_entries';
import * as migration_20261107_021548_squads_outcomes from './20261107_021548_squads_outcomes';
import * as migration_20261107_023646_selection_payments from './20261107_023646_selection_payments';
import * as migration_20261107_025525_team_pages from './20261107_025525_team_pages';
import * as migration_20261107_032141_twilio_sms_voice from './20261107_032141_twilio_sms_voice';
import * as migration_20261107_042144_academy_term_slots from './20261107_042144_academy_term_slots';
import * as migration_20261107_043914_program_price_per_session from './20261107_043914_program_price_per_session';
import * as migration_20261107_065357_pdr_content from './20261107_065357_pdr_content';
import * as migration_20261107_070958_foundation_plus_progress from './20261107_070958_foundation_plus_progress';
import * as migration_20261107_072405_foundation_plus_submissions from './20261107_072405_foundation_plus_submissions';
import * as migration_20261107_074307_foundation_plus_awards_setup from './20261107_074307_foundation_plus_awards_setup';
import * as migration_20261107_090239_two_nights_a_week from './20261107_090239_two_nights_a_week';
import * as migration_20261107_094545_difference_page from './20261107_094545_difference_page';
import * as migration_20261107_113740_foundation_plus_waitlist from './20261107_113740_foundation_plus_waitlist';
import * as migration_20261107_115147_trial_places_per_night from './20261107_115147_trial_places_per_night';
import * as migration_20261107_120146_foundation_plus_billing from './20261107_120146_foundation_plus_billing';
import * as migration_20261107_121722_foundation_plus_trial from './20261107_121722_foundation_plus_trial';
import * as migration_20261107_205754_shop_item_access from './20261107_205754_shop_item_access';

export const migrations = [
  {
    up: migration_20261105_081406_initial.up,
    down: migration_20261105_081406_initial.down,
    name: '20261105_081406_initial',
  },
  {
    up: migration_20261105_091033_about_page_and_team_dribl_links.up,
    down: migration_20261105_091033_about_page_and_team_dribl_links.down,
    name: '20261105_091033_about_page_and_team_dribl_links',
  },
  {
    up: migration_20261105_095659_trials_memberships_accounts.up,
    down: migration_20261105_095659_trials_memberships_accounts.down,
    name: '20261105_095659_trials_memberships_accounts',
  },
  {
    up: migration_20261105_104026_sponsor_logos.up,
    down: migration_20261105_104026_sponsor_logos.down,
    name: '20261105_104026_sponsor_logos',
  },
  {
    up: migration_20261105_110000_sponsor_logo_backfill.up,
    down: migration_20261105_110000_sponsor_logo_backfill.down,
    name: '20261105_110000_sponsor_logo_backfill',
  },
  {
    up: migration_20261105_122821_admin_created_records.up,
    down: migration_20261105_122821_admin_created_records.down,
    name: '20261105_122821_admin_created_records',
  },
  {
    up: migration_20261106_110441_consent_invites_message_log.up,
    down: migration_20261106_110441_consent_invites_message_log.down,
    name: '20261106_110441_consent_invites_message_log',
  },
  {
    up: migration_20261106_115745_academy_terms_coaches_availability.up,
    down: migration_20261106_115745_academy_terms_coaches_availability.down,
    name: '20261106_115745_academy_terms_coaches_availability',
  },
  {
    up: migration_20261106_121446_remove_term_sessions_skip_dates.up,
    down: migration_20261106_121446_remove_term_sessions_skip_dates.down,
    name: '20261106_121446_remove_term_sessions_skip_dates',
  },
  {
    up: migration_20261106_121459_weekend_times_away_periods.up,
    down: migration_20261106_121459_weekend_times_away_periods.down,
    name: '20261106_121459_weekend_times_away_periods',
  },
  {
    up: migration_20261106_122301_academy_reminder_log.up,
    down: migration_20261106_122301_academy_reminder_log.down,
    name: '20261106_122301_academy_reminder_log',
  },
  {
    up: migration_20261106_123856_academy_bookings_sessions.up,
    down: migration_20261106_123856_academy_bookings_sessions.down,
    name: '20261106_123856_academy_bookings_sessions',
  },
  {
    up: migration_20261106_133721_academy_weekly_payments.up,
    down: migration_20261106_133721_academy_weekly_payments.down,
    name: '20261106_133721_academy_weekly_payments',
  },
  {
    up: migration_20261106_140019_academy_weekly_schedule.up,
    down: migration_20261106_140019_academy_weekly_schedule.down,
    name: '20261106_140019_academy_weekly_schedule',
  },
  {
    up: migration_20261106_141649_account_reminder.up,
    down: migration_20261106_141649_account_reminder.down,
    name: '20261106_141649_account_reminder',
  },
  {
    up: migration_20261106_145310_player_profile_coach_sessions.up,
    down: migration_20261106_145310_player_profile_coach_sessions.down,
    name: '20261106_145310_player_profile_coach_sessions',
  },
  {
    up: migration_20261106_202041_academy_cancellations_credits.up,
    down: migration_20261106_202041_academy_cancellations_credits.down,
    name: '20261106_202041_academy_cancellations_credits',
  },
  {
    up: migration_20261106_211833_stage14_session_credits_member_price.up,
    down: migration_20261106_211833_stage14_session_credits_member_price.down,
    name: '20261106_211833_stage14_session_credits_member_price',
  },
  {
    up: migration_20261107_004109_booking_reschedule.up,
    down: migration_20261107_004109_booking_reschedule.down,
    name: '20261107_004109_booking_reschedule',
  },
  {
    up: migration_20261107_013526_birth_year_age_groups.up,
    down: migration_20261107_013526_birth_year_age_groups.down,
    name: '20261107_013526_birth_year_age_groups',
  },
  {
    up: migration_20261107_015825_selection_rounds_entries.up,
    down: migration_20261107_015825_selection_rounds_entries.down,
    name: '20261107_015825_selection_rounds_entries',
  },
  {
    up: migration_20261107_021548_squads_outcomes.up,
    down: migration_20261107_021548_squads_outcomes.down,
    name: '20261107_021548_squads_outcomes',
  },
  {
    up: migration_20261107_023646_selection_payments.up,
    down: migration_20261107_023646_selection_payments.down,
    name: '20261107_023646_selection_payments',
  },
  {
    up: migration_20261107_025525_team_pages.up,
    down: migration_20261107_025525_team_pages.down,
    name: '20261107_025525_team_pages',
  },
  {
    up: migration_20261107_032141_twilio_sms_voice.up,
    down: migration_20261107_032141_twilio_sms_voice.down,
    name: '20261107_032141_twilio_sms_voice',
  },
  {
    up: migration_20261107_042144_academy_term_slots.up,
    down: migration_20261107_042144_academy_term_slots.down,
    name: '20261107_042144_academy_term_slots',
  },
  {
    up: migration_20261107_043914_program_price_per_session.up,
    down: migration_20261107_043914_program_price_per_session.down,
    name: '20261107_043914_program_price_per_session',
  },
  {
    up: migration_20261107_065357_pdr_content.up,
    down: migration_20261107_065357_pdr_content.down,
    name: '20261107_065357_pdr_content',
  },
  {
    up: migration_20261107_070958_foundation_plus_progress.up,
    down: migration_20261107_070958_foundation_plus_progress.down,
    name: '20261107_070958_foundation_plus_progress',
  },
  {
    up: migration_20261107_072405_foundation_plus_submissions.up,
    down: migration_20261107_072405_foundation_plus_submissions.down,
    name: '20261107_072405_foundation_plus_submissions',
  },
  {
    up: migration_20261107_074307_foundation_plus_awards_setup.up,
    down: migration_20261107_074307_foundation_plus_awards_setup.down,
    name: '20261107_074307_foundation_plus_awards_setup',
  },
  {
    up: migration_20261107_090239_two_nights_a_week.up,
    down: migration_20261107_090239_two_nights_a_week.down,
    name: '20261107_090239_two_nights_a_week',
  },
  {
    up: migration_20261107_094545_difference_page.up,
    down: migration_20261107_094545_difference_page.down,
    name: '20261107_094545_difference_page',
  },
  {
    up: migration_20261107_113740_foundation_plus_waitlist.up,
    down: migration_20261107_113740_foundation_plus_waitlist.down,
    name: '20261107_113740_foundation_plus_waitlist',
  },
  {
    up: migration_20261107_115147_trial_places_per_night.up,
    down: migration_20261107_115147_trial_places_per_night.down,
    name: '20261107_115147_trial_places_per_night',
  },
  {
    up: migration_20261107_120146_foundation_plus_billing.up,
    down: migration_20261107_120146_foundation_plus_billing.down,
    name: '20261107_120146_foundation_plus_billing',
  },
  {
    up: migration_20261107_121722_foundation_plus_trial.up,
    down: migration_20261107_121722_foundation_plus_trial.down,
    name: '20261107_121722_foundation_plus_trial',
  },
  {
    up: migration_20261107_205754_shop_item_access.up,
    down: migration_20261107_205754_shop_item_access.down,
    name: '20261107_205754_shop_item_access'
  },
];
