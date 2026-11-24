// Post-build fix for Next.js 16 static export.
// The client router prefetches route segments as `about/__next.about.__PAGE__.txt`, but `next build`
// writes them as `about/__next.about/__PAGE__.txt`. On a plain static host those prefetches 404
// (navigation still works, but the console fills with errors). This copies every nested segment
// file to the flat, dot-joined name the router requests. Runs automatically after `npm run build`.
import { copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'out';
let copied = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    if (entry.startsWith('__next.')) flatten(full, dir, entry);
    else if (entry !== '_next') walk(full);
  }
}

function flatten(segDir, parent, prefix) {
  for (const entry of readdirSync(segDir)) {
    const full = join(segDir, entry);
    const name = `${prefix}.${entry}`;
    if (statSync(full).isDirectory()) flatten(full, parent, name);
    else if (!existsSync(join(parent, name))) {
      copyFileSync(full, join(parent, name));
      copied++;
    }
  }
}

if (!existsSync(OUT)) throw new Error('Run `next build` first: ./out does not exist.');
walk(OUT);
console.log(`flatten-rsc: ${copied} segment file(s) aliased for static hosting.`);
