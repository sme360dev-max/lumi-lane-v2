import { existsSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const website = path.join(root, 'website');
const envLocal = path.join(website, '.env.local');

if (!existsSync(envLocal)) {
  copyFileSync(path.join(website, '.env.example'), envLocal);
  console.log('Created website/.env.local from .env.example.');
}

const run = (args) => {
  const result = spawnSync('npm', args, {
    cwd: website,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

if (!existsSync(path.join(website, 'node_modules'))) {
  run(['ci']);
}
run(['run', 'dev']);
