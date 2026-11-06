// Used by .github/workflows/engine-watch.yml.
// If a newer stable Electron (which carries Chromium security fixes) exists,
// install it, bump Drift's patch version, and report the new tag to GitHub
// Actions. Prints nothing to GITHUB_OUTPUT when Drift is already current.
import { execSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

const cmp = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};
const out = (k, v) => process.env.GITHUB_OUTPUT && appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const current = pkg.devDependencies.electron.replace(/^[^\d]*/, '');
const releases = await (await fetch('https://releases.electronjs.org/releases.json')).json();
const latest = releases
  .filter((r) => r.version && !r.version.includes('-') && r.chrome)
  .sort((a, b) => cmp(b.version, a.version))[0];

console.log(`Drift uses Electron ${current}; newest stable is ${latest.version} (Chromium ${latest.chrome}, ${latest.date}).`);
if (cmp(latest.version, current) <= 0) {
  console.log('Engine is current. Nothing to release.');
  process.exit(0);
}

execSync(`npm install --save-dev --save-exact --ignore-scripts electron@${latest.version}`, { stdio: 'inherit' });
execSync('npm version patch --no-git-tag-version', { stdio: 'inherit' });
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;

console.log(`Releasing Drift ${version} with Chromium ${latest.chrome}.`);
out('tag', `v${version}`);
out('electron', latest.version);
out('chrome', latest.chrome);
