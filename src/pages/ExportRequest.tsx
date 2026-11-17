// Solicitação de exportação: a Gerência decide aqui; o solicitante acompanha e baixa quando aprovada.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Download, FileSpreadsheet, X } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { fmtDateTime } from '@/platform/format';
import { Avatar, BackToList, Badge, Dialog, Field, KV, PageHeader, type Tone } from '@/ui/core';
import { COMPANIES } from '@/ui/brand';
import { Timeline } from '@/ui/records';
import { generateFile } from '@/ui/export';
import { ORIGINS } from '@/ui/origin';
import { useToast } from '@/ui/toast';
import { ForbiddenInline, NotFoundInline } from './NotFound';
import type { ExportRequest as ER } from '@/platform/types';

export const EXP_STATUS: Record<ER['status'], { label: string; tone: Tone }> = {
  pendente: { label: 'Aguardando Gerência', tone: 'warn' }, aprovada: { label: 'Aprovada · pronta para baixar', tone: 'ok' },
  recusada: { label: 'Recusada', tone: 'neutral' }, baixada: { label: 'Arquivo baixado', tone: 'info' },
};

export default function ExportRequestPage() {
  const { id } = useParams();
  const { data, me, can, update, log, notify, userName } = useDemo();
  const toast = useToast();
  const [dlg, setDlg] = useState<null | 'aprovar' | 'recusar'>(null);
  const [obs, setObs] = useState('');
  const [err, setErr] = useState('');
  const x = data.exportRequests.find((r) => r.id === id);
  if (!x) return <NotFoundInline what="solicitação de exportação" back="/inicio" />;
  const isManager = can('admin', 'exportacoes') && !!me?.grants?.[x.companyId]?.admin?.actions.includes('exportacoes');
  const isRequester = x.requesterId === me?.id;
  if (!isManager && !isRequester) return <ForbiddenInline module="Exportações" />;
  const events = data.events.filter((e) => e.recordId === x.id);
  const decide = (ok: boolean) => {
    if (!ok && obs.trim().length < 10) { setErr('Explique o motivo da recusa (mínimo de 10 caracteres).'); return; }
    update((d) => { const r = d.exportRequests.find((y) => y.id === x.id)!; r.status = ok ? 'aprovada' : 'recusada'; r.decididoPor = me!.id; r.decididoEm = new Date().toISOString(); r.obs = obs.trim() || undefined; });
    log({ module: 'admin', recordId: x.id, recordLabel: x.numero, action: ok ? `Exportação aprovada pela Gerência${obs.trim() ? ` — ${obs.trim()}` : ''}` : `Exportação recusada: ${obs.trim()}`, kind: 'decisao', companyId: x.companyId });
    notify({ userId: x.requesterId, module: 'admin', kind: 'exportacao', title: ok ? 'Exportação aprovada' : 'Exportação recusada', subject: `${x.numero} · ${ok ? 'arquivo liberado para download' : obs.trim()}`, link: `/exportacoes/${x.id}`, recordId: x.id, companyId: x.companyId });
    toast(ok ? <>Exportação <b>{x.numero}</b> aprovada. {userName(x.requesterId).split(' ')[0]} foi avisado por notificação e e-mail.</> : <>Exportação <b>{x.numero}</b> recusada.</>);
    setDlg(null); setObs('');
  };
  const baixar = () => {
    generateFile(data, x.module, x.recordIds, `${x.numero.toLowerCase()}-${x.module}`, x.formato);
    update((d) => { d.exportRequests.find((y) => y.id === x.id)!.status = 'baixada'; });
    log({ module: 'admin', recordId: x.id, recordLabel: x.numero, action: `Arquivo ${x.formato} baixado (${x.registros} registros)`, kind: 'exportacao', companyId: x.companyId });
    toast(<>Arquivo da <b>{x.numero}</b> gerado{x.formato === 'CSV' ? '' : ' (simulação)'}. Registrado na auditoria.</>);
  };
  return (
    <>
      <PageHeader crumbs={[{ label: 'Exportações' }, { label: x.numero }]} eyebrow={<div className="detail-id">{x.numero}</div>}
        title={`Exportação de ${ORIGINS[x.module].name}`}
        sub={<span className="row-wrap" style={{ gap: 10 }}><Badge tone={EXP_STATUS[x.status].tone}>{EXP_STATUS[x.status].label}</Badge><span className="small muted">{COMPANIES[x.companyId].name} · solicitada em {fmtDateTime(x.criadoEm)}</span></span>}
        actions={<>
          <BackToList fallback="/inicio" />
          {isManager && x.status === 'pendente' && <button className="btn btn-secondary" onClick={() => setDlg('recusar')}><X size={16} />Recusar</button>}
          {isManager && x.status === 'pendente' && <button className="btn btn-primary" onClick={() => setDlg('aprovar')}><Check size={17} />Aprovar exportação</button>}
          {isRequester && x.status === 'aprovada' && <button className="btn btn-primary" onClick={baixar}><Download size={17} />Baixar arquivo</button>}
        </>} />
      <div className="layout-detail">
        <div className="stack">
          <div className="card card-pad">
            <KV items={[['Módulo', ORIGINS[x.module].name], ['Formato', x.formato], ['Registros', String(x.registros)], ['Filtros', x.filtros], ['Regra', 'Exportação por solicitação (decisão da Gerência)'], ['Decisão', x.decididoPor ? `${userName(x.decididoPor)} · ${fmtDateTime(x.decididoEm)}` : '—']]} />
            <div style={{ marginTop: 18 }}><div className="label" style={{ marginBottom: 6 }}>Justificativa</div><p>{x.justificativa}</p></div>
            {x.obs && <div style={{ marginTop: 14 }}><div className="label" style={{ marginBottom: 6 }}>Observação da Gerência</div><p>{x.obs}</p></div>}
          </div>
          <div className="card"><div className="card-head"><h2>Histórico</h2></div><div className="card-body"><Timeline events={events} /></div></div>
        </div>
        <aside className="card card-pad">
          <div className="label" style={{ marginBottom: 12 }}>Solicitante</div>
          <div className="row" style={{ gap: 12 }}><Avatar name={userName(x.requesterId)} /><div><div className="strong">{userName(x.requesterId)}</div><div className="xs muted">{data.users.find((u) => u.id === x.requesterId)?.sector}</div></div></div>
          <p className="xs muted" style={{ marginTop: 16 }}><FileSpreadsheet size={13} style={{ verticalAlign: '-2px' }} /> O arquivo é gerado no momento do download com os mesmos registros da solicitação. Todos os registros permanecem preservados.</p>
        </aside>
      </div>
      <Dialog open={dlg === 'aprovar'} onClose={() => setDlg(null)} title={`Aprovar ${x.numero}?`} desc={`${userName(x.requesterId)} poderá baixar ${x.registros} registros em ${x.formato}.`}
        footer={<><button className="btn btn-secondary" onClick={() => setDlg(null)}>Cancelar</button><button className="btn btn-primary" onClick={() => decide(true)}><Check size={17} />Aprovar exportação</button></>}>
        <Field label="Observação (opcional)" htmlFor="ex-obs"><textarea id="ex-obs" className="textarea" value={obs} onChange={(e) => setObs(e.target.value)} /></Field>
      </Dialog>
      <Dialog open={dlg === 'recusar'} onClose={() => { setDlg(null); setErr(''); }} title={`Recusar ${x.numero}?`} desc="O solicitante recebe o motivo por notificação e e-mail."
        footer={<><button className="btn btn-secondary" onClick={() => setDlg(null)}>Cancelar</button><button className="btn btn-danger" onClick={() => decide(false)}>Recusar</button></>}>
        <Field label="Motivo" required error={err} htmlFor="ex-mot"><textarea id="ex-mot" className="textarea" value={obs} onChange={(e) => { setObs(e.target.value); setErr(''); }} aria-invalid={!!err} /></Field>
      </Dialog>
    </>
  );
}
