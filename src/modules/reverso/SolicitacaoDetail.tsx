import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Check, CornerUpLeft, PackageCheck, PackageOpen, RotateCcw, Tag, Truck } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { flash, useRecordVisit } from '@/platform/hooks';
import { fmtDateTime, uid } from '@/platform/format';
import { Avatar, BackToList, Badge, Dialog, EmptyState, Field, KV, Tabs } from '@/ui/core';
import { AttachmentList, Timeline } from '@/ui/records';
import { useToast } from '@/ui/toast';
import { COMPANIES } from '@/ui/brand';
import { NotFoundInline } from '@/pages/NotFound';
import { RV_STATUS } from './meta';
import type { Reverso } from '@/platform/types';

type Tab = 'resumo' | 'postagem' | 'aprovacao' | 'etiquetas' | 'historico';

export default function SolicitacaoDetail() {
  const { id } = useParams();
  const loc = useLocation();
  const { data, company, can, sees, userName, update, me, notify, touchRecent } = useDemo();
  const toast = useToast();
  const r = data.reversos.find((x) => x.id === id && x.companyId === company);
  const [fl] = useState(() => flash.take(id) ?? (loc.state as { tab?: Tab; highlight?: string } | null) ?? undefined);
  const [tab, setTab] = useState<Tab>((fl?.tab as Tab) ?? 'resumo');
  const [highlight, setHighlight] = useState(fl?.highlight);
  const [dlg, setDlg] = useState<null | 'aprovar' | 'ajuste' | 'etiqueta' | 'reenviar' | 'receber'>(null);
  const [obs, setObs] = useState('');
  const [rastreio, setRastreio] = useState('BR' + Math.floor(100000000 + Math.random() * 899999999) + 'BR');
  const [err, setErr] = useState('');
  useRecordVisit('reverso', r?.id, r ? `${r.numero} · ${r.clienteNome}` : undefined, `/reverso/solicitacoes/${id}`);

  if (!r || !sees('reverso', r.solicitanteId)) return <NotFoundInline what="solicitação" back="/reverso/solicitacoes" />;
  const st = RV_STATUS[r.status];
  const events = data.events.filter((e) => e.recordId === r.id);
  const isApprover = can('reverso', 'aprovar') && r.aprovadorId === me?.id;
  const canDecide = isApprover && r.status === 'aguardando_aprovacao';
  const canShip = can('reverso', 'expedir') && r.status === 'aguardando_expedicao';
  const canReceive = can('reverso', 'expedir') && r.status === 'em_transito';
  const canResend = r.solicitanteId === me?.id && r.status === 'ajuste';

  const apply = (fn: (x: Reverso) => void, action: string, toastText: React.ReactNode, nextTab: Tab, notifyUser?: { userId: string; title: string }) => {
    const evId = uid('ev');
    update((d) => {
      fn(d.reversos.find((x) => x.id === r.id)!);
      d.events.push({ id: evId, ts: new Date().toISOString(), companyId: company, module: 'reverso', recordId: r.id, recordLabel: r.numero, action, actorId: me!.id, kind: /^(Aprovada|Devolvida)/.test(action) ? 'decisao' : 'operacao' });
    });
    if (notifyUser) notify({ userId: notifyUser.userId, module: 'reverso', title: notifyUser.title, subject: `${r.numero} · ${r.clienteNome}`, link: `/reverso/solicitacoes/${r.id}` });
    touchRecent({ module: 'reverso', recordId: r.id, label: `${r.numero} · ${r.clienteNome}`, action: action.split(' —')[0].split(':')[0], link: `/reverso/solicitacoes/${r.id}` });
    setHighlight(evId); setTab(nextTab); setDlg(null); setObs(''); setErr('');
    toast(toastText);
  };

  const aprovar = () => apply((x) => { x.status = 'aguardando_expedicao'; x.decisao = { por: me!.id, em: new Date().toISOString(), tipo: 'aprovado', obs: obs.trim() || undefined }; },
    `Aprovada — aguardando expedição${obs.trim() ? ` · ${obs.trim()}` : ''}`, <>Solicitação <b>{r.numero}</b> aprovada e encaminhada à expedição.</>, 'historico',
    { userId: r.solicitanteId, title: 'Sua solicitação foi aprovada' });
  const devolver = () => {
    if (obs.trim().length < 10) { setErr('Explique o ajuste necessário (mínimo de 10 caracteres).'); return; }
    apply((x) => { x.status = 'ajuste'; x.decisao = { por: me!.id, em: new Date().toISOString(), tipo: 'ajuste', obs: obs.trim() }; },
      `Devolvida para ajuste: ${obs.trim()}`, <>Solicitação <b>{r.numero}</b> devolvida ao solicitante.</>, 'historico',
      { userId: r.solicitanteId, title: 'Ajuste solicitado no reverso' });
  };
  const etiquetar = () => {
    if (!/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(rastreio.trim())) { setErr('Use o formato de rastreio AA000000000AA.'); return; }
    const attId = uid('a');
    update((d) => { d.attachments.push({ id: attId, nome: `Etiqueta de postagem — ${r.numero}.png`, tipo: 'PNG', tamanho: '95 KB', em: new Date().toISOString(), kind: 'etiqueta', ref: r.id }); });
    apply((x) => { x.status = 'em_transito'; x.rastreio = rastreio.trim(); x.docs.unshift(attId); },
      `Etiqueta incluída · rastreio ${rastreio.trim()}`, <>Etiqueta incluída. <b>{r.numero}</b> está em trânsito.</>, 'etiquetas',
      { userId: r.solicitanteId, title: 'Etiqueta de postagem disponível' });
  };
  const receber = () => apply((x) => { x.status = 'concluido'; }, 'Mercadoria recebida no centro de distribuição — concluída', <>Reverso <b>{r.numero}</b> concluído.</>, 'historico');
  const reenviar = () => {
    if (obs.trim().length < 10) { setErr('Descreva o ajuste realizado (mínimo de 10 caracteres).'); return; }
    apply((x) => { x.status = 'aguardando_aprovacao'; x.justificativa = `${x.justificativa ?? ''}\nAjuste: ${obs.trim()}`.trim(); },
      `Reenviada com ajuste: ${obs.trim()}`, <>Solicitação <b>{r.numero}</b> reenviada para aprovação.</>, 'historico',
      { userId: r.aprovadorId ?? 'u2', title: 'Aprovação aguardando sua decisão' });
  };

  return (
    <>
      <nav className="crumbs" aria-label="Você está em"><Link to="/reverso/solicitacoes">Reverso</Link><span aria-hidden>›</span><Link to="/reverso/solicitacoes">Solicitações</Link><span aria-hidden>›</span><span aria-current="page">{r.numero}</span></nav>
      <section className="card" style={{ marginBottom: 20, overflow: 'hidden' }} aria-labelledby="rv-title">
        <div className="hero">
          <span className="hero-ic"><PackageOpen size={30} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="hero-id">{r.numero}</div>
            <h1 className="hero-title" id="rv-title">{r.motivo} · {r.clienteNome}</h1>
            <div className="row-wrap" style={{ gap: 10 }}><Badge tone={st.tone}>{st.label}</Badge><span className="small muted">{r.itens.reduce((n, i) => n + i.qtd, 0)} {r.itens.reduce((n, i) => n + i.qtd, 0) === 1 ? 'item' : 'itens'} · {COMPANIES[r.companyId].name}</span></div>
          </div>
          <div className="hero-actions row">
            <BackToList fallback="/reverso/solicitacoes" />
            {canDecide && <button className="btn btn-secondary" onClick={() => setDlg('ajuste')}><CornerUpLeft size={17} />Devolver para ajuste</button>}
            {canDecide && <button className="btn btn-primary" onClick={() => setDlg('aprovar')}><Check size={18} />Aprovar solicitação</button>}
            {canShip && <button className="btn btn-primary" onClick={() => setDlg('etiqueta')}><Tag size={17} />Incluir etiqueta</button>}
            {canReceive && <button className="btn btn-primary" onClick={() => setDlg('receber')}><PackageCheck size={17} />Confirmar recebimento</button>}
            {canResend && <button className="btn btn-primary" onClick={() => setDlg('reenviar')}><RotateCcw size={17} />Ajustar e reenviar</button>}
          </div>
        </div>
        <dl className="facts" style={{ margin: 0 }}>
          <div className="fact"><dt>Cliente</dt><dd title={r.clienteNome}>{r.clienteCodigo}</dd></div>
          <div className="fact"><dt>Solicitante</dt><dd><span className="person"><Avatar name={userName(r.solicitanteId)} sm />{userName(r.solicitanteId)}</span></dd></div>
          <div className="fact"><dt>Aprovador</dt><dd>{userName(r.aprovadorId)}</dd></div>
          <div className="fact"><dt>Abertura</dt><dd className="tnum">{fmtDateTime(r.criadoEm)}</dd></div>
        </dl>
      </section>
      {r.status === 'ajuste' && r.decisao?.obs && (
        <div className="banner banner-danger" style={{ marginBottom: 20 }}><CornerUpLeft size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <span className="b-text"><b>Ajuste solicitado por {userName(r.decisao.por)}:</b> {r.decisao.obs}</span></div>
      )}
      {r.status === 'aguardando_aprovacao' && !isApprover && (
        <div className="banner banner-warn" style={{ marginBottom: 20 }}><span className="b-text">Aguardando decisão de <b>{userName(r.aprovadorId)}</b>.</span></div>
      )}
      <div className="layout-detail">
        <div className="card">
          <Tabs<Tab> value={tab} onChange={setTab} tabs={[
            { id: 'resumo', label: 'Resumo' }, { id: 'postagem', label: 'Postagem' }, { id: 'aprovacao', label: 'Aprovação' },
            { id: 'etiquetas', label: 'Etiquetas', count: r.docs.length }, { id: 'historico', label: 'Histórico', count: events.length },
          ]} />
          <div className="card-body">
            {tab === 'resumo' && (
              <div className="stack">
                <KV items={[['Motivo', r.motivo], ['Setor', r.setor], ['Cliente', `${r.clienteCodigo} · ${r.clienteNome}`], ['Ambiente', COMPANIES[r.companyId].name]]} />
                <div><div className="label" style={{ marginBottom: 6 }}>Justificativa</div><p style={{ whiteSpace: 'pre-line' }}>{r.justificativa || <span className="subtle">Não se aplica a este motivo.</span>}</p></div>
                <div>
                  <div className="label" style={{ marginBottom: 8 }}>Itens</div>
                  <table className="tbl" style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <thead><tr><th>Descrição</th><th>Referência</th><th style={{ textAlign: 'right' }}>Qtd.</th></tr></thead>
                    <tbody>{r.itens.map((i, k) => <tr key={k} style={{ cursor: 'default' }}><td>{i.descricao}</td><td className="mono small">{i.ref || '—'}</td><td className="num" style={{ textAlign: 'right' }}>{i.qtd}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            )}
            {tab === 'postagem' && <KV items={[['Remetente (cliente)', r.clienteNome], ['Endereço de coleta', r.endereco], ['Destino', `${COMPANIES[r.companyId].legal} · Centro de distribuição`], ['Rastreio', r.rastreio ? <span className="mono">{r.rastreio}</span> : 'Gerado pela expedição']]} />}
            {tab === 'aprovacao' && (r.decisao ? (
              <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
                <Avatar name={userName(r.decisao.por)} />
                <div>
                  <div className="strong">{r.decisao.tipo === 'aprovado' ? 'Aprovada' : 'Devolvida para ajuste'} por {userName(r.decisao.por)}</div>
                  <div className="xs muted">{fmtDateTime(r.decisao.em)}</div>
                  {r.decisao.obs && <p style={{ marginTop: 8 }}>{r.decisao.obs}</p>}
                </div>
              </div>
            ) : <EmptyState title="Aguardando decisão" text={`Aprovador designado: ${userName(r.aprovadorId)}.`} />)}
            {tab === 'etiquetas' && (
              <div className="stack">
                {r.rastreio && <div className="banner banner-info"><Truck size={18} style={{ flexShrink: 0 }} /><span className="b-text">Rastreio <b className="mono">{r.rastreio}</b> · postagem simulada</span></div>}
                <AttachmentList ids={r.docs} empty="A etiqueta é incluída pela expedição após a aprovação." />
              </div>
            )}
            {tab === 'historico' && <Timeline events={events} highlightId={highlight} />}
          </div>
        </div>
        <aside className="stack">
          <div className="card card-pad">
            <div className="label" style={{ marginBottom: 14 }}>Andamento</div>
            <Progress status={r.status} />
          </div>
          <div className="card card-pad">
            <div className="label" style={{ marginBottom: 12 }}>Solicitante</div>
            <div className="row" style={{ gap: 12 }}><Avatar name={userName(r.solicitanteId)} /><div><div className="strong">{userName(r.solicitanteId)}</div><div className="xs muted">{r.setor}</div></div></div>
          </div>
        </aside>
      </div>

      <Dialog open={dlg === 'aprovar'} onClose={() => setDlg(null)} title={`Aprovar ${r.numero}?`} desc="A solicitação seguirá para a expedição gerar a etiqueta de postagem."
        footer={<><button className="btn btn-secondary" onClick={() => setDlg(null)}>Cancelar</button><button className="btn btn-primary" onClick={aprovar}><Check size={17} />Aprovar solicitação</button></>}>
        <Field label="Observação (opcional)" htmlFor="obs-a"><textarea id="obs-a" className="textarea" value={obs} onChange={(e) => setObs(e.target.value)} /></Field>
      </Dialog>
      <Dialog open={dlg === 'ajuste'} onClose={() => { setDlg(null); setErr(''); }} title="Devolver para ajuste" desc={`${userName(r.solicitanteId)} será notificada e poderá corrigir a solicitação.`}
        footer={<><button className="btn btn-secondary" onClick={() => setDlg(null)}>Cancelar</button><button className="btn btn-primary" onClick={devolver}><CornerUpLeft size={17} />Devolver para ajuste</button></>}>
        <Field label="O que precisa ser ajustado?" required error={err} htmlFor="obs-j"><textarea id="obs-j" className="textarea" value={obs} aria-invalid={!!err} onChange={(e) => { setObs(e.target.value); setErr(''); }} /></Field>
      </Dialog>
      <Dialog open={dlg === 'etiqueta'} onClose={() => { setDlg(null); setErr(''); }} title="Incluir etiqueta de postagem" desc="Etiqueta de exemplo · geração simulada nesta demonstração."
        footer={<><button className="btn btn-secondary" onClick={() => setDlg(null)}>Cancelar</button><button className="btn btn-primary" onClick={etiquetar}><Tag size={17} />Incluir etiqueta</button></>}>
        <div className="stack">
          <Field label="Código de rastreio" required error={err} htmlFor="rast"><input id="rast" className="input mono" value={rastreio} aria-invalid={!!err} onChange={(e) => { setRastreio(e.target.value.toUpperCase()); setErr(''); }} /></Field>
          <div className="att"><span className="att-icon png">PNG</span><div style={{ flex: 1 }}><div className="strong">Etiqueta de postagem — {r.numero}.png</div><div className="xs muted">Arquivo de exemplo · 95 KB</div></div></div>
        </div>
      </Dialog>
      <Dialog open={dlg === 'receber'} onClose={() => setDlg(null)} title="Confirmar recebimento?" desc="Registra a chegada da mercadoria ao centro de distribuição e conclui o reverso."
        footer={<><button className="btn btn-secondary" onClick={() => setDlg(null)}>Cancelar</button><button className="btn btn-primary" onClick={receber}>Confirmar recebimento</button></>} />
      <Dialog open={dlg === 'reenviar'} onClose={() => { setDlg(null); setErr(''); }} title="Ajustar e reenviar" desc={r.decisao?.obs ? `Solicitado: ${r.decisao.obs}` : undefined}
        footer={<><button className="btn btn-secondary" onClick={() => setDlg(null)}>Cancelar</button><button className="btn btn-primary" onClick={reenviar}><RotateCcw size={16} />Reenviar para aprovação</button></>}>
        <Field label="Ajuste realizado" required error={err} htmlFor="obs-r" help="Ex.: NF de venda 004512"><textarea id="obs-r" className="textarea" value={obs} aria-invalid={!!err} onChange={(e) => { setObs(e.target.value); setErr(''); }} /></Field>
      </Dialog>
    </>
  );
}

function Progress({ status }: { status: Reverso['status'] }) {
  const order = ['aguardando_aprovacao', 'aguardando_expedicao', 'em_transito', 'concluido'] as const;
  const labels = ['Aprovação', 'Expedição', 'Em trânsito', 'Concluída'];
  const idx = status === 'ajuste' ? 0 : order.indexOf(status as (typeof order)[number]);
  return (
    <div className="steps">
      {labels.map((l, i) => {
        const done = i < idx || status === 'concluido';
        const run = i === idx && status !== 'concluido';
        return (
          <div key={l} className={`step ${done ? 'done' : run ? 'run' : ''}`}>
            <span className="ic">{done ? <Check size={15} /> : i + 1}</span>
            <span className={done || run ? 'strong' : 'muted'}>{l}{run && status === 'ajuste' ? ' · em ajuste' : ''}</span>
          </div>
        );
      })}
    </div>
  );
}
