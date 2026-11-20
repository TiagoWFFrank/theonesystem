import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = await readFile(new URL('../supabase/migrations/20261119205630_central_plugin_catalog.sql', import.meta.url), 'utf8');
const migration2 = await readFile(new URL('../supabase/migrations/20261119205636_catalog_legacy_documents.sql', import.meta.url), 'utf8');
const user = '11111111-1111-4111-8111-111111111111';
const sha1 = '9dc9818e482f32f797d1e15098fdbb412b446c32';
const sha2 = 'c3d7a2439f8a3137db3051fbfdedd8d0e84be907';
try {
  // These roles and auth.users emulate only the Supabase objects used by the migration.
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users (id uuid primary key);');
  await db.exec(migration);
  await db.exec(migration2);
  await db.exec(`insert into auth.users values ('${user}');`);
  await db.exec(`
    insert into one_system.brands (id, name) values ('azime', 'AZIME');
    insert into one_system.brand_memberships (user_id, brand_id) values ('${user}', 'azime');
    insert into one_system.plugins (id, name, repository) values ('horizon-plugin-demo', 'Demo', 'https://example.invalid/demo.git');
    insert into one_system.plugin_versions (plugin_id, commit_sha, version, revision_type, revision, manifest, checkout)
      values ('horizon-plugin-demo', '${sha1}', '1.0.0', 'tag', 'v1.0.0', '{}', 'plugins/demo/v1');
    insert into one_system.plugin_installations (plugin_id, commit_sha) values ('horizon-plugin-demo', '${sha1}');
    insert into one_system.plugin_brands (plugin_id, brand_id) values ('horizon-plugin-demo', 'azime');
    insert into one_system.plugin_actions (plugin_id, action_id, label) values ('horizon-plugin-demo', 'ver', 'Consultar');
    insert into one_system.plugin_grants (plugin_id, action_id, user_id, brand_id, scope) values ('horizon-plugin-demo', 'ver', '${user}', 'azime', 'empresa');
    insert into one_system.plugin_settings (plugin_id, settings) values ('horizon-plugin-demo', '{"apiBaseUrl":"http://localhost:4300"}');
  `);
  await assert.rejects(db.exec(`update one_system.plugin_installations set commit_sha = '${sha2}' where plugin_id = 'horizon-plugin-demo'`));
  const before = await db.query("select i.commit_sha, s.settings from one_system.plugin_installations i join one_system.plugin_settings s using (plugin_id)");
  assert.equal(before.rows[0].commit_sha, sha1);
  assert.equal(before.rows[0].settings.apiBaseUrl, 'http://localhost:4300');
  await db.exec(`insert into one_system.plugin_versions (plugin_id, commit_sha, version, revision_type, revision, manifest, checkout) values ('horizon-plugin-demo', '${sha2}', '1.1.0', 'tag', 'v1.1.0', '{}', 'plugins/demo/v2'); update one_system.plugin_installations set commit_sha = '${sha2}' where plugin_id = 'horizon-plugin-demo';`);
  const after = await db.query('select i.commit_sha, s.settings, count(g.action_id)::int as grants from one_system.plugin_installations i join one_system.plugin_settings s using (plugin_id) join one_system.plugin_grants g using (plugin_id) group by i.commit_sha, s.settings');
  assert.equal(after.rows[0].commit_sha, sha2);
  assert.equal(after.rows[0].settings.apiBaseUrl, 'http://localhost:4300');
  assert.equal(after.rows[0].grants, 1);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from one_system.plugin_settings'), /permission denied/i);
  await db.exec('reset role; set role service_role');
  await db.exec("insert into one_system.plugin_audit (plugin_id, outcome) values ('horizon-plugin-demo', 'allowed')");
  await assert.rejects(db.exec('delete from one_system.plugin_audit'), /permission denied/i);
  await db.exec('reset role');
  const rls = await db.query("select count(*)::int as count from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'one_system' and c.relkind = 'r' and c.relrowsecurity");
  assert.equal(rls.rows[0].count, 14);
  console.log('PASS: migration, access restrictions, version foreign key and preservation of settings and grants (local PGlite).');
} finally {
  await db.close();
}
