import * as migration_20261105_081406_initial from './20261105_081406_initial';

export const migrations = [
  {
    up: migration_20261105_081406_initial.up,
    down: migration_20261105_081406_initial.down,
    name: '20261105_081406_initial'
  },
];
