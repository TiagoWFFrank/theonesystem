import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Lock, Search, ShieldCheck, Unlock, UserCheck, UserPlus, X } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { useUrlState } from '@/platform/hooks';
import { BUSINESS_ACTIONS, effectiveGrant, isLeader, moduleAvailability, ROLE_LABEL, ROLES, SCOPE_LABEL } from '@/platform/permissions';
import { Avatar, BackToList, Badge, Confirm, EmptyState, ErrorState, KV, NoResults, PageHeader, SkeletonRows, useSimLoad, type Tone } from '@/ui/core';
import { COMPANIES } from '@/ui/brand';
import { Timeline } from '@/ui/records';
import { useToast } from '@/ui/toast';
import { NotFoundInline } from '@/pages/NotFound';
import { actionLabel, moduleCatalog } from './meta';
import type { BrandId, Grant, ModuleId, RoleId, Scope, User } from '@/platform/types';

export const USER_STATUS: Record<User['status'], { label: string; tone: Tone }> = {
  ativo: { label: 'Liberado', tone: 'ok' }, aguardando: { label: 'Aguardando liberação', tone: 'warn' }, bloqueado: { label: 'Bloqueado', tone: 'neutral' },
};
const SETORES = ['Atendimento', 'Comercial', 'Compras', 'Expedição', 'Financeiro', 'Gerência', 'Logística', 'Marketing', 'Tecnologia'];

