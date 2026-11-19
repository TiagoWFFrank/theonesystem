import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = {
  ...process.env,
  NODE_ENV: 'development',
  HORIZON_ALLOW_LOCAL_GIT: process.env.HORIZON_ALLOW_LOCAL_GIT || '1',
  HORIZON_DEV_SESSIONS: process.env.HORIZON_DEV_SESSIONS || '1',
};
const children = [
  spawn(process.execPath, [path.join(ROOT, 'server', 'index.mjs')], { cwd: ROOT, env, stdio: 'inherit', windowsHide: true }),
  spawn(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', process.env.VITE_HOST || '127.0.0.1'], { cwd: ROOT, env, stdio: 'inherit', windowsHide: true }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill();
  setTimeout(() => process.exit(code), 150);
}
for (const child of children) child.on('exit', (code) => { if (!stopping) stop(code || 0); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(0));
