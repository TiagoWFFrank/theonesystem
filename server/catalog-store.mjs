import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { execFile as execFileCallback } from 'node:child_process';

const execFile = promisify(execFileCallback);
export async function openCatalogStore(dataDir) {
  const url = process.env.HORIZON_DATABASE_URL;
  const localDir = process.env.HORIZON_PGLITE_DIR;
  const namespace = process.env.HORIZON_CATALOG_TEST_NAMESPACE || '';
  if (namespace && (process.env.NODE_ENV === 'production' || !/^[a-f0-9-]{36}$/.test(namespace))) throw new Error('Namespace isolado disponível apenas para testes.');
  const prefix = namespace ? `test:${namespace}:` : '';
  const importMarker = prefix + '__legacy_import_v1__';
  const operational = Boolean(url && !namespace) || Boolean(localDir && process.env.HORIZON_TEST_REQUIRE_REAL_IDENTITIES === '1');
  if (!url && !localDir && process.env.NODE_ENV === 'production') throw new Error('HORIZON_DATABASE_URL é obrigatória em produção.');
  if (!url && !localDir) return null;
  if (url && localDir) throw new Error('Configure apenas um banco para o catálogo.');
  if (localDir && process.env.NODE_ENV === 'production') throw new Error('PGlite é exclusivo de testes locais.');
  if (url && process.env.NODE_ENV === 'production') {
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('A verificação TLS não pode ser desativada em produção.');
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('HORIZON_DATABASE_URL inválida.'); }
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !['require', 'verify-ca', 'verify-full'].includes(parsed.searchParams.get('sslmode'))) throw new Error('HORIZON_DATABASE_URL deve usar PostgreSQL com TLS explícito.');
  }
  let db;
  let lease;
  if (localDir) {
    const { PGlite } = await import('@electric-sql/pglite');
    db = new PGlite(localDir);
  } else {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: url, max: 4 });
    const acquire = async () => {
      const client = await pool.connect();
      try { await client.query('set role service_role'); return client; }
      catch (error) { client.release(); throw error; }
    };
    try {
      lease = await acquire();
      const lock = await lease.query("select pg_try_advisory_lock(hashtext('the-one-system-catalog-v1')) as acquired");
      if (!lock.rows[0].acquired) throw new Error('Outro servidor já está usando este catálogo central.');
    } catch (error) { if (lease) lease.release(); await pool.end(); throw error; }
    db = {
      connect: acquire,
      query: async (sql, params) => { const client = await acquire(); try { return await client.query(sql, params); } finally { client.release(); } },
      end: () => pool.end(),
    };
  }
  const root = path.resolve(dataDir);
  const keyFor = (file) => {
    const relative = path.relative(root, path.resolve(file)).split(path.sep).join('/');
    if (relative.startsWith('../') || relative === '..' || path.isAbsolute(relative)) throw new Error('Caminho do catálogo fora do diretório de dados.');
    if (!/^(plugins\.json|git-attempts\.json|legacy-quarantined-grants\.json|plugin-settings\/[a-z0-9-]+\.json|plugin-user-settings\/[a-z0-9-]+\/[0-9a-f]{64}\.json)$/.test(relative)) throw new Error('Documento de catálogo não permitido.');
    return prefix + relative;
  };
  const rawJson = async (file, fallback) => {
    try { return JSON.parse(await fs.readFile(file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
  };
  const paths = async (dir) => {
    try { return await fs.readdir(dir, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  };
  const hasMembership = async (userId, brandId) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return false;
    const result = await db.query('select 1 from one_system.brand_memberships where user_id = $1::uuid and brand_id = $2 and active = true', [userId, brandId]);
    return result.rows.length > 0;
  };
  const quarantineGrants = async (registry, quarantined) => {
    let changed = false;
    for (const [id, entry] of Object.entries(registry.plugins || {})) {
      for (const [userId, grants] of Object.entries(entry.access?.grants || {})) {
        for (const [brandId, grant] of Object.entries(grants || {})) {
          if (!await hasMembership(userId, brandId)) {
            quarantined[id] ??= {};
            quarantined[id][userId] ??= {};
            quarantined[id][userId][brandId] = grant;
            delete entry.access.grants[userId][brandId];
            changed = true;
          }
        }
        if (!Object.keys(entry.access.grants[userId]).length) delete entry.access.grants[userId];
      }
    }
    return changed;
  };
  const importLegacy = async () => {
    const marker = await db.query('select 1 from one_system.plugin_documents where key = $1', [importMarker]);
    if (marker.rows.length) {
      if (operational) {
        const registryKey = keyFor(path.join(root, 'plugins.json'));
        const quarantineKey = keyFor(path.join(root, 'legacy-quarantined-grants.json'));
        const result = await db.query('select key,value from one_system.plugin_documents where key = any($1::text[])', [[registryKey, quarantineKey]]);
        const documents = Object.fromEntries(result.rows.map(({ key, value }) => [key, value]));
        const registry = documents[registryKey];
        const quarantined = documents[quarantineKey] || {};
        if (registry && await quarantineGrants(registry, quarantined)) {
          const client = localDir ? db : await db.connect();
          try {
            await client.query('begin');
            for (const [key, value] of [[registryKey, registry], [quarantineKey, quarantined]]) await client.query('insert into one_system.plugin_documents (key,value) values ($1,$2::jsonb) on conflict (key) do update set value=excluded.value, updated_at=now()', [key, JSON.stringify(value)]);
            await client.query('commit');
          } catch (error) { await client.query('rollback'); throw error; }
          finally { if (!localDir) client.release(); }
        }
      }
      return false;
    }
    const docs = [];
    const quarantined = {};
    for (const file of ['plugins.json', 'git-attempts.json']) {
      const full = path.join(root, file);
      const value = await rawJson(full, file === 'plugins.json' ? { plugins: {} } : {});
      if (file === 'plugins.json') {
        for (const [id, entry] of Object.entries(value.plugins || {})) {
          const checkout = path.resolve(root, entry.install?.checkout || '');
          const sha = entry.install?.commit;
          if (!/^[a-z][a-z0-9-]{2,47}$/.test(id) || entry.manifest?.id !== id || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(sha || '') || !checkout.startsWith(path.join(root, 'plugins') + path.sep)) throw new Error(`Instalação local inválida: ${id}. Importação cancelada.`);
          const result = await execFile('git', ['rev-parse', '--verify', `${sha}^{commit}`], { cwd: checkout, windowsHide: true });
          if (result.stdout.trim() !== sha) throw new Error(`Revisão local inválida: ${id}. Importação cancelada.`);
        }
        if (operational) await quarantineGrants(value, quarantined);
      }
      docs.push([keyFor(full), value]);
    }
    if (Object.keys(quarantined).length) docs.push([keyFor(path.join(root, 'legacy-quarantined-grants.json')), quarantined]);
    const settingsDir = path.join(root, 'plugin-settings');
    for (const entry of await paths(settingsDir)) if (entry.isFile() && /^[a-z0-9-]+\.json$/.test(entry.name)) {
      const file = path.join(settingsDir, entry.name); docs.push([keyFor(file), await rawJson(file, {})]);
    }
    const usersDir = path.join(root, 'plugin-user-settings');
    for (const plugin of await paths(usersDir)) if (plugin.isDirectory() && /^[a-z0-9-]+$/.test(plugin.name)) {
      const dir = path.join(usersDir, plugin.name);
      for (const entry of await paths(dir)) if (entry.isFile() && /^[0-9a-f]{64}\.json$/.test(entry.name)) {
        const file = path.join(dir, entry.name); docs.push([keyFor(file), await rawJson(file, {})]);
      }
    }
    let audit = '';
    try { audit = await fs.readFile(path.join(root, 'plugin-audit.jsonl'), 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const events = audit.split(/\r?\n/).filter(Boolean).map((line, index) => [createHash('sha256').update(`${index}:${line}`).digest('hex'), JSON.parse(line)]);
    const client = localDir ? db : await db.connect();
    try {
      await client.query('begin');
      for (const [key, value] of docs) await client.query('insert into one_system.plugin_documents (key,value) values ($1,$2::jsonb) on conflict (key) do nothing', [key, JSON.stringify(value)]);
      for (const [key, value] of events) await client.query('insert into one_system.plugin_legacy_audit (event_key,event) values ($1,$2::jsonb) on conflict (event_key) do nothing', [prefix + key, JSON.stringify(value)]);
      await client.query('insert into one_system.plugin_documents (key,value) values ($1,$2::jsonb) on conflict (key) do nothing', [importMarker, JSON.stringify({ importedAt: new Date().toISOString() })]);
      await client.query('commit');
      return true;
    } catch (error) { await client.query('rollback'); throw error; }
    finally { if (!localDir) client.release(); }
  };
  try { await importLegacy(); }
  catch (error) { if (lease) lease.release(); if (localDir) await db.close(); else await db.end(); throw error; }
  let queue = Promise.resolve();
  return {
    operational,
    hasMembership,
    async read(file, fallback) {
      const result = await db.query('select value from one_system.plugin_documents where key=$1', [keyFor(file)]);
      return result.rows.length ? result.rows[0].value : fallback;
    },
    write(file, value) {
      const key = keyFor(file); const snapshot = JSON.stringify(value);
      const task = queue.then(() => db.query('insert into one_system.plugin_documents (key,value) values ($1,$2::jsonb) on conflict (key) do update set value=excluded.value, updated_at=now()', [key, snapshot]));
      queue = task.catch(() => {});
      return task;
    },
    async appendAudit(event) {
      await db.query('insert into one_system.plugin_legacy_audit (event_key,event) values ($1,$2::jsonb)', [prefix + event.id, JSON.stringify(namespace ? { ...event, testNamespace: namespace } : event)]);
    },
    async close() { await queue; if (lease) lease.release(); if (localDir) await db.close(); else await db.end(); },
  };
}
