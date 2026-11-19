import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = path.join(ROOT, 'plugins', 'horizon-plugin-demo');
const SANDBOX = await fs.mkdtemp(path.join(tmpdir(), 'horizon-plugin-git-'));
const REPOSITORY = path.join(SANDBOX, 'demo-repository');
const DATA_DIR = path.join(SANDBOX, 'horizon-data');
const PORT = 45174 + Math.floor(Math.random() * 5000);
const BASE = 'http://127.0.0.1:' + PORT;
const PLUGIN_ID = 'horizon-e2e-demo';
let apiProcess;
let connectionServer;
const observed = [];

async function git(args, cwd) {
  const child = spawn('git', args, { cwd, windowsHide: true, stdio: 'pipe' });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  if (code !== 0) throw new Error('git ' + args.join(' ') + ' failed: ' + stderr);
  return stdout.trim();
}

async function request(pathname, body, headers = {}) {
  const hasBody = body !== undefined;
  const response = await fetch(BASE + pathname, {
    method: hasBody ? 'POST' : 'GET',
    headers: { ...(hasBody ? { 'content-type': 'application/json' } : {}), ...headers },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}

async function post(pathname, body, headers) {
  const result = await request(pathname, body, headers);
  if (result.status < 200 || result.status >= 300) throw new Error(result.data.error || 'HTTP ' + result.status);
  return result.data;
}

async function waitForApi() {
  for (let n = 0; n < 80; n++) {
    if (apiProcess.exitCode !== null) throw new Error('The One System API exited before becoming ready.');
    try { if ((await request('/api/health')).data.ok) return; } catch { await delay(100); }
  }
  throw new Error('The One System API did not become ready.');
}

async function devSession(input) {
  return (await post('/api/dev/session', input)).accessToken;
}

async function query(pathname, token) {
  return request(pathname, undefined, token ? { authorization: 'Bearer ' + token } : {});
}

function sendJson(res, code, value) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(value));
}

