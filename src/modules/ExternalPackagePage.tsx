import * as React from 'react';
import { useEffect, useState, type FormEvent } from 'react';
import { Boxes, FileSearch, LoaderCircle, Package, Puzzle, RefreshCw, Search, type LucideIcon } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ModuleManifest } from '@/platform/types';
import { externalPackageById, gitInstallById, pluginRequestHeaders, type ExternalPackagePage as PageDefinition, type ExternalPluginPackage } from '@/platform/externalPackages';
import { Badge, EmptyState, KV, PageHeader } from '@/ui/core';
import { useDemo } from '@/platform/store';

const PACKAGE_ICONS: Record<ExternalPluginPackage['icon'], LucideIcon> = {
  Puzzle,
  Package,
  Boxes,
  FileSearch,
};

function ExternalPackagePage({ packageId, path }: { packageId: string; path: string }) {
  const plugin = externalPackageById(packageId);
  const page = plugin?.pages.find((candidate) => candidate.path === path);
  if (!plugin || !page) return <EmptyState title="Pacote externo indisponível" text="O manifesto desta página não está instalado neste navegador." />;
  return <PackagePage plugin={plugin} page={page} />;
}

function PackagePage({ plugin, page }: { plugin: ExternalPluginPackage; page: PageDefinition }) {
  const Icon = PACKAGE_ICONS[plugin.icon];
  if (page.kind === 'react') return <PackageReactPage plugin={plugin} page={page} />;
  if (page.configuration) return <PackageConfiguration plugin={plugin} page={page} />;
  if (page.kind === 'list' || page.kind === 'detail') return <PackageDataPage plugin={plugin} page={page} />;
  return (
    <>
      <PageHeader
        crumbs={[{ label: plugin.name }, { label: page.title }]}
        title={page.title}
        eyebrow={<div style={{ marginBottom: 8 }}><Badge tone="accent"><Icon size={13} />Plugin externo · manifesto v1</Badge></div>}
        sub={page.description || plugin.description}
      />
      {page.sections?.length ? (
        <div className="grid-2">
          {page.sections.map((section) => (
            <section className="card card-pad" key={section.title}>
              <h2 className="h3">{section.title}</h2>
              <p className="small muted" style={{ marginTop: 8, whiteSpace: 'pre-line' }}>{section.body}</p>
            </section>
          ))}
        </div>
      ) : <div className="card"><EmptyState title="Página declarada pelo plugin" text="O pacote não incluiu seções de conteúdo nesta rota." /></div>}
      <p className="xs muted" style={{ marginTop: 14 }}>Esta prova carrega apenas manifesto JSON validado. O núcleo renderiza a página com os componentes e o contexto do The One System; nenhum JavaScript do ZIP é executado.</p>
    </>
  );
}

type ReactPluginProps = {
  react: typeof React;
  context: { brandId: string; userId: string; params: Readonly<Record<string, string | undefined>>; navigate: (path: string) => void; operation: (id: string, inputs?: Record<string, string | number>) => Promise<unknown> };
};

class PluginPageBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="banner banner-danger" role="alert">A página do plugin não pôde ser exibida.</div> : this.props.children;
  }
}

