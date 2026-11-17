import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Lock, Search, ShieldCheck, Unlock, UserCheck, UserPlus, X } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { useUrlState } from '@/platform/hooks';
import { grantSources, moduleAvailability, ROLE_LABEL, ROLES, SCOPE_LABEL } from '@/platform/permissions';
import { Avatar, BackToList, Badge, Confirm, EmptyState, ErrorState, KV, NoResults, PageHeader, SkeletonRows, useSimLoad, type Tone } from '@/ui/core';
import { COMPANIES } from '@/ui/brand';
import { Timeline } from '@/ui/records';
import { useToast } from '@/ui/toast';
import { NotFoundInline } from '@/pages/NotFound';
import { actionLabel, moduleCatalog } from './meta';
import type { BrandId, RoleId, User } from '@/platform/types';

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
  const { data, update, log, can, me, setSession } = useDemo();
  const toast = useToast();
  const u = data.users.find((x) => x.id === id);
  const [roles, setRoles] = useState<RoleId[] | null>(null);
  const [companies, setCompanies] = useState<BrandId[] | null>(null);
  const [dlg, setDlg] = useState<null | 'save' | 'liberar' | 'bloquear' | { revoke: [BrandId, string] }>(null);
  if (!u) return <NotFoundInline what="colaborador" back="/admin/colaboradores" />;
  const isTI = can('admin', 'aplicar_acesso');
  const isLeader = can('admin', 'solicitar_acesso') && u.managerId === me?.id;
  const r = roles ?? u.roles;
  const c = companies ?? u.companies;
  const changed = JSON.stringify([...r].sort()) !== JSON.stringify([...u.roles].sort()) || JSON.stringify([...c].sort()) !== JSON.stringify([...u.companies].sort());
  const preview: User = { ...u, roles: r, companies: c };
  const diff = [
    ...r.filter((x) => !u.roles.includes(x)).map((x) => `+ Perfil ${ROLE_LABEL[x]}`), ...u.roles.filter((x) => !r.includes(x)).map((x) => `− Perfil ${ROLE_LABEL[x]}`),
    ...c.filter((x) => !u.companies.includes(x)).map((x) => `+ Ambiente ${COMPANIES[x].name}`), ...u.companies.filter((x) => !c.includes(x)).map((x) => `− Ambiente ${COMPANIES[x].name}`),
  ];
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const catalog = moduleCatalog();
  const setStatus = (s: User['status'], action: string, msg: React.ReactNode) => {
    update((d) => { d.users.find((y) => y.id === u.id)!.status = s; });
    log({ module: 'admin', recordId: u.id, recordLabel: u.name, action });
    toast(msg);
  };

  return (
    <>
      <PageHeader crumbs={[{ label: 'Administração' }, { label: 'Colaboradores', to: '/admin/colaboradores' }, { label: u.name }]}
        title={<span className="row" style={{ gap: 16 }}><Avatar name={u.name} lg />{u.name}</span>}
        sub={<span className="row-wrap" style={{ gap: 10 }}><Badge tone={USER_STATUS[u.status].tone}>{USER_STATUS[u.status].label}</Badge><span className="small muted">{u.email} · conta Microsoft · {u.sector}</span></span>}
        actions={<>
          <BackToList fallback="/admin/colaboradores" />
          {isLeader && <Link className="btn btn-primary" to={`/admin/acessos/nova?para=${u.id}`}><UserPlus size={17} />Solicitar acesso</Link>}
          {isTI && u.status === 'aguardando' && <button className="btn btn-primary" onClick={() => setDlg('liberar')}><UserCheck size={17} />Liberar conta</button>}
          {isTI && u.status === 'ativo' && u.id !== me?.id && <button className="btn btn-secondary" onClick={() => setDlg('bloquear')}><Lock size={16} />Bloquear</button>}
          {isTI && u.status === 'bloqueado' && <button className="btn btn-secondary" onClick={() => setStatus('ativo', 'Acesso reativado pela TI', <>Acesso de {u.name} reativado.</>)}><Unlock size={16} />Reativar</button>}
        </>} />
      <div className="layout-detail">
        <div className="stack">
          <div className="card">
            <div className="card-head"><h2>Permissões por ambiente</h2><span className="xs muted" style={{ marginLeft: 'auto' }}>Perfil + individual</span></div>
            <div className="card-body stack">
              {c.length === 0 && <p className="muted small">Sem ambientes liberados: nenhum acesso.</p>}
              {c.map((b) => (
                <div key={b}>
                  <div className="label" style={{ marginBottom: 8 }}>{COMPANIES[b].name}</div>
                  <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 12 }}>
                    <table className="tbl" style={{ fontSize: 13 }}>
                      <thead><tr><th>Módulo</th><th>Ações</th><th>Escopo</th><th>Origem</th>{isTI && <th />}</tr></thead>
                      <tbody>
                        {catalog.flatMap((m) => {
                          if (m.id !== 'admin' && moduleAvailability(data, b, m.id) === 'nao_instalado') return [];
                          return grantSources(data, preview, b, m.id).map((s) => (
                            <tr key={m.id + s.source} style={{ cursor: 'default' }}>
                              <td className="strong">{m.name}</td>
                              <td>{s.grant.actions.map((a) => actionLabel(m.id, a)).join(', ')}</td>
                              <td className="small">{SCOPE_LABEL[s.grant.scope]}</td>
                              <td>{s.individual ? <Badge tone="accent">Individual</Badge> : <span className="small muted">{s.source}</span>}</td>
                              {isTI && <td className="r">{s.individual && <button className="btn btn-ghost btn-xs" onClick={() => setDlg({ revoke: [b, m.id] })}>Revogar</button>}</td>}
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              {changed && <p className="xs" style={{ color: 'var(--info)' }}>Prévia considerando as alterações não salvas.</p>}
            </div>
          </div>
          {isTI && (
            <div className="card">
              <div className="card-head"><h2>Ambientes e perfis</h2></div>
              <div className="form-section">
                <h3>Ambientes liberados</h3><p className="section-desc">Definem o seletor de ambiente do colaborador.</p>
                <div className="row-wrap" style={{ gap: 18 }}>{(Object.keys(COMPANIES) as BrandId[]).map((b) => <label key={b} className="check"><input type="checkbox" checked={c.includes(b)} onChange={() => setCompanies(toggle(c, b))} />{COMPANIES[b].name}</label>)}</div>
              </div>
              <div className="form-section">
                <h3>Perfis</h3><p className="section-desc">Combináveis. Permissões de cada perfil ficam em Perfis e permissões.</p>
                <div className="grid-3">{ROLES.map((x) => <label key={x} className="check"><input type="checkbox" checked={r.includes(x)} onChange={() => setRoles(toggle(r, x))} />{ROLE_LABEL[x]}</label>)}</div>
              </div>
              <div className="form-actions">
                <button className="btn btn-secondary" disabled={!changed} onClick={() => { setRoles(null); setCompanies(null); }}>Descartar</button>
                <button className="btn btn-primary" disabled={!changed} onClick={() => setDlg('save')}><ShieldCheck size={17} />Revisar e aplicar</button>
              </div>
            </div>
          )}
          <div className="card"><div className="card-head"><h2>Histórico administrativo</h2></div><div className="card-body"><Timeline events={data.events.filter((e) => e.module === 'admin' && e.recordId === u.id)} /></div></div>
        </div>
        <aside className="stack">
          <div className="card card-pad"><KV items={[['Setor', u.sector], ['Líder', data.users.find((x) => x.id === u.managerId)?.name ?? '—'], ['Perfis', u.roles.map((x) => ROLE_LABEL[x]).join(', ')]]} /></div>
          {!isTI && <div className="banner banner-info"><ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 2 }} /><span className="b-text small">Alterações de acesso são aplicadas pela TI a partir de solicitações dos líderes.</span></div>}
        </aside>
      </div>
      <Confirm open={dlg === 'save'} onClose={() => setDlg(null)} title="Aplicar alteração de acessos" confirmLabel="Aplicar alterações"
        desc={`As mudanças valem a partir do próximo acesso de ${u.name.split(' ')[0]}.`}
        onConfirm={() => {
          update((d) => { const x = d.users.find((y) => y.id === u.id)!; x.roles = r; x.companies = c; });
          log({ module: 'admin', recordId: u.id, recordLabel: u.name, action: `Acessos alterados pela TI: ${diff.join(', ')}` });
          toast(<>Acessos de <b>{u.name}</b> atualizados.</>, u.persona ? { action: { label: `Entrar como ${u.name.split(' ')[0]}`, run: () => setSession({ userId: u.id }) } } : undefined);
          setRoles(null); setCompanies(null);
        }}>
        <ul className="checklist">{diff.map((d) => <li key={d} className="strong">{d}</li>)}</ul>
      </Confirm>
      <Confirm open={dlg === 'liberar'} onClose={() => setDlg(null)} title={`Liberar a conta de ${u.name}?`} confirmLabel="Liberar conta"
        desc={`A conta Microsoft ${u.email} passa a entrar na plataforma nos ambientes ${u.companies.map((x) => COMPANIES[x].name).join(', ')}.`}
        onConfirm={() => setStatus('ativo', 'Conta liberada pela TI', <>Conta de <b>{u.name}</b> liberada.</>)} />
      <Confirm open={dlg === 'bloquear'} onClose={() => setDlg(null)} danger title={`Bloquear ${u.name}?`} confirmLabel="Bloquear acesso"
        desc="O colaborador deixa de entrar na plataforma. Todos os registros e históricos são preservados."
        onConfirm={() => setStatus('bloqueado', 'Acesso bloqueado pela TI (registros preservados)', <>Acesso de <b>{u.name}</b> bloqueado. Registros preservados.</>)} />
      <Confirm open={!!dlg && typeof dlg === 'object'} onClose={() => setDlg(null)} danger title="Revogar permissão individual?" confirmLabel="Revogar"
        desc="As permissões do perfil continuam valendo. A revogação fica no histórico."
        onConfirm={() => {
          if (!dlg || typeof dlg !== 'object') return;
          const [b, mid] = dlg.revoke;
          update((d) => { const x = d.users.find((y) => y.id === u.id)!; if (x.grants?.[b]) delete x.grants[b]![mid as keyof NonNullable<typeof x.grants>[BrandId]]; });
          log({ module: 'admin', recordId: u.id, recordLabel: u.name, action: `Permissão individual revogada: ${catalog.find((m) => m.id === mid)?.name} · ${COMPANIES[b].name}`, companyId: b });
          toast('Permissão individual revogada.');
        }} />
    </>
  );
}

