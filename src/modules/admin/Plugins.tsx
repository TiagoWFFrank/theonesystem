import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Download, Loader2, PackageX, Power, ShieldCheck, Wrench } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { ROLE_LABEL, ROLES } from '@/platform/permissions';
import { BackToList, Badge, Confirm, Dialog, EmptyState, PageHeader, Tabs, type Tone } from '@/ui/core';
import { COMPANIES } from '@/ui/brand';
import { useToast } from '@/ui/toast';
import { ForbiddenInline, NotFoundInline } from '@/pages/NotFound';
import { PLUGINS, pluginById } from '../plugins';
import type { BrandId, ModuleId, PluginState, RoleId } from '@/platform/types';

const PSTATUS: Record<PluginState['status'], { label: string; tone: Tone }> = {
  disponivel: { label: 'Disponível', tone: 'neutral' }, instalado: { label: 'Instalado', tone: 'ok' }, desativado: { label: 'Desativado', tone: 'warn' },
};
type Filter = 'todos' | PluginState['status'];

export function PluginCatalog() {
  const { data, can } = useDemo();
  const [filter, setFilter] = useState<Filter>('todos');
  const list = PLUGINS.map((p) => ({ m: p, s: data.plugins.find((x) => x.id === p.id)! })).filter(({ s }) => filter === 'todos' || s.status === filter);
  const count = (f: PluginState['status']) => data.plugins.filter((p) => p.status === f).length;
  if (!can('admin', 'plugins')) return <ForbiddenInline module="Catálogo de plugins" />;
  return (
    <>
      <PageHeader crumbs={[{ label: 'Administração' }, { label: 'Catálogo de plugins' }]} title="Catálogo de plugins"
        sub="Cada funcionalidade da plataforma é um plugin com identidade própria, permissões declaradas e habilitação por ambiente." />
      <div className="card">
        <Tabs<Filter> value={filter} onChange={setFilter} tabs={[
          { id: 'todos', label: 'Todos', count: data.plugins.length }, { id: 'disponivel', label: 'Disponíveis', count: count('disponivel') },
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
    </>
  );
}

export function PluginDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, update, log, company, can } = useDemo();
  const m = pluginById(id as ModuleId);
  const s = data.plugins.find((x) => x.id === id);
  const [install, setInstall] = useState(false);
  const [disable, setDisable] = useState(false);
  const [maint, setMaint] = useState(false);
  if (!m || !s) return <NotFoundInline what="plugin" back="/admin/plugins" />;
  if (!can('admin', 'plugins')) return <ForbiddenInline module="Catálogo de plugins" />;

  const toggleCompany = (b: BrandId) => {
    const on = s.companies.includes(b);
    update((d) => { const p = d.plugins.find((x) => x.id === m.id)!; p.companies = on ? p.companies.filter((c) => c !== b) : [...p.companies, b]; });
    log({ module: 'admin', recordId: `plugin-${m.id}`, recordLabel: m.name, action: `${m.name} ${on ? 'desabilitado' : 'habilitado'} para ${COMPANIES[b].name}` });
    toast(<>{m.name} {on ? 'desabilitado' : 'habilitado'} para <b>{COMPANIES[b].name}</b>.</>);
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
          {s.status === 'desativado' && <button className="btn btn-primary" onClick={() => { update((d) => { d.plugins.find((x) => x.id === m.id)!.status = 'instalado'; }); log({ module: 'admin', recordId: `plugin-${m.id}`, recordLabel: m.name, action: `${m.name} reativado` }); toast(<>{m.name} reativado.</>); }}><Power size={16} />Reativar</button>}
        </>} />
      <div className="layout-detail">
        <div className="stack">
          <div className="card"><div className="card-head"><h2>Como passa a integrar a plataforma</h2><span className="xs muted" style={{ marginLeft: 'auto' }}>Manifesto v{s.version}</span></div>
            <div className="card-body">
              <p style={{ marginBottom: 16 }}>{m.description}</p>
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
        onConfirm={() => { update((d) => { d.plugins.find((x) => x.id === m.id)!.status = 'desativado'; }); log({ module: 'admin', recordId: `plugin-${m.id}`, recordLabel: m.name, action: `${m.name} desativado` }); toast(<>{m.name} desativado.</>); }}>
        <div className="banner banner-warn"><span className="b-text">Impacto: {s.companies.length} {s.companies.length === 1 ? 'ambiente' : 'ambientes'} e os perfis {Array.from(new Set(s.companies.flatMap(rolesWithAccess))).map((r) => ROLE_LABEL[r].split(' ')[0]).join(', ') || '—'} perderão o acesso.</span></div>
      </Confirm>
      <Confirm open={maint} onClose={() => setMaint(false)} confirmLabel={s.maintenance ? 'Encerrar manutenção' : 'Colocar em manutenção'} title={s.maintenance ? 'Encerrar manutenção?' : `Colocar ${m.name} em manutenção?`}
        desc={s.maintenance ? 'O módulo volta a abrir normalmente.' : 'O módulo continua no menu, mas exibe uma mensagem de manutenção. As demais áreas seguem disponíveis.'}
        onConfirm={() => { update((d) => { const p = d.plugins.find((x) => x.id === m.id)!; p.maintenance = !p.maintenance; }); log({ module: 'admin', recordId: `plugin-${m.id}`, recordLabel: m.name, action: `${m.name}: manutenção ${s.maintenance ? 'encerrada' : 'iniciada'}` }); toast(<>{m.name}: manutenção {s.maintenance ? 'encerrada' : 'iniciada'}.</>); }} />
    </>
  );
}

