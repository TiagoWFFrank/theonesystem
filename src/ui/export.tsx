// Exportação configurada pela Gerência:
//  · permanente → cargos autorizados exportam direto;
//  · por solicitação → cargos autorizados pedem, a Gerência decide e o arquivo é liberado.
// Toda exportação é uma cópia, registrada na auditoria. Nenhum registro é removido.
import { useState } from 'react';
import { Download, FileSpreadsheet, Send, ShieldCheck } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { fmtDate, uid } from '@/platform/format';
import type { DemoData, ExportRequest, ModuleId, RoleId, User } from '@/platform/types';
import { Dialog, Field } from './core';
import { useToast } from './toast';

type Col = { key: string; label: string; get: (r: Record<string, unknown>, d: DemoData) => string };
const name = (d: DemoData, id?: unknown) => d.users.find((u) => u.id === id)?.name ?? '';
export const EXPORT_COLUMNS: Partial<Record<ModuleId, { source: (d: DemoData) => Record<string, unknown>[]; cols: Col[] }>> = {
  inventario: { source: (d) => d.equipments as never, cols: [
    { key: 'patrimonio', label: 'Patrimônio', get: (r) => String(r.patrimonio) }, { key: 'descricao', label: 'Equipamento', get: (r) => String(r.descricao) },
    { key: 'tipo', label: 'Tipo', get: (r) => String(r.tipo) }, { key: 'responsavel', label: 'Responsável', get: (r, d) => name(d, r.responsavelId) },
    { key: 'localizacao', label: 'Localização', get: (r) => String(r.localizacao) }, { key: 'situacao', label: 'Situação', get: (r) => String(r.status) },
    { key: 'ultimaMov', label: 'Última movimentação', get: (r) => fmtDate(String(r.ultimaMov)) },
  ] },
  reverso: { source: (d) => d.reversos as never, cols: [
    { key: 'numero', label: 'Número', get: (r) => String(r.numero) }, { key: 'motivo', label: 'Motivo', get: (r) => String(r.motivo) },
    { key: 'cliente', label: 'Cliente', get: (r) => `${r.clienteCodigo} ${r.clienteNome}` }, { key: 'situacao', label: 'Situação', get: (r) => String(r.status) },
    { key: 'abertura', label: 'Abertura', get: (r) => fmtDate(String(r.criadoEm)) },
  ] },
  viagens: { source: (d) => d.viagens as never, cols: [
    { key: 'codigo', label: 'Código', get: (r) => String(r.codigo) }, { key: 'viajante', label: 'Viajante', get: (r, d) => name(d, r.viajanteId) },
    { key: 'destino', label: 'Destino', get: (r) => String(r.destino) }, { key: 'periodo', label: 'Período', get: (r) => `${fmtDate(String(r.inicio))} a ${fmtDate(String(r.fim))}` },
    { key: 'situacao', label: 'Situação', get: (r) => String(r.status) },
  ] },
};

export function exportRight(d: DemoData, me: User | undefined, module: ModuleId, canManage: boolean): 'direto' | 'solicitar' | null {
  const cfg = d.exportConfig[module];
  if (!me || !cfg?.enabled) return null;
  if (canManage) return 'direto'; // Gerência
  if (!me.roles.some((r: RoleId) => cfg.roles.includes(r))) return null;
  return cfg.mode === 'permanente' ? 'direto' : 'solicitar';
}

