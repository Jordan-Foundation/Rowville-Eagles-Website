import * as migration_20261105_081406_initial from './20261105_081406_initial';
import * as migration_20261105_091033_about_page_and_team_dribl_links from './20261105_091033_about_page_and_team_dribl_links';

export const migrations = [
  {
    up: migration_20261105_081406_initial.up,
    down: migration_20261105_081406_initial.down,
    name: '20261105_081406_initial',
  },
  {
    up: migration_20261105_091033_about_page_and_team_dribl_links.up,
    down: migration_20261105_091033_about_page_and_team_dribl_links.down,
    name: '20261105_091033_about_page_and_team_dribl_links'
  },
];
