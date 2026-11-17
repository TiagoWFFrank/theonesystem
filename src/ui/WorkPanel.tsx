// Painel de trabalho contextual: consultar, comentar e avançar uma tarefa sem sair da tela atual.
// Consome o contrato do plugin de origem (TaskOps): visão, comentários, transições válidas e verificações.
// O núcleo não conhece tipos, prioridades nem identificadores internos do plugin.
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Info, Loader2, RotateCw, Send, X } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { fmtDate, fmtDateTime, fmtRelative, fmtTime } from '@/platform/format';
import { originMeta } from '@/platform/registry';
import { taskOpsFor } from '@/platform/work';
import type { HealthId, OriginId } from '@/platform/types';
import { Avatar, Badge, Drawer } from './core';
import { OriginChip } from './origin';
import { IntegrationTag } from './source';
import { draftKey, useDraft, useRecordOperation, type OpState } from './operation';

export type PanelTarget = { origin: OriginId; recordId: string };

const FAIL_TITLE: Record<string, string> = {
  indisponivel: 'Sistema de origem sem resposta', permissao: 'Permissão alterada', situacao: 'A situação mudou', registro: 'Registro indisponível',
  modulo: 'Módulo indisponível', contexto: 'Contexto alterado', validacao: 'Falta o comentário',
};

/** Retorno de uma operação (envio, falha, cancelamento). Também usado nas telas do módulo. */
export function OpFeedback({ state, origin, onRetry, onCancel, onDismiss }: { state: OpState; origin: OriginId; onRetry: () => void; onCancel: () => void; onDismiss: () => void }) {
  const { down, health } = useDemo();
  const meta = originMeta(origin);
  if (state.phase === 'sending') return (
    <div className="banner banner-info" role="status" data-op="sending"><Loader2 size={17} className="spin" style={{ flexShrink: 0, marginTop: 2 }} />
      <span className="b-text small">Enviando {state.intent.kind === 'comment' ? 'comentário' : `“${state.intent.label}”`} ao {meta.system.includes('plugin') ? `sistema de ${meta.name}` : meta.name}{state.attempt > 1 ? ` · tentativa ${state.attempt}` : ''}…</span>
      <button className="btn btn-ghost btn-xs" onClick={onCancel}><X size={13} />Cancelar envio</button>
    </div>
  );
  if (state.phase === 'cancelled') return (
    <div className="banner banner-info" role="status" data-op="cancelled"><Info size={17} style={{ flexShrink: 0, marginTop: 2 }} />
      <span className="b-text small">{state.msg}</span>
      <button className="btn btn-ghost btn-xs" onClick={onDismiss}>Fechar aviso</button>
    </div>
  );
  if (state.phase !== 'failed') return null;
  const h = health[origin as HealthId];
  const back = state.code === 'indisponivel' && !down(origin as HealthId) && h?.restoredAt && h.restoredAt > state.at;
  return (
    <div className={`banner ${state.retryable ? 'banner-danger' : 'banner-warn'}`} role="alert" data-op="failed" data-code={state.code}>
      <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 2 }} />
      <span className="b-text small">
        <b>{FAIL_TITLE[state.code] ?? 'Não foi possível concluir'}{state.attempt > 1 ? ` · tentativa ${state.attempt}` : ''}.</b> {state.msg}
        {back && <span className="retry-line" style={{ color: 'var(--ok)' }}>A conexão foi restabelecida às {fmtTime(new Date(h!.restoredAt!).toISOString())}. Você pode tentar novamente.</span>}
        {state.code !== 'validacao' && state.code !== 'indisponivel' && <span className="retry-line">Seu texto foi mantido. As ações abaixo já refletem a situação e o acesso atuais.</span>}
        {state.retryable && <span className="retry-line">A nova tentativa é feita com a situação, o acesso e o texto deste momento. Operações não são reenviadas automaticamente.</span>}
      </span>
      {state.retryable ? <button className="btn btn-secondary btn-xs" onClick={onRetry}><RotateCw size={13} />Tentar novamente</button>
        : <button className="btn btn-ghost btn-xs" onClick={onDismiss}>Entendi</button>}
    </div>
  );
}

