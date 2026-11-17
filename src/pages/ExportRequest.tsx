// Solicitação de exportação: a Gerência decide sobre o CONTEÚDO EXATO pedido; o solicitante baixa depois de
// uma revalidação completa (ambiente, autorização, acesso atual, regra atual, registros) e o arquivo gerado
// precisa corresponder ao que foi autorizado. Toda tentativa — gerada, simulada, com falha ou bloqueada — fica registrada.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeftRight, Check, CheckCircle2, Download, FileSpreadsheet, RotateCw, X, XCircle } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { fmtDateTime } from '@/platform/format';
import { exportsOf, originMeta } from '@/platform/registry';
import { configVersion, hashContent, REAL_FORMATS, requestFileName, ruleGaps } from '@/platform/exports';
import { effectiveGrant, moduleAvailability } from '@/platform/permissions';
import { makeCtx } from '@/platform/work';
import { Avatar, BackToList, Badge, Dialog, Field, KV, PageHeader, type Tone } from '@/ui/core';
import { COMPANIES } from '@/ui/brand';
import { Timeline } from '@/ui/records';
import { produceExport, RESULT_LABEL } from '@/ui/export';
import { useToast } from '@/ui/toast';
import { ForbiddenInline, NotFoundInline } from './NotFound';
import type { DemoData, ExportAttempt, ExportRequest as ER, User } from '@/platform/types';

export const EXP_STATUS: Record<ER['status'], { label: string; tone: Tone }> = {
  pendente: { label: 'Aguardando Gerência', tone: 'warn' }, aprovada: { label: 'Aprovada · pronta para baixar', tone: 'ok' },
  recusada: { label: 'Recusada', tone: 'neutral' }, gerada: { label: 'Arquivo gerado', tone: 'info' }, simulada: { label: 'Exportação simulada', tone: 'accent' },
};

type Check = { label: string; ok: boolean; detail: string };
const fieldLabel = (m: string) => (k: string) => exportsOf(m)?.fields.find((f) => f.key === k)?.label ?? k;

/** Revalidação do download com o estado ATUAL. */
export function downloadChecks(data: DemoData, me: User | undefined, company: string, x: ER): Check[] {
  const cfg = data.exportConfig[x.module];
  const name = COMPANIES[x.companyId].name;
  const checks: Check[] = [];
  checks.push({ label: 'Solicitante', ok: me?.id === x.requesterId && me.status === 'ativo', detail: me?.id === x.requesterId ? (me.status === 'ativo' ? 'Você fez esta solicitação' : 'Seu acesso está suspenso') : 'Somente quem solicitou pode baixar' });
  checks.push({ label: 'Ambiente', ok: company === x.companyId, detail: company === x.companyId ? `Ambiente ${name}` : `A solicitação é do ambiente ${name}; troque de ambiente para baixar` });
  const intact = hashContent(x.content) === x.hash;
  const approved = ['aprovada', 'gerada', 'simulada'].includes(x.status) && x.aprovado?.hash === x.hash && intact;
  checks.push({ label: 'Autorização', ok: approved, detail: approved ? `Conteúdo #${x.hash} aprovado por ${data.users.find((u) => u.id === x.decididoPor)?.name ?? '—'}` : !intact ? 'O conteúdo registrado não confere com o aprovado' : 'Sem aprovação da Gerência para este conteúdo' });
  const avail = moduleAvailability(data, x.companyId, x.module);
  const grant = me ? effectiveGrant(data, me, x.companyId, x.module) : null;
  checks.push({ label: 'Acesso atual', ok: avail === 'ok' && !!grant, detail: avail !== 'ok' ? `${originMeta(x.module).name} não está disponível no ambiente` : grant ? `Acesso a ${originMeta(x.module).name} vigente` : `Seu acesso a ${originMeta(x.module).name} foi retirado` });
  const gaps = ruleGaps(cfg, x.content, me, false, fieldLabel(x.module));
  const changed = configVersion(cfg) !== (x.aprovado?.regraVersao ?? x.regra.versao);
  checks.push({ label: 'Regra de exportação', ok: gaps.length === 0, detail: gaps.length ? `A regra mudou depois da aprovação: ${gaps.join('; ')}` : changed ? `Regra alterada (v${x.aprovado?.regraVersao ?? x.regra.versao} → v${configVersion(cfg)}), mas o conteúdo autorizado continua permitido` : 'Regra igual à da aprovação' });
  if (me && company === x.companyId && grant) {
    const visible = exportsOf(x.module)?.rows(makeCtx(data, me, x.companyId), x.content.recordIds).length ?? 0;
    const n = x.content.recordIds.length;
    checks.push({ label: 'Registros autorizados', ok: visible === n, detail: visible === n ? `Os ${n} registros continuam acessíveis para você` : `${n - visible} de ${n} registros não estão mais acessíveis para você` });
  }
  return checks;
}

