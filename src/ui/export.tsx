// Exportação configurada pela Gerência, com recursos FORNECIDOS PELO PLUGIN (campos, linhas visíveis, histórico):
//  · permanente → cargos autorizados exportam direto;
//  · por solicitação → o conteúdo exato (ambiente, registros, campos, formato) é registrado, a Gerência decide
//    sobre esse conteúdo e o download revalida acesso e regra antes de gerar.
// Resultado sempre explícito: arquivo gerado, exportação simulada (formato sem gerador) ou falha.
import { useState } from 'react';
import { AlertTriangle, Download, FileSpreadsheet, RotateCw, Send, ShieldCheck } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { uid } from '@/platform/format';
import { exportsOf } from '@/platform/registry';
import { buildFile, configVersion, deliverCsv, exportRight, hashContent, REAL_FORMATS } from '@/platform/exports';
import { effectiveGrant } from '@/platform/permissions';
import { OpError, type ContribCtx, type ExportAttempt, type ExportContent, type ExportFormat, type ExportRequest, type ModuleId } from '@/platform/types';
import { Dialog, Field } from './core';
import { useToast } from './toast';

type Store = ReturnType<typeof useDemo>;

/**
 * Gera a exportação de um conteúdo já autorizado, com o contexto ATUAL da pessoa.
 * bloqueado = acesso/correspondência não confere · falha = serviço de arquivos ou navegador · simulado · gerado.
 */
export function produceExport(s: Store, ctx: ContribCtx, content: ExportContent, fileName: string): ExportAttempt {
  const ts = new Date().toISOString();
  const by = ctx.me.id;
  const p = exportsOf(content.module);
  if (!p) return { ts, by, result: 'bloqueado', detail: 'O plugin não fornece mais recursos de exportação' };
  const built = buildFile(ctx, p, content);
  if (!built.ok) return { ts, by, result: 'bloqueado', detail: built.detail };
  try { s.call('arquivos'); } catch (e) {
    return { ts, by, result: 'falha', detail: e instanceof OpError ? 'O serviço de arquivos não respondeu; nenhum arquivo foi gerado' : 'Falha inesperada na geração' };
  }
  const shape = `${built.rows} registros × ${built.cols} colunas`;
  if (!REAL_FORMATS.includes(content.formato))
    return { ts, by, result: 'simulado', detail: `Formato ${content.formato} sem gerador nesta versão: conteúdo conferido (${shape}), nenhum arquivo produzido`, hash: built.hash };
  if (!deliverCsv(built.csv, fileName)) return { ts, by, result: 'falha', detail: 'O navegador não permitiu salvar o arquivo' };
  return { ts, by, result: 'gerado', detail: `CSV com ${shape}`, bytes: built.bytes, hash: built.hash };
}

export const RESULT_LABEL: Record<ExportAttempt['result'], { label: string; tone: 'ok' | 'info' | 'danger' | 'warn' }> = {
  gerado: { label: 'Arquivo gerado', tone: 'ok' }, simulado: { label: 'Exportação simulada', tone: 'info' },
  falha: { label: 'Falha na geração', tone: 'danger' }, bloqueado: { label: 'Download bloqueado', tone: 'warn' },
};

/** Conteúdo da exportação a partir da regra atual e das linhas que a pessoa vê. */
function contentFor(ctx: ContribCtx, module: ModuleId, ids: string[], formato: ExportFormat, filtros: string): ExportContent | null {
  const p = exportsOf(module);
  const cfg = ctx.data.exportConfig[module];
  if (!p || !cfg) return null;
  const rows = p.rows(ctx, ids);
  return {
    companyId: ctx.company, module, recordIds: rows.map((r) => r.id), recordLabels: rows.map((r) => r.label),
    fields: p.fields.filter((f) => cfg.fields.includes(f.key)), formato, includeHistory: cfg.includeHistory, filtros,
  };
}

