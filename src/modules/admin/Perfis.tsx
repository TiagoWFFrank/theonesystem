import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { moduleAvailability, ROLE_LABEL, ROLES, SCOPE_LABEL } from '@/platform/permissions';
import { Confirm, Field, PageHeader } from '@/ui/core';
import { COMPANIES } from '@/ui/brand';
import { Timeline } from '@/ui/records';
import { useToast } from '@/ui/toast';
import { PLUGINS } from '../plugins';
import { ADMIN_ACTIONS } from './meta';
import { ForbiddenInline } from '@/pages/NotFound';
import type { BrandId, Grant, ModuleId, RoleId, Scope } from '@/platform/types';


export default function Perfis() {
  const { data, company, update, log, can } = useDemo();
  const toast = useToast();
  const [emp, setEmp] = useState<BrandId>(company);
  const [role, setRole] = useState<RoleId>('colaborador');
  const modules = [...PLUGINS.filter((p) => moduleAvailability(data, emp, p.id) !== 'nao_instalado').map((p) => ({ id: p.id, name: p.name, actions: p.actions })),
    { id: 'admin' as ModuleId, name: 'Administração', actions: ADMIN_ACTIONS }];
  const [mod, setMod] = useState<ModuleId>('viagens');
  const current: Grant = data.permissions[emp]?.[role]?.[mod] ?? { actions: [], scope: 'proprios' };
  const [draft, setDraft] = useState<Grant>(current);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { setDraft(data.permissions[emp]?.[role]?.[mod] ?? { actions: [], scope: 'proprios' }); }, [emp, role, mod, data.permissions]);
  useEffect(() => { if (!modules.some((m) => m.id === mod)) setMod(modules[0].id); }, [emp]); // eslint-disable-line react-hooks/exhaustive-deps

  const m = modules.find((x) => x.id === mod) ?? modules[0];
  const allowedPage = can('admin', 'aplicar_acesso');
  const label = (id: string) => m.actions.find((a) => a.id === id)?.label ?? id;
  const diff = [
    ...draft.actions.filter((a) => !current.actions.includes(a)).map((a) => `+ ${label(a)}`),
    ...current.actions.filter((a) => !draft.actions.includes(a)).map((a) => `− ${label(a)}`),
    ...(draft.scope !== current.scope && draft.actions.length ? [`Escopo: ${SCOPE_LABEL[current.scope]} → ${SCOPE_LABEL[draft.scope]}`] : []),
  ];

  const save = () => {
    update((d) => {
      d.permissions[emp] ??= {};
      d.permissions[emp][role] ??= {};
      if (draft.actions.length) d.permissions[emp][role]![mod] = { ...draft };
      else delete d.permissions[emp][role]![mod];
    });
    log({ module: 'admin', recordId: `perm-${role}`, recordLabel: `Perfil ${ROLE_LABEL[role]}`, action: `Modelo ${ROLE_LABEL[role]} · ${m.name} · ${COMPANIES[emp].name}: ${diff.join(', ')}`, kind: 'acesso', companyId: emp });
    toast(<>Modelo do cargo <b>{ROLE_LABEL[role]}</b> atualizado em {m.name}. Concessões existentes não mudam.</>);
  };

  if (!allowedPage) return <ForbiddenInline module="Perfis e permissões" />;
  return (
    <>
      <PageHeader crumbs={[{ label: 'Administração' }, { label: 'Modelos de acesso' }]} title="Modelos de acesso por cargo"
        sub="Modelos que a TI usa para preencher concessões. Não concedem acesso sozinhos: o acesso efetivo é sempre a concessão individual de cada pessoa." />
      <div className="banner banner-info" style={{ marginBottom: 16 }}>
        <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 2 }} />
        <span className="b-text">Alterar um modelo não muda o acesso de ninguém. Para aplicar, abra a ficha do colaborador e use “Aplicar modelo dos cargos”, revisando cada ação.</span>
      </div>
      <div className="layout-detail">
        <div className="card">
          <div className="form-section">
            <div className="grid-3">
              <Field label="Ambiente" htmlFor="p-emp"><select id="p-emp" className="select" value={emp} onChange={(e) => setEmp(e.target.value as BrandId)}>{(Object.keys(COMPANIES) as BrandId[]).map((c) => <option key={c} value={c}>{COMPANIES[c].name}</option>)}</select></Field>
              <Field label="Cargo" htmlFor="p-role"><select id="p-role" className="select" value={role} onChange={(e) => setRole(e.target.value as RoleId)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
              <Field label="Módulo" htmlFor="p-mod"><select id="p-mod" className="select" value={m.id} onChange={(e) => setMod(e.target.value as ModuleId)}>{modules.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
            </div>
          </div>
          <div className="form-section">
            <h3>Ações permitidas</h3>
            <p className="section-desc">Declaradas pelo plugin {m.name}.</p>
            <div className="stack-sm">
              {m.actions.map((a) => (
                <label key={a.id} className="check">
                  <input type="checkbox" checked={draft.actions.includes(a.id)} onChange={() => setDraft((d) => ({ ...d, actions: d.actions.includes(a.id) ? d.actions.filter((x) => x !== a.id) : [...d.actions, a.id] }))} />
                  <span>{a.label} <span className="xs subtle mono">{mod}.{a.id}</span></span>
                </label>
              ))}
            </div>
          </div>
          <div className="form-section">
            <h3>Escopo</h3>
            <p className="section-desc">A quais registros a permissão se aplica.</p>
            <div className="radio-cards" role="radiogroup" aria-label="Escopo">
              {(['proprios', 'equipe', 'empresa'] as Scope[]).map((s) => (
                <label key={s} className="radio-card"><input type="radio" name="scope" checked={draft.scope === s} onChange={() => setDraft((d) => ({ ...d, scope: s }))} disabled={!draft.actions.length} /><span><b>{SCOPE_LABEL[s]}</b><br /><span className="xs muted">{s === 'proprios' ? 'Só o que é da pessoa' : s === 'equipe' ? 'Pessoa e liderados' : 'Todos da empresa'}</span></span></label>
              ))}
            </div>
          </div>
          {diff.length > 0 && (
            <div className="form-section" style={{ background: 'var(--surface-2)' }}>
              <h3>Resumo das mudanças</h3>
              <ul className="checklist" style={{ marginTop: 8 }}>{diff.map((d) => <li key={d} className="strong">{d}</li>)}</ul>
            </div>
          )}
          <div className="form-actions">
            <button className="btn btn-secondary" disabled={!diff.length} onClick={() => setDraft(current)}>Descartar</button>
            <button className="btn btn-primary" disabled={!diff.length} onClick={() => setConfirm(true)}><ShieldCheck size={17} />Salvar modelo</button>
          </div>
        </div>
        <aside className="stack">
          <div className="card">
            <div className="card-head"><h3>Matriz · {COMPANIES[emp].name}</h3></div>
            <div className="table-wrap">
              <table className="tbl" style={{ fontSize: 12.5 }}>
                <thead><tr><th>Perfil</th>{modules.map((x) => <th key={x.id} title={x.name}>{x.name.slice(0, 4)}.</th>)}</tr></thead>
                <tbody>
                  {ROLES.map((r) => (
                    <tr key={r} style={{ cursor: 'pointer', background: r === role ? 'var(--accent-soft)' : undefined }} onClick={() => setRole(r)}>
                      <td className="strong">{ROLE_LABEL[r].split(' ')[0]}</td>
                      {modules.map((x) => { const g = data.permissions[emp]?.[r]?.[x.id]; return <td key={x.id} className="num" title={g ? `${g.actions.join(', ')} · ${SCOPE_LABEL[g.scope]}` : 'Sem acesso'}>{g ? g.actions.length : '—'}</td>; })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="xs muted" style={{ padding: '10px 16px' }}>Número de ações por módulo. Passe o cursor para ver detalhes.</p>
          </div>
          <div className="card">
            <div className="card-head"><h3>Histórico administrativo</h3></div>
            <div className="card-body" style={{ maxHeight: 360, overflowY: 'auto' }}><Timeline events={data.events.filter((e) => e.module === 'admin').slice(-8)} /></div>
          </div>
        </aside>
      </div>
      <Confirm open={confirm} onClose={() => setConfirm(false)} onConfirm={save} confirmLabel="Salvar modelo" title="Salvar modelo do cargo"
        desc={`${ROLE_LABEL[role]} · ${m.name} · ${COMPANIES[emp].name}. Não altera o acesso de ninguém até ser aplicado na ficha de cada pessoa.`}>
        <ul className="checklist">{diff.map((d) => <li key={d} className="strong">{d}</li>)}</ul>
      </Confirm>
    </>
  );
}