try {
  await fs.cp(TEMPLATE, REPOSITORY, { recursive: true, filter: (source) => !/[\\/](?:\.git|node_modules|dist)(?:[\\/]|$)/.test(source) });
  const manifestPath = path.join(REPOSITORY, 'horizon-plugin.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const originalBasePath = manifest.basePath;
  manifest.id = PLUGIN_ID;
  manifest.name = 'The One System E2E Demo';
  manifest.basePath = '/ext/' + PLUGIN_ID;
  manifest.business = true;
  manifest.version = '1.1.0';
  manifest.menu = manifest.menu.map((item) => ({ ...item, path: item.path.replace(originalBasePath, manifest.basePath) }));
  manifest.pages = manifest.pages.map((page) => ({
    ...page,
    path: page.path.replace(originalBasePath, manifest.basePath),
    detailPath: page.detailPath?.replace(originalBasePath, manifest.basePath),
  }));
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  await git(['init', '--initial-branch=main'], REPOSITORY);
  await git(['config', 'user.name', 'The One System E2E'], REPOSITORY);
  await git(['config', 'user.email', 'the-one-system-e2e@example.invalid'], REPOSITORY);
  await git(['add', '.'], REPOSITORY);
  await git(['commit', '-m', 'Plugin Demo 1.1.0'], REPOSITORY);
  await git(['tag', 'v1.1.0'], REPOSITORY);

  connectionServer = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname === '/denied/health') return sendJson(res, 403, { error: 'denied' });
    if (url.pathname === '/unavailable/health') return sendJson(res, 503, { error: 'down' });
    if (url.pathname === '/health') return sendJson(res, 200, { ok: true });
    observed.push({
      actorId: req.headers['x-horizon-actor-id'],
      brandId: req.headers['x-horizon-brand-id'],
      pluginId: req.headers['x-horizon-plugin-id'],
      operationId: req.headers['x-horizon-operation-id'],
      permission: req.headers['x-horizon-permission'],
      scope: req.headers['x-horizon-scope'],
      authorization: req.headers.authorization,
    });
    if (!String(req.headers.authorization || '').startsWith('Bearer ')) return sendJson(res, 401, { error: 'missing bearer token' });
    if (url.pathname === '/records') {
      const rows = [{ id: 'DEMO-E2E-1', title: 'Registro autorizado', status: 'Ativo', owner: 'Equipe E2E', brandId: req.headers['x-horizon-brand-id'] }];
      const term = (url.searchParams.get('q') || '').toLowerCase();
      return sendJson(res, 200, { items: rows.filter((row) => row.brandId === req.headers['x-horizon-brand-id'] && (!term || row.title.toLowerCase().includes(term))).slice(0, Number(url.searchParams.get('limit') || 50)) });
    }
    if (url.pathname === '/records/DEMO-E2E-1') {
      if (req.headers['x-horizon-brand-id'] !== 'azime') return sendJson(res, 404, { error: 'record not found' });
      return sendJson(res, 200, { record: { id: 'DEMO-E2E-1', title: 'Registro autorizado', status: 'Ativo', owner: 'Equipe E2E', summary: 'Consulta autorizada do teste de aceite.' } });
    }
    return sendJson(res, 404, { error: 'not found' });
  });
  await new Promise((resolve) => connectionServer.listen(0, '127.0.0.1', resolve));
  const connectionPort = connectionServer.address().port;

  apiProcess = spawn(process.execPath, [path.join(ROOT, 'server', 'index.mjs')], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: String(PORT),
      HORIZON_ALLOW_LOCAL_GIT: '1',
      HORIZON_DEV_SESSIONS: '1',
      HORIZON_DATA_DIR: DATA_DIR,
    },
    stdio: 'ignore',
    windowsHide: true,
  });
  await waitForApi();
  assert.equal((await request('/api/plugins')).data.plugins.length, 0, 'a new The One System instance must not know the copied plugin');

  const tags = await post('/api/plugins/git/revisions', { repositoryUrl: REPOSITORY });
  assert.equal(tags.repository.status, 'ok');
  assert(tags.tags.some((tag) => tag.name === 'v1.1.0'));
  const attemptId = randomUUID();
  const validate = () => post('/api/plugins/git/install/validate', { repositoryUrl: REPOSITORY, revisionType: 'tag', revision: 'v1.1.0', attemptId });

  let result = await validate();
  assert.equal(result.status, 'pending');
  assert.equal(result.checks.revision.status, 'ok');
  assert.equal(result.checks.connections[0].status, 'missing_config');
  assert.equal((await request('/api/plugins')).data.plugins.length, 0, 'pending plugin must remain inactive');

  const saveSetting = (apiBaseUrl) => post('/api/plugins/config/' + PLUGIN_ID, { attemptId, settings: { apiBaseUrl } });
  await saveSetting('http://127.0.0.1:' + connectionPort + '/denied');
  result = await validate();
  assert.equal(result.checks.connections[0].status, 'denied');
  await saveSetting('http://127.0.0.1:' + connectionPort + '/unavailable');
  result = await validate();
  assert.equal(result.checks.connections[0].status, 'unavailable');

  await saveSetting('http://127.0.0.1:' + connectionPort);
  result = await validate();
  assert.equal(result.status, 'installed');
  const v1Commit = await git(['rev-parse', 'v1.1.0^{commit}'], REPOSITORY);
  assert.equal(result.install.commit, v1Commit);
  assert.equal(result.checks.revision.commit, v1Commit);
  assert.equal((await request('/api/plugins')).data.plugins[0].install.commit, v1Commit);

  const operations = '/api/plugins/' + PLUGIN_ID + '/operations/';
  const personalSettings = '/api/plugins/user-settings/' + PLUGIN_ID;
  let denied = await query(operations + 'listar-registros');
  assert.equal(denied.status, 401, 'data operations require a signed session');
  const ana = await devSession({ userId: 'u1', brandId: 'azime', brands: ['azime'], leader: false, admin: false });
  denied = await query(operations + 'listar-registros', ana);
  assert.equal(denied.status, 403, 'a plugin is not available before TI enables the brand');
  await post('/api/plugins/' + PLUGIN_ID + '/access', { enabledBrands: ['azime'] });
  const ungranted = await devSession({ userId: 'u3', brandId: 'azime', brands: ['azime'], leader: false, admin: false });
  denied = await query(operations + 'listar-registros', ungranted);
  assert.equal(denied.status, 403, 'a person without an individual grant cannot query');
  assert.equal((await query(personalSettings, ana)).status, 403, 'view permission does not grant access to the edit screen');
  const wrongBrand = await devSession({ userId: 'u1', brandId: 'alinare', brands: ['alinare'], leader: true, admin: false });
  denied = await query(operations + 'listar-registros', wrongBrand);
  assert.equal(denied.status, 403, 'even a leader cannot use a plugin in a disabled brand');

  await post('/api/plugins/' + PLUGIN_ID + '/access/grants', { userId: 'u1', grantsByBrand: { azime: { actions: ['ver'], scope: 'empresa' } } });
  const listed = await query(operations + 'listar-registros?q=autorizado', ana);
  assert.equal(listed.status, 200);
  assert.equal(listed.data.data[0].id, 'DEMO-E2E-1');
  assert.equal(listed.data.commit, v1Commit);
  const detail = await query(operations + 'consultar-registro?id=DEMO-E2E-1', ana);
  assert.equal(detail.status, 200);
  assert.equal(detail.data.data.summary, 'Consulta autorizada do teste de aceite.');
  assert.equal(observed.at(-1).actorId, 'u1');
  assert.equal(observed.at(-1).brandId, 'azime');
  assert.equal(observed.at(-1).pluginId, PLUGIN_ID);
  assert.equal(observed.at(-1).operationId, 'consultar-registro');
  assert.equal(observed.at(-1).permission, 'ver');
  assert.equal(observed.at(-1).scope, 'empresa');
  assert(observed.at(-1).authorization.startsWith('Bearer '), 'the validated The One System session token is forwarded to the source');
  assert.equal((await query(operations + 'listar-registros?companyId=alinare', ana)).status, 400, 'undeclared brand query parameters are rejected');
  assert.equal((await query(personalSettings, ana)).status, 403, 'view permission cannot read personal settings');
  await post('/api/plugins/' + PLUGIN_ID + '/access/grants', { userId: 'u1', grantsByBrand: { azime: { actions: ['ver', 'editar'], scope: 'empresa' } } });
  const emptySettings = await query(personalSettings, ana);
  assert.equal(emptySettings.status, 200);
  assert.deepEqual(emptySettings.data.settings, {});
  const savedPreferences = await request(personalSettings, { settings: { observacao: 'Preferência individual preservada' } }, { authorization: 'Bearer ' + ana });
  assert.equal(savedPreferences.status, 200);
  assert.equal((await query(personalSettings, ana)).data.settings.observacao, 'Preferência individual preservada');

  const leader = await devSession({ userId: 'u2', brandId: 'azime', brands: ['azime'], leader: true, admin: false });
  assert.equal((await query(operations + 'listar-registros', leader)).status, 200, 'leaders retain all actions for business plugins in enabled brands');
  await post('/api/plugins/' + PLUGIN_ID + '/access/grants', { userId: 'u1', grantsByBrand: {} });
  assert.equal((await query(operations + 'listar-registros', ana)).status, 403, 'permission revocation applies to the next direct query');
  await post('/api/plugins/' + PLUGIN_ID + '/access/grants', { userId: 'u1', grantsByBrand: { azime: { actions: ['ver', 'editar'], scope: 'empresa' } } });

  const preservedData = path.join(DATA_DIR, 'plugin-data', PLUGIN_ID, 'sample.json');
  await fs.mkdir(path.dirname(preservedData), { recursive: true });
  await fs.writeFile(preservedData, JSON.stringify({ marker: 'keep-me', createdBy: 'v1' }));

  manifest.version = '1.1.1';
  manifest.compatibility.horizon = '>=9.0.0';
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  await git(['add', 'horizon-plugin.json'], REPOSITORY);
  await git(['commit', '-m', 'Incompatible plugin version'], REPOSITORY);
  await git(['tag', 'v1.1.1-incompatible'], REPOSITORY);
  const badAttempt = await post('/api/plugins/git/install/validate', { repositoryUrl: REPOSITORY, revisionType: 'tag', revision: 'v1.1.1-incompatible', attemptId: randomUUID() });
  assert.equal(badAttempt.status, 'pending');
  assert.equal(badAttempt.checks.compatibility.status, 'incompatible');
  assert.equal((await request('/api/plugins')).data.plugins[0].manifest.version, '1.1.0', 'a failed update leaves the prior version installed');

  manifest.version = '1.2.0';
  manifest.compatibility.horizon = '>=0.5.0 <0.6.0';
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  await git(['add', 'horizon-plugin.json'], REPOSITORY);
  await git(['commit', '-m', 'Plugin Demo 1.2.0'], REPOSITORY);
  await git(['tag', 'v1.2.0'], REPOSITORY);
  const updateAttempt = await post('/api/plugins/git/install/validate', { repositoryUrl: REPOSITORY, revisionType: 'tag', revision: 'v1.2.0', attemptId: randomUUID() });
  assert.equal(updateAttempt.status, 'installed');
  assert.equal(updateAttempt.install.version, '1.2.0');
  assert.notEqual(updateAttempt.install.commit, v1Commit);
  assert.deepEqual(JSON.parse(await fs.readFile(preservedData, 'utf8')), { marker: 'keep-me', createdBy: 'v1' });
  const installed = (await request('/api/plugins')).data.plugins[0];
  assert.equal(installed.install.enabledBrands.join(','), 'azime', 'brand access is preserved across updates');
  assert.equal((await query(personalSettings, ana)).data.settings.observacao, 'Preferência individual preservada', 'per-user settings remain across successful updates');
  assert.equal((await post('/api/plugins/config/' + PLUGIN_ID, { attemptId, settings: { apiBaseUrl: 'http://127.0.0.1:' + connectionPort } })).settings.apiBaseUrl, 'http://127.0.0.1:' + connectionPort);
  assert.equal((await query(operations + 'listar-registros', ana)).status, 200, 'the individual grant remains active after a successful update');

  const audit = (await fs.readFile(path.join(DATA_DIR, 'plugin-audit.jsonl'), 'utf8')).trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert(audit.some((event) => event.outcome === 'permission_denied' && event.actorId === 'u3'));
  assert(audit.some((event) => event.outcome === 'no_session'));
  assert(audit.some((event) => event.outcome === 'invalid_input' && event.status === 400));
  assert(audit.some((event) => event.outcome === 'permission_denied' && event.actorId === 'u1'));
  assert(audit.some((event) => event.outcome === 'settings_updated' && event.actorId === 'u1'));

  process.stdout.write('PASS: fresh The One System -> copied plugin installed by exact Git tag -> missing/denied/unavailable connection -> correction -> brand and per-person authorization -> list/detail reads -> access denial/revocation -> audit -> failed update preserves current version -> successful update preserves access/settings/data\n');
} finally {
  if (apiProcess && apiProcess.exitCode === null) { apiProcess.kill(); await new Promise((resolve) => apiProcess.once('exit', resolve)); }
  if (connectionServer) await new Promise((resolve) => connectionServer.close(resolve));
  const resolvedSandbox = path.resolve(SANDBOX);
  if (resolvedSandbox.startsWith(path.resolve(tmpdir()) + path.sep)) await fs.rm(resolvedSandbox, { recursive: true, force: true });
}
