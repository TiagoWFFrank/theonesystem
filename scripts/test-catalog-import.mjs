import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { PGlite } from '@electric-sql/pglite';
import { openCatalogStore } from '../server/catalog-store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = await fs.mkdtemp(path.join(tmpdir(), 'tos-catalog-import-'));
const data = path.join(sandbox, 'data');
const dbPath = path.join(sandbox, 'db');
const operational = process.argv.includes('--operational');
const validUser = '41ce40c9-1c67-440a-b9e8-b1643396c2ac';
const execFile = promisify(execFileCallback);
let store;
try {
  if (process.argv.includes('--existing')) {
    // This optional check reads the real installation only by copying it to a fixture.
    await fs.cp(path.join(root, '.horizon-data'), data, { recursive: true });
  } else {
    const repo = path.join(sandbox, 'repo');
    await fs.mkdir(repo, { recursive: true });
    const git = async (...args) => (await execFile('git', args, { cwd: repo, windowsHide: true })).stdout.trim();
    await git('init', '--initial-branch=main');
    await git('config', 'user.name', 'The One System Test');
    await git('config', 'user.email', 'test@example.invalid');
    await fs.writeFile(path.join(repo, 'horizon-plugin.json'), JSON.stringify({ format: 'horizon-plugin', id: 'horizon-plugin-demo' }));
    await git('add', '.'); await git('commit', '-m', 'Demo fixture');
    const sha = await git('rev-parse', 'HEAD');
    const checkout = path.join('plugins', 'horizon-plugin-demo', sha);
    await fs.mkdir(path.join(data, 'plugins', 'horizon-plugin-demo'), { recursive: true });
    await fs.rename(repo, path.join(data, checkout));
    await fs.mkdir(path.join(data, 'plugin-settings'), { recursive: true });
    await fs.writeFile(path.join(data, 'plugins.json'), JSON.stringify({ plugins: { 'horizon-plugin-demo': { manifest: { id: 'horizon-plugin-demo' }, install: { commit: sha, checkout } } } }));
    await fs.writeFile(path.join(data, 'plugin-settings', 'horizon-plugin-demo.json'), JSON.stringify({ apiBaseUrl: 'http://localhost:4300' }));
  }
  const registryPath = path.join(data, 'plugins.json');
  const registry = JSON.parse(await fs.readFile(registryPath, 'utf8'));
  const demo = registry.plugins['horizon-plugin-demo'];
  assert(demo, 'a cópia deve conter a instalação local do Demo');
  demo.access = { active: true, enabledBrands: ['azime'], grants: { u1: { azime: { actions: ['ver'], scope: 'empresa' } } } };
  if (operational) demo.access.grants[validUser] = { azime: { actions: ['ver'], scope: 'empresa' } };
  await fs.writeFile(registryPath, JSON.stringify(registry));
  const settingsPath = path.join(data, 'plugin-settings', 'horizon-plugin-demo.json');
  const settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
  const db = new PGlite(dbPath);
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users (id uuid primary key);');
  for (const file of ['20261119205630_central_plugin_catalog.sql', '20261119205636_catalog_legacy_documents.sql']) await db.exec(await fs.readFile(path.join(root, 'supabase', 'migrations', file), 'utf8'));
  if (operational) {
    await db.query('insert into auth.users(id) values ($1)', [validUser]);
    await db.query("insert into one_system.brands(id,name) values ('azime','Azime')");
    await db.query("insert into one_system.brand_memberships(user_id,brand_id) values ($1,'azime')", [validUser]);
  }
  await db.close();
  delete process.env.HORIZON_DATABASE_URL;
  process.env.HORIZON_PGLITE_DIR = dbPath;
  if (operational) process.env.HORIZON_TEST_REQUIRE_REAL_IDENTITIES = '1';
  store = await openCatalogStore(data);
  const imported = await store.read(registryPath, {});
  if (operational) {
    assert.equal(await store.hasMembership('u1', 'azime'), false);
    assert.equal(await store.hasMembership(validUser, 'azime'), true);
    assert.deepEqual(imported.plugins['horizon-plugin-demo'].access.grants[validUser], demo.access.grants[validUser]);
    assert.equal(imported.plugins['horizon-plugin-demo'].access.grants.u1, undefined);
    const quarantine = await store.read(path.join(data, 'legacy-quarantined-grants.json'), {});
    assert.deepEqual(quarantine['horizon-plugin-demo'].u1, demo.access.grants.u1);
    delete registry.plugins['horizon-plugin-demo'].access.grants.u1;
  }
  assert.deepEqual(imported, registry);
  assert.deepEqual(await store.read(settingsPath, {}), settings);
  await store.close(); store = undefined;
  await fs.writeFile(registryPath, JSON.stringify({ plugins: {} }));
  store = await openCatalogStore(data);
  assert.deepEqual(await store.read(registryPath, {}), registry, 'reimport must not replace database state');
  assert.deepEqual(await store.read(settingsPath, {}), settings);
  if (operational) {
    const earlier = structuredClone(registry);
    earlier.plugins['horizon-plugin-demo'].access.grants.u2 = { azime: { actions: ['ver'], scope: 'empresa' } };
    await store.write(registryPath, earlier);
    await store.close(); store = await openCatalogStore(data);
    assert.deepEqual(await store.read(registryPath, {}), registry, 'older database imports must also be quarantined');
    const quarantine = await store.read(path.join(data, 'legacy-quarantined-grants.json'), {});
    assert(quarantine['horizon-plugin-demo'].u1 && quarantine['horizon-plugin-demo'].u2);
  }
  await store.close(); store = undefined;
  const verify = new PGlite(dbPath);
  const marker = await verify.query("select count(*)::int as n from one_system.plugin_documents where key = '__legacy_import_v1__'");
  assert.equal(marker.rows[0].n, 1);
  await verify.close();
  console.log(`PASS: ${process.argv.includes('--existing') ? 'isolated copy of installed Demo' : 'synthetic Demo fixture'}, SHA, checkout, settings and ${operational ? 'verified memberships with legacy grants quarantined' : 'simulated grants'} imported idempotently.`);
} finally {
  if (store) await store.close();
  const target = path.resolve(sandbox);
  if (target.startsWith(path.resolve(tmpdir()) + path.sep)) await fs.rm(target, { recursive: true, force: true });
}
