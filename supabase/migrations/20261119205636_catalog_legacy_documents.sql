-- Compatibility store for the existing v1 catalog, including legacy non-UUID
-- identities and pending configurations. Backend access only.
begin;
create table one_system.plugin_documents (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
create table one_system.plugin_legacy_audit (
  event_key text primary key,
  event jsonb not null,
  imported_at timestamptz not null default now()
);
alter table one_system.plugin_documents enable row level security;
alter table one_system.plugin_legacy_audit enable row level security;
revoke all on one_system.plugin_documents, one_system.plugin_legacy_audit from public, anon, authenticated;
grant select, insert, update, delete on one_system.plugin_documents to service_role;
grant select, insert on one_system.plugin_legacy_audit to service_role;
commit;