export function ExportButton({ module, rows, name: fileName, filtros }: { module: ModuleId; rows: { id: string }[]; name: string; filtros: string }) {
  const s = useDemo();
  const { data, me, company, can, log, notify, update, contrib } = s;
  const toast = useToast();
  const right = exportRight(data, me, module, can('admin', 'exportacoes'));
  const [open, setOpen] = useState(false);
  const cfg = data.exportConfig[module];
  const [fmt, setFmt] = useState<ExportFormat>(cfg?.formats[0] ?? 'CSV');
  const [just, setJust] = useState('');
  const [err, setErr] = useState('');
  const [fail, setFail] = useState<ExportAttempt | null>(null);
  const p = exportsOf(module);
  if (!right || !cfg || !me || !p || !contrib) return null;
  const format = cfg.formats.includes(fmt) ? fmt : cfg.formats[0];
  const content = contentFor(contrib, module, rows.map((r) => r.id), format, filtros)!;
  const preview = p.rows(contrib, content.recordIds.slice(0, 4));

  const direct = () => {
    const at = produceExport(s, contrib, content, fileName);
    const mode = can('admin', 'exportacoes') ? 'Gerência' : 'autorização permanente';
    log({ module: 'admin', recordId: `export-${module}`, recordLabel: `Exportação ${fileName}`, action: `${RESULT_LABEL[at.result].label} · ${content.formato} · ${content.recordIds.length} registros · ${content.fields.length} campos · ${mode} — ${at.detail}`, kind: 'exportacao' });
    if (at.result === 'gerado' || at.result === 'simulado') {
      toast(at.result === 'gerado' ? <>Arquivo <b>{fileName}.csv</b> gerado: {at.detail}. Registrado na auditoria.</> : <>Exportação simulada. {at.detail}. Registrado na auditoria.</>, { tone: at.result === 'gerado' ? undefined : 'info' });
      setOpen(false); setFail(null);
    } else setFail(at);
  };
  const request = () => {
    if (just.trim().length < 10) { setErr('Explique para que a exportação será usada (mínimo de 10 caracteres).'); return; }
    const id = uid('x');
    const numero = `EXP-${String(6 + data.exportRequests.length).padStart(4, '0')}`;
    const req: ExportRequest = { id, numero, module, companyId: company, requesterId: me.id, content, hash: hashContent(content), regra: { mode: cfg.mode, versao: configVersion(cfg) }, justificativa: just.trim(), status: 'pendente', criadoEm: new Date().toISOString() };
    update((d) => { d.exportRequests.push(req); });
    log({ module: 'admin', recordId: id, recordLabel: numero, action: `${me.name} solicitou exportação ${content.formato} de ${content.recordIds.length} registros · ${content.fields.length} campos (${filtros}) · conteúdo #${req.hash}`, kind: 'exportacao' });
    for (const g of data.users.filter((u) => u.id !== me.id && effectiveGrant(data, u, company, 'admin')?.actions.includes('exportacoes')))
      notify({ userId: g.id, module: 'admin', kind: 'exportacao', title: 'Exportação aguardando sua decisão', subject: `${numero} · ${me.name} · ${content.recordIds.length} registros`, link: `/exportacoes/${id}`, recordId: id, companyId: company });
    toast(<>Solicitação <b>{numero}</b> enviada à Gerência com o conteúdo exato. Você será avisado da decisão.</>);
    setOpen(false); setJust('');
  };
  return (
    <>
      <button className="btn btn-secondary" onClick={() => { setOpen(true); setFail(null); }}>{right === 'direto' ? <Download size={17} /> : <Send size={16} />}{right === 'direto' ? 'Exportar' : 'Solicitar exportação'}</button>
      <Dialog open={open} onClose={() => setOpen(false)} title={right === 'direto' ? 'Exportar lista' : 'Solicitar exportação'} size="wide" icon={<FileSpreadsheet size={22} style={{ marginTop: 4 }} />}
        desc={`${content.recordIds.length} registros com os filtros atuais (${filtros}) · ${content.fields.length} campos · ${right === 'direto' ? (can('admin', 'exportacoes') ? 'Gerência' : 'autorização permanente definida pela Gerência') : 'esta exportação exige decisão da Gerência sobre exatamente este conteúdo'}`}
        footer={<><button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
          {right === 'direto' ? <button className="btn btn-primary" onClick={direct}>{fail ? <RotateCw size={16} /> : <Download size={16} />}{fail ? 'Tentar novamente' : REAL_FORMATS.includes(format) ? 'Gerar arquivo' : `Conferir (${format} simulado)`}</button>
            : <button className="btn btn-primary" onClick={request}><Send size={16} />Enviar solicitação</button>}</>}>
        <div className="stack">
          <div className="seg" role="group" aria-label="Formato" style={{ width: 'auto', alignSelf: 'flex-start' }}>
            {cfg.formats.map((f) => <button key={f} aria-pressed={format === f} onClick={() => setFmt(f)} style={{ padding: '7px 18px' }}>{f}{REAL_FORMATS.includes(f) ? '' : ' · simulado'}</button>)}
          </div>
          <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 12 }}>
            <table className="tbl" style={{ fontSize: 12.5 }}>
              <thead><tr>{content.fields.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
              <tbody>{preview.map((r) => <tr key={r.id} style={{ cursor: 'default' }}>{content.fields.map((c) => <td key={c.key} style={{ whiteSpace: 'nowrap' }}>{r.values[c.key]}</td>)}</tr>)}</tbody>
            </table>
          </div>
          {right === 'solicitar' && (
            <Field label="Para que será usada?" required error={err} htmlFor="exp-just" help="A justificativa vai para a Gerência e fica na auditoria.">
              <textarea id="exp-just" className="textarea" value={just} onChange={(e) => { setJust(e.target.value); setErr(''); }} aria-invalid={!!err} />
            </Field>
          )}
          {fail && <div className={`banner ${fail.result === 'falha' ? 'banner-danger' : 'banner-warn'}`} role="alert" data-export-result={fail.result}><AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 2 }} /><span className="b-text small"><b>{RESULT_LABEL[fail.result].label}.</b> {fail.detail}. Nada foi entregue; a tentativa ficou na auditoria.</span></div>}
          <div className="banner banner-info"><ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 2 }} /><span className="b-text">A exportação é uma cópia: todos os registros continuam preservados na plataforma. Fica registrada na auditoria{content.includeHistory ? ' e inclui o histórico de cada registro' : ''}. {REAL_FORMATS.includes(format) ? '' : `${format} ainda não tem gerador: o conteúdo é conferido, mas nenhum arquivo é produzido.`}</span></div>
        </div>
      </Dialog>
    </>
  );
}