export default function ExportRequestPage() {
  const { id } = useParams();
  const s = useDemo();
  const { data, me, company, update, log, notify, userName, setSession } = s;
  const toast = useToast();
  const [dlg, setDlg] = useState<null | 'aprovar' | 'recusar'>(null);
  const [obs, setObs] = useState('');
  const [err, setErr] = useState('');
  const x = data.exportRequests.find((r) => r.id === id);
  if (!x) return <NotFoundInline what="solicitação de exportação" back="/inicio" />;
  const isManager = !!effectiveGrant(data, me, x.companyId, 'admin')?.actions.includes('exportacoes');
  const isRequester = x.requesterId === me?.id;
  if (!isManager && !isRequester) return <ForbiddenInline module="Exportações" />;
  const events = data.events.filter((e) => e.recordId === x.id);
  const cfg = data.exportConfig[x.module];
  const requester = data.users.find((u) => u.id === x.requesterId);
  const sameEnv = company === x.companyId;
  const last = x.tentativas?.[x.tentativas.length - 1];

  // decisão: o conteúdo pedido precisa caber na regra ATUAL e continuar acessível ao solicitante
  const decisionGaps = [...ruleGaps(cfg, x.content, requester, false, fieldLabel(x.module))];
  if (requester) {
    const vis = exportsOf(x.module)?.rows(makeCtx(data, requester, x.companyId), x.content.recordIds).length ?? 0;
    if (vis !== x.content.recordIds.length) decisionGaps.push(`${x.content.recordIds.length - vis} registros não estão mais acessíveis ao solicitante`);
  }
  const decide = (ok: boolean) => {
    if (!ok && obs.trim().length < 10) { setErr('Explique o motivo da recusa (mínimo de 10 caracteres).'); return; }
    if (ok && decisionGaps.length) return;
    update((d) => {
      const r = d.exportRequests.find((y) => y.id === x.id)!;
      r.status = ok ? 'aprovada' : 'recusada'; r.decididoPor = me!.id; r.decididoEm = new Date().toISOString(); r.obs = obs.trim() || undefined;
      if (ok) r.aprovado = { hash: r.hash, regraVersao: configVersion(d.exportConfig[x.module]) };
    });
    log({ module: 'admin', recordId: x.id, recordLabel: x.numero, action: ok ? `Exportação aprovada pela Gerência · conteúdo #${x.hash} (${x.content.recordIds.length} registros, ${x.content.fields.length} campos, ${x.content.formato})${obs.trim() ? ` — ${obs.trim()}` : ''}` : `Exportação recusada: ${obs.trim()}`, kind: 'decisao', companyId: x.companyId });
    notify({ userId: x.requesterId, module: 'admin', kind: 'exportacao', title: ok ? 'Exportação aprovada' : 'Exportação recusada', subject: `${x.numero} · ${ok ? 'arquivo liberado para download' : obs.trim()}`, link: `/exportacoes/${x.id}`, recordId: x.id, companyId: x.companyId });
    toast(ok ? <>Exportação <b>{x.numero}</b> aprovada. {userName(x.requesterId).split(' ')[0]} foi avisado por notificação e e-mail.</> : <>Exportação <b>{x.numero}</b> recusada.</>);
    setDlg(null); setObs('');
  };

  const checks = isRequester ? downloadChecks(data, me, company, x) : [];
  const canDownload = isRequester && ['aprovada', 'gerada', 'simulada'].includes(x.status);
  const record = (at: ExportAttempt) => {
    update((d) => {
      const r = d.exportRequests.find((y) => y.id === x.id)!;
      r.tentativas = [...(r.tentativas ?? []), at];
      if (at.result === 'gerado') r.status = 'gerada';
      else if (at.result === 'simulado') r.status = 'simulada';
    });
    log({ module: 'admin', recordId: x.id, recordLabel: x.numero, action: `${RESULT_LABEL[at.result].label}: ${at.detail}`, kind: 'exportacao', companyId: x.companyId });
  };
  const baixar = () => {
    // revalida no clique, com o estado deste momento
    const now = downloadChecks(data, me, company, x).filter((c) => !c.ok);
    if (now.length) {
      record({ ts: new Date().toISOString(), by: me!.id, result: 'bloqueado', detail: now.map((c) => c.detail).join('; ') });
      toast(<>Download de <b>{x.numero}</b> bloqueado: {now[0].detail}.</>, { tone: 'info' });
      return;
    }
    const at = produceExport(s, s.contrib!, x.content, requestFileName(x));
    record(at);
    if (at.result === 'gerado') toast(<>Arquivo da <b>{x.numero}</b> gerado: {at.detail}. Confere com o conteúdo autorizado #{x.hash}.</>);
    else if (at.result === 'simulado') toast(<>{at.detail}. Registrado na auditoria.</>, { tone: 'info' });
    else toast(<>{RESULT_LABEL[at.result].label}: {at.detail}.</>, { tone: 'info' });
  };

  return (
    <>
      <PageHeader crumbs={[{ label: 'Exportações' }, { label: x.numero }]} eyebrow={<div className="detail-id">{x.numero}</div>}
        title={`Exportação de ${originMeta(x.module).name}`}
        sub={<span className="row-wrap" style={{ gap: 10 }}><Badge tone={EXP_STATUS[x.status].tone}>{EXP_STATUS[x.status].label}</Badge><span className="small muted">{COMPANIES[x.companyId].name} · solicitada em {fmtDateTime(x.criadoEm)}</span></span>}
        actions={<>
          <BackToList fallback="/inicio" />
          {!sameEnv && <button className="btn btn-secondary" onClick={() => setSession({ companyId: x.companyId })}><ArrowLeftRight size={16} />Ir para {COMPANIES[x.companyId].name}</button>}
          {isManager && sameEnv && x.status === 'pendente' && <button className="btn btn-secondary" onClick={() => setDlg('recusar')}><X size={16} />Recusar</button>}
          {isManager && sameEnv && x.status === 'pendente' && <button className="btn btn-primary" disabled={decisionGaps.length > 0} title={decisionGaps.join('; ')} onClick={() => setDlg('aprovar')}><Check size={17} />Aprovar exportação</button>}
          {canDownload && <button className="btn btn-primary" onClick={baixar}>{last?.result === 'falha' ? <RotateCw size={17} /> : <Download size={17} />}{last?.result === 'falha' ? 'Tentar novamente' : x.status === 'aprovada' ? (REAL_FORMATS.includes(x.content.formato) ? 'Baixar arquivo' : `Conferir (${x.content.formato} simulado)`) : 'Baixar de novo'}</button>}
        </>} />
      <div className="layout-detail">
        <div className="stack">
          {isManager && x.status === 'pendente' && decisionGaps.length > 0 && (
            <div className="banner banner-warn" role="alert"><XCircle size={17} style={{ flexShrink: 0, marginTop: 2 }} /><span className="b-text small"><b>Este conteúdo não pode ser aprovado com a regra atual:</b> {decisionGaps.join('; ')}. Recuse e oriente uma nova solicitação.</span></div>
          )}
          {last && (
            <div className={`banner banner-${RESULT_LABEL[last.result].tone === 'ok' ? 'ok' : RESULT_LABEL[last.result].tone === 'danger' ? 'danger' : RESULT_LABEL[last.result].tone === 'warn' ? 'warn' : 'info'}`} data-export-result={last.result}>
              <FileSpreadsheet size={17} style={{ flexShrink: 0, marginTop: 2 }} />
              <span className="b-text small"><b>Última tentativa · {RESULT_LABEL[last.result].label}</b> ({fmtDateTime(last.ts)}): {last.detail}.{last.bytes ? ` ${(last.bytes / 1024).toFixed(1)} KB.` : ''}{last.hash ? ` Conteúdo #${last.hash}${last.hash === x.hash ? ' = autorizado' : ' ≠ autorizado'}.` : ''}</span>
            </div>
          )}
          <div className="card card-pad">
            <div className="label" style={{ marginBottom: 10 }}>Conteúdo {x.status === 'pendente' ? 'solicitado' : 'autorizado'} · #{x.hash}</div>
            <KV items={[
              ['Ambiente', COMPANIES[x.content.companyId].name], ['Módulo', originMeta(x.module).name], ['Formato', `${x.content.formato}${REAL_FORMATS.includes(x.content.formato) ? '' : ' (sem gerador nesta versão · simulado)'}`],
              ['Registros', String(x.content.recordIds.length)], ['Campos', x.content.fields.map((f) => f.label).join(', ')], ['Histórico', x.content.includeHistory ? 'Incluído' : 'Não incluído'],
              ['Filtros', x.content.filtros], ['Regra no pedido', `${x.regra.mode === 'aprovacao' ? 'Por solicitação' : 'Permanente'} · v${x.regra.versao}${configVersion(cfg) !== x.regra.versao ? ` (atual v${configVersion(cfg)})` : ''}`],
              ['Decisão', x.decididoPor ? `${userName(x.decididoPor)} · ${fmtDateTime(x.decididoEm)}` : '—'],
            ]} />
            <details style={{ marginTop: 14 }}><summary className="small strong" style={{ cursor: 'pointer' }}>Registros incluídos ({x.content.recordLabels.length})</summary><p className="small muted tnum" style={{ marginTop: 8 }}>{x.content.recordLabels.join(' · ')}</p></details>
            <div style={{ marginTop: 18 }}><div className="label" style={{ marginBottom: 6 }}>Justificativa</div><p>{x.justificativa}</p></div>
            {x.obs && <div style={{ marginTop: 14 }}><div className="label" style={{ marginBottom: 6 }}>Observação da Gerência</div><p>{x.obs}</p></div>}
          </div>
          <div className="card"><div className="card-head"><h2>Histórico</h2></div><div className="card-body"><Timeline events={events} /></div></div>
        </div>
        <aside className="stack">
          <div className="card card-pad">
            <div className="label" style={{ marginBottom: 12 }}>Solicitante</div>
            <div className="row" style={{ gap: 12 }}><Avatar name={userName(x.requesterId)} /><div><div className="strong">{userName(x.requesterId)}</div><div className="xs muted">{requester?.sector}</div></div></div>
          </div>
          {canDownload && (
            <div className="card card-pad" aria-label="Verificação do download">
              <div className="label" style={{ marginBottom: 10 }}>Verificação no download</div>
              <ul className="checklist small" data-checks>
                {checks.map((c) => <li key={c.label} data-ok={c.ok}>{c.ok ? <CheckCircle2 size={15} className="ok-ic" /> : <XCircle size={15} style={{ color: 'var(--danger)' }} />}<span><b>{c.label}.</b> {c.detail}</span></li>)}
              </ul>
              <p className="xs muted" style={{ marginTop: 12 }}>Refeita no clique, com o estado daquele momento. O arquivo é montado só com os registros e campos autorizados e conferido pelo código do conteúdo.</p>
            </div>
          )}
          {(x.tentativas?.length ?? 0) > 0 && (
            <div className="card card-pad"><div className="label" style={{ marginBottom: 10 }}>Tentativas · {x.tentativas!.length}</div>
              <ul className="checklist small">{[...x.tentativas!].reverse().map((t, i) => <li key={i}><Badge tone={RESULT_LABEL[t.result].tone} plain>{RESULT_LABEL[t.result].label}</Badge><span className="xs muted">{fmtDateTime(t.ts)} · {t.detail}</span></li>)}</ul>
            </div>
          )}
        </aside>
      </div>
      <Dialog open={dlg === 'aprovar'} onClose={() => setDlg(null)} title={`Aprovar ${x.numero}?`} desc={`${userName(x.requesterId)} poderá baixar exatamente este conteúdo: ${x.content.recordIds.length} registros, ${x.content.fields.length} campos, ${x.content.formato}, ambiente ${COMPANIES[x.companyId].name}.`}
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
