// Emits sensitive catalog/configuration data. Pipe directly to an approved
// importer; never print the output in logs or commit it to the repository.
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { openCatalogStore } from '../server/catalog-store.mjs';

if (!process.argv.includes('--sensitive-stdout')) throw new Error('Explicit --sensitive-stdout is required.');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = path.resolve(process.env.HORIZON_DATA_DIR || path.join(root, '.horizon-data'));
const sandbox = await fs.mkdtemp(path.join(tmpdir(), 'tos-export-catalog-'));
const dbPath = path.join(sandbox, 'db');
let store;
try {
  const db = new PGlite(dbPath);
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users (id uuid primary key);');
  for (const file of ['20261119205630_central_plugin_catalog.sql', '20261119205636_catalog_legacy_documents.sql']) await db.exec(await fs.readFile(path.join(root, 'supabase', 'migrations', file), 'utf8'));
  await db.close();
  delete process.env.HORIZON_DATABASE_URL;
  process.env.HORIZON_PGLITE_DIR = dbPath;
  store = await openCatalogStore(data);
  await store.close(); store = undefined;
  const verify = new PGlite(dbPath);
  const documents = (await verify.query('select key, value from one_system.plugin_documents order by key')).rows;
  const audit = (await verify.query('select event_key, event from one_system.plugin_legacy_audit order by event_key')).rows;
  await verify.close();
  process.stdout.write(JSON.stringify({ documents, audit }));
} finally {
  if (store) await store.close();
  const target = path.resolve(sandbox);
  if (target.startsWith(path.resolve(tmpdir()) + path.sep)) await fs.rm(target, { recursive: true, force: true });
}
