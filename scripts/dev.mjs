// Dev loop: start Vite (with HMR for the shell UI), compile the Electron
// main/preload once, then launch Electron pointed at the dev server.
import { execSync, spawn } from 'node:child_process';
import electronPath from 'electron';
import { createServer } from 'vite';

const server = await createServer({ configFile: 'vite.config.mts' });
await server.listen();
const url = server.resolvedUrls.local[0];
console.log(`[dev] shell UI at ${url}`);

execSync('npx tsc -p tsconfig.electron.json', { stdio: 'inherit' });

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, DRIFT_DEV_URL: url },
});
child.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