function PackageReactPage({ plugin, page }: { plugin: ExternalPluginPackage; page: PageDefinition }) {
  const { pluginAuthReady, pluginAuthIdentity, company, me } = useDemo();
  const params = useParams();
  const navigate = useNavigate();
  const [component, setComponent] = useState<React.ComponentType<ReactPluginProps> | null>(null);
  const [error, setError] = useState('');
  const install = gitInstallById(plugin.id);
  const commit = install?.commit;
  const index = plugin.pages.findIndex((item) => item.path === page.path);
  const waiting = import.meta.env.DEV && !!me && pluginAuthIdentity !== me.id + ':' + company;
  useEffect(() => {
    setComponent(null);
    setError('');
    if (!pluginAuthReady || waiting || !me) return;
    if (!commit || index < 0) { setError('Componente disponível somente para plugins instalados pelo Git.'); return; }
    let alive = true;
    let objectUrl = '';
    const load = async () => {
      try {
        const response = await fetch(`/api/plugins/${encodeURIComponent(plugin.id)}/components/${index}?commit=${encodeURIComponent(commit)}`, { headers: await pluginRequestHeaders(), cache: 'no-store' });
        if (!response.ok) throw new Error('Não foi possível carregar a página autorizada do plugin.');
        const script = await response.text();
        if (!alive) return;
        objectUrl = URL.createObjectURL(new Blob([script], { type: 'text/javascript' }));
        const module = await import(/* @vite-ignore */ objectUrl) as { default?: React.ComponentType<ReactPluginProps> };
        if (typeof module.default !== 'function') throw new Error('O componente do plugin é inválido.');
        if (alive) setComponent(() => module.default!);
      } catch (reason) { if (alive) setError(reason instanceof Error ? reason.message : 'Falha ao carregar o plugin.'); }
    };
    void load();
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [plugin.id, index, commit, company, me?.id, pluginAuthReady, pluginAuthIdentity, waiting]);
  if (error) return <div className="banner banner-danger" role="alert">{error}</div>;
  if (!component || !me) return <div className="small muted">Carregando página do plugin…</div>;
  const operation = async (id: string, inputs: Record<string, string | number> = {}) => {
    const declared = plugin.operations.find((item) => item.id === id);
    if (!declared) throw new Error('Operação não declarada.');
    if (Object.keys(inputs).some((key) => !declared.inputs.some((input) => input.name === key))) throw new Error('Parâmetro não declarado.');
    const query = new URLSearchParams();
    const body: Record<string, string | number> = {};
    for (const input of declared.inputs) if (inputs[input.name] != null) {
      if (input.location === 'body') body[input.name] = inputs[input.name]; else query.set(input.name, String(inputs[input.name]));
    }
    const response = await fetch(`/api/plugins/${encodeURIComponent(plugin.id)}/operations/${encodeURIComponent(id)}?${query}`, { method: declared.method, headers: await pluginRequestHeaders(declared.method === 'POST' ? { 'content-type': 'application/json', 'x-horizon-plugin-commit': commit! } : {}), ...(declared.method === 'POST' ? { body: JSON.stringify(body) } : {}), cache: 'no-store' });
    const result = await response.json() as { data?: unknown; error?: string };
    if (!response.ok) throw new Error(result.error || 'Operação não autorizada ou indisponível.');
    return result.data;
  };
  return <PluginPageBoundary key={commit + ':' + page.path}>{React.createElement(component, { react: React, context: { brandId: company, userId: me.id, params, navigate: (path) => { if (path === plugin.basePath || path.startsWith(plugin.basePath + '/')) navigate(path); }, operation } })}</PluginPageBoundary>;
}

type PluginRecord = Record<string, unknown>;
function fieldValue(record: PluginRecord, field: string): string {
  const value = field.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[part];
  }, record);
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join(', ');
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function pluginFailure(code: string, fallback: string): string {
  const messages: Record<string, string> = {
    no_session: 'Entre com uma conta The One System autorizada para consultar este plugin.',
    permission_denied: 'Acesso negado: a conta não recebeu a permissão de consulta para este plugin.',
    brand_disabled: 'Acesso negado: o plugin não está habilitado para o ambiente ativo.',
    source_denied: 'A fonte negou acesso para a conta ou para o ambiente ativo.',
    missing_config: 'Conexão ausente: a TI precisa configurar a fonte deste plugin.',
    unavailable: 'Serviço indisponível: não foi possível concluir a consulta.',
    invalid_response: 'A fonte respondeu fora do contrato de dados deste plugin.',
    record_not_found: 'O registro não foi encontrado na fonte autorizada.',
  };
  return messages[code] ?? fallback;
}

