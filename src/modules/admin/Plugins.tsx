import { useEffect, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Download, GitBranch, Loader2, PackagePlus, PackageX, Power, ShieldCheck, Wrench } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { ROLE_LABEL, ROLES } from '@/platform/permissions';
import { BackToList, Badge, Confirm, Dialog, EmptyState, PageHeader, Tabs, type Tone } from '@/ui/core';
import { COMPANIES } from '@/ui/brand';
import { useToast } from '@/ui/toast';
import { ForbiddenInline, NotFoundInline } from '@/pages/NotFound';
import { PLUGINS, pluginById } from '../plugins';
import { externalPackageById, gitInstallById, pluginRequestHeaders, readExternalPackageZip, saveExternalPackage, updateGitPluginInstallAccess, type ExternalPluginPackage } from '@/platform/externalPackages';
import type { BrandId, ModuleId, PluginState, RoleId } from '@/platform/types';

const PSTATUS: Record<PluginState['status'], { label: string; tone: Tone }> = {
  disponivel: { label: 'Disponível', tone: 'neutral' }, instalado: { label: 'Instalado', tone: 'ok' }, desativado: { label: 'Desativado', tone: 'warn' },
};
type Filter = 'todos' | PluginState['status'];

export function PluginCatalog() {
  const { data, can } = useDemo();
  const [filter, setFilter] = useState<Filter>('todos');
  const [importOpen, setImportOpen] = useState(false);
  const [gitOpen, setGitOpen] = useState(false);
  const list = PLUGINS.map((m) => {
    const existing = data.plugins.find((item) => item.id === m.id);
    const s: PluginState = existing ?? { id: m.id, version: m.version, status: 'disponivel', maintenance: false, companies: [] };
    return { m, s };
  }).filter(({ s }) => filter === 'todos' || s.status === filter);
  const count = (f: PluginState['status']) => PLUGINS.filter((m) => (data.plugins.find((item) => item.id === m.id)?.status ?? 'disponivel') === f).length;
  if (!can('admin', 'plugins')) return <ForbiddenInline module="Catálogo de plugins" />;
  return (
    <>
      <PageHeader crumbs={[{ label: 'Administração' }, { label: 'Catálogo de plugins' }]} title="Catálogo de plugins"
        sub="Cada funcionalidade da plataforma é um plugin com identidade própria, permissões declaradas e habilitação por ambiente."
        actions={<div className="row-wrap"><button className="btn btn-primary" onClick={() => setGitOpen(true)}><GitBranch size={17} />Instalar pelo Git</button><button className="btn btn-secondary" onClick={() => setImportOpen(true)}><PackagePlus size={17} />Pacote ZIP local</button></div>} />
      <div className="card">
        <Tabs<Filter> value={filter} onChange={setFilter} tabs={[
          { id: 'todos', label: 'Todos', count: PLUGINS.length }, { id: 'disponivel', label: 'Disponíveis', count: count('disponivel') },
          { id: 'instalado', label: 'Instalados', count: count('instalado') }, { id: 'desativado', label: 'Desativados', count: count('desativado') },
        ]} />
        <div className="card-body">
          {list.length === 0 ? <EmptyState icon={<PackageX size={22} />} title="Nenhum plugin nesta situação" /> : (
            <div className="mod-grid">
              {list.map(({ m, s }) => (
                <Link key={m.id} to={`/admin/plugins/${m.id}`} className="mod-tile">
                  <div className="row"><span className="mod-icon"><m.icon size={22} /></span><span className="spacer" /><Badge tone={PSTATUS[s.status].tone}>{PSTATUS[s.status].label}</Badge></div>
                  <div><h3>{m.name}</h3><p>{m.description}</p></div>
                  <div className="row xs muted" style={{ marginTop: 'auto' }}>
                    <span className="tnum">v{s.version}</span><span>·</span>
                    <span>{s.status === 'instalado' ? `${s.companies.length} ${s.companies.length === 1 ? 'ambiente' : 'ambientes'}` : 'Não habilitado'}</span>
                    {s.maintenance && <Badge tone="warn" plain>Em manutenção</Badge>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <ExternalPackageImport open={importOpen} onClose={() => setImportOpen(false)} />
      <GitInstallDialog open={gitOpen} onClose={() => setGitOpen(false)} />
    </>
  );
}

function ExternalPackageImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { log } = useDemo();
  const toast = useToast();
  const [candidate, setCandidate] = useState<ExternalPluginPackage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (open) { setCandidate(null); setError(''); setLoading(false); }
  }, [open]);

  const readPackage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setCandidate(null);
    setError('');
    if (!file) return;
    setLoading(true);
    try {
      setCandidate(await readExternalPackageZip(file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível validar o pacote.');
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    if (!candidate) return;
    try {
      saveExternalPackage(candidate);
      log({ module: 'admin', recordId: 'plugin-' + candidate.id, recordLabel: candidate.name, action: 'Pacote externo importado para o catálogo local · v' + candidate.version });
      toast(<>Pacote <b>{candidate.name}</b> adicionado ao catálogo. Habilite-o por ambiente e perfil.</>);
      onClose();
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível adicionar o pacote.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Adicionar pacote de plugin" desc="A prova local aceita um ZIP com horizon-plugin.json na raiz. O manifesto é validado; nenhum JavaScript do pacote é executado." size="wide"
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={!candidate || loading} onClick={save}><PackagePlus size={16} />Adicionar ao catálogo</button></>}>
      <div className="stack">
        <label className="field">
          <span>Arquivo ZIP</span>
          <input className="input" type="file" accept=".zip,application/zip" onChange={readPackage} />
          <span className="help">Até 500 KB. O instalador só lê o manifesto JSON e ignora os demais arquivos. A assinatura criptográfica ainda não é verificada.</span>
        </label>
        {loading && <div className="row small muted"><Loader2 size={16} className="spin" />Lendo o manifesto…</div>}
        {error && <div className="banner banner-danger" role="alert"><span className="b-text">{error}</span></div>}
        {candidate && (
          <div className="card card-pad">
            <div className="row"><b>{candidate.name}</b><span className="spacer" /><Badge tone="ok">Manifesto compatível</Badge></div>
            <p className="small muted" style={{ marginTop: 8 }}>{candidate.description}</p>
            <div className="xs muted" style={{ marginTop: 8 }}>id: <span className="mono">{candidate.id}</span> · v{candidate.version} · {candidate.menu.length} item(ns) de menu · {candidate.pages.length} rota(s) · {candidate.actions.length} ação(ões)</div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

type GitCheck = { status: string; detail: string; selected?: string; commit?: string; type?: string; name?: string; id?: string; label?: string; settingKey?: string };
type GitInstallResult = {
  attemptId: string;
  status: 'pending' | 'installed';
  manifest?: ExternalPluginPackage;
  checks: { repository: GitCheck; revision: GitCheck; compatibility: GitCheck; dependencies: GitCheck[]; connections: GitCheck[] };
};

function checkTone(status: string): Tone {
  if (status === 'ok') return 'ok';
  if (status === 'missing_config') return 'warn';
  return 'danger';
}

function CheckRow({ label, check }: { label: string; check: GitCheck }) {
  const names: Record<string, string> = { ok: 'Verificado', missing_config: 'Configuração ausente', denied: 'Acesso negado', unavailable: 'Indisponível', incompatible: 'Incompatível', not_found: 'Não encontrada', invalid: 'Inválida' };
  return <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}><div className="stack-sm" style={{ flex: 1, minWidth: 0 }}><b className="small">{label}</b><span className="xs muted">{check.detail}</span>{check.commit && <span className="xs mono">Commit {check.commit}</span>}</div><Badge tone={checkTone(check.status)}>{names[check.status] || check.status}</Badge></div>;
}

function GitInstallDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { update, log } = useDemo();
  const toast = useToast();
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [revisionType, setRevisionType] = useState<'tag' | 'commit'>('tag');
  const [revision, setRevision] = useState('');
  const [tags, setTags] = useState<{ name: string; commit: string }[]>([]);
  const [tagLoading, setTagLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attemptId, setAttemptId] = useState('');
  const [result, setResult] = useState<GitInstallResult | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setRepositoryUrl(''); setRevisionType('tag'); setRevision(''); setTags([]); setAttemptId(''); setResult(null); setSettings({}); setError('');
  }, [open]);

  const post = async <T,>(url: string, body: unknown): Promise<T> => {
    const response = await fetch(url, { method: 'POST', headers: await pluginRequestHeaders({ 'content-type': 'application/json' }), body: JSON.stringify(body) });
    const payload = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}.`);
    return payload;
  };

  const resetRevision = () => { setAttemptId(''); setResult(null); setError(''); };
  const loadTags = async () => {
    setTagLoading(true); setError('');
    try {
      const response = await post<{ repository: GitCheck; tags: { name: string; commit: string }[] }>('/api/plugins/git/revisions', { repositoryUrl });
      setTags(response.tags || []);
      if (response.tags?.length) setRevision((current) => current || response.tags[0].name);
      setResult({ attemptId: '', status: 'pending', checks: { repository: response.repository, revision: { status: 'unavailable', detail: 'Selecione uma revisão para continuar.' }, compatibility: { status: 'unavailable', detail: 'Ainda não verificado.' }, dependencies: [], connections: [] } });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível acessar o repositório.'); }
    finally { setTagLoading(false); }
  };

  const validate = async (knownAttemptId = attemptId) => {
    if (!revision.trim()) { setError(revisionType === 'tag' ? 'Selecione uma tag.' : 'Informe o SHA completo do commit.'); return; }
    const currentAttempt = knownAttemptId || crypto.randomUUID();
    setAttemptId(currentAttempt); setLoading(true); setError('');
    try {
      const validation = await post<GitInstallResult>('/api/plugins/git/install/validate', { repositoryUrl, revisionType, revision: revision.trim(), attemptId: currentAttempt });
      setResult(validation);
      if (validation.status === 'pending' && validation.manifest && validation.checks.connections.some((check) => check.status !== 'ok')) {
        try {
          const authHeaders = await pluginRequestHeaders();
          const saved = await fetch('/api/plugins/config/' + encodeURIComponent(validation.manifest.id) + '?attemptId=' + encodeURIComponent(currentAttempt), { headers: authHeaders, cache: 'no-store' });
          if (saved.ok) {
            const payload = await saved.json() as { settings?: Record<string, string> };
            setSettings((current) => ({ ...(payload.settings ?? {}), ...current }));
          }
        } catch { /* the pending report already states that the server configuration must be corrected */ }
      }
      if (validation.status === 'installed' && validation.manifest) {
        update((data) => {
          const saved = data.plugins.find((plugin) => plugin.id === validation.manifest!.id);
          if (saved) { saved.status = 'instalado'; saved.version = validation.manifest!.version; }
          else data.plugins.push({ id: validation.manifest!.id, version: validation.manifest!.version, status: 'instalado', maintenance: false, companies: [] });
        });
        log({ module: 'admin', recordId: `plugin-${validation.manifest.id}`, recordLabel: validation.manifest.name, action: `Instalado pelo Git · ${validation.checks.revision.commit}` });
        toast(<><b>{validation.manifest.name}</b> instalado. Habilite as marcas e permissões no detalhe do plugin.</>);
        onClose();
        window.setTimeout(() => window.location.reload(), 120);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'A validação Git falhou.'); }
    finally { setLoading(false); }
  };

  const saveAndRetry = async () => {
    if (!result?.manifest || !attemptId) return;
    setLoading(true); setError('');
    try {
      await post(`/api/plugins/config/${encodeURIComponent(result.manifest.id)}`, { attemptId, settings });
      await validate(attemptId);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a configuração.'); setLoading(false); }
  };

  const pendingConnections = !!result?.checks.connections.some((item) => item.status !== 'ok');
  const configFields = result?.manifest?.configuration?.fields ?? [];
  return (
    <Dialog open={open} onClose={onClose} title="Instalar pelo Git" desc="O servidor do The One System acessa o repositório, fixa a revisão exata, valida manifesto e dependências e só instala quando todas as conexões responderem." size="wide"
      footer={<><button className="btn btn-secondary" onClick={onClose}>Fechar</button><button className="btn btn-primary" disabled={loading || !repositoryUrl.trim() || !revision.trim()} onClick={() => void validate()}><GitBranch size={16} />{loading ? 'Validando…' : 'Validar e instalar'}</button></>}>
      <div className="stack">
        <label className="field"><span>URL do repositório</span><input className="input" type="url" autoComplete="url" placeholder="https://github.com/organizacao/plugin" value={repositoryUrl} onChange={(event) => { setRepositoryUrl(event.target.value); setTags([]); resetRevision(); }} /><span className="help">Repositórios privados usam a conexão Git configurada no servidor. Não inclua credenciais na URL.</span></label>
        <div className="row-wrap">
          <button className="btn btn-secondary" onClick={() => void loadTags()} disabled={tagLoading || !repositoryUrl.trim()}><GitBranch size={16} />{tagLoading ? 'Buscando tags…' : 'Listar tags'}</button>
          <label className="field" style={{ minWidth: 190 }}><span>Tipo de revisão</span><select className="input" value={revisionType} onChange={(event) => { setRevisionType(event.target.value as 'tag' | 'commit'); setRevision(''); resetRevision(); }}><option value="tag">Tag publicada</option><option value="commit">SHA completo</option></select></label>
          {revisionType === 'tag' ? <label className="field" style={{ minWidth: 220, flex: 1 }}><span>Tag</span>{tags.length ? <select className="input" value={revision} onChange={(event) => { setRevision(event.target.value); resetRevision(); }}>{tags.map((tag) => <option key={tag.name} value={tag.name}>{tag.name} · {tag.commit.slice(0, 8)}</option>)}</select> : <input className="input" value={revision} placeholder="Liste tags ou informe o nome" onChange={(event) => { setRevision(event.target.value); resetRevision(); }} />}</label> : <label className="field" style={{ minWidth: 280, flex: 1 }}><span>Commit SHA completo</span><input className="input mono" value={revision} placeholder="40 caracteres hexadecimais" onChange={(event) => { setRevision(event.target.value); resetRevision(); }} /></label>}
        </div>
        {result && <div className="card card-pad stack">
          <div className="row"><h3>Resultado das verificações</h3><span className="spacer" /><Badge tone={result.status === 'installed' ? 'ok' : 'warn'}>{result.status === 'installed' ? 'Instalação concluída' : 'Pendente'}</Badge></div>
          <CheckRow label="Acesso ao repositório" check={result.checks.repository} />
          <CheckRow label="Revisão selecionada" check={result.checks.revision} />
          <CheckRow label="Compatibilidade do manifesto" check={result.checks.compatibility} />
          {result.checks.dependencies.map((check) => <CheckRow key={check.name} label={`Dependência · ${check.name}`} check={check} />)}
          {result.checks.connections.map((check) => <CheckRow key={check.id} label={`Conexão · ${check.label}`} check={check} />)}
          {result.checks.revision.commit && <div className="xs muted">Essa revisão fica fixada no SHA acima; repetir a tentativa usa o mesmo commit.</div>}
        </div>}
        {pendingConnections && result?.manifest && <div className="card card-pad stack">
          <div><h3>Configurar conexão pendente</h3><p className="small muted" style={{ marginTop: 6 }}>A instalação permanece inativa. Corrija os campos no servidor e tente de novo com a mesma tag/commit.</p></div>
          {configFields.map((field) => <label className="field" key={field.id}><span>{field.label}{field.required ? ' *' : ''}</span><input className="input" type={field.type} required={field.required} placeholder={field.placeholder} value={settings[field.id] ?? ''} onChange={(event) => setSettings((current) => ({ ...current, [field.id]: event.target.value }))} /></label>)}
          <div><button className="btn btn-primary" disabled={loading || configFields.some((field) => field.required && !settings[field.id]?.trim())} onClick={() => void saveAndRetry()}>{loading ? 'Salvando e validando…' : 'Salvar configuração e tentar novamente'}</button></div>
        </div>}
        {result?.status === 'pending' && !pendingConnections && attemptId && <div><button className="btn btn-secondary" disabled={loading} onClick={() => void validate(attemptId)}>{loading ? 'Revalidando…' : 'Tentar novamente com a mesma revisão'}</button></div>}
        {error && <div className="banner banner-danger" role="alert"><span className="b-text">{error}</span></div>}
        <p className="xs muted">O instalador aceita manifestos declarativos validados. Ele não executa scripts de instalação nem JavaScript arbitrário do repositório.</p>
      </div>
    </Dialog>
  );
}

export function PluginDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, update, log, company, can } = useDemo();
  const m = pluginById(id as ModuleId);
  const gitInstall = gitInstallById(id || '');
  const savedState = data.plugins.find((x) => x.id === id);
  const s: PluginState | undefined = m ? savedState ?? { id: m.id, version: m.version, status: gitInstall ? 'instalado' : 'disponivel', maintenance: false, companies: [] } : undefined;
  const [install, setInstall] = useState(false);
  const [disable, setDisable] = useState(false);
  const [maint, setMaint] = useState(false);
  if (!m || !s) return <NotFoundInline what="plugin" back="/admin/plugins" />;
  if (!can('admin', 'plugins')) return <ForbiddenInline module="Catálogo de plugins" />;

  const toggleCompanyLocal = (b: BrandId) => {
    const on = s.companies.includes(b);
    update((d) => { const p = d.plugins.find((x) => x.id === m.id)!; p.companies = on ? p.companies.filter((c) => c !== b) : [...p.companies, b]; });
    log({ module: 'admin', recordId: `plugin-${m.id}`, recordLabel: m.name, action: `${m.name} ${on ? 'desabilitado' : 'habilitado'} para ${COMPANIES[b].name}` });
    toast(<>{m.name} {on ? 'desabilitado' : 'habilitado'} para <b>{COMPANIES[b].name}</b>.</>);
  };
  const toggleCompany = async (b: BrandId) => {
    const on = s.companies.includes(b);
    const enabledBrands = on ? s.companies.filter((c) => c !== b) : [...s.companies, b];
    if (gitInstall) {
      try {
        const response = await fetch('/api/plugins/' + encodeURIComponent(m.id) + '/access', {
          method: 'POST',
          headers: await pluginRequestHeaders({ 'content-type': 'application/json' }),
          body: JSON.stringify({ enabledBrands }),
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error || 'Não foi possível salvar as marcas habilitadas no servidor.');
        updateGitPluginInstallAccess(m.id, { enabledBrands });
      } catch (reason) {
        toast(reason instanceof Error ? reason.message : 'Não foi possível alterar o acesso do plugin.');
        return;
      }
    }
    toggleCompanyLocal(b);
  };
  const setGitActive = async (active: boolean) => {
    if (gitInstall) {
      try {
        const response = await fetch('/api/plugins/' + encodeURIComponent(m.id) + '/activation', {
          method: 'POST',
          headers: await pluginRequestHeaders({ 'content-type': 'application/json' }),
          body: JSON.stringify({ active }),
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar a ativação no servidor.');
        updateGitPluginInstallAccess(m.id, { active });
      } catch (reason) {
        toast(reason instanceof Error ? reason.message : 'Não foi possível atualizar a ativação do plugin.');
        return;
      }
    }
    update((d) => { d.plugins.find((x) => x.id === m.id)!.status = active ? 'instalado' : 'desativado'; });
    log({ module: 'admin', recordId: 'plugin-' + m.id, recordLabel: m.name, action: active ? m.name + ' reativado' : m.name + ' desativado' });
    toast(<>{m.name} {active ? 'reativado' : 'desativado'}.</>);
  };
  const rolesWithAccess = (b: BrandId) => ROLES.filter((r) => data.permissions[b]?.[r]?.[m.id]?.actions.length);

  return (
    <>
      <PageHeader crumbs={[{ label: 'Administração' }, { label: 'Catálogo de plugins', to: '/admin/plugins' }, { label: m.name }]}
        title={<span className="row" style={{ gap: 14 }}><span className="mod-icon"><m.icon size={22} /></span>{m.name}</span>}
        sub={<span className="row-wrap" style={{ gap: 10 }}><Badge tone={PSTATUS[s.status].tone}>{PSTATUS[s.status].label}</Badge>{s.maintenance && <Badge tone="warn">Em manutenção</Badge>}<span className="small muted tnum">Versão {s.version}</span></span>}
        actions={<>
          <BackToList fallback="/admin/plugins" />
          {s.status === 'disponivel' && <button className="btn btn-primary" onClick={() => setInstall(true)}><Download size={17} />Instalar</button>}
          {s.status === 'instalado' && <button className="btn btn-secondary" onClick={() => setMaint(true)}><Wrench size={16} />{s.maintenance ? 'Encerrar manutenção' : 'Colocar em manutenção'}</button>}
          {s.status === 'instalado' && <button className="btn btn-secondary" onClick={() => setDisable(true)}><Power size={16} />Desativar</button>}
          {s.status === 'desativado' && <button className="btn btn-primary" onClick={() => void setGitActive(true)}><Power size={16} />Reativar</button>}
        </>} />
      <div className="layout-detail">
        <div className="stack">
          <div className="card"><div className="card-head"><h2>Como passa a integrar a plataforma</h2><span className="xs muted" style={{ marginLeft: 'auto' }}>Manifesto v{s.version}</span></div>
            <div className="card-body">
              <p style={{ marginBottom: 16 }}>{m.description}</p>
              {gitInstall && <div className="banner banner-info" style={{ marginBottom: 16 }}><span className="b-text">Origem Git · {gitInstall.revisionType} <span className="mono">{gitInstall.revision}</span> · commit <span className="mono">{gitInstall.commit}</span></span></div>}
              <div className="flow">
                <div className={`node ${s.status === 'instalado' ? 'new' : ''}`}><b>Menus</b>{m.menu.map((x) => <div key={x.path} className="xs">{x.label} <span className="mono subtle">{x.path}</span></div>)}</div>
                <div className="arrow">+</div>
                <div className={`node ${s.status === 'instalado' ? 'new' : ''}`}><b>Permissões</b>{m.actions.map((a) => <div key={a.id} className="xs">{a.label}</div>)}<div className="xs muted" style={{ marginTop: 6 }}>Aparecem em Perfis e permissões e em Solicitar acesso.</div></div>
                <div className="arrow">+</div>
                <div className={`node ${s.status === 'instalado' ? 'new' : ''}`}><b>Funcionalidades</b><div className="xs">Telas e rotas próprias</div><div className="xs">Tarefas em Meu trabalho</div><div className="xs">Busca global e notificações</div><div className="xs">Exportação configurável</div></div>
              </div>
              <p className="xs muted" style={{ marginTop: 14 }}>A plataforma entrega identidade do ambiente, navegação, componentes e serviços comuns; o plugin declara o que oferece e o que exige.</p>
            </div>
          </div>
          <div className="card"><div className="card-head"><h2>Permissões declaradas</h2></div>
            <div className="card-body"><ul className="checklist">{m.actions.map((a) => <li key={a.id}><ShieldCheck size={15} />{a.label} <span className="xs subtle mono">{m.id}.{a.id}</span></li>)}</ul></div>
          </div>
          <div className="card"><div className="card-head"><h2>Requisitos</h2></div>
            <div className="card-body"><ul className="checklist">{m.requirements.map((r) => <li key={r}><Check size={15} className="ok-ic" />{r}</li>)}</ul></div>
          </div>
        </div>
        <aside className="card">
          <div className="card-head"><h3>Ambientes habilitados</h3></div>
          <div className="card-body stack">
            {s.status !== 'instalado' && <p className="small muted">{s.status === 'disponivel' ? 'Instale o plugin para habilitá-lo por ambiente.' : 'Plugin desativado: o menu foi removido de todos os ambientes; os dados estão preservados.'}</p>}
            {(Object.keys(COMPANIES) as BrandId[]).map((b) => (
              <div key={b} className="row" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div className="strong">{COMPANIES[b].name}</div>
                  <div className="xs muted">{s.companies.includes(b) ? `Perfis: ${rolesWithAccess(b).map((r) => ROLE_LABEL[r].split(' ')[0]).join(', ') || 'nenhum'}` : 'Não habilitado'}</div>
                </div>
                <label className="check" style={{ alignItems: 'center' }}>
                  <input type="checkbox" role="switch" aria-label={`Habilitar para ${COMPANIES[b].name}`} checked={s.companies.includes(b)} disabled={s.status !== 'instalado'} onChange={() => toggleCompany(b)} />
                </label>
              </div>
            ))}
          </div>
        </aside>
      </div>
      <InstallFlow open={install} onClose={() => setInstall(false)} pluginId={m.id} defaultCompany={company} onDone={() => nav(m.basePath)} />
      <Confirm open={disable} onClose={() => setDisable(false)} danger confirmLabel="Desativar plugin" title={`Desativar ${m.name}?`}
        desc="O módulo sai do menu de todos os ambientes. Todos os registros são preservados e o plugin pode ser reativado."
        onConfirm={() => setGitActive(false)}>
        <div className="banner banner-warn"><span className="b-text">Impacto: {s.companies.length} {s.companies.length === 1 ? 'ambiente' : 'ambientes'} e os perfis {Array.from(new Set(s.companies.flatMap(rolesWithAccess))).map((r) => ROLE_LABEL[r].split(' ')[0]).join(', ') || '—'} perderão o acesso.</span></div>
      </Confirm>
      <Confirm open={maint} onClose={() => setMaint(false)} confirmLabel={s.maintenance ? 'Encerrar manutenção' : 'Colocar em manutenção'} title={s.maintenance ? 'Encerrar manutenção?' : `Colocar ${m.name} em manutenção?`}
        desc={s.maintenance ? 'O módulo volta a abrir normalmente.' : 'O módulo continua no menu, mas exibe uma mensagem de manutenção. As demais áreas seguem disponíveis.'}
        onConfirm={() => { update((d) => { const p = d.plugins.find((x) => x.id === m.id)!; p.maintenance = !p.maintenance; }); log({ module: 'admin', recordId: `plugin-${m.id}`, recordLabel: m.name, action: `${m.name}: manutenção ${s.maintenance ? 'encerrada' : 'iniciada'}` }); toast(<>{m.name}: manutenção {s.maintenance ? 'encerrada' : 'iniciada'}.</>); }} />
    </>
  );
}

const STEPS = ['Receber pacote (demonstração)', 'Mapear menus, permissões e rotas incorporadas', 'Concluir demonstração'];
function InstallFlow({ open, onClose, pluginId, defaultCompany, onDone }: { open: boolean; onClose: () => void; pluginId: ModuleId; defaultCompany: BrandId; onDone: () => void }) {
  const { update, log } = useDemo();
  const toast = useToast();
  const m = pluginById(pluginId)!;
  const externalPackage = externalPackageById(pluginId);
  const steps = externalPackage
    ? ['Validar manifesto externo', 'Registrar menu, rotas e permissões', 'Instalar neste navegador']
    : STEPS;
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'running' | 'config'>('running');
  const [companies, setCompanies] = useState<BrandId[]>([defaultCompany]);
  const [roles, setRoles] = useState<RoleId[]>(['colaborador']);
  useEffect(() => {
    if (!open) return;
    setStep(0); setPhase('running'); setCompanies([defaultCompany]); setRoles(['colaborador']);
    const t1 = setTimeout(() => setStep(1), 1100);
    const t2 = setTimeout(() => setStep(2), 2200);
    const t3 = setTimeout(() => { setStep(3); setPhase('config'); }, 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [open, defaultCompany]);

  const finish = () => {
    update((d) => {
      const p = d.plugins.find((x) => x.id === pluginId);
      if (p) {
        p.status = 'instalado'; p.companies = companies;
      } else {
        d.plugins.push({ id: pluginId, version: m.version, status: 'instalado', maintenance: false, companies: [...companies] });
      }
      for (const b of companies) for (const r of roles) {
        d.permissions[b] ??= {};
        d.permissions[b][r] ??= {};
        d.permissions[b][r]![pluginId] = { actions: m.actions.map((a) => a.id), scope: 'empresa' };
      }
    });
    log({ module: 'admin', recordId: `plugin-${pluginId}`, recordLabel: m.name, action: `${m.name} ${externalPackage ? 'instalado localmente' : 'instalado (simulação)'} · ${companies.map((c) => COMPANIES[c].name).join(', ')} · perfis ${roles.map((r) => ROLE_LABEL[r].split(' ')[0]).join(', ')}` });
    toast(<><b>{m.name}</b> instalado e disponível no menu.</>);
    onClose();
    if (companies.includes(defaultCompany)) onDone();
  };
  const toggle = <T,>(l: T[], v: T) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);

  return (
    <Dialog open={open} onClose={onClose} title={`Instalar ${m.name}`} desc={externalPackage ? "Pacote declarativo externo lido do ZIP e gravado neste navegador; nenhum código do pacote é executado." : "Instalação demonstrativa de um módulo já incorporado ao build."} size="wide"
      footer={phase === 'config' ? <><button className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={!companies.length || !roles.length} onClick={finish}><Check size={17} />Concluir instalação</button></> : undefined}>
      <div className="steps" style={{ marginBottom: 20 }}>
        {steps.map((l, i) => (
          <div key={l} className={`step ${step > i ? 'done' : step === i ? 'run' : ''}`}>
            <span className="ic">{step > i ? <Check size={15} /> : step === i ? <Loader2 size={15} className="spin" /> : i + 1}</span>
            <span className={step >= i ? 'strong' : 'muted'}>{l}</span>
            {i === 0 && step > 0 && <span className="xs muted">· {externalPackage ? "manifesto estruturalmente validado; assinatura criptográfica não verificada" : "nenhuma assinatura de pacote externo foi verificada"}</span>}
            {i === 1 && step > 1 && <span className="xs muted">· manifesto {externalPackage ? "externo" : "incorporado"}: {m.menu.length} item(ns) de menu, {m.routes.length} rota(s), {m.actions.length} permissões</span>}
          </div>
        ))}
      </div>
      {phase === 'config' && (
        <div className="grid-2">
          <div>
            <div className="label" style={{ marginBottom: 10 }}>Ambientes com acesso</div>
            <div className="stack-sm">{(Object.keys(COMPANIES) as BrandId[]).map((b) => <label key={b} className="check"><input type="checkbox" checked={companies.includes(b)} onChange={() => setCompanies(toggle(companies, b))} />{COMPANIES[b].name}</label>)}</div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 10 }}>Perfis com acesso</div>
            <div className="stack-sm">{ROLES.map((r) => <label key={r} className="check"><input type="checkbox" checked={roles.includes(r)} onChange={() => setRoles(toggle(roles, r))} />{ROLE_LABEL[r]}</label>)}</div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
