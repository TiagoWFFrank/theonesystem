// Exportação configurável pela Gerência + política de preservação de registros.
import { useEffect, useState } from 'react';
import { Archive, Download, History, Lock, Save, ShieldCheck } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { ROLE_LABEL, ROLES } from '@/platform/permissions';
import { PageHeader } from '@/ui/core';
import { Timeline } from '@/ui/records';
import { useToast } from '@/ui/toast';
import { ForbiddenInline } from '@/pages/NotFound';
import { moduleName } from './meta';
import type { ExportConfig, ModuleId } from '@/platform/types';

const FIELDS: Partial<Record<ModuleId, { key: string; label: string }[]>> = {
  inventario: [{ key: 'patrimonio', label: 'Patrimônio' }, { key: 'descricao', label: 'Equipamento' }, { key: 'tipo', label: 'Tipo' }, { key: 'responsavel', label: 'Responsável' }, { key: 'localizacao', label: 'Localização' }, { key: 'situacao', label: 'Situação' }, { key: 'ultimaMov', label: 'Última movimentação' }],
  reverso: [{ key: 'numero', label: 'Número' }, { key: 'motivo', label: 'Motivo' }, { key: 'cliente', label: 'Cliente' }, { key: 'situacao', label: 'Situação' }, { key: 'abertura', label: 'Abertura' }],
  viagens: [{ key: 'codigo', label: 'Código' }, { key: 'viajante', label: 'Viajante' }, { key: 'destino', label: 'Destino' }, { key: 'periodo', label: 'Período' }, { key: 'situacao', label: 'Situação' }],
};
const FORMATS: ExportConfig['formats'] = ['CSV', 'XLSX', 'PDF'];

export default function Exportacoes() {
  const { data, can, update, log } = useDemo();
  const toast = useToast();
  const mods = Object.keys(FIELDS) as ModuleId[];
  const [mod, setMod] = useState<ModuleId>('inventario');
  const saved = data.exportConfig[mod]!;
  const [draft, setDraft] = useState<ExportConfig>(saved);
  useEffect(() => setDraft(data.exportConfig[mod]!), [mod, data.exportConfig]);
  if (!can('admin', 'exportacoes')) return <ForbiddenInline module="Exportações" />;
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  const toggle = <T,>(l: T[], v: T) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);
  const save = () => {
    update((d) => { d.exportConfig[mod] = draft; });
    log({ module: 'admin', recordId: `export-cfg-${mod}`, recordLabel: `Exportação ${moduleName(mod)}`, action: `Configuração de exportação de ${moduleName(mod)}: ${draft.enabled ? `${draft.formats.join('/')} · perfis ${draft.roles.map((r) => ROLE_LABEL[r]).join(', ')} · ${draft.fields.length} campos` : 'desativada'}` });
    toast(<>Exportação de <b>{moduleName(mod)}</b> atualizada. O botão Exportar aparece para os perfis escolhidos.</>);
  };
  const exportsLog = data.events.filter((e) => e.module === 'admin' && e.recordId.startsWith('export')).slice(-6);

  return (
    <>
      <PageHeader crumbs={[{ label: 'Administração' }, { label: 'Exportações' }]} title="Exportações e preservação"
        sub="A Gerência define o que pode ser exportado, em quais formatos e por quais perfis. Nenhum registro é excluído da plataforma." />
      <div className="layout-detail">
        <div className="card">
          <div className="tabs" role="tablist">{mods.map((m) => <button key={m} role="tab" className="tab" aria-selected={mod === m} onClick={() => setMod(m)}>{moduleName(m)}<span className="tab-count">{data.exportConfig[m]?.enabled ? 'ativa' : 'off'}</span></button>)}</div>
          <div className="form-section">
            <label className="check" style={{ fontWeight: 600 }}><input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />Permitir exportação de {moduleName(mod)}</label>
          </div>
          <fieldset disabled={!draft.enabled} style={{ border: 0, margin: 0, padding: 0, opacity: draft.enabled ? 1 : .5, transition: 'opacity var(--dur)' }}>
            <div className="form-section"><h3>Formatos</h3><p className="section-desc">Arquivos que os perfis autorizados podem gerar.</p>
              <div className="row-wrap" style={{ gap: 18 }}>{FORMATS.map((f) => <label key={f} className="check"><input type="checkbox" checked={draft.formats.includes(f)} onChange={() => setDraft({ ...draft, formats: toggle(draft.formats, f) })} />{f}</label>)}</div>
            </div>
            <div className="form-section"><h3>Quem pode exportar</h3><p className="section-desc">Perfis que veem o botão Exportar nas listas.</p>
              <div className="grid-3">{ROLES.map((r) => <label key={r} className="check"><input type="checkbox" checked={draft.roles.includes(r)} onChange={() => setDraft({ ...draft, roles: toggle(draft.roles, r) })} />{ROLE_LABEL[r]}</label>)}</div>
            </div>
            <div className="form-section"><h3>Campos</h3><p className="section-desc">Colunas incluídas no arquivo, na ordem da lista.</p>
              <div className="grid-3">{FIELDS[mod]!.map((f) => <label key={f.key} className="check"><input type="checkbox" checked={draft.fields.includes(f.key)} onChange={() => setDraft({ ...draft, fields: toggle(draft.fields, f.key) })} />{f.label}</label>)}</div>
              <label className="check" style={{ marginTop: 16 }}><input type="checkbox" checked={draft.includeHistory} onChange={(e) => setDraft({ ...draft, includeHistory: e.target.checked })} />Incluir histórico de cada registro</label>
            </div>
          </fieldset>
          <div className="form-actions">
            <button className="btn btn-secondary" disabled={!changed} onClick={() => setDraft(saved)}>Descartar</button>
            <button className="btn btn-primary" disabled={!changed} onClick={save}><Save size={16} />Salvar configuração</button>
          </div>
        </div>
        <aside className="stack">
          <div className="card card-pad">
            <div className="row strong" style={{ marginBottom: 12 }}><ShieldCheck size={18} />Preservação de registros</div>
            <ul className="checklist small">
              <li><Archive size={15} className="ok-ic" />Nenhum registro é excluído; desativar ou bloquear mantém os dados.</li>
              <li><History size={15} className="ok-ic" />Toda alteração gera histórico com autor e data.</li>
              <li><Download size={15} className="ok-ic" />Exportações são cópias e ficam registradas.</li>
              <li><Lock size={15} className="ok-ic" />Plugins desativados preservam suas tabelas.</li>
            </ul>
          </div>
          <div className="card"><div className="card-head"><h3>Exportações recentes</h3></div><div className="card-body">{exportsLog.length ? <Timeline events={exportsLog} /> : <p className="small muted">Nenhuma exportação ainda.</p>}</div></div>
        </aside>
      </div>
    </>
  );
}