function PackageDataPage({ plugin, page }: { plugin: ExternalPluginPackage; page: PageDefinition }) {
  const Icon = PACKAGE_ICONS[plugin.icon];
  const { pluginAuthReady, pluginAuthIdentity, company, me } = useDemo();
  const routeParams = useParams();
  const [records, setRecords] = useState<PluginRecord[]>([]);
  const [record, setRecord] = useState<PluginRecord | null>(null);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requestId, setRequestId] = useState(0);
  const operation = plugin.operations.find((item) => item.id === page.operationId);
  const recordId = page.recordIdParam ? routeParams[page.recordIdParam] : undefined;
  const isList = page.kind === 'list';
  const waitingForSession = import.meta.env.DEV && !!me && pluginAuthIdentity !== me.id + ':' + company;

  useEffect(() => {
    if (!pluginAuthReady || waitingForSession || !operation) return;
    let current = true;
    setLoading(true);
    setError('');
    const query = new URLSearchParams();
    if (isList && page.search && search) query.set(page.search.input, search);
    if (!isList && page.recordIdParam && recordId) query.set(page.recordIdParam, recordId);
    const load = async () => {
      try {
        const response = await fetch('/api/plugins/' + encodeURIComponent(plugin.id) + '/operations/' + encodeURIComponent(operation.id) + (query.size ? '?' + query.toString() : ''), {
          headers: await pluginRequestHeaders(),
          cache: 'no-store',
        });
        const result = await response.json() as { data?: unknown; code?: string; error?: string };
        if (!response.ok) throw new Error(pluginFailure(result.code ?? '', result.error ?? 'Não foi possível concluir a consulta.'));
        if (!current) return;
        if (isList) setRecords(Array.isArray(result.data) ? result.data as PluginRecord[] : []);
        else setRecord(result.data && typeof result.data === 'object' && !Array.isArray(result.data) ? result.data as PluginRecord : null);
      } catch (reason) {
        if (current) setError(reason instanceof Error ? reason.message : 'Não foi possível concluir a consulta.');
      } finally { if (current) setLoading(false); }
    };
    void load();
    return () => { current = false; };
  }, [pluginAuthReady, waitingForSession, pluginAuthIdentity, me?.id, plugin.id, operation?.id, isList, page.search?.input, page.recordIdParam, recordId, search, company, requestId]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(draft.trim());
  };
  const retry = () => setRequestId((value) => value + 1);
  const demo = plugin.id === 'horizon-plugin-demo';
  const title = !isList && record ? fieldValue(record, 'title') : page.title;
  const detailUrl = (item: PluginRecord) => {
    const id = fieldValue(item, page.recordIdField || 'id');
    return (page.detailPath || plugin.basePath).replace(/:[A-Za-z][A-Za-z0-9_]*/, encodeURIComponent(id));
  };

  return (
    <>
      <PageHeader
        crumbs={isList ? [{ label: plugin.name }, { label: page.title }] : [{ label: plugin.name }, { label: 'Lista', to: plugin.basePath }, { label: title }]}
        title={title}
        eyebrow={<div style={{ marginBottom: 8 }}><Badge tone="accent"><Icon size={13} />Consulta do plugin</Badge></div>}
        sub={page.description || plugin.description}
        actions={<button className="btn btn-secondary" type="button" onClick={retry} disabled={loading}><RefreshCw size={15} />Atualizar</button>}
      />
      {demo && <div className="banner banner-info" style={{ marginBottom: 16 }}><span className="b-text">Dados fictícios da API própria do Plugin Demo. Esta tela valida o contrato de conexão e consulta do The One System.</span></div>}
      {isList && page.search && (
        <div className="card">
          <form className="list-tools" onSubmit={submitSearch}>
            <div className="tools-row">
              <div className="input-icon"><Search size={17} /><input className="input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={page.search?.placeholder || 'Buscar'} aria-label={page.search.placeholder || 'Buscar'} /></div>
              <button className="btn btn-primary" type="submit">Buscar</button>
              {!!search && <button className="btn btn-ghost" type="button" onClick={() => { setDraft(''); setSearch(''); }}>Limpar</button>}
            </div>
          </form>
        </div>
      )}
      {loading || !pluginAuthReady || waitingForSession ? (
        <div className="card" style={{ marginTop: isList && page.search ? 16 : 0 }}><EmptyState title="Consultando a fonte" text="Aguarde enquanto o servidor The One System valida a sessão, a marca e a conexão do plugin." icon={<LoaderCircle size={22} className="spin" />} /></div>
      ) : error ? (
        <div className="card" style={{ marginTop: isList && page.search ? 16 : 0 }}><EmptyState title="Consulta não concluída" text={error} icon={<RefreshCw size={22} />} action={<button className="btn btn-secondary btn-sm" onClick={retry}>Tentar novamente</button>} /></div>
      ) : isList ? records.length === 0 ? (
        <div className="card" style={{ marginTop: isList && page.search ? 16 : 0 }}><EmptyState title="Nenhum registro autorizado" text="A fonte não retornou registros para os filtros e a marca ativos." /></div>
      ) : (
        <div className="card" style={{ marginTop: page.search ? 16 : 0 }}>
          <div className="table-wrap responsive">
            <table className="tbl">
              <thead><tr>{page.columns?.map((column) => <th key={column.field}>{column.label}</th>)}<th><span className="sr-only">Abrir registro</span></th></tr></thead>
              <tbody>{records.map((item) => <tr key={fieldValue(item, page.recordIdField || 'id')}>
                {page.columns?.map((column) => <td key={column.field}>{fieldValue(item, column.field)}</td>)}
                <td className="row-action"><Link className="btn btn-ghost btn-xs" to={detailUrl(item)}>Consultar</Link></td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="card-foot xs muted">{records.length} registro(s) retornado(s) pela fonte do plugin.</div>
        </div>
      ) : record ? (
        <div className="stack">
          <div className="card card-pad"><KV items={(page.fields ?? []).map((field) => [field.label, fieldValue(record, field.field)])} /></div>
          {Array.isArray(record.movements) && record.movements.length > 0 && <div className="card">
            <div className="card-head"><h2>Movimentações</h2></div>
            <div className="card-body stack-sm">{record.movements.map((item, index) => {
              const movement = item && typeof item === 'object' ? item as PluginRecord : {};
              return <div className="row" key={index}><span className="badge badge-neutral">{fieldValue(movement, 'at')}</span><span>{fieldValue(movement, 'label')}</span></div>;
            })}</div>
          </div>}
          <div><Link className="btn btn-secondary" to={plugin.basePath}>Voltar à lista</Link></div>
        </div>
      ) : <div className="card"><EmptyState title="Registro indisponível" text="A fonte não retornou uma ficha autorizada." /></div>}
      <p className="xs muted" style={{ marginTop: 14 }}>Consulta declarada no manifesto e executada pelo servidor The One System com sessão assinada, marca ativa e permissão atual.</p>
    </>
  );
}

function PackageConfiguration({ plugin, page }: { plugin: ExternalPluginPackage; page: PageDefinition }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const configuration = plugin.userConfiguration;

  useEffect(() => {
    let active = true;
    pluginRequestHeaders().then((headers) => fetch('/api/plugins/user-settings/' + encodeURIComponent(plugin.id), { headers }))
      .then(async (response) => {
        if (!response.ok) { const error = await response.json() as { error?: string }; throw new Error(error.error || (response.status === 403 ? 'Acesso negado: permissão editar necessária.' : 'Não foi possível ler as preferências pessoais do plugin.')); }
        return response.json() as Promise<{ settings?: Record<string, string> }>;
      })
      .then((result) => { if (active) setSettings(result.settings ?? {}); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Falha ao carregar a configuração.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [plugin.id]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError(''); setSaved(false);
    try {
      const response = await fetch('/api/plugins/user-settings/' + encodeURIComponent(plugin.id), {
        method: 'POST', headers: await pluginRequestHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ settings }),
      });
      const result = await response.json() as { error?: string; settings?: Record<string, string> };
      if (!response.ok) throw new Error(result.error || 'Não foi possível guardar a configuração.');
      setSettings(result.settings ?? settings); setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao guardar a configuração.');
    } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader crumbs={[{ label: plugin.name }, { label: page.title }]} title={page.title}
        eyebrow={<div style={{ marginBottom: 8 }}><Badge tone="accent"><Puzzle size={13} />Configuração · permissão editar</Badge></div>}
        sub={configuration?.description || page.description || plugin.description} />
      <form className="card" onSubmit={save}>
        <div className="card-head"><h2>{configuration?.title || page.title}</h2></div>
        <div className="card-body stack">
          {loading ? <div className="small muted">Lendo configuração segura do servidor…</div> : null}
          {configuration?.fields.map((field) => (
            <label className="field" key={field.id}>
              <span>{field.label}{field.required ? ' *' : ''}</span>
              <input className="input" type={field.type} required={field.required} placeholder={field.placeholder}
                value={settings[field.id] ?? ''} onChange={(event) => { setSaved(false); setSettings((current) => ({ ...current, [field.id]: event.target.value })); }} />
            </label>
          ))}
          {plugin.connections?.map((connection) => <div className="xs muted" key={connection.id}>Verificação: {connection.label} · {connection.healthPath}</div>)}
          {error && <div className="banner banner-danger" role="alert"><span className="b-text">{error}</span></div>}
          {saved && <div className="banner banner-info" role="status"><span className="b-text">Configuração guardada no servidor The One System.</span></div>}
          <div><button className="btn btn-primary" type="submit" disabled={loading || saving || !configuration?.fields.length}>{saving ? 'Salvando…' : 'Salvar configuração'}</button></div>
        </div>
      </form>
      {!configuration?.fields.length && <div className="card"><EmptyState title="Nenhuma configuração declarada" text="Este plugin não declarou campos de configuração." /></div>}
    </>
  );
}

export function externalPackageModule(plugin: ExternalPluginPackage): ModuleManifest {
  const Icon = PACKAGE_ICONS[plugin.icon];
  return {
    id: plugin.id,
    name: plugin.name,
    description: plugin.description,
    icon: Icon,
    basePath: plugin.basePath,
    version: plugin.version,
    menu: plugin.menu,
    actions: plugin.actions,
    requirements: plugin.requirements,
    business: plugin.business,
    contributes: { recordPath: () => plugin.basePath },
    routes: plugin.pages.map((page) => ({
      path: page.path,
      mode: page.mode,
      requires: page.requires,
      element: () => <ExternalPackagePage packageId={plugin.id} path={page.path} />,
    })),
  };
}
