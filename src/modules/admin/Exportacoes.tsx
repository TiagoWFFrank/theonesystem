// Exportação configurada pela Gerência: autorização permanente ou por solicitação, por módulo.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, ChevronRight, Download, History, Lock, Save, ShieldCheck } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { useUrlState } from '@/platform/hooks';
import { fmtDate } from '@/platform/format';
import { ROLE_LABEL, ROLES } from '@/platform/permissions';
import { Badge, EmptyState, PageHeader } from '@/ui/core';
import { Timeline } from '@/ui/records';
import { useToast } from '@/ui/toast';
import { ForbiddenInline } from '@/pages/NotFound';
import { EXP_STATUS } from '@/pages/ExportRequest';
import { moduleName } from './meta';
import { exportModules, exportsOf } from '@/platform/registry';
import { configVersion, ruleGaps } from '@/platform/exports';
import type { ExportConfig, ExportRequest, ModuleId } from '@/platform/types';

const FORMATS: ExportConfig['formats'] = ['CSV', 'XLSX', 'PDF'];

export default function Exportacoes() {
  const { data, can, update, log, company, userName, me } = useDemo();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useUrlState({ aba: 'regras', situacao: '' });
  const mods = exportModules().filter((m) => data.exportConfig[m]) as ModuleId[];
  const [mod, setMod] = useState<ModuleId>('inventario');
  const saved = data.exportConfig[mod]!;
  const [draft, setDraft] = useState<ExportConfig>(saved);
  useEffect(() => setDraft(data.exportConfig[mod]!), [mod, data.exportConfig]);
  if (!can('admin', 'exportacoes')) return <ForbiddenInline module="Exportações" />;
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  const fields = exportsOf(mod)?.fields ?? [];
  const label = (k: string) => fields.find((x) => x.key === k)?.label ?? k;
  // solicitações aprovadas (ainda baixáveis) que a nova regra deixaria de permitir
  const affected = changed ? data.exportRequests.filter((x) => x.module === mod && ['aprovada', 'gerada', 'simulada'].includes(x.status)
    && ruleGaps(draft, x.content, data.users.find((u) => u.id === x.requesterId), false, label).length > 0) : [];
  const toggle = <T,>(l: T[], v: T) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);
  const save = () => {
    const versao = configVersion(saved) + 1;
    update((d) => { d.exportConfig[mod] = { ...draft, versao, atualizadoEm: new Date().toISOString(), atualizadoPor: me?.id }; });
    log({ module: 'admin', recordId: `export-cfg-${mod}`, recordLabel: `Exportação ${moduleName(mod)}`, action: `Regra de exportação de ${moduleName(mod)} v${versao}: ${draft.enabled ? `${draft.mode === 'permanente' ? 'autorização permanente' : 'por solicitação'} · ${draft.formats.join('/')} · campos ${draft.fields.map(label).join(', ')} · cargos ${draft.roles.map((r) => ROLE_LABEL[r]).join(', ')}` : 'desativada'}${affected.length ? ` · ${affected.length} aprovação(ões) deixam de ser baixáveis` : ''}`, kind: 'exportacao' });
    toast(<>Regra de exportação de <b>{moduleName(mod)}</b> salva (v{versao}).{affected.length ? ` ${affected.length} exportação(ões) aprovada(s) passam a ser bloqueadas no download.` : ''}</>);
  };
  const reqs = data.exportRequests.filter((x) => x.companyId === company);
  const shown = reqs.filter((x) => !f.situacao || x.status === f.situacao).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  const exportsLog = data.events.filter((e) => e.kind === 'exportacao').slice(-6);

  return (
    <>
      <PageHeader crumbs={[{ label: 'Administração' }, { label: 'Exportações' }]} title="Exportações e preservação"
        sub="A Gerência define, por módulo, quem exporta com autorização permanente e o que depende de solicitação e decisão. Nenhum registro é excluído." />
      <div className="layout-detail">
        <div className="card">
          <div className="tabs" role="tablist">
            <button role="tab" className="tab" aria-selected={f.aba === 'regras'} onClick={() => setF({ aba: 'regras' })}>Regras por módulo</button>
            <button role="tab" className="tab" aria-selected={f.aba === 'solicitacoes'} onClick={() => setF({ aba: 'solicitacoes' })}>Solicitações<span className="tab-count">{reqs.filter((x) => x.status === 'pendente').length}</span></button>
          </div>
          {f.aba === 'regras' ? (
            <>
              <div className="form-section" style={{ paddingBottom: 14 }}>
                <div className="seg" role="group" aria-label="Módulo" style={{ width: 'auto' }}>
                  {mods.map((m) => <button key={m} aria-pressed={mod === m} onClick={() => setMod(m)}>{moduleName(m)} · {data.exportConfig[m]?.enabled ? (data.exportConfig[m]!.mode === 'permanente' ? 'permanente' : 'por solicitação') : 'desativada'}</button>)}
                </div>
              </div>
              <div className="form-section">
                <label className="check" style={{ fontWeight: 600 }}><input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />Permitir exportação de {moduleName(mod)}</label>
              </div>
              <fieldset disabled={!draft.enabled} style={{ border: 0, margin: 0, padding: 0, opacity: draft.enabled ? 1 : .5 }}>
                <div className="form-section"><h3>Tipo de autorização</h3><p className="section-desc">Como os cargos escolhidos podem exportar.</p>
                  <div className="radio-cards" style={{ gridTemplateColumns: '1fr 1fr' }} role="radiogroup" aria-label="Tipo de autorização">
                    <label className="radio-card"><input type="radio" name="mode" checked={draft.mode === 'permanente'} onChange={() => setDraft({ ...draft, mode: 'permanente' })} /><span><b>Permanente</b><br /><span className="xs muted">Exportam direto; cada exportação é registrada.</span></span></label>
                    <label className="radio-card"><input type="radio" name="mode" checked={draft.mode === 'aprovacao'} onChange={() => setDraft({ ...draft, mode: 'aprovacao' })} /><span><b>Por solicitação</b><br /><span className="xs muted">Pedem com justificativa; a Gerência decide e o arquivo é liberado.</span></span></label>
                  </div>
                </div>
                <div className="form-section"><h3>Cargos</h3><p className="section-desc">{draft.mode === 'permanente' ? 'Veem o botão Exportar nas listas.' : 'Veem o botão Solicitar exportação.'} A Gerência sempre pode exportar.</p>
                  <div className="grid-3">{ROLES.filter((r) => r !== 'gerencia').map((r) => <label key={r} className="check"><input type="checkbox" checked={draft.roles.includes(r)} onChange={() => setDraft({ ...draft, roles: toggle(draft.roles, r) })} />{ROLE_LABEL[r]}</label>)}</div>
                </div>
                <div className="form-section"><h3>Formatos e campos</h3>
                  <div className="row-wrap" style={{ gap: 18, marginBottom: 14 }}>{FORMATS.map((x) => <label key={x} className="check"><input type="checkbox" checked={draft.formats.includes(x)} onChange={() => setDraft({ ...draft, formats: toggle(draft.formats, x) })} />{x}</label>)}</div>
                  <div className="grid-3">{fields.map((x) => <label key={x.key} className="check"><input type="checkbox" checked={draft.fields.includes(x.key)} onChange={() => setDraft({ ...draft, fields: toggle(draft.fields, x.key) })} />{x.label}</label>)}</div>
                  <label className="check" style={{ marginTop: 16 }}><input type="checkbox" checked={draft.includeHistory} onChange={(e) => setDraft({ ...draft, includeHistory: e.target.checked })} />Incluir histórico de cada registro</label>
                </div>
              </fieldset>
              {affected.length > 0 && (
                <div className="form-section" style={{ paddingTop: 0 }}><div className="banner banner-warn" role="alert"><Lock size={17} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span className="b-text small"><b>{affected.map((x) => x.numero).join(', ')}</b> {affected.length === 1 ? 'foi aprovada' : 'foram aprovadas'} com conteúdo que esta regra não permite mais. Ao salvar, o download {affected.length === 1 ? 'dela' : 'delas'} fica bloqueado e será preciso solicitar de novo.</span></div></div>
              )}
              <div className="form-actions">
                <span className="xs muted" style={{ marginRight: 'auto' }}>Regra v{configVersion(saved)}{saved.atualizadoEm ? ` · alterada em ${fmtDate(saved.atualizadoEm)} por ${userName(saved.atualizadoPor)}` : ''}</span>
                <button className="btn btn-secondary" disabled={!changed} onClick={() => setDraft(saved)}>Descartar</button>
                <button className="btn btn-primary" disabled={!changed} onClick={save}><Save size={16} />Salvar regra</button>
              </div>
            </>
          ) : (
            <>
              <div className="list-tools">
                <div className="seg-filter" role="group" aria-label="Situação">
                  <button aria-pressed={!f.situacao} onClick={() => setF({ situacao: '' })}>Todas<span className="n">{reqs.length}</span></button>
                  {(Object.keys(EXP_STATUS) as ExportRequest['status'][]).map((k) => <button key={k} aria-pressed={f.situacao === k} onClick={() => setF({ situacao: k })}>{EXP_STATUS[k].label.split(' ·')[0]}<span className="n">{reqs.filter((x) => x.status === k).length}</span></button>)}
                </div>
              </div>
              {shown.length === 0 ? <EmptyState icon={<Download size={22} />} title="Nenhuma solicitação nesta situação" /> : (
                <div className="table-wrap">
                  <table className="tbl">
                    <thead><tr><th>Número</th><th>Módulo</th><th>Solicitante</th><th>Registros</th><th>Situação</th><th className="r">Data</th><th /></tr></thead>
                    <tbody>{shown.map((x) => (
                      <tr key={x.id} onClick={() => nav(`/exportacoes/${x.id}`)}>
                        <td className="id-cell">{x.numero}</td><td>{moduleName(x.module)}</td><td className="small">{userName(x.requesterId)}</td>
                        <td className="num small">{x.content.recordIds.length} · {x.content.formato}</td><td><Badge tone={EXP_STATUS[x.status].tone}>{EXP_STATUS[x.status].label.split(' ·')[0]}</Badge></td>
                        <td className="num small r">{fmtDate(x.criadoEm)}</td><td className="row-action"><ChevronRight size={18} className="muted" /></td>
                      </tr>))}</tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
        <aside className="stack">
          <div className="card card-pad">
            <div className="row strong" style={{ marginBottom: 12 }}><ShieldCheck size={18} />Preservação de registros</div>
            <ul className="checklist small">
              <li><Archive size={15} className="ok-ic" />Nenhum registro é excluído; situações como bloqueado, cancelado ou desativado mantêm os dados.</li>
              <li><History size={15} className="ok-ic" />Toda alteração gera histórico com autor e data.</li>
              <li><Download size={15} className="ok-ic" />Exportações são cópias e ficam na auditoria.</li>
              <li><Lock size={15} className="ok-ic" />Plugins desativados preservam seus dados.</li>
            </ul>
          </div>
          <div className="card"><div className="card-head"><h3>Exportações recentes</h3></div><div className="card-body">{exportsLog.length ? <Timeline events={exportsLog} /> : <p className="small muted">Nenhuma exportação ainda.</p>}</div></div>
        </aside>
      </div>
    </>
  );
}