export function ColaboradoresList() {
  const { data, me, grant } = useDemo();
  const nav = useNavigate();
  const { state, retry } = useSimLoad();
  const [f, setF] = useUrlState({ q: '', empresa: '', setor: '', situacao: '' });
  const scope = grant('admin')?.scope;
  const visible = useMemo(() => data.users.filter((u) => scope !== 'equipe' || u.managerId === me?.id || u.id === me?.id), [data.users, scope, me]);
  const pre = useMemo(() => visible.filter((u) =>
    (!f.q || `${u.name} ${u.email}`.toLowerCase().includes(f.q.toLowerCase())) &&
    (!f.empresa || u.companies.includes(f.empresa as BrandId)) && (!f.setor || u.sector === f.setor)), [visible, f.q, f.empresa, f.setor]);
  const rows = pre.filter((u) => !f.situacao || u.status === f.situacao).sort((a, b) => a.name.localeCompare(b.name));
  const clear = () => setF({ q: '', empresa: '', setor: '', situacao: '' });

  return (
    <>
      <PageHeader crumbs={[{ label: 'Administração' }, { label: 'Colaboradores' }]} title={scope === 'equipe' ? 'Minha equipe' : 'Colaboradores'}
        sub={scope === 'equipe' ? 'Pessoas que respondem a você. Solicite acessos e a TI aplica.' : 'Contas Microsoft liberadas pela TI, ambientes, perfis e permissões individuais.'}
        actions={scope === 'equipe' && <Link to="/admin/acessos/nova" className="btn btn-primary"><UserPlus size={18} />Solicitar acesso</Link>} />
      <div className="card">
        <div className="list-tools">
          <div className="tools-row">
            <div className="input-icon"><Search size={17} /><input className="input" aria-label="Buscar colaboradores" placeholder="Nome ou e-mail" value={f.q} onChange={(e) => setF({ q: e.target.value })} /></div>
            <select className="select" aria-label="Ambiente" value={f.empresa} onChange={(e) => setF({ empresa: e.target.value })}>
              <option value="">Ambiente: todos</option>{(Object.keys(COMPANIES) as BrandId[]).map((c) => <option key={c} value={c}>{COMPANIES[c].name}</option>)}
            </select>
            <select className="select" aria-label="Setor" value={f.setor} onChange={(e) => setF({ setor: e.target.value })}>
              <option value="">Setor: todos</option>{SETORES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="tools-row">
            <div className="seg-filter" role="group" aria-label="Situação do acesso">
              <button aria-pressed={!f.situacao} onClick={() => setF({ situacao: '' })}>Todos<span className="n">{pre.length}</span></button>
              {(Object.keys(USER_STATUS) as User['status'][]).map((k) => <button key={k} aria-pressed={f.situacao === k} onClick={() => setF({ situacao: k })}>{USER_STATUS[k].label}<span className="n">{pre.filter((u) => u.status === k).length}</span></button>)}
            </div>
            {(f.q || f.empresa || f.setor || f.situacao) && <button className="btn btn-ghost btn-sm" onClick={clear}><X size={14} />Limpar filtros</button>}
          </div>
        </div>
        {state === 'loading' ? <SkeletonRows cols={5} /> : state === 'error' ? <ErrorState onRetry={retry} /> : state === 'empty' ? <EmptyState title="Nenhum colaborador" /> : rows.length === 0 ? <NoResults onClear={clear} /> : (
          <>
            <div className="table-wrap responsive">
              <table className="tbl">
                <thead><tr><th>Colaborador</th><th>Ambientes</th><th>Setor</th><th>Perfis</th><th>Acesso</th><th /></tr></thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id} onClick={() => nav(`/admin/colaboradores/${u.id}`)}>
                      <td><div className="person"><Avatar name={u.name} /><div><Link to={`/admin/colaboradores/${u.id}`} className="strong" style={{ textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>{u.name}</Link><div className="xs muted">{u.email}</div></div></div></td>
                      <td className="small">{u.companies.map((c) => COMPANIES[c].name).join(', ')}</td>
                      <td className="small">{u.sector}</td>
                      <td className="small"><div className="truncate" style={{ maxWidth: 200 }}>{u.roles.map((r) => ROLE_LABEL[r]).join(', ')}{u.grants && Object.keys(u.grants).length ? <span className="xs muted"> · + individual</span> : ''}</div></td>
                      <td><Badge tone={USER_STATUS[u.status].tone}>{USER_STATUS[u.status].label}</Badge></td>
                      <td className="row-action"><ChevronRight size={18} className="muted" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-cards">
              {rows.map((u) => (
                <Link key={u.id} to={`/admin/colaboradores/${u.id}`} className="m-card">
                  <div className="row"><Avatar name={u.name} /><div style={{ flex: 1 }}><div className="strong">{u.name}</div><div className="xs muted">{u.sector} · {u.companies.map((c) => COMPANIES[c].name).join(', ')}</div></div><Badge tone={USER_STATUS[u.status].tone}>{USER_STATUS[u.status].label}</Badge></div>
                </Link>
              ))}
            </div>
            <div className="pager"><span className="tnum">{rows.length} colaboradores</span></div>
          </>
        )}
      </div>
    </>
  );
}

export function ColaboradorDetail() {
  const { id } = useParams();
  const { data, update, log, can, me, setSession, notify } = useDemo();
  const toast = useToast();
  const u = data.users.find((x) => x.id === id);
  const [roles, setRoles] = useState<RoleId[] | null>(null);
  const [companies, setCompanies] = useState<BrandId[] | null>(null);
  const [grants, setGrants] = useState<NonNullable<User['grants']> | null>(null);
  const [dlg, setDlg] = useState<null | 'save' | 'liberar' | 'bloquear'>(null);
  if (!u) return <NotFoundInline what="colaborador" back="/admin/colaboradores" />;
  const isTI = can('admin', 'aplicar_acesso');
  const leader = isLeader(data, u);
  const isLeaderOfU = can('admin', 'solicitar_acesso') && u.managerId === me?.id;
  const r = roles ?? u.roles;
  const c = companies ?? u.companies;
  const g = grants ?? u.grants ?? {};
  const catalog = moduleCatalog();
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const setGrant = (b: BrandId, m: ModuleId, patch: Partial<Grant>) => {
    const next = structuredClone(g);
    next[b] ??= {};
    const cur = next[b]![m] ?? { actions: [], scope: 'proprios' as Scope };
    next[b]![m] = { ...cur, ...patch };
    if (!next[b]![m]!.actions.length) delete next[b]![m];
    setGrants(next);
  };
  const applyTemplate = (b: BrandId) => {
    const next = structuredClone(g); next[b] ??= {};
    for (const role of r) for (const [m, t] of Object.entries(data.permissions[b]?.[role] ?? {})) {
      const prev = next[b]![m as ModuleId];
      next[b]![m as ModuleId] = { actions: Array.from(new Set([...(prev?.actions ?? []), ...t!.actions])), scope: prev && ['proprios', 'equipe', 'empresa'].indexOf(prev.scope) > ['proprios', 'equipe', 'empresa'].indexOf(t!.scope) ? prev.scope : t!.scope };
    }
    setGrants(next);
    toast(<>Modelo dos cargos aplicado em {COMPANIES[b].name}. Revise antes de aplicar.</>, { tone: 'info' });
  };
  // diferenças: vínculos, cargos e cada ação concedida/retirada
  const diff: string[] = [
    ...r.filter((x) => !u.roles.includes(x)).map((x) => `+ Cargo ${ROLE_LABEL[x]}`), ...u.roles.filter((x) => !r.includes(x)).map((x) => `− Cargo ${ROLE_LABEL[x]}`),
    ...c.filter((x) => !u.companies.includes(x)).map((x) => `+ Ambiente ${COMPANIES[x].name}`), ...u.companies.filter((x) => !c.includes(x)).map((x) => `− Ambiente ${COMPANIES[x].name}`),
  ];
  for (const b of Object.keys(COMPANIES) as BrandId[]) for (const m of catalog) {
    const before = u.grants?.[b]?.[m.id]; const after = g[b]?.[m.id];
    for (const a of after?.actions ?? []) if (!before?.actions.includes(a)) diff.push(`+ ${COMPANIES[b].name} · ${m.name} · ${actionLabel(m.id, a)}`);
    for (const a of before?.actions ?? []) if (!after?.actions.includes(a)) diff.push(`− ${COMPANIES[b].name} · ${m.name} · ${actionLabel(m.id, a)}`);
    if (before && after && before.scope !== after.scope) diff.push(`${COMPANIES[b].name} · ${m.name}: escopo ${SCOPE_LABEL[before.scope]} → ${SCOPE_LABEL[after.scope]}`);
  }
  const setStatus = (s: User['status'], action: string, msg: React.ReactNode) => {
    update((d) => { d.users.find((y) => y.id === u.id)!.status = s; });
    log({ module: 'admin', recordId: u.id, recordLabel: u.name, action, kind: 'acesso' });
    notify({ userId: u.id, module: 'admin', kind: 'acesso', title: 'Seu acesso à plataforma foi alterado', subject: action, link: '/inicio', recordId: u.id });
    toast(msg);
  };
  const apply = () => {
    update((d) => { const x = d.users.find((y) => y.id === u.id)!; x.roles = r; x.companies = c; x.grants = g; });
    for (const line of diff) log({ module: 'admin', recordId: u.id, recordLabel: u.name, action: `Concessão alterada pela TI: ${line}`, kind: 'acesso' });
    notify({ userId: u.id, module: 'admin', kind: 'acesso', title: 'Seus acessos foram atualizados pela TI', subject: `${diff.length} ${diff.length === 1 ? 'alteração' : 'alterações'}: ${diff.slice(0, 2).join('; ')}${diff.length > 2 ? '…' : ''}`, link: '/inicio', recordId: u.id });
    toast(<>Acessos de <b>{u.name}</b> aplicados ({diff.length} {diff.length === 1 ? 'alteração' : 'alterações'}).</>, u.persona ? { action: { label: `Entrar como ${u.name.split(' ')[0]}`, run: () => setSession({ userId: u.id }) } } : undefined);
    setRoles(null); setCompanies(null); setGrants(null);
  };
  const editable = isTI && !leader;

  return (
    <>
      <PageHeader crumbs={[{ label: 'Administração' }, { label: 'Colaboradores', to: '/admin/colaboradores' }, { label: u.name }]}
        title={<span className="row" style={{ gap: 16 }}><Avatar name={u.name} lg />{u.name}</span>}
        sub={<span className="row-wrap" style={{ gap: 10 }}><Badge tone={USER_STATUS[u.status].tone}>{USER_STATUS[u.status].label}</Badge>{leader && <Badge tone="accent" plain>Líder · configuração inicial</Badge>}<span className="small muted">{u.email} · conta Microsoft · {u.sector}</span></span>}
        actions={<>
          <BackToList fallback="/admin/colaboradores" />
          {isLeaderOfU && <Link className="btn btn-primary" to={`/admin/acessos/nova?para=${u.id}`}><UserPlus size={17} />Solicitar acesso</Link>}
          {isTI && u.status === 'aguardando' && <button className="btn btn-primary" onClick={() => setDlg('liberar')}><UserCheck size={17} />Liberar conta</button>}
          {isTI && u.status === 'ativo' && u.id !== me?.id && <button className="btn btn-secondary" onClick={() => setDlg('bloquear')}><Lock size={16} />Bloquear</button>}
          {isTI && u.status === 'bloqueado' && <button className="btn btn-secondary" onClick={() => setStatus('ativo', 'Acesso reativado pela TI', <>Acesso de {u.name} reativado.</>)}><Unlock size={16} />Reativar</button>}
        </>} />
      {leader && <div className="banner banner-info" style={{ marginBottom: 20 }}><ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 2 }} /><span className="b-text">Líder definido na configuração inicial: acesso total às operações dos módulos de negócio em todos os ambientes vinculados. Concessões administrativas continuam individuais.</span></div>}
      <div className="layout-detail">
        <div className="stack">
          <div className="card">
            <div className="card-head"><h2>Concessões por ambiente</h2><span className="xs muted" style={{ marginLeft: 'auto' }}>{editable ? 'Marque ou desmarque ações · o acesso efetivo é exatamente o que está aqui' : 'Acesso efetivo'}</span></div>
            <div className="card-body stack">
              {c.length === 0 && <p className="muted small">Sem ambientes liberados: nenhum acesso.</p>}
              {c.map((b) => (
                <div key={b}>
                  <div className="row" style={{ marginBottom: 8 }}><span className="label">{COMPANIES[b].name}</span><span className="spacer" />{editable && <button className="btn btn-ghost btn-xs" onClick={() => applyTemplate(b)}>Aplicar modelo dos cargos</button>}</div>
                  <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 12 }}>
                    <table className="tbl" style={{ fontSize: 13 }}>
                      <thead><tr><th>Módulo</th><th>Ações</th><th>Escopo</th><th>Origem</th></tr></thead>
                      <tbody>
                        {catalog.filter((m) => m.id === 'admin' || moduleAvailability(data, b, m.id) !== 'nao_instalado').map((m) => {
                          const preview: User = { ...u, roles: r, companies: c, grants: g, status: 'ativo' };
                          const eff = effectiveGrant(data, preview, b, m.id);
                          const fromLeader = leader && !!BUSINESS_ACTIONS[m.id];
                          const gr = g[b]?.[m.id];
                          return (
                            <tr key={m.id} style={{ cursor: 'default', opacity: eff || editable ? 1 : .55 }}>
                              <td className="strong" style={{ whiteSpace: 'nowrap' }}>{m.name}</td>
                              <td>
                                {editable && !fromLeader ? (
                                  <div className="row-wrap" style={{ gap: '4px 14px' }}>
                                    {m.actions.map((a) => (
                                      <label key={a.id} className="check small" style={{ gap: 6 }}>
                                        <input type="checkbox" aria-label={`${COMPANIES[b].name} · ${m.name} · ${a.label}`} checked={!!gr?.actions.includes(a.id)} onChange={() => setGrant(b, m.id, { actions: toggle(gr?.actions ?? [], a.id) })} />{a.label}
                                      </label>
                                    ))}
                                  </div>
                                ) : eff ? eff.actions.map((a) => actionLabel(m.id, a)).join(', ') : <span className="subtle">Sem acesso</span>}
                              </td>
                              <td className="small">
                                {editable && !fromLeader && gr ? (
                                  <select className="select" style={{ height: 34, minWidth: 176 }} aria-label={`Escopo ${m.name}`} value={gr.scope} onChange={(e) => setGrant(b, m.id, { scope: e.target.value as Scope })}>
                                    {(['proprios', 'equipe', 'empresa'] as Scope[]).map((x) => <option key={x} value={x}>{SCOPE_LABEL[x]}</option>)}
                                  </select>
                                ) : eff ? SCOPE_LABEL[eff.scope] : '—'}
                              </td>
                              <td className="small">{fromLeader ? <Badge tone="accent" plain>Líder</Badge> : eff ? <span className="muted">Individual</span> : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
            {isTI && (
              <>
                <div className="form-section">
                  <h3>Ambientes e cargos</h3><p className="section-desc">Ambientes definem o seletor da pessoa. Cargos organizam a administração e servem de modelo; não concedem acesso sozinhos.</p>
                  <div className="row-wrap" style={{ gap: 18, marginBottom: 14 }}>{(Object.keys(COMPANIES) as BrandId[]).map((b) => <label key={b} className="check"><input type="checkbox" checked={c.includes(b)} onChange={() => setCompanies(toggle(c, b))} />{COMPANIES[b].name}</label>)}</div>
                  <div className="grid-3">{ROLES.map((x) => <label key={x} className="check"><input type="checkbox" checked={r.includes(x)} onChange={() => setRoles(toggle(r, x))} />{ROLE_LABEL[x]}</label>)}</div>
                </div>
                {diff.length > 0 && (
                  <div className="form-section" style={{ background: 'var(--surface-2)' }}>
                    <h3>Alterações pendentes · {diff.length}</h3>
                    <ul className="checklist small" style={{ marginTop: 8 }}>{diff.map((d) => <li key={d} style={{ color: d.startsWith('−') ? 'var(--danger)' : d.startsWith('+') ? 'var(--ok)' : undefined, fontWeight: 600 }}>{d}</li>)}</ul>
                  </div>
                )}
                <div className="form-actions">
                  <button className="btn btn-secondary" disabled={!diff.length} onClick={() => { setRoles(null); setCompanies(null); setGrants(null); }}>Descartar</button>
                  <button className="btn btn-primary" disabled={!diff.length} onClick={() => setDlg('save')}><ShieldCheck size={17} />Revisar e aplicar</button>
                </div>
              </>
            )}
          </div>
          <div className="card"><div className="card-head"><h2>Histórico administrativo</h2></div><div className="card-body"><Timeline events={data.events.filter((e) => e.module === 'admin' && e.recordId === u.id)} /></div></div>
        </div>
        <aside className="stack">
          <div className="card card-pad"><KV items={[['Setor', u.sector], ['Líder', data.users.find((x) => x.id === u.managerId)?.name ?? '—'], ['Cargos', u.roles.map((x) => ROLE_LABEL[x]).join(', ')]]} /></div>
          {!isTI && <div className="banner banner-info"><ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 2 }} /><span className="b-text small">Líderes solicitam acessos; a TI aplica as concessões.</span></div>}
        </aside>
      </div>
      <Confirm open={dlg === 'save'} onClose={() => setDlg(null)} title="Aplicar concessões" confirmLabel="Aplicar alterações"
        desc={`Valem imediatamente para ${u.name.split(' ')[0]}, que recebe notificação e e-mail. Cada alteração entra na auditoria.`} onConfirm={apply}>
        <ul className="checklist small">{diff.map((d) => <li key={d} className="strong">{d}</li>)}</ul>
      </Confirm>
      <Confirm open={dlg === 'liberar'} onClose={() => setDlg(null)} title={`Liberar a conta de ${u.name}?`} confirmLabel="Liberar conta"
        desc={`A conta Microsoft ${u.email} passa a entrar na plataforma nos ambientes ${u.companies.map((x) => COMPANIES[x].name).join(', ')}.`}
        onConfirm={() => setStatus('ativo', 'Conta Microsoft liberada pela TI', <>Conta de <b>{u.name}</b> liberada.</>)} />
      <Confirm open={dlg === 'bloquear'} onClose={() => setDlg(null)} danger title={`Bloquear ${u.name}?`} confirmLabel="Bloquear acesso"
        desc="O colaborador deixa de entrar na plataforma. Todos os registros e históricos são preservados."
        onConfirm={() => setStatus('bloqueado', 'Acesso bloqueado pela TI (registros preservados)', <>Acesso de <b>{u.name}</b> bloqueado. Registros preservados.</>)} />
    </>
  );
}
