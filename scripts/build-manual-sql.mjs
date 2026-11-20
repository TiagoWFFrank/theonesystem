import { readFile, writeFile } from 'node:fs/promises';

const first = new URL('../supabase/migrations/20261119205630_central_plugin_catalog.sql', import.meta.url);
const second = new URL('../supabase/migrations/20261119205636_catalog_legacy_documents.sql', import.meta.url);
const out = new URL('../supabase/INSTALAR_MANUAL.sql', import.meta.url);
const body = (text) => text.replace(/^begin;\s*$/im, '').replace(/^commit;\s*$/im, '').trim();
const initial = body(await readFile(first, 'utf8'));
const compatibility = body(await readFile(second, 'utf8'));
const names = ['brands', 'brand_memberships', 'plugins', 'plugin_versions', 'plugin_install_attempts', 'plugin_installations', 'plugin_brands', 'plugin_actions', 'plugin_grants', 'plugin_settings', 'plugin_user_settings', 'plugin_audit'];
const quotedNames = names.map((name) => `'${name}'`).join(', ');
const sql = `-- The One System: execute no SQL Editor de um projeto Supabase autorizado.
-- Este arquivo não apaga dados. Se o schema já existir, valida sua presença
-- e preserva os dados; caso esteja incompleto, interrompe para revisão.
-- Execução manual não registra versões no histórico de migrações Supabase.
begin;
do $install$
begin
  if not exists (select 1 from pg_namespace where nspname = 'one_system') then
${initial}
  end if;
  if exists (select 1 from unnest(array[${quotedNames}]) as t(name) where to_regclass('one_system.' || t.name) is null) then
    raise exception 'Schema one_system existente está incompleto; revise as migrações antes de continuar.';
  end if;
end
$install$;
do $compatibility$
begin
  if to_regclass('one_system.plugin_documents') is null and to_regclass('one_system.plugin_legacy_audit') is null then
${compatibility}
  elsif to_regclass('one_system.plugin_documents') is null or to_regclass('one_system.plugin_legacy_audit') is null then
    raise exception 'Tabelas de compatibilidade estão incompletas; revise antes de continuar.';
  end if;
end
$compatibility$;
commit;
select 'The One System: schema verificado' as resultado;
`;
await writeFile(out, sql, 'utf8');
process.stdout.write('SQL manual gerado em supabase/INSTALAR_MANUAL.sql\n');
