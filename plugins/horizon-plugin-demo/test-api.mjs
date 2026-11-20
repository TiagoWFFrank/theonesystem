import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = await fs.mkdtemp(path.join(tmpdir(), 'tos-demo-data-'));
const reserve = net.createServer();
await new Promise((resolve) => reserve.listen(0, '127.0.0.1', resolve));
const port = reserve.address().port;
await new Promise((resolve, reject) => reserve.close((error) => error ? reject(error) : resolve()));
const url = `http://127.0.0.1:${port}`;
const headers = { 'x-horizon-actor-id': 'example', 'x-horizon-brand-id': 'azime', 'x-horizon-scope': 'empresa', 'x-horizon-permission': 'editar', 'content-type': 'application/json' };
let child;
async function start() {
  child = spawn(process.execPath, [fileURLToPath(new URL('./demo-api.mjs', import.meta.url))], { env: { ...process.env, DEMO_DATA_DIR: dir, DEMO_API_PORT: String(port) }, stdio: 'ignore', windowsHide: true });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('Demo API failed to start');
    try { if ((await fetch(`${url}/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Demo API did not start');
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const stopped = new Promise((resolve) => child.once('exit', resolve));
  child.kill();
  await stopped;
}
try {
  await start();
  const written = await fetch(`${url}/records/DEMO-1001/status`, { method: 'POST', headers, body: JSON.stringify({ status: 'Concluído' }) });
  assert.equal(written.status, 200);
  await stop();
  await start();
  const read = await fetch(`${url}/records/DEMO-1001`, { headers: { ...headers, 'x-horizon-permission': 'ver' } });
  assert.equal((await read.json()).record.status, 'Concluído');
  const otherBrand = await fetch(`${url}/records/DEMO-1001`, { headers: { ...headers, 'x-horizon-permission': 'ver', 'x-horizon-brand-id': 'alinare' } });
  assert.equal(otherBrand.status, 404);
  console.log('PASS: Demo API retains the written status after its own restart and isolates brands.');
} finally {
  await stop();
  if (path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep)) await fs.rm(dir, { recursive: true, force: true });
}
