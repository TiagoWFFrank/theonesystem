// Representação demonstrativa do sistema de Chamados e Acompanhamento incorporado como plugin.
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronRight, CornerUpLeft, Eye, Headset, ListChecks, Loader2, Search, Send } from 'lucide-react';
import { IntegrationTag, SourceNotice } from '@/ui/source';
import { ExportButton } from '@/ui/export';
import { draftKey, useDraft, useRecordOperation } from '@/ui/operation';
import { OpFeedback } from '@/ui/WorkPanel';
import { fmtTime } from '@/platform/format';
import { useDemo } from '@/platform/store';
import { useRecordVisit, useUrlState } from '@/platform/hooks';
import { fmtDate, fmtDateTime, fmtRelative } from '@/platform/format';
import { Avatar, BackToList, Badge, EmptyState, ErrorState, NoResults, PageHeader, SkeletonRows, Tabs, useSimLoad } from '@/ui/core';
import { Timeline } from '@/ui/records';
import { WorkPanel, type PanelTarget } from '@/ui/WorkPanel';
import { NotFoundInline } from '@/pages/NotFound';
import { CH_STATUS, PRIORITY, TF_STATUS } from './meta';
import { chamadosOps, findRec, reviewDecisions, seesChamado, transitionsFor } from './ops';
import { chamadoFilters } from './contrib';
import { chStore, type ChamadoStatus, type ChPriority, type TarefaStatus } from './model';

const CH = 'chamados' as const;
const tgt = (recordId: string | null): PanelTarget | null => (recordId ? { origin: CH, recordId } : null);

/** Aviso de indisponibilidade da origem, mantendo o conteúdo em cache utilizável. */
export function ChamadosOutage() {
  return <SourceNotice id="chamados" cachedNote="Comentários e transições são enviados quando você confirma; se o sistema continuar fora, nada é alterado e o texto fica guardado. Operações não são reenviadas automaticamente." />;
}

function Prio({ p }: { p?: ChPriority }) {
  return p ? <span className={`prio t-${PRIORITY[p].tone}`}>{PRIORITY[p].label}</span> : <span className="subtle xs">—</span>;
}

