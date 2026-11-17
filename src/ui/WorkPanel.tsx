// Painel de trabalho contextual: consultar, comentar e avançar uma tarefa sem sair da tela atual.
// Usa as REGRAS e OPERAÇÕES do módulo de origem (TaskOps declarado no contrato do plugin).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Loader2, RotateCw, Send } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { fmtDate, fmtDateTime, fmtRelative } from '@/platform/format';
import type { OriginId, TaskOps } from '@/platform/types';
import { Avatar, Badge, Drawer } from './core';
import { OriginChip } from './origin';
import { useToast } from './toast';
import { PRIORITY } from '@/modules/chamados/meta';

export function WorkPanel({ open, onClose, origin, recordId, ops }: { open: boolean; onClose: () => void; origin: OriginId; recordId: string | null; ops?: TaskOps }) {
  const { contrib, api, userName, me, down } = useDemo();
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ msg: string; retry: () => void } | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  useEffect(() => { setText(''); setErr(null); setFresh(null); }, [recordId]);
  if (!open || !recordId || !ops || !contrib || !api) return null;
  const v = ops.view(contrib, recordId);
  if (!v) return null;
  const comments = ops.comments(contrib, recordId);
  const transitions = ops.transitions(contrib, recordId);

  // simula a latência do sistema de origem e devolve retorno claro em caso de falha
  const run = (label: string, fn: () => string | void) => {
    setBusy(label); setErr(null);
    setTimeout(() => {
      try {
        const msg = fn();
        setBusy(null);
        if (msg) toast(msg);
      } catch (e) {
        setBusy(null);
        setErr({ msg: (e as Error).message, retry: () => run(label, fn) });
      }
    }, 650);
  };
  const doComment = () => {
    const t = text.trim();
    if (!t) { setErr({ msg: 'Escreva o comentário antes de enviar.', retry: () => setErr(null) }); return; }
    run('comment', () => { ops.comment(api, recordId, t); setText(''); setFresh(t); return `Comentário registrado em ${v.ref}.`; });
  };
  const doTransition = (id: string, needsComment?: boolean) => {
    const t = text.trim();
    if (needsComment && !t) { setErr({ msg: 'Esta ação exige um comentário. Escreva-o no campo abaixo e tente de novo.', retry: () => setErr(null) }); document.getElementById('wp-text')?.focus(); return; }
    run(id, () => { const m = ops.apply(api, recordId, id, needsComment ? t : undefined); if (needsComment) setText(''); return m; });
  };
  const isRevisor = /^t/.test(recordId) && v.status === 'Em revisão' && contrib.data.tarefas.find((x) => x.id === recordId)?.revisorId === me?.id;

  return (
    <Drawer open={open} onClose={onClose} wide label={`${v.ref} · painel de trabalho`}
      title={<span className="row" style={{ gap: 10 }}><span className="tnum">{v.ref}</span><OriginChip origin={origin} /></span>}
      footer={<>
        <Link to={v.openTo} className="btn btn-secondary btn-sm" onClick={onClose}><ArrowUpRight size={15} />Abrir no módulo</Link>
        <span className="spacer" />
        {down(origin as never) ? <span className="xs" style={{ color: 'var(--warn)' }}>Origem indisponível</span> : <span className="xs muted">Sincronizado com {origin === 'chamados' ? 'o sistema de Chamados' : 'a origem'}</span>}
      </>}>
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.25 }}>{v.title}</h2>
          <div className="row-wrap" style={{ gap: 8, marginTop: 8 }}>
            <Badge tone={v.tone}>{v.status}</Badge>
            {v.priority && <span className={`prio ${v.priority}`}>Prioridade {PRIORITY[v.priority].label}</span>}
            {v.due && <span className="xs muted">Prazo {fmtDate(v.due)}</span>}
          </div>
        </div>
        <dl className="kv" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
          {v.facts.map(([k, val]) => <div key={k}><dt>{k}</dt><dd className="small">{val}</dd></div>)}
        </dl>
        <p className="small muted">{v.description}</p>

        {isRevisor && (
          <div className="banner banner-warn"><AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 2 }} />
            <span className="b-text small">A revisão é uma aprovação e é decidida dentro do módulo Chamados. <Link to={v.openTo} onClick={onClose}><b>Abrir para decidir</b></Link></span></div>
        )}

        <div>
          <div className="label" style={{ marginBottom: 8 }}>Próxima ação</div>
          {transitions.length ? (
            <div className="trans">
              {transitions.map((t) => (
                <button key={t.id} className={`btn btn-sm ${t.primary ? 'btn-primary' : 'btn-secondary'}`} disabled={!!busy} onClick={() => doTransition(t.id, t.needsComment)} title={t.hint}>
                  {busy === t.id ? <Loader2 size={15} className="spin" /> : t.primary ? <CheckCircle2 size={15} /> : null}{t.label}{t.needsComment ? ' *' : ''}
                </button>
              ))}
            </div>
          ) : <p className="small muted">Nenhuma ação disponível para você nesta situação.</p>}
          {transitions.some((t) => t.needsComment) && <p className="xs muted" style={{ marginTop: 6 }}>* exige comentário</p>}
          {transitions.find((t) => t.hint && t.primary) && <p className="xs muted" style={{ marginTop: 6 }}>{transitions.find((t) => t.hint && t.primary)!.hint}</p>}
        </div>

        {err && (
          <div className="banner banner-danger" role="alert"><AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 2 }} />
            <span className="b-text small" style={{ flex: 1 }}>{err.msg}</span>
            <button className="btn btn-secondary btn-xs" onClick={err.retry}><RotateCw size={13} />Tentar novamente</button>
          </div>
        )}

        <div>
          <div className="label" style={{ marginBottom: 10 }}>Comentários · {comments.length}</div>
          <div className="comments">
            {comments.length === 0 && <p className="small muted">Ainda não há comentários.</p>}
            {comments.map((cm) => (
              <div key={cm.id} className={`cmt ${cm.authorId === me?.id ? 'mine' : ''} ${fresh && cm.text === fresh ? 'new' : ''}`}>
                <Avatar name={userName(cm.authorId)} sm />
                <div>
                  <div className="meta"><b>{userName(cm.authorId)}</b><span title={fmtDateTime(cm.ts)}>{fmtRelative(cm.ts)}</span>{cm.via === 'painel' && <span>· pelo painel</span>}</div>
                  <div className="bubble">{cm.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="composer">
          <label className="label" htmlFor="wp-text">Adicionar comentário</label>
          <textarea id="wp-text" className="textarea" placeholder="Escreva para a pessoa responsável ou solicitante…" value={text} onChange={(e) => { setText(e.target.value); if (err) setErr(null); }} />
          <div className="row"><span className="xs muted">O comentário fica no histórico do {v.ref} e notifica os envolvidos.</span><span className="spacer" />
            <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={doComment}>{busy === 'comment' ? <Loader2 size={15} className="spin" /> : <Send size={15} />}Comentar</button></div>
        </div>
      </div>
    </Drawer>
  );
}
