import * as migration_20261105_081406_initial from './20261105_081406_initial';
import * as migration_20261105_091033_about_page_and_team_dribl_links from './20261105_091033_about_page_and_team_dribl_links';
import * as migration_20261105_095659_trials_memberships_accounts from './20261105_095659_trials_memberships_accounts';
import * as migration_20261105_104026_sponsor_logos from './20261105_104026_sponsor_logos';
import * as migration_20261105_110000_sponsor_logo_backfill from './20261105_110000_sponsor_logo_backfill';
import * as migration_20261105_122821_admin_created_records from './20261105_122821_admin_created_records';
import * as migration_20261106_110441_consent_invites_message_log from './20261106_110441_consent_invites_message_log';
import * as migration_20261106_115745_academy_terms_coaches_availability from './20261106_115745_academy_terms_coaches_availability';

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
    name: '20261106_115745_academy_terms_coaches_availability'
  },
];