export function WorkPanel({ target, onClose }: { target: PanelTarget | null; onClose: () => void }) {
  const { contrib, userName, me, company } = useDemo();
  const origin = target?.origin ?? ('admin' as OriginId);
  const recordId = target?.recordId ?? null;
  const ops = target ? taskOpsFor(origin) : undefined;
  const draft = useDraft(draftKey(me?.id, company, origin, recordId));
  const op = useRecordOperation(origin, recordId, {
    getText: () => draft.text,
    onSuccess: (i) => { if (i.kind === 'comment' || i.needsComment) draft.clear(); },
  });
  // o painel pertence ao contexto em que foi aberto: troca de pessoa ou ambiente fecha o painel
  const opened = useRef<string | null>(null);
  const ctxKey = `${me?.id}|${company}`;
  useEffect(() => {
    if (!target) { opened.current = null; return; }
    if (opened.current === null) opened.current = ctxKey;
    else if (opened.current !== ctxKey) { opened.current = null; onClose(); }
  }, [target, ctxKey, onClose]);
  if (!target || !ops || !contrib) return null;
  const v = ops.view(contrib, target.recordId);
  if (!v) return null;
  const meta = originMeta(origin);
  const comments = ops.comments(contrib, target.recordId);
  const transitions = ops.transitions(contrib, target.recordId);
  const canComment = ops.canComment(contrib, target.recordId);
  const busy = op.busy;
  const sendingId = op.state.phase === 'sending' ? (op.state.intent.kind === 'comment' ? 'comment' : op.state.intent.id) : null;

  return (
    <Drawer open onClose={onClose} wide label={`${v.ref} · painel de trabalho`}
      title={<span className="row" style={{ gap: 10 }}><span className="tnum">{v.ref}</span><OriginChip origin={origin} /></span>}
      footer={<>
        <Link to={v.openTo} className="btn btn-secondary btn-sm" onClick={onClose}><ArrowUpRight size={15} />Abrir no módulo</Link>
        <span className="spacer" />
        <IntegrationTag id={meta.integration} compact />
      </>}>
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.25 }}>{v.title}</h2>
          <div className="row-wrap" style={{ gap: 8, marginTop: 8 }}>
            <Badge tone={v.tone}>{v.status}</Badge>
            {v.priority && <span className={`prio t-${v.priority.tone}`}>Prioridade {v.priority.label}</span>}
            {v.due && <span className="xs muted">Prazo {fmtDate(v.due)}</span>}
          </div>
        </div>
        <dl className="kv" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
          {v.facts.map(([k, val]) => <div key={k}><dt>{k}</dt><dd className="small">{val}</dd></div>)}
        </dl>
        <p className="small muted">{v.description}</p>

        {v.notice && (
          <div className={`banner banner-${v.notice.tone}`}><AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 2 }} />
            <span className="b-text small">{v.notice.text} {v.notice.action && <Link to={v.notice.action.to} onClick={onClose}><b>{v.notice.action.label}</b></Link>}</span></div>
        )}

        <div>
          <div className="label" style={{ marginBottom: 8 }}>Próxima ação</div>
          {transitions.length ? (
            <div className="trans">
              {transitions.map((t) => (
                <button key={t.id} className={`btn btn-sm ${t.primary ? 'btn-primary' : 'btn-secondary'}`} disabled={busy} title={t.hint}
                  onClick={() => op.run({ kind: 'transition', id: t.id, label: t.label, needsComment: t.needsComment })}>
                  {sendingId === t.id ? <Loader2 size={15} className="spin" /> : t.primary ? <CheckCircle2 size={15} /> : null}{t.label}{t.needsComment ? ' *' : ''}
                </button>
              ))}
            </div>
          ) : <p className="small muted">Nenhuma ação disponível para você nesta situação.</p>}
          {transitions.some((t) => t.needsComment) && <p className="xs muted" style={{ marginTop: 6 }}>* exige comentário (use o campo abaixo)</p>}
          {transitions.find((t) => t.hint && t.primary) && <p className="xs muted" style={{ marginTop: 6 }}>{transitions.find((t) => t.hint && t.primary)!.hint}</p>}
        </div>

        <OpFeedback state={op.state} origin={origin} onRetry={op.retry} onCancel={op.cancel} onDismiss={op.dismiss} />

        <div>
          <div className="label" style={{ marginBottom: 10 }}>Comentários · {comments.length}</div>
          <div className="comments">
            {comments.length === 0 && <p className="small muted">Ainda não há comentários.</p>}
            {comments.map((cm) => (
              <div key={cm.id} className={`cmt ${cm.authorId === me?.id ? 'mine' : ''} ${op.state.phase === 'idle' && op.state.lastOk && cm.authorId === me?.id && Date.now() - new Date(cm.ts).getTime() < 15000 ? 'new' : ''}`}>
                <Avatar name={userName(cm.authorId)} sm />
                <div>
                  <div className="meta"><b>{userName(cm.authorId)}</b><span title={fmtDateTime(cm.ts)}>{fmtRelative(cm.ts)}</span>{cm.via === 'painel' && <span>· pelo painel</span>}</div>
                  <div className="bubble">{cm.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {canComment.ok || transitions.some((t) => t.needsComment) ? (
          <div className="composer">
            <label className="label" htmlFor="wp-text">Adicionar comentário</label>
            <textarea id="wp-text" className="textarea" placeholder="Escreva para a pessoa responsável ou solicitante…" value={draft.text}
              onChange={(e) => { draft.setText(e.target.value); if (op.state.phase === 'failed' && op.state.code === 'validacao') op.dismiss(); }} />
            <div className="row"><span className="xs muted">{draft.text && draft.restoredAt ? `Rascunho guardado às ${fmtTime(draft.restoredAt)} · ` : ''}Fica no histórico do {v.ref} e notifica os envolvidos.</span><span className="spacer" />
              {canComment.ok && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => op.run({ kind: 'comment' })}>{sendingId === 'comment' ? <Loader2 size={15} className="spin" /> : <Send size={15} />}Comentar</button>}</div>
          </div>
        ) : <p className="xs muted">{canComment.msg}{draft.text ? ' Seu rascunho continua guardado.' : ''}</p>}
      </div>
    </Drawer>
  );
}
