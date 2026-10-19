import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const [action, path] = process.argv.slice(2);
const cli = './node_modules/wrangler/bin/wrangler.js';
const base = ['--local', '--config', 'wrangler.local.json', '--persist-to', '.wrangler/state'];
let args;
if (action === 'migrate') args = ['d1', 'migrations', 'apply', 'DB', ...base];
else if (action === 'export' && path) {
  if (existsSync(path)) throw Error('Destination already exists; refusing overwrite.');
  args = ['d1', 'export', 'DB', '--local', '--config', 'wrangler.local.json', '--output', resolve(path)];
} else if (action === 'restore' && path && existsSync(path)) {
  // Generated recovery SQL checks that all application tables are empty.
  args = ['d1', 'execute', 'DB', ...base, '--file', resolve(path)];
} else throw Error('Usage: db-local.mjs migrate | export NEW_PATH | restore RECOVERY_SQL');
const result = spawnSync(process.execPath, ['--import', './scripts/sites-env.mjs', cli, ...args], {stdio:'inherit'});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
