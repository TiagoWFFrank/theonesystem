import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.join(root, 'plugins', 'horizon-plugin-demo').split(path.sep).join('/');
const sandbox = await mkdtemp(path.join(tmpdir(), 'tos-browser-'));
const freePort = async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
};
const [backendPort, frontendPort, demoPort] = await Promise.all([freePort(), freePort(), freePort()]);
const base = `http://127.0.0.1:${frontendPort}/#`;
const backend = `http://127.0.0.1:${backendPort}`;
const demo = `http://127.0.0.1:${demoPort}`;
const shotDir = sandbox;
const expectedSha = execFileSync('git', ['rev-parse', 'v1.4.0^{commit}'], { cwd: repo, encoding: 'utf8' }).trim();
const initialSha = execFileSync('git', ['rev-parse', 'v1.3.0^{commit}'], { cwd: repo, encoding: 'utf8' }).trim();
const cleanEnv = { ...process.env };
delete cleanEnv.HORIZON_DATABASE_URL;
delete cleanEnv.HORIZON_PGLITE_DIR;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
const page = await context.newPage();
const hostProcess = spawn(process.execPath, ['server/index.mjs'], { cwd: root, env: { ...cleanEnv, NODE_ENV: 'development', PORT: String(backendPort), HORIZON_ALLOW_LOCAL_GIT: '1', HORIZON_DEV_SESSIONS: '1', HORIZON_DATA_DIR: path.join(sandbox, 'host-data') }, stdio: 'ignore', windowsHide: true });
const viteProcess = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort'], { cwd: root, env: { ...cleanEnv, HORIZON_API_TARGET: backend }, stdio: 'ignore', windowsHide: true });
const errors = [];
const operationResponses = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', async (response) => {
  if (!response.url().includes('/api/plugins/horizon-plugin-demo/operations/')) return;
  try { operationResponses.push({ status: response.status(), url: response.url(), body: await response.json() }); } catch {}
});
let apiProcess;
const waitForApi = async (url, label) => {
  for (let i = 0; i < 40; i++) {
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(label + ' no respondeu a tempo.');
};
try {
  await waitForApi(backend + '/api/health', 'The One System');
  await waitForApi(`http://127.0.0.1:${frontendPort}`, 'interface');
  await page.goto(base + '/entrar');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('button.ms-btn').click();
  await page.locator('button.account:has-text("Elisa Moura")').click();
  await page.getByText('Escolha o ambiente').waitFor({ timeout: 10000 });
  await page.locator('button.env-card:has-text("AZIME")').click();
  await page.getByRole('button', { name: 'Entrar em AZIME' }).click();
  await page.waitForURL(/#\/inicio/, { timeout: 10000 });
  await page.getByText(/Bom dia, Elisa|Boa tarde, Elisa|Boa noite, Elisa/).waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);

  await page.goto(base + '/admin/plugins');
  await page.getByRole('button', { name: 'Instalar pelo Git' }).waitFor();
  await page.getByRole('button', { name: 'Instalar pelo Git' }).click();
  await page.locator('input[type=url]').first().fill(repo);
  await page.getByRole('button', { name: 'Listar tags' }).click();
  await page.waitForFunction(() => Array.from(document.querySelectorAll('select option')).some((option) => option.value === 'v1.3.0'), null, { timeout: 15000 });
  await page.locator('select').nth(1).selectOption('v1.3.0');
  await page.getByRole('button', { name: 'Validar e instalar' }).click();
  await page.locator('.badge').filter({ hasText: 'Pendente' }).waitFor({ timeout: 20000 });
  const pendingText = await page.locator('body').innerText();
  assert.ok(/API.*Plugin Demo/s.test(pendingText));
  assert.ok(pendingText.includes(initialSha), 'a revisão pendente deve mostrar o SHA completo da tag');
  await page.screenshot({ path: shotDir + '/01-pending-validation.png', fullPage: true });

  apiProcess = spawn(process.execPath, ['demo-api.mjs'], { cwd: repo, env: { ...cleanEnv, DEMO_DATA_DIR: path.join(sandbox, 'demo-data'), DEMO_API_PORT: String(demoPort) }, stdio: 'ignore', windowsHide: true });
  await waitForApi(demo + '/health', 'API Demo');
  await page.locator('input[type=url]').last().fill(demo);
  await page.getByRole('button', { name: /Salvar config/ }).click();
  await page.locator('a.mod-tile').filter({ hasText: 'Plugin Demo' }).waitFor({ timeout: 30000 });
  await page.locator('a.mod-tile').filter({ hasText: 'Plugin Demo' }).waitFor({ timeout: 15000 });


  await page.goto(base + '/admin/plugins/horizon-plugin-demo');
  await page.locator('.banner').filter({ hasText: 'Origem Git' }).waitFor();
  assert.ok((await page.locator('body').innerText()).includes(initialSha), 'plugin detail must show the approved SHA');
  const azimeSwitch = page.locator('input[aria-label="Habilitar para AZIME"]');
  assert.equal(await azimeSwitch.isChecked(), false);
  await azimeSwitch.click();
  await page.waitForFunction(() => document.querySelector('input[aria-label="Habilitar para AZIME"]')?.checked === true, null, { timeout: 10000 });
  assert.equal(await page.locator('input[aria-label="Habilitar para Alinare"]').isChecked(), false);
  assert.equal(await page.locator('input[aria-label="Habilitar para Novitah"]').isChecked(), false);
  await page.screenshot({ path: shotDir + '/02-plugin-enabled-azime.png', fullPage: true });

  await page.goto(base + '/admin/colaboradores/u1');
  await page.locator('input[aria-label^=AZIME]').first().waitFor();
  const anaView = page.locator('input[type="checkbox"][aria-label*="Consultar o Plugin Demo"]');
  await anaView.check();
  assert.equal(await anaView.isChecked(), true);
  await page.getByRole('button', { name: 'Revisar e aplicar' }).click();
  await page.getByRole('button', { name: /Aplicar alter/ }).click();
  await page.getByText(/Acessos de Ana Ribeiro aplicados/).waitFor({ timeout: 15000 });
  await page.waitForFunction(() => { const d = JSON.parse(localStorage.getItem('azime-demo-data-v4') || '{}'); return d.users?.find((u) => u.id === 'u1')?.grants?.azime?.['horizon-plugin-demo']?.actions?.includes('ver'); }, null, { timeout: 10000 });

  await page.evaluate(() => {
    const key = 'azime-demo-session-v4';
    const session = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({ ...session, userId: 'u1', companyId: 'azime' }));
  });
  await page.reload();
  await page.goto(base + '/inicio');
  const demoMenu = page.getByRole('link', { name: 'Plugin Demo', exact: true });
  await demoMenu.waitFor({ timeout: 15000 });
  await demoMenu.click();
  await page.getByText('DEMO-1001', { exact: true }).waitFor({ timeout: 15000 });
  const azimeRows = page.locator('tbody tr');
  assert.equal(await azimeRows.count(), 2, 'a lista AZIME deve trazer s os dois registros fictcios AZIME');
  assert.ok((await page.locator('body').innerText()).includes('Notebook para'));
  assert.ok(!(await page.locator('body').innerText()).includes('DEMO-2001'), 'o registro Alinare no deve aparecer em AZIME');
  const listResponse = operationResponses.find((entry) => entry.url.includes('listar-registros'));
  assert.equal(listResponse?.status, 200);
  assert.deepEqual(listResponse?.body?.data?.map((row) => row.id), ['DEMO-1001', 'DEMO-1002']);
  await page.waitForTimeout(800);
  assert.ok(!(await page.locator('body').innerText()).includes('Horizon'), 'legacy product text must display as The One System');
  await page.screenshot({ path: shotDir + '/03-demo-list-ana.png', fullPage: true });

  await page.getByRole('link', { name: /React do Demo/ }).click();
  await page.getByRole('heading', { name: /React do Plugin Demo/ }).waitFor({ timeout: 15000 });
  await page.locator('[data-plugin-react="demo"]').getByText(/DEMO-1001/).waitFor({ timeout: 15000 });
  const deniedWrite = page.waitForResponse((r) => r.url().includes('/operations/alterar-status') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Alterar status DEMO-1001' }).click();
  assert.equal((await deniedWrite).status(), 403);
  await page.getByRole('alert').waitFor();
  const grantResponse = await fetch(backend + '/api/plugins/horizon-plugin-demo/access/grants', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({userId:'u1',grantsByBrand:{azime:{actions:['ver','editar'],scope:'empresa'}}}) });
  assert.equal(grantResponse.status, 200);
  const acceptedWrite = page.waitForResponse((r) => r.url().includes('/operations/alterar-status') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Alterar status DEMO-1001' }).click();
  assert.equal((await acceptedWrite).status(), 200);
  await page.locator('[data-plugin-react="demo"] li').filter({hasText:'DEMO-1001'}).getByText(/Conclu/).waitFor();
  await page.reload();
  await page.locator('[data-plugin-react="demo"] li').filter({hasText:'DEMO-1001'}).getByText(/Conclu/).waitFor({timeout:15000});
  await page.waitForTimeout(500);
  await page.screenshot({ path: shotDir + '/06-react-demo.png', fullPage: true });

  // Update the same installed repository through the catalog UI.
  await page.evaluate(() => {
    const key = 'azime-demo-session-v4';
    localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key) || '{}'), userId: 'u5', companyId: 'azime' }));
  });
  await page.reload();
  await page.goto(base + '/admin/plugins');
  await page.getByRole('button', { name: 'Instalar pelo Git' }).click();
  await page.locator('input[type=url]').first().fill(repo);
  await page.getByRole('button', { name: 'Listar tags' }).click();
  await page.waitForFunction(() => Array.from(document.querySelectorAll('select option')).some((option) => option.value === 'v1.4.0'), null, { timeout: 15000 });
  await page.locator('select').nth(1).selectOption('v1.4.0');
  const updateResponse = page.waitForResponse((response) => response.url().includes('/api/plugins/git/install/validate') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Validar e instalar' }).click();
  assert.equal((await (await updateResponse).json()).status, 'installed');
  await page.locator('a.mod-tile').filter({ hasText: 'Plugin Demo' }).getByText('v1.4.0').waitFor({ timeout: 30000 });
  const afterUpdate = (await (await fetch(backend + '/api/plugins')).json()).plugins[0];
  assert.equal(afterUpdate.install.commit, expectedSha);
  assert.deepEqual(afterUpdate.install.enabledBrands, ['azime']);
  const config = (await (await fetch(backend + '/api/plugins/config/horizon-plugin-demo')).json()).settings;
  assert.equal(config.apiBaseUrl, demo);
  await page.evaluate(() => {
    const key = 'azime-demo-session-v4';
    localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key) || '{}'), userId: 'u1', companyId: 'azime' }));
  });
  await page.reload();
  await page.goto(base + '/ext/horizon-plugin-demo/pagina-react');
  await page.locator('[data-plugin-react="demo"] li').filter({hasText:'DEMO-1001'}).getByText(/Conclu/).waitFor({ timeout: 15000 });
  await page.getByRole('link', { name: /Registros de demonstra/ }).click();
  await page.getByText('DEMO-1001', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByRole('link', { name: 'Consultar', exact: true }).first().click();
  await page.getByText('DEMO-1001', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByText(/Registro consultado pela API/).waitFor();
  const detailResponse = operationResponses.find((entry) => entry.url.includes('consultar-registro'));
  assert.equal(detailResponse?.status, 200);
  assert.equal(detailResponse?.body?.data?.id, 'DEMO-1001');
  assert.ok(!(await page.locator('body').innerText()).includes('Horizon'), 'legacy product text must display as The One System');
  await page.waitForTimeout(800);
  await page.screenshot({ path: shotDir + '/04-demo-detail-ana.png', fullPage: true });

  // Revocation must take effect even when the browser still has a cached menu grant.
  const revoke = await fetch(backend + '/api/plugins/horizon-plugin-demo/access/grants', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: 'u1', grantsByBrand: {} }) });
  assert.equal(revoke.status, 200);
  const deniedComponent = page.waitForResponse((r) => r.url().includes('/components/') && r.status() === 403);
  await page.goto(base + '/ext/horizon-plugin-demo/pagina-react');
  await deniedComponent;
  assert.equal(await page.locator('[data-plugin-react="demo"]').count(), 0);
  const restore = await fetch(backend + '/api/plugins/horizon-plugin-demo/access/grants', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: 'u1', grantsByBrand: { azime: { actions: ['ver', 'editar'], scope: 'empresa' } } }) });
  assert.equal(restore.status, 200);

  const brandTokenResponse = await fetch(backend + '/api/dev/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: 'u1', brandId: 'alinare', brands: ['alinare'], leader: false, admin: false }) });
  const brandToken = (await brandTokenResponse.json()).accessToken;
  const installed = (await (await fetch(backend + '/api/plugins')).json()).plugins[0];
  const pageIndex = installed.manifest.pages.findIndex((item) => item.kind === 'react');
  const directComponent = await fetch(`${backend}/api/plugins/horizon-plugin-demo/components/${pageIndex}?commit=${expectedSha}`, { headers: { authorization: `Bearer ${brandToken}` } });
  assert.equal(directComponent.status, 403, 'direct component URL must reject a disabled brand');

  const carlaContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState: await context.storageState() });
  const carla = await carlaContext.newPage();
  await carla.goto(base + '/inicio');
  await carla.waitForTimeout(1200);
  await carla.evaluate(() => {
    const key = 'azime-demo-session-v4';
    const session = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({ ...session, userId: 'u3', companyId: 'azime' }));
  });
  await carla.reload();
  await carla.goto(base + '/inicio');
  await carla.waitForTimeout(1200);
  const carlaMenuCount = await carla.getByRole('link', { name: 'Plugin Demo', exact: true }).count();
  assert.equal(carlaMenuCount, 0, 'Carla no deve ver o item de menu do Plugin Demo');
  await carla.goto(base + '/ext/horizon-plugin-demo');
  await carla.waitForTimeout(1200);
  const carlaText = await carla.locator('body').innerText();
  assert.ok(carlaText.includes('Seu perfil') && carlaText.includes('Plugin Demo neste ambiente'), 'a rota direta deve explicar que Carla nao tem permissao');
  assert.ok(!carlaText.includes('DEMO-1001'), 'a rota direta de Carla no pode revelar dados');
  await carla.screenshot({ path: shotDir + '/05-carla-denied.png', fullPage: true });
  await carla.goto(base + '/ext/horizon-plugin-demo/pagina-react');
  await carla.getByText(/Seu perfil/).waitFor({ timeout: 10000 });
  assert.equal(await carla.locator('[data-plugin-react="demo"]').count(), 0);
  assert.ok(!(await carla.locator('body').innerText()).includes('DEMO-1001'));
  await carla.screenshot({ path: shotDir + '/07-react-denied.png', fullPage: true });
  await carlaContext.close();

  assert.deepEqual(errors.filter((item) => !item.includes('403')), [], 'o fluxo visual no deve produzir erros JavaScript/console');
  console.log(JSON.stringify({
    result: 'PASS', viewport: '1440x1000', repository: repo, update: 'v1.3.0 -> v1.4.0', sha: expectedSha,
    connection: 'pendente -> API demo configurada -> instalado na mesma tentativa',
    enabledBrands: ['azime'],
    ana: { menu: 'visible', list: ['DEMO-1001', 'DEMO-1002'], detail: 'DEMO-1001', source: 'Plugin Demo API' },
    carla: { menu: 'hidden', directRoute: 'denied without data' },
    browserErrors: errors,
  }, null, 2));
} catch (error) {
  console.error('Página no momento da falha:', (await page.locator('body').innerText()).slice(0, 5000));
  throw error;
} finally {
  await context.close();
  await browser.close();
  await Promise.all([hostProcess, viteProcess, apiProcess].filter(Boolean).map(async (child) => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill();
    await exited;
  }));
  await rm(sandbox, { recursive: true, force: true });
}
