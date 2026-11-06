// Moves Drift to the newest stable Electron, and with it the newest Chromium.
// Usage: npm run update-engine  (add --dry-run to only report)
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const dry = process.argv.includes('--dry-run');
const current = JSON.parse(readFileSync('node_modules/electron/package.json', 'utf8')).version;

const releases = await (await fetch('https://releases.electronjs.org/releases.json')).json();
const stable = releases.filter((r) => r.version && !r.version.includes('-') && r.chrome);
const cmp = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};
stable.sort((a, b) => cmp(b.version, a.version));
const latest = stable[0];
const now = releases.find((r) => r.version === current);

console.log(`Current: Electron ${current} (Chromium ${now?.chrome ?? '?'})`);
console.log(`Latest:  Electron ${latest.version} (Chromium ${latest.chrome}, released ${latest.date})`);

if (cmp(latest.version, current) <= 0) {
  console.log('Already on the newest engine.');
  process.exit(0);
}
if (dry) {
  console.log('Dry run: nothing changed.');
  process.exit(0);
}

execSync(`npm install --save-dev electron@${latest.version}`, { stdio: 'inherit' });
execSync('npm run build', { stdio: 'inherit' });
console.log(`\nDone: Drift now runs Chromium ${latest.chrome}. Ship it to users with "npm run dist" and publish the release.`);
