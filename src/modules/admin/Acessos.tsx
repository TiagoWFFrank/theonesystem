// Fluxo de acesso: o LÍDER solicita acessos para a equipe; a TI revisa e APLICA (gera permissão individual).
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, ChevronRight, KeyRound, Send, ShieldCheck, UserPlus, X } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { useUnsavedGuard, useUrlState } from '@/platform/hooks';
import { fmtDate, fmtDateTime, uid } from '@/platform/format';
import { effectiveGrant, SCOPE_LABEL } from '@/platform/permissions';
import { Avatar, BackToList, Badge, Dialog, EmptyState, Field, KV, PageHeader } from '@/ui/core';
import { COMPANIES } from '@/ui/brand';
import { Timeline } from '@/ui/records';
import { useToast } from '@/ui/toast';
import { ForbiddenInline, NotFoundInline } from '@/pages/NotFound';
import { actionLabel, AR_STATUS, moduleCatalog, moduleName } from './meta';
import type { AccessRequest, BrandId, ModuleId, Scope } from '@/platform/types';

export function AcessosList() {
  const { data, company, can, me, userName } = useDemo();
  const nav = useNavigate();
  const [f, setF] = useUrlState({ situacao: '' });
  const isTI = can('admin', 'aplicar_acesso');
  const base = data.accessRequests.filter((a) => a.companyId === company && (isTI || a.requesterId === me?.id));
  const rows = base.filter((a) => !f.situacao || a.status === f.situacao).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  if (!isTI && !can('admin', 'solicitar_acesso')) return <ForbiddenInline module="Solicitações de acesso" />;
  return (
    <>
      <PageHeader crumbs={[{ label: 'Administração' }, { label: 'Solicitações de acesso' }]} title="Solicitações de acesso"
        sub={isTI ? 'Pedidos feitos pelos líderes. A TI revisa e aplica; cada aplicação gera uma permissão individual com histórico.' : 'Acessos que você solicitou para a sua equipe. A TI aplica as alterações.'}
        actions={can('admin', 'solicitar_acesso') && <Link to="/admin/acessos/nova" className="btn btn-primary"><UserPlus size={18} />Solicitar acesso</Link>} />
      <div className="card">
        <div className="list-tools">
          <div className="seg-filter" role="group" aria-label="Situação">
            <button aria-pressed={!f.situacao} onClick={() => setF({ situacao: '' })}>Todas<span className="n">{base.length}</span></button>
            {(Object.keys(AR_STATUS) as AccessRequest['status'][]).map((k) => <button key={k} aria-pressed={f.situacao === k} onClick={() => setF({ situacao: k })}>{AR_STATUS[k].label}<span className="n">{base.filter((a) => a.status === k).length}</span></button>)}
          </div>
        </div>
        {rows.length === 0 ? <EmptyState icon={<KeyRound size={22} />} title="Nenhuma solicitação nesta situação" /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Número</th><th>Colaborador</th><th>Acesso solicitado</th><th>Solicitante</th><th>Situação</th><th className="r">Data</th><th /></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} onClick={() => nav(`/admin/acessos/${a.id}`)}>
                    <td className="id-cell">{a.numero}</td>
                    <td><span className="person"><Avatar name={userName(a.targetId)} sm />{userName(a.targetId)}</span></td>
                    <td className="small"><b>{moduleName(a.module)}</b> · {a.actions.map((x) => actionLabel(a.module, x)).join(', ')}<div className="xs muted">{SCOPE_LABEL[a.scope]}</div></td>
                    <td className="small">{userName(a.requesterId)}</td>
                    <td><Badge tone={AR_STATUS[a.status].tone}>{AR_STATUS[a.status].label}</Badge></td>
                    <td className="num small r">{fmtDate(a.criadoEm)}</td>
                    <td className="row-action"><ChevronRight size={18} className="muted" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export function AcessoNovo() {
  const { data, company, me, can, update, log, notify } = useDemo();
  const nav = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const team = useMemo(() => data.users.filter((u) => u.managerId === me?.id && u.status === 'ativo'), [data.users, me]);
  const [target, setTarget] = useState(params.get('para') ?? '');
  const [emp, setEmp] = useState<BrandId>(company);
  const mods = moduleCatalog().filter((m) => m.id !== 'admin');
  const [mod, setMod] = useState<ModuleId>('reverso');
  const [actions, setActions] = useState<string[]>([]);
  const [scope, setScope] = useState<Scope>('equipe');
  const [just, setJust] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { guard, release } = useUnsavedGuard(!!(target || actions.length || just));
  if (!can('admin', 'solicitar_acesso')) return <ForbiddenInline module="Solicitar acesso" />;
  const m = mods.find((x) => x.id === mod)!;
  const tUser = data.users.find((u) => u.id === target);
  const current = tUser ? effectiveGrant(data, tUser, emp, mod) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!target) er.target = 'Selecione o colaborador da sua equipe.';
    if (!actions.length) er.actions = 'Selecione ao menos uma ação.';
    if (just.trim().length < 15) er.just = 'Explique o motivo (mínimo de 15 caracteres) para a TI avaliar.';
    setErrors(er);
    if (Object.keys(er).length) return;
    const id = uid('ar');
    const numero = `ACS-00${15 + data.accessRequests.length - 2}`;
    update((d) => { d.accessRequests.push({ id, numero, requesterId: me!.id, targetId: target, companyId: emp, module: mod, actions, scope, justificativa: just.trim(), status: 'pendente', criadoEm: new Date().toISOString() }); });
    log({ module: 'admin', recordId: id, recordLabel: numero, action: `${me!.name} solicitou: ${moduleName(mod)} · ${actions.map((a) => actionLabel(mod, a)).join(', ')} (${SCOPE_LABEL[scope].toLowerCase()}) para ${tUser!.name}`, kind: 'acesso', companyId: emp });
    notify({ userId: 'u5', module: 'admin', title: 'Solicitação de acesso para aplicar', subject: `${numero} · ${tUser!.name} · ${moduleName(mod)}`, link: `/admin/acessos/${id}`, companyId: emp });
    release();
    toast(<>Solicitação <b>{numero}</b> enviada para a TI.</>);
    nav(`/admin/acessos/${id}`, { replace: true });
  };

  return (
    <>
      {guard}
      <PageHeader crumbs={[{ label: 'Administração' }, { label: 'Solicitações de acesso', to: '/admin/acessos' }, { label: 'Nova' }]} title="Solicitar acesso"
        sub="Como líder, você pede o acesso para alguém da sua equipe. A TI revisa e aplica a alteração." />
      <form className="layout-form" onSubmit={submit} noValidate>
        <div className="card">
          <div className="form-section">
            <h3><span className="step-num">1</span>Para quem</h3><p className="section-desc">Colaboradores que respondem a você.</p>
            <div className="form-grid">
              <Field label="Colaborador" required error={errors.target} htmlFor="target">
                <select id="target" className="select" value={target} onChange={(e) => { setTarget(e.target.value); setErrors((x) => ({ ...x, target: '' })); }} aria-invalid={!!errors.target}>
                  <option value="">Selecione</option>{team.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.sector}</option>)}
                </select>
              </Field>
              <Field label="Ambiente" htmlFor="emp">
                <select id="emp" className="select" value={emp} onChange={(e) => setEmp(e.target.value as BrandId)}>
                  {(tUser?.companies ?? (Object.keys(COMPANIES) as BrandId[])).map((c) => <option key={c} value={c}>{COMPANIES[c].name}</option>)}
                </select>
              </Field>
            </div>
          </div>
          <div className="form-section">
            <h3><span className="step-num">2</span>O quê</h3><p className="section-desc">Ações declaradas pelo módulo e alcance dos registros.</p>
            <div className="stack">
              <div className="seg" role="group" aria-label="Módulo" style={{ width: 'auto', alignSelf: 'flex-start', flexWrap: 'wrap' }}>
                {mods.map((x) => <button type="button" key={x.id} aria-pressed={mod === x.id} onClick={() => { setMod(x.id); setActions([]); }}>{x.name}</button>)}
              </div>
              <div className="stack-sm" id="actions">
                {m.actions.map((a) => (
                  <label key={a.id} className="check"><input type="checkbox" checked={actions.includes(a.id)} onChange={() => { setActions((l) => l.includes(a.id) ? l.filter((x) => x !== a.id) : [...l, a.id]); setErrors((x) => ({ ...x, actions: '' })); }} />
                    <span>{a.label}{current?.actions.includes(a.id) && <span className="xs muted"> · já possui</span>}</span></label>
                ))}
                {errors.actions && <span className="error-msg" role="alert">{errors.actions}</span>}
              </div>
              <div className="radio-cards" role="radiogroup" aria-label="Escopo">
                {(['proprios', 'equipe', 'empresa'] as Scope[]).map((s) => <label key={s} className="radio-card"><input type="radio" name="scope" checked={scope === s} onChange={() => setScope(s)} /><span><b>{SCOPE_LABEL[s]}</b></span></label>)}
              </div>
            </div>
          </div>
          <div className="form-section">
            <h3><span className="step-num">3</span>Por quê</h3><p className="section-desc">A justificativa fica registrada no histórico administrativo.</p>
            <Field label="Justificativa" required error={errors.just} htmlFor="just"><textarea id="just" className="textarea" value={just} onChange={(e) => { setJust(e.target.value); setErrors((x) => ({ ...x, just: '' })); }} aria-invalid={!!errors.just} /></Field>
          </div>
        </div>
        <aside className="summary card">
          <div className="card-head"><h3>Resumo do pedido</h3></div>
          <div className="card-body stack" style={{ gap: 12 }}>
            <KV items={[['Colaborador', tUser?.name ?? '—'], ['Ambiente', COMPANIES[emp].name], ['Módulo', m.name], ['Escopo', SCOPE_LABEL[scope]]]} />
            <div className="small"><span className="muted">Ações: </span>{actions.length ? actions.map((a) => actionLabel(mod, a)).join(', ') : '—'}</div>
            <div className="banner banner-info"><ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 2 }} /><span className="b-text small">Segue para a TI. Você acompanha em Meu trabalho.</span></div>
          </div>
          <div className="form-actions"><button type="button" className="btn btn-secondary" onClick={() => nav(-1)}>Cancelar</button><button className="btn btn-primary" style={{ flex: 1 }}><Send size={16} />Enviar para a TI</button></div>
        </aside>
      </form>
    </>
  );
}