export function ChamadosList() {
  const { contrib, company, userName, can } = useDemo();
  const nav = useNavigate();
  const { state, retry } = useSimLoad();
  const [f, setF] = useUrlState({ visao: 'atribuidos', situacao: '', q: '' });
  const [panel, setPanel] = useState<string | null>(null);
  const all = can('chamados', 'gerenciar') || contrib?.scope('chamados') === 'empresa';
  const base = useMemo(() => {
    if (!contrib) return [];
    if (f.visao === 'atribuidos') return chamadoFilters.atribuidos(contrib);
    if (f.visao === 'abertos') return chamadoFilters.abertos(contrib);
    return chStore(contrib.data).chamados.filter((x) => x.companyId === company && seesChamado(contrib, { kind: 'chamado', ch: x }));
  }, [contrib, f.visao, company]);
  const pre = base.filter((x) => !f.q || `${x.numero} ${x.titulo} ${userName(x.solicitanteId)}`.toLowerCase().includes(f.q.toLowerCase()));
  const rows = pre.filter((x) => !f.situacao || x.status === f.situacao).sort((a, b) => PRIORITY[a.prioridade].rank - PRIORITY[b.prioridade].rank || (a.prazo ?? '').localeCompare(b.prazo ?? ''));
  if (!contrib) return null;
  const counts = { atribuidos: chamadoFilters.atribuidos(contrib).length, abertos: chamadoFilters.abertos(contrib).length };
  return (
    <>
      <PageHeader crumbs={[{ label: 'Chamados', to: '/chamados' }, { label: 'Chamados' }]} title="Chamados"
        sub={<span className="row-wrap" style={{ gap: 8 }}>Sistema de chamados incorporado como plugin. <IntegrationTag id="chamados" /></span>}
        actions={<ExportButton module="chamados" rows={rows} name={`chamados-${f.visao}`} filtros={`${f.visao === 'atribuidos' ? 'Atribuídos a mim' : f.visao === 'abertos' ? 'Que abri' : 'Todos do ambiente'}${f.situacao ? ` · ${CH_STATUS[f.situacao as ChamadoStatus].label}` : ''}${f.q ? ` · “${f.q}”` : ''}`} />} />
      <div className="card">
        <ChamadosOutage />
        <div className="list-tools">
          <div className="tools-row">
            <div className="seg" role="group" aria-label="Visão" style={{ width: 'auto' }}>
              <button aria-pressed={f.visao === 'atribuidos'} onClick={() => setF({ visao: 'atribuidos', situacao: '' })}>Atribuídos a mim · {counts.atribuidos}</button>
              <button aria-pressed={f.visao === 'abertos'} onClick={() => setF({ visao: 'abertos', situacao: '' })}>Que abri · {counts.abertos}</button>
              {all && <button aria-pressed={f.visao === 'todos'} onClick={() => setF({ visao: 'todos', situacao: '' })}>Todos do ambiente</button>}
            </div>
            <div className="input-icon"><Search size={17} /><input className="input" aria-label="Buscar chamados" placeholder="Número, assunto ou solicitante" value={f.q} onChange={(e) => setF({ q: e.target.value })} /></div>
          </div>
          <div className="seg-filter" role="group" aria-label="Situação">
            <button aria-pressed={!f.situacao} onClick={() => setF({ situacao: '' })}>Todas<span className="n">{pre.length}</span></button>
            {(Object.keys(CH_STATUS) as ChamadoStatus[]).map((k) => <button key={k} aria-pressed={f.situacao === k} onClick={() => setF({ situacao: f.situacao === k ? '' : k })}>{CH_STATUS[k].label}<span className="n">{pre.filter((x) => x.status === k).length}</span></button>)}
          </div>
        </div>
        {state === 'loading' ? <SkeletonRows cols={6} /> : state === 'error' ? <ErrorState onRetry={retry} /> : base.length === 0 || state === 'empty' ? (
          <EmptyState icon={<Headset size={22} />} title="Nenhum chamado nesta visão" text="Chamados atribuídos a você ou abertos por você aparecem aqui." />
        ) : rows.length === 0 ? <NoResults onClear={() => setF({ situacao: '', q: '' })} /> : (
          <>
            <div className="table-wrap responsive">
              <table className="tbl">
                <thead><tr><th>Chamado</th><th>Assunto</th><th>Solicitante · responsável</th><th>Prioridade</th><th>Situação</th><th className="r">Prazo</th><th /></tr></thead>
                <tbody>
                  {rows.map((x) => (
                    <tr key={x.id} onClick={() => nav(`/chamados/${x.id}`)}>
                      <td className="id-cell">{x.numero}<div className="xs muted" style={{ fontWeight: 400 }}>{x.fila}</div></td>
                      <td><div className="truncate" style={{ maxWidth: 300, fontWeight: 500 }}>{x.titulo}</div><div className="xs muted">{x.categoria} · atualizado {fmtRelative(x.atualizadoEm)}</div></td>
                      <td className="small"><span className="person"><Avatar name={userName(x.solicitanteId)} sm />{userName(x.solicitanteId).split(' ')[0]}</span><div className="xs muted">→ {userName(x.responsavelId)}</div></td>
                      <td><Prio p={x.prioridade} /></td>
                      <td><Badge tone={CH_STATUS[x.status].tone}>{CH_STATUS[x.status].label}</Badge></td>
                      <td className="num small r">{x.prazo ? fmtDate(x.prazo) : '—'}</td>
                      <td className="row-action" onClick={(e) => e.stopPropagation()}><button className="btn btn-secondary btn-xs always" onClick={() => setPanel(x.id)}>Trabalhar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-cards">
              {rows.map((x) => (
                <Link key={x.id} to={`/chamados/${x.id}`} className="m-card">
                  <div className="row"><span className="strong tnum">{x.numero}</span><Prio p={x.prioridade} /><span className="spacer" /><Badge tone={CH_STATUS[x.status].tone}>{CH_STATUS[x.status].label}</Badge></div>
                  <div className="small" style={{ marginTop: 4 }}>{x.titulo}</div>
                  <div className="xs muted">{userName(x.solicitanteId)} → {userName(x.responsavelId)}</div>
                </Link>
              ))}
            </div>
            <div className="pager"><span className="tnum">{rows.length} chamados</span></div>
          </>
        )}
      </div>
      <WorkPanel target={tgt(panel)} onClose={() => setPanel(null)} />
    </>
  );
}

export function TarefasList() {
  const { contrib, company, userName } = useDemo();
  const nav = useNavigate();
  const [f, setF] = useUrlState({ visao: 'minhas', situacao: '' });
  const [panel, setPanel] = useState<string | null>(null);
  if (!contrib) return null;
  const base = f.visao === 'revisar' ? chamadoFilters.revisar(contrib) : f.visao === 'todas'
    ? chStore(contrib.data).tarefas.filter((t) => { const r = findRec(contrib, t.id); return t.companyId === company && !!r && seesChamado(contrib, r); }) : chamadoFilters.minhasTarefas(contrib);
  const rows = base.filter((t) => !f.situacao || t.status === f.situacao).sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? ''));
  return (
    <>
      <PageHeader crumbs={[{ label: 'Chamados', to: '/chamados' }, { label: 'Tarefas' }]} title="Acompanhamento de tarefas" sub="Tarefas associadas aos chamados. A revisão é uma aprovação feita aqui no módulo." />
      <div className="card">
        <ChamadosOutage />
        <div className="list-tools">
          <div className="seg" role="group" aria-label="Visão" style={{ width: 'auto', alignSelf: 'flex-start' }}>
            <button aria-pressed={f.visao === 'minhas'} onClick={() => setF({ visao: 'minhas', situacao: '' })}>Minhas tarefas · {chamadoFilters.minhasTarefas(contrib).length}</button>
            <button aria-pressed={f.visao === 'revisar'} onClick={() => setF({ visao: 'revisar', situacao: '' })}>Para revisar · {chamadoFilters.revisar(contrib).length}</button>
            <button aria-pressed={f.visao === 'todas'} onClick={() => setF({ visao: 'todas', situacao: '' })}>Todas que acompanho</button>
          </div>
          <div className="seg-filter" role="group" aria-label="Situação">
            <button aria-pressed={!f.situacao} onClick={() => setF({ situacao: '' })}>Todas<span className="n">{base.length}</span></button>
            {(Object.keys(TF_STATUS) as TarefaStatus[]).map((k) => <button key={k} aria-pressed={f.situacao === k} onClick={() => setF({ situacao: f.situacao === k ? '' : k })}>{TF_STATUS[k].label}<span className="n">{base.filter((t) => t.status === k).length}</span></button>)}
          </div>
        </div>
        {rows.length === 0 ? <EmptyState icon={<ListChecks size={22} />} title="Nenhuma tarefa nesta visão" /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Tarefa</th><th>Assunto</th><th>Responsável · revisor</th><th>Situação</th><th className="r">Prazo</th><th /></tr></thead>
              <tbody>
                {rows.map((t) => {
                  const ch = chStore(contrib.data).chamados.find((x) => x.id === t.chamadoId)!;
                  const rev = f.visao === 'revisar';
                  return (
                    <tr key={t.id} onClick={() => nav(`/chamados/tarefas/${t.id}`)}>
                      <td className="id-cell">{t.codigo}<div className="xs muted" style={{ fontWeight: 400 }}>{ch.numero}</div></td>
                      <td><div className="truncate" style={{ maxWidth: 320, fontWeight: 500 }}>{t.titulo}</div><div className="xs muted">{ch.titulo}</div></td>
                      <td className="small">{userName(t.responsavelId)}<div className="xs muted">revisão: {userName(t.revisorId)}</div></td>
                      <td><Badge tone={TF_STATUS[t.status].tone}>{TF_STATUS[t.status].label}</Badge></td>
                      <td className="num small r">{t.prazo ? fmtDate(t.prazo) : '—'}</td>
                      <td className="row-action" onClick={(e) => e.stopPropagation()}>
                        {rev ? <Link className="btn btn-primary btn-xs always" to={`/chamados/tarefas/${t.id}`}>Decidir</Link> : <button className="btn btn-secondary btn-xs always" onClick={() => setPanel(t.id)}>Trabalhar</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <WorkPanel target={tgt(panel)} onClose={() => setPanel(null)} />
    </>
  );
}

/** Conversa + composer: mesmas operações e mesma revalidação do painel de trabalho. */
function Conversation({ recordId }: { recordId: string }) {
  const { contrib, me, userName, company } = useDemo();
  const draft = useDraft(draftKey(me?.id, company, CH, recordId));
  const op = useRecordOperation(CH, recordId, { getText: () => draft.text, onSuccess: () => draft.clear() });
  if (!contrib) return null;
  const comments = chamadosOps.comments(contrib, recordId);
  const can = chamadosOps.canComment(contrib, recordId);
  return (
    <div className="stack">
      <div className="comments">
        {comments.length === 0 && <p className="small muted">Ainda não há comentários.</p>}
        {comments.map((cm) => (
          <div key={cm.id} className={`cmt ${cm.authorId === me?.id ? 'mine' : ''}`}>
            <Avatar name={userName(cm.authorId)} sm />
            <div><div className="meta"><b>{userName(cm.authorId)}</b><span>{fmtDateTime(cm.ts)}</span>{cm.via === 'painel' && <span>· pelo painel do Início</span>}</div><div className="bubble">{cm.text}</div></div>
          </div>
        ))}
      </div>
      {can.ok ? (
        <div className="composer">
          <textarea className="textarea" aria-label="Novo comentário" placeholder="Escreva um comentário…" value={draft.text} onChange={(e) => draft.setText(e.target.value)} />
          <OpFeedback state={op.state} origin={CH} onRetry={op.retry} onCancel={op.cancel} onDismiss={op.dismiss} />
          <div className="row"><span className="xs muted">{draft.text && draft.restoredAt ? `Rascunho guardado às ${fmtTime(draft.restoredAt)}` : ''}</span><span className="spacer" /><button className="btn btn-primary btn-sm" disabled={op.busy} onClick={() => op.run({ kind: 'comment' })}>{op.busy ? <Loader2 size={15} className="spin" /> : <Send size={15} />}Comentar</button></div>
        </div>
      ) : <p className="xs muted">{can.msg}</p>}
    </div>
  );
}

/** Botões de transição/decisão: revalidam situação e acesso no envio; retorno claro em falha. */
function Actions({ recordId, decisions }: { recordId: string; decisions?: boolean }) {
  const { contrib, me, company } = useDemo();
  const [need, setNeed] = useState<{ id: string; label: string } | null>(null);
  const k = draftKey(me?.id, company, CH, recordId);
  const draft = useDraft(k ? `${k}|acao` : null);
  const op = useRecordOperation(CH, recordId, { getText: () => draft.text, onSuccess: (i) => { if (i.kind === 'transition' && i.needsComment) draft.clear(); setNeed(null); } });
  if (!contrib) return null;
  const list = decisions ? reviewDecisions(contrib, recordId) : transitionsFor(contrib, recordId);
  if (!list.length && op.state.phase === 'idle') return null;
  const go = (t: { id: string; label: string; needsComment?: boolean }) => op.run({ kind: 'transition', id: t.id, label: t.label, needsComment: t.needsComment });
  return (
    <div className="stack-sm" style={{ alignItems: 'flex-end' }}>
      <div className="row-wrap" style={{ justifyContent: 'flex-end' }}>
        {list.map((t) => (
          <button key={t.id} className={`btn ${t.primary ? 'btn-primary' : 'btn-secondary'}`} disabled={op.busy} onClick={() => (t.needsComment ? setNeed(t) : go(t))}>
            {op.state.phase === 'sending' && op.state.intent.kind === 'transition' && op.state.intent.id === t.id ? <Loader2 size={16} className="spin" /> : t.id === 'devolver' ? <CornerUpLeft size={16} /> : t.primary ? <CheckCircle2 size={16} /> : null}{t.label}
          </button>
        ))}
      </div>
      {need && (
        <div className="card card-pad" style={{ width: 'min(460px, 100%)' }}>
          <label className="label" htmlFor="need-text">{need.label}: comentário obrigatório</label>
          <textarea id="need-text" className="textarea" style={{ marginTop: 6 }} value={draft.text} onChange={(e) => draft.setText(e.target.value)} />
          <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setNeed(null)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" disabled={op.busy} onClick={() => go({ ...need, needsComment: true })}>Confirmar</button>
          </div>
        </div>
      )}
      <div style={{ width: 'min(520px, 100%)' }}><OpFeedback state={op.state} origin={CH} onRetry={op.retry} onCancel={op.cancel} onDismiss={op.dismiss} /></div>
    </div>
  );
}

export function ChamadoDetail() {
  const { id } = useParams();
  const { contrib, company, data, userName } = useDemo();
  const [tab, setTab] = useState<'conversa' | 'tarefas' | 'historico'>('conversa');
  const [panel, setPanel] = useState<string | null>(null);
  const r = contrib && id ? findRec(contrib, id) : null;
  useRecordVisit('chamados', r?.kind === 'chamado' ? r.ch.id : undefined, r?.kind === 'chamado' ? `${r.ch.numero} · ${r.ch.titulo}` : undefined, `/chamados/${id}`);
  if (!contrib || !r || r.kind !== 'chamado' || r.ch.companyId !== company || !seesChamado(contrib, r)) return <NotFoundInline what="chamado" back="/chamados" />;
  const ch = r.ch;
  const tarefas = chStore(data).tarefas.filter((t) => t.chamadoId === ch.id);
  const events = data.events.filter((e) => e.recordId === ch.id);
  const rel = ch.responsavelId === contrib.me.id ? 'Sob sua responsabilidade' : ch.solicitanteId === contrib.me.id ? 'Você abriu este chamado' : 'Acompanhando';
  return (
    <>
      <nav className="crumbs" aria-label="Você está em"><Link to="/chamados">Chamados</Link><span aria-hidden>›</span><span aria-current="page">{ch.numero}</span></nav>
      <section className="card" style={{ marginBottom: 20, overflow: 'hidden' }} aria-labelledby="ch-title">
        <ChamadosOutage />
        <div className="hero">
          <span className="hero-ic"><Headset size={30} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="hero-id">{ch.numero} · {ch.fila.toUpperCase()}</div>
            <h1 className="hero-title" id="ch-title">{ch.titulo}</h1>
            <div className="row-wrap" style={{ gap: 10 }}><Badge tone={CH_STATUS[ch.status].tone}>{CH_STATUS[ch.status].label}</Badge><Prio p={ch.prioridade} /><span className="rel-tag">{ch.solicitanteId === contrib.me.id && ch.responsavelId !== contrib.me.id ? <Eye size={13} /> : null}{rel}</span></div>
          </div>
          <div className="hero-actions row"><BackToList fallback="/chamados" /></div>
        </div>
        <dl className="facts" style={{ margin: 0 }}>
          <div className="fact"><dt>Solicitante</dt><dd><span className="person"><Avatar name={userName(ch.solicitanteId)} sm />{userName(ch.solicitanteId)}</span></dd></div>
          <div className="fact"><dt>Responsável</dt><dd><span className="person"><Avatar name={userName(ch.responsavelId)} sm />{userName(ch.responsavelId)}</span></dd></div>
          <div className="fact"><dt>Aberto em</dt><dd className="tnum">{fmtDate(ch.criadoEm)}</dd></div>
          <div className="fact"><dt>Prazo</dt><dd className="tnum">{ch.prazo ? fmtDate(ch.prazo) : '—'}</dd></div>
        </dl>
      </section>
      <div className="layout-detail">
        <div className="card">
          <Tabs value={tab} onChange={setTab} tabs={[{ id: 'conversa', label: 'Conversa', count: contrib.data.comments.filter((c) => c.recordId === ch.id).length }, { id: 'tarefas', label: 'Tarefas', count: tarefas.length }, { id: 'historico', label: 'Histórico', count: events.length }]} />
          <div className="card-body">
            {tab === 'conversa' && <><p className="small muted" style={{ marginBottom: 16 }}>{ch.descricao}</p><Conversation recordId={ch.id} /></>}
            {tab === 'tarefas' && (tarefas.length ? tarefas.map((t) => (
              <div key={t.id} className="att" style={{ cursor: 'pointer' }} onClick={() => setPanel(t.id)}>
                <span className="asset-ic"><ListChecks size={17} /></span>
                <div style={{ flex: 1, minWidth: 0 }}><div className="strong">{t.codigo} · {t.titulo}</div><div className="xs muted">{userName(t.responsavelId)} · prazo {t.prazo ? fmtDate(t.prazo) : '—'}</div></div>
                <Badge tone={TF_STATUS[t.status].tone}>{TF_STATUS[t.status].label}</Badge><ChevronRight size={16} className="muted" />
              </div>
            )) : <EmptyState icon={<ListChecks size={22} />} title="Sem tarefas associadas" />)}
            {tab === 'historico' && <Timeline events={events} />}
          </div>
        </div>
        <aside className="stack">
          <div className="card card-pad">
            <div className="label" style={{ marginBottom: 10 }}>Próxima ação</div>
            {transitionsFor(contrib, ch.id).length ? <Actions recordId={ch.id} /> : <p className="small muted">Nenhuma ação disponível para você nesta situação.</p>}
          </div>
          <div className="card card-pad"><div className="label" style={{ marginBottom: 6 }}>Origem</div><p className="small muted" style={{ marginBottom: 8 }}>Registro do sistema de Chamados. Comentários e transições feitos na plataforma são enviados ao sistema de origem pelo adaptador indicado abaixo.</p><IntegrationTag id="chamados" /></div>
        </aside>
      </div>
      <WorkPanel target={tgt(panel)} onClose={() => setPanel(null)} />
    </>
  );
}

export function TarefaDetail() {
  const { id } = useParams();
  const { contrib, company, data, userName } = useDemo();
  const [tab, setTab] = useState<'conversa' | 'historico'>('conversa');
  const r = contrib && id ? findRec(contrib, id) : null;
  useRecordVisit('chamados', r?.kind === 'tarefa' ? r.tf.id : undefined, r?.kind === 'tarefa' ? `${r.tf.codigo} · ${r.tf.titulo}` : undefined, `/chamados/tarefas/${id}`);
  if (!contrib || !r || r.kind !== 'tarefa' || r.tf.companyId !== company || !seesChamado(contrib, r)) return <NotFoundInline what="tarefa" back="/chamados/tarefas" />;
  const { tf, ch } = r;
  const events = data.events.filter((e) => e.recordId === tf.id);
  const decide = reviewDecisions(contrib, tf.id).length > 0;
  return (
    <>
      <nav className="crumbs" aria-label="Você está em"><Link to="/chamados">Chamados</Link><span aria-hidden>›</span><Link to={`/chamados/${ch.id}`}>{ch.numero}</Link><span aria-hidden>›</span><span aria-current="page">{tf.codigo}</span></nav>
      <section className="card" style={{ marginBottom: 20, overflow: 'hidden' }} aria-labelledby="tf-title">
        <ChamadosOutage />
        <div className="hero">
          <span className="hero-ic"><ListChecks size={30} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="hero-id">TAREFA {tf.codigo} · {ch.numero}</div>
            <h1 className="hero-title" id="tf-title">{tf.titulo}</h1>
            <div className="row-wrap" style={{ gap: 10 }}><Badge tone={TF_STATUS[tf.status].tone}>{TF_STATUS[tf.status].label}</Badge><Prio p={tf.prioridade} /><span className="small muted">{ch.titulo}</span></div>
          </div>
          <div className="hero-actions row"><BackToList fallback="/chamados/tarefas" /></div>
        </div>
        <dl className="facts" style={{ margin: 0 }}>
          <div className="fact"><dt>Responsável</dt><dd><span className="person"><Avatar name={userName(tf.responsavelId)} sm />{userName(tf.responsavelId)}</span></dd></div>
          <div className="fact"><dt>Revisor</dt><dd>{userName(tf.revisorId)}</dd></div>
          <div className="fact"><dt>Prazo</dt><dd className="tnum">{tf.prazo ? fmtDate(tf.prazo) : '—'}</dd></div>
          <div className="fact"><dt>Atualizada</dt><dd>{fmtRelative(tf.atualizadoEm)}</dd></div>
        </dl>
      </section>
      {decide && (
        <div className="banner banner-warn" style={{ marginBottom: 20 }}><AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <span className="b-text"><b>{userName(tf.responsavelId)}</b> enviou esta tarefa para sua revisão. Leia a conversa e decida: aprovar conclui a tarefa; devolver retorna para ajustes com seu comentário.</span></div>
      )}
      <div className="layout-detail">
        <div className="card">
          <Tabs value={tab} onChange={setTab} tabs={[{ id: 'conversa', label: 'Conversa', count: data.comments.filter((c) => c.recordId === tf.id).length }, { id: 'historico', label: 'Histórico', count: events.length }]} />
          <div className="card-body">
            {tab === 'conversa' && <><p className="small muted" style={{ marginBottom: 16 }}>{tf.descricao}</p><Conversation recordId={tf.id} /></>}
            {tab === 'historico' && <Timeline events={events} />}
          </div>
        </div>
        <aside className="stack">
          <div className="card card-pad">
            <div className="label" style={{ marginBottom: 10 }}>{decide ? 'Decisão da revisão' : 'Próxima ação'}</div>
            {decide ? <Actions recordId={tf.id} decisions /> : transitionsFor(contrib, tf.id).length ? <Actions recordId={tf.id} /> : <p className="small muted">{tf.status === 'em_revisao' ? `Aguardando revisão de ${userName(tf.revisorId)}.` : 'Nenhuma ação disponível para você nesta situação.'}</p>}
          </div>
        </aside>
      </div>
    </>
  );
}