const STEPS = ['Conferência do pacote (assinatura e compatibilidade)', 'Registro de menus, permissões e funcionalidades', 'Conclusão'];
function InstallFlow({ open, onClose, pluginId, defaultCompany, onDone }: { open: boolean; onClose: () => void; pluginId: ModuleId; defaultCompany: BrandId; onDone: () => void }) {
  const { update, log } = useDemo();
  const toast = useToast();
  const m = pluginById(pluginId)!;
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
      const p = d.plugins.find((x) => x.id === pluginId)!;
      p.status = 'instalado'; p.companies = companies;
      for (const b of companies) for (const r of roles) {
        d.permissions[b] ??= {};
        d.permissions[b][r] ??= {};
        d.permissions[b][r]![pluginId] = { actions: m.actions.map((a) => a.id), scope: 'empresa' };
      }
    });
    log({ module: 'admin', recordId: `plugin-${pluginId}`, recordLabel: m.name, action: `${m.name} instalado (simulação) · ${companies.map((c) => COMPANIES[c].name).join(', ')} · perfis ${roles.map((r) => ROLE_LABEL[r].split(' ')[0]).join(', ')}` });
    toast(<><b>{m.name}</b> instalado e disponível no menu.</>);
    onClose();
    if (companies.includes(defaultCompany)) onDone();
  };
  const toggle = <T,>(l: T[], v: T) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);

  return (
    <Dialog open={open} onClose={onClose} title={`Instalar ${m.name}`} desc="Instalação simulada · demonstra o resultado esperado do mecanismo futuro." size="wide"
      footer={phase === 'config' ? <><button className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={!companies.length || !roles.length} onClick={finish}><Check size={17} />Concluir instalação</button></> : undefined}>
      <div className="steps" style={{ marginBottom: 20 }}>
        {STEPS.map((l, i) => (
          <div key={l} className={`step ${step > i ? 'done' : step === i ? 'run' : ''}`}>
            <span className="ic">{step > i ? <Check size={15} /> : step === i ? <Loader2 size={15} className="spin" /> : i + 1}</span>
            <span className={step >= i ? 'strong' : 'muted'}>{l}</span>
            {i === 0 && step > 0 && <span className="xs muted">· assinatura e compatibilidade verificadas</span>}
            {i === 1 && step > 1 && <span className="xs muted">· {m.menu.length} rota(s), {m.actions.length} permissões</span>}
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