export function AcessoDetail() {
  const { id } = useParams();
  const { data, can, me, userName, update, log, notify } = useDemo();
  const toast = useToast();
  const a = data.accessRequests.find((x) => x.id === id);
  const [dlg, setDlg] = useState<null | 'aplicar' | 'recusar'>(null);
  const [obs, setObs] = useState('');
  const [err, setErr] = useState('');
  if (!a) return <NotFoundInline what="solicitação" back="/admin/acessos" />;
  const isTI = can('admin', 'aplicar_acesso');
  if (!isTI && a.requesterId !== me?.id) return <ForbiddenInline />;
  const target = data.users.find((u) => u.id === a.targetId)!;
  const before = effectiveGrant(data, target, a.companyId, a.module);
  const events = data.events.filter((e) => e.recordId === a.id);

  const aplicar = () => {
    update((d) => {
      const r = d.accessRequests.find((x) => x.id === a.id)!;
      r.status = 'aplicada'; r.resolvidoPor = me!.id; r.resolvidoEm = new Date().toISOString(); r.obs = obs.trim() || undefined;
      const u = d.users.find((x) => x.id === a.targetId)!;
      u.grants ??= {}; u.grants[a.companyId] ??= {};
      const prev = u.grants[a.companyId]![a.module];
      u.grants[a.companyId]![a.module] = { actions: Array.from(new Set([...(prev?.actions ?? []), ...a.actions])), scope: a.scope };
    });
    log({ module: 'admin', recordId: a.id, recordLabel: a.numero, action: 'Aplicada pela TI · concessão individual atualizada', kind: 'acesso', companyId: a.companyId });
    log({ module: 'admin', recordId: a.targetId, recordLabel: target.name, kind: 'acesso', action: `Concessão individual: ${moduleName(a.module)} · ${a.actions.map((x) => actionLabel(a.module, x)).join(', ')} (${SCOPE_LABEL[a.scope].toLowerCase()}) · ${a.numero}`, companyId: a.companyId });
    notify({ userId: a.requesterId, module: 'admin', title: 'Acesso aplicado pela TI', subject: `${a.numero} · ${target.name}`, link: `/admin/acessos/${a.id}`, companyId: a.companyId });
    notify({ userId: a.targetId, module: a.module, title: `Novo acesso em ${moduleName(a.module)}`, subject: a.actions.map((x) => actionLabel(a.module, x)).join(', '), link: '/inicio', companyId: a.companyId });
    toast(<>Acesso <b>{a.numero}</b> aplicado. {target.name.split(' ')[0]} já vê as novas ações.</>);
    setDlg(null);
  };
  const recusar = () => {
    if (obs.trim().length < 10) { setErr('Explique o motivo da recusa (mínimo de 10 caracteres).'); return; }
    update((d) => { const r = d.accessRequests.find((x) => x.id === a.id)!; r.status = 'recusada'; r.resolvidoPor = me!.id; r.resolvidoEm = new Date().toISOString(); r.obs = obs.trim(); });
    log({ module: 'admin', recordId: a.id, recordLabel: a.numero, action: `Recusada pela TI: ${obs.trim()}`, kind: 'acesso', companyId: a.companyId });
    notify({ userId: a.requesterId, module: 'admin', title: 'Solicitação de acesso recusada', subject: `${a.numero} · ${obs.trim()}`, link: `/admin/acessos/${a.id}`, companyId: a.companyId });
    toast(<>Solicitação <b>{a.numero}</b> recusada e líder notificado.</>);
    setDlg(null);
  };

  return (
    <>
      <PageHeader crumbs={[{ label: 'Administração' }, { label: 'Solicitações de acesso', to: '/admin/acessos' }, { label: a.numero }]}
        eyebrow={<div className="detail-id">{a.numero}</div>} title={`${moduleName(a.module)} para ${target.name}`}
        sub={<span className="row-wrap" style={{ gap: 10 }}><Badge tone={AR_STATUS[a.status].tone}>{AR_STATUS[a.status].label}</Badge><span className="small muted">Solicitado por {userName(a.requesterId)} em {fmtDateTime(a.criadoEm)} · {COMPANIES[a.companyId].name}</span></span>}
        actions={<>
          <BackToList fallback="/admin/acessos" />
          {isTI && a.status === 'pendente' && <button className="btn btn-secondary" onClick={() => setDlg('recusar')}><X size={16} />Recusar</button>}
          {isTI && a.status === 'pendente' && <button className="btn btn-primary" onClick={() => setDlg('aplicar')}><Check size={17} />Aplicar acesso</button>}
        </>} />
      <div className="layout-detail">
        <div className="stack">
          <div className="card card-pad">
            <div className="label" style={{ marginBottom: 14 }}>Alteração solicitada</div>
            <div className="grid-2">
              <div className="att" style={{ alignItems: 'flex-start' }}><div><div className="xs muted strong">HOJE</div><div className="small" style={{ marginTop: 6 }}>{before ? <>{before.actions.map((x) => actionLabel(a.module, x)).join(', ')}<div className="xs muted">{SCOPE_LABEL[before.scope]}</div></> : <span className="muted">Sem acesso a {moduleName(a.module)}</span>}</div></div></div>
              <div className="att" style={{ alignItems: 'flex-start', borderColor: 'var(--primary)' }}><div><div className="xs muted strong">APÓS APLICAR</div><div className="small" style={{ marginTop: 6 }}>{Array.from(new Set([...(a.status === 'aplicada' ? [] : before?.actions ?? []), ...a.actions])).map((x) => actionLabel(a.module, x)).join(', ')}<div className="xs muted">{SCOPE_LABEL[a.scope]} · permissão individual</div></div></div></div>
            </div>
            <div style={{ marginTop: 18 }}><div className="label" style={{ marginBottom: 6 }}>Justificativa do líder</div><p>{a.justificativa}</p></div>
            {a.obs && <div style={{ marginTop: 14 }}><div className="label" style={{ marginBottom: 6 }}>Observação da TI</div><p>{a.obs}</p></div>}
          </div>
          <div className="card"><div className="card-head"><h2>Histórico</h2></div><div className="card-body"><Timeline events={events} /></div></div>
        </div>
        <aside className="card card-pad">
          <div className="label" style={{ marginBottom: 12 }}>Colaborador</div>
          <div className="row" style={{ gap: 12 }}><Avatar name={target.name} /><div><Link to={`/admin/colaboradores/${target.id}`} className="strong">{target.name}</Link><div className="xs muted">{target.sector}</div></div></div>
          <p className="xs muted" style={{ marginTop: 16 }}>Regra: líderes solicitam, a TI aplica. A permissão individual soma-se às do perfil e pode ser revista na ficha do colaborador.</p>
        </aside>
      </div>
      <Dialog open={dlg === 'aplicar'} onClose={() => setDlg(null)} title={`Aplicar ${a.numero}?`} desc={`${target.name} recebe a permissão individual em ${moduleName(a.module)} (${COMPANIES[a.companyId].name}).`}
        footer={<><button className="btn btn-secondary" onClick={() => setDlg(null)}>Cancelar</button><button className="btn btn-primary" onClick={aplicar}><Check size={17} />Aplicar acesso</button></>}>
        <Field label="Observação (opcional)" htmlFor="obs-a"><textarea id="obs-a" className="textarea" value={obs} onChange={(e) => setObs(e.target.value)} /></Field>
      </Dialog>
      <Dialog open={dlg === 'recusar'} onClose={() => { setDlg(null); setErr(''); }} title={`Recusar ${a.numero}?`} desc="O líder é notificado com o motivo."
        footer={<><button className="btn btn-secondary" onClick={() => setDlg(null)}>Cancelar</button><button className="btn btn-danger" onClick={recusar}>Recusar solicitação</button></>}>
        <Field label="Motivo" required error={err} htmlFor="obs-r"><textarea id="obs-r" className="textarea" value={obs} onChange={(e) => { setObs(e.target.value); setErr(''); }} aria-invalid={!!err} /></Field>
      </Dialog>
    </>
  );
}
