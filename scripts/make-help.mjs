import { readFileSync } from 'node:fs';

const makefile = readFileSync(new URL('./Makefile', import.meta.url), 'utf8');
const commands = [];
for (const line of makefile.split(/\r?\n/)) {
  const match = line.match(/^([a-zA-Z0-9_-]+):.*##\s*(.+)$/);
  if (match) commands.push([match[1], match[2]]);
}
for (const [command, description] of commands.sort(([a], [b]) => a.localeCompare(b))) {
  process.stdout.write(`  ${command.padEnd(18)} ${description}\n`);
}
