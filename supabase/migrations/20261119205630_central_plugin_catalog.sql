-- Central catalog. The backend is the sole writer and reader until explicit,
-- reviewed client policies are added. Existing local files are not modified.
begin;

create schema one_system;
revoke all on schema one_system from public, anon, authenticated;
grant usage on schema one_system to service_role;

create table one_system.brands (
  id text primary key check (id ~ '^[a-z][a-z0-9_-]{0,79}$'),
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table one_system.brand_memberships (
  user_id uuid not null references auth.users(id) on delete restrict,
  brand_id text not null references one_system.brands(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, brand_id)
);

create table one_system.plugins (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{2,47}$'),
  name text not null check (length(trim(name)) > 0),
  repository text not null check (length(trim(repository)) > 0),
  created_at timestamptz not null default now()
);

create table one_system.plugin_versions (
  plugin_id text not null references one_system.plugins(id) on delete restrict,
  commit_sha text not null check (commit_sha ~ '^([0-9a-f]{40}|[0-9a-f]{64})$'),
  version text not null,
  revision_type text not null check (revision_type in ('tag', 'commit')),
  revision text not null,
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object'),
  checkout text not null,
  installed_at timestamptz not null default now(),
  primary key (plugin_id, commit_sha)
);

create table one_system.plugin_install_attempts (
  id uuid primary key,
  repository text not null,
  revision_type text not null check (revision_type in ('tag', 'commit')),
  revision text not null,
  commit_sha text check (commit_sha is null or commit_sha ~ '^([0-9a-f]{40}|[0-9a-f]{64})$'),
  staging_key text,
  status text not null check (status in ('pending', 'installed', 'failed')),
  checks jsonb not null default '{}'::jsonb check (jsonb_typeof(checks) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table one_system.plugin_installations (
  plugin_id text primary key references one_system.plugins(id) on delete restrict,
  commit_sha text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  foreign key (plugin_id, commit_sha) references one_system.plugin_versions(plugin_id, commit_sha) on delete restrict
);

create table one_system.plugin_brands (
  plugin_id text not null references one_system.plugin_installations(plugin_id) on delete restrict,
  brand_id text not null references one_system.brands(id) on delete restrict,
  enabled boolean not null default true,
  primary key (plugin_id, brand_id)
);

create table one_system.plugin_actions (
  plugin_id text not null references one_system.plugins(id) on delete restrict,
  action_id text not null check (action_id ~ '^[a-z][a-z0-9_]{0,47}$'),
  label text not null,
  primary key (plugin_id, action_id)
);

create table one_system.plugin_grants (
  plugin_id text not null,
  action_id text not null,
  user_id uuid not null,
  brand_id text not null,
  scope text not null check (scope in ('proprios', 'equipe', 'empresa')),
  created_at timestamptz not null default now(),
  primary key (plugin_id, action_id, user_id, brand_id),
  foreign key (plugin_id, action_id) references one_system.plugin_actions(plugin_id, action_id) on delete restrict,
  foreign key (user_id, brand_id) references one_system.brand_memberships(user_id, brand_id) on delete restrict,
  foreign key (plugin_id, brand_id) references one_system.plugin_brands(plugin_id, brand_id) on delete restrict
);

create table one_system.plugin_settings (
  plugin_id text primary key references one_system.plugins(id) on delete restrict,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  updated_at timestamptz not null default now()
);

create table one_system.plugin_user_settings (
  plugin_id text not null references one_system.plugins(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (plugin_id, user_id)
);

create table one_system.plugin_audit (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete restrict,
  brand_id text references one_system.brands(id) on delete restrict,
  plugin_id text references one_system.plugins(id) on delete restrict,
  operation_id text,
  outcome text not null,
  status integer,
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create index plugin_audit_plugin_occurred_idx on one_system.plugin_audit (plugin_id, occurred_at desc);
create index plugin_grants_user_brand_idx on one_system.plugin_grants (user_id, brand_id);

alter table one_system.brands enable row level security;
alter table one_system.brand_memberships enable row level security;
alter table one_system.plugins enable row level security;
alter table one_system.plugin_versions enable row level security;
alter table one_system.plugin_install_attempts enable row level security;
alter table one_system.plugin_installations enable row level security;
alter table one_system.plugin_brands enable row level security;
alter table one_system.plugin_actions enable row level security;
alter table one_system.plugin_grants enable row level security;
alter table one_system.plugin_settings enable row level security;
alter table one_system.plugin_user_settings enable row level security;
alter table one_system.plugin_audit enable row level security;

revoke all on all tables in schema one_system from public, anon, authenticated;
revoke all on all sequences in schema one_system from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema one_system to service_role;
grant usage, select on all sequences in schema one_system to service_role;
-- Normal application code only appends audit entries; maintenance requires an
-- owner-level migration and is deliberately separate from the service account.
revoke update, delete on one_system.plugin_audit from service_role;

commit;
