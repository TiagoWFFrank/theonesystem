import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const sql = await readFile(new URL('../supabase/INSTALAR_MANUAL.sql', import.meta.url), 'utf8');
const bootstrap = 'create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users (id uuid primary key);';
const db = new PGlite();
const partial = new PGlite();
try {
  await db.exec(bootstrap);
  await db.exec(sql);
  await db.query('insert into one_system.plugin_documents (key, value) values ($1, $2::jsonb)', ['plugins.json', JSON.stringify({ marker: 'preserve' })]);
  await db.exec(sql);
  const result = await db.query('select value from one_system.plugin_documents where key = $1', ['plugins.json']);
  assert.equal(result.rows[0].value.marker, 'preserve');
  await partial.exec(bootstrap);
  await partial.exec('create schema one_system');
  await assert.rejects(partial.exec(sql), /schema one_system existente está incompleto/i);
  console.log('PASS: manual SQL creates schema, preserves existing documents on rerun and rejects partial schema.');
} finally {
  await db.close();
  await partial.close();
}