/** Gera o CSV (download real quando o navegador permite) e devolve as linhas. */
export function generateFile(d: DemoData, module: ModuleId, ids: string[], fileName: string, fmt: string) {
  const def = EXPORT_COLUMNS[module]!;
  const cfg = d.exportConfig[module]!;
  const cols = def.cols.filter((c) => cfg.fields.includes(c.key));
  const rows = def.source(d).filter((r) => ids.includes(String(r.id)));
  const csv = [cols.map((c) => c.label).join(';'), ...rows.map((r) => cols.map((c) => `"${c.get(r, d).replace(/"/g, '""')}"`).join(';'))].join('\n');
  if (fmt === 'CSV') try {
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    Object.assign(document.createElement('a'), { href: url, download: `${fileName}.csv` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch { /* download indisponível no visualizador */ }
  return { cols, rows };
}

export function ExportButton({ module, rows, name: fileName, filtros }: { module: ModuleId; rows: { id: string }[]; name: string; filtros: string }) {
  const { data, me, company, can, log, notify, update } = useDemo();
  const toast = useToast();
  const right = exportRight(data, me, module, can('admin', 'exportacoes'));
  const [open, setOpen] = useState(false);
  const cfg = data.exportConfig[module];
  const [fmt, setFmt] = useState<'CSV' | 'XLSX' | 'PDF'>(cfg?.formats[0] ?? 'CSV');
  const [just, setJust] = useState('');
  const [err, setErr] = useState('');
  if (!right || !cfg || !me) return null;
  const def = EXPORT_COLUMNS[module]!;
  const cols = def.cols.filter((c) => cfg.fields.includes(c.key));
  const preview = def.source(data).filter((r) => rows.some((x) => x.id === r.id)).slice(0, 4);
  const ids = rows.map((r) => r.id);

  const direct = () => {
    generateFile(data, module, ids, fileName, fmt);
    log({ module: 'admin', recordId: `export-${module}`, recordLabel: `Exportação ${fileName}`, action: `Exportação ${fmt} · ${rows.length} registros · ${cols.length} campos · ${cfg.mode === 'permanente' ? 'autorização permanente' : 'Gerência'}`, kind: 'exportacao' });
    toast(<>Arquivo <b>{fileName}.{fmt.toLowerCase()}</b> gerado com {rows.length} registros{fmt === 'CSV' ? '' : ' (simulação)'}. Registrado na auditoria.</>);
    setOpen(false);
  };
  const request = () => {
    if (just.trim().length < 10) { setErr('Explique para que a exportação será usada (mínimo de 10 caracteres).'); return; }
    const id = uid('x');
    const numero = `EXP-${String(6 + data.exportRequests.length).padStart(4, '0')}`;
    const req: ExportRequest = { id, numero, module, companyId: company, requesterId: me.id, formato: fmt, registros: rows.length, filtros, recordIds: ids, justificativa: just.trim(), status: 'pendente', criadoEm: new Date().toISOString() };
    update((d) => { d.exportRequests.push(req); });
    log({ module: 'admin', recordId: id, recordLabel: numero, action: `${me.name} solicitou exportação ${fmt} de ${rows.length} registros (${filtros})`, kind: 'exportacao' });
    for (const g of data.users.filter((u) => u.status === 'ativo' && u.grants?.[company]?.admin?.actions.includes('exportacoes')))
      notify({ userId: g.id, module: 'admin', kind: 'exportacao', title: 'Exportação aguardando sua decisão', subject: `${numero} · ${me.name} · ${rows.length} registros`, link: `/exportacoes/${id}`, recordId: id, companyId: company });
    toast(<>Solicitação <b>{numero}</b> enviada à Gerência. Você será avisado da decisão.</>);
    setOpen(false); setJust('');
  };
  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen(true)}>{right === 'direto' ? <Download size={17} /> : <Send size={16} />}{right === 'direto' ? 'Exportar' : 'Solicitar exportação'}</button>
      <Dialog open={open} onClose={() => setOpen(false)} title={right === 'direto' ? 'Exportar lista' : 'Solicitar exportação'} size="wide" icon={<FileSpreadsheet size={22} style={{ marginTop: 4 }} />}
        desc={`${rows.length} registros com os filtros atuais (${filtros}) · ${right === 'direto' ? (can('admin', 'exportacoes') ? 'Gerência' : 'autorização permanente definida pela Gerência') : 'esta exportação exige decisão da Gerência'}`}
        footer={<><button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
          {right === 'direto' ? <button className="btn btn-primary" onClick={direct}><Download size={16} />Gerar arquivo</button> : <button className="btn btn-primary" onClick={request}><Send size={16} />Enviar solicitação</button>}</>}>
        <div className="stack">
          <div className="seg" role="group" aria-label="Formato" style={{ width: 'auto', alignSelf: 'flex-start' }}>
            {cfg.formats.map((f) => <button key={f} aria-pressed={fmt === f} onClick={() => setFmt(f)} style={{ padding: '7px 18px' }}>{f}</button>)}
          </div>
          <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 12 }}>
            <table className="tbl" style={{ fontSize: 12.5 }}>
              <thead><tr>{cols.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
              <tbody>{preview.map((r, i) => <tr key={i} style={{ cursor: 'default' }}>{cols.map((c) => <td key={c.key} style={{ whiteSpace: 'nowrap' }}>{c.get(r, data)}</td>)}</tr>)}</tbody>
            </table>
          </div>
          {right === 'solicitar' && (
            <Field label="Para que será usada?" required error={err} htmlFor="exp-just" help="A justificativa vai para a Gerência e fica na auditoria.">
              <textarea id="exp-just" className="textarea" value={just} onChange={(e) => { setJust(e.target.value); setErr(''); }} aria-invalid={!!err} />
            </Field>
          )}
          <div className="banner banner-info"><ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 2 }} /><span className="b-text">A exportação é uma cópia: todos os registros continuam preservados na plataforma. Fica registrada na auditoria{cfg.includeHistory ? ' e inclui o histórico de cada registro' : ''}.</span></div>
        </div>
      </Dialog>
    </>
  );
}
