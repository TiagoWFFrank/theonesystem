// "Meu trabalho": lista unificada das contribuições dos plugins e fontes, com filtros por origem e situação.
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, CheckCheck, Eye, ShieldQuestion, User as UserIcon } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { collectWork, STAGE_LABEL, taskOpsFor } from '@/platform/work';
import { fmtDate, fmtDateShort } from '@/platform/format';
import { integration } from '@/platform/integrations';
import type { OriginId, WorkItem, WorkStage } from '@/platform/types';
import { Badge, Dialog, EmptyState } from './core';
import { ORIGINS, OriginChip } from './origin';
import { WorkPanel } from './WorkPanel';
import { PRIORITY } from '@/modules/chamados/meta';

const STAGE_ORDER: WorkStage[] = ['aprovacao', 'acao', 'andamento', 'acompanhando', 'informativo'];
const DAY = 86400000;
export function dueInfo(it: Pick<WorkItem, 'due' | 'dueLabel'>) {
  if (!it.due) return null;
  const d = Math.ceil((new Date(it.due).getTime() - Date.now()) / DAY);
  const label = it.dueLabel ?? 'Prazo';
  if (it.dueLabel === 'Embarque') return { text: `${label} ${fmtDateShort(it.due)}`, cls: d <= 3 ? 'soon' : '' };
  if (d < 0) return { text: `Atrasado · ${fmtDateShort(it.due)}`, cls: 'late' };
  if (d === 0) return { text: `${label}: hoje`, cls: 'soon' };
  if (d === 1) return { text: `${label}: amanhã`, cls: 'soon' };
  return { text: `${label} ${fmtDateShort(it.due)}`, cls: '' };
}
export const sortWork = (a: WorkItem, b: WorkItem) =>
  STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage)
  || (a.priority ? PRIORITY[a.priority].rank : 4) - (b.priority ? PRIORITY[b.priority].rank : 4)
  || (a.due ?? '9').localeCompare(b.due ?? '9');

const REL: Record<WorkItem['relation'], { label: string; icon: typeof Eye }> = {
  responsavel: { label: 'Sob sua responsabilidade', icon: UserIcon },
  solicitante: { label: 'Você abriu · acompanhando', icon: Eye },
  aprovador: { label: 'Sua decisão', icon: ShieldQuestion },
  destinatario: { label: 'Para você', icon: UserIcon },
};

export function useWork() {
  const { data, me, company } = useDemo();
  return useMemo(() => {
    const queues = collectWork(data, me, company);
    const items = queues.flatMap((q) => q.items).sort(sortWork);
    return { queues, items };
  }, [data, me, company]);
}

/** Lista de trabalho com filtros por origem e situação; contagens = itens apresentados. */
export function WorkList({ limit, showQueues = true, compactHeader }: { limit?: number; showQueues?: boolean; compactHeader?: React.ReactNode }) {
  const { queues, items } = useWork();
  const nav = useNavigate();
  const [orig, setOrig] = useState<OriginId | ''>('');
  const [stage, setStage] = useState<WorkStage | ''>('');
  const [panel, setPanel] = useState<WorkItem | null>(null);
  const [ext, setExt] = useState<WorkItem | null>(null);
  const byStage = items.filter((i) => !orig || i.origin === orig);
  const byOrig = items.filter((i) => !stage || i.stage === stage);
  const shown = items.filter((i) => (!orig || i.origin === orig) && (!stage || i.stage === stage));
  const origins = Array.from(new Set(items.map((i) => i.origin)));
  const stages = STAGE_ORDER.filter((s) => items.some((i) => i.stage === s));
  const visible = limit ? shown.slice(0, limit) : shown;
  const act = (it: WorkItem) => {
    if (it.action.kind === 'painel' && taskOpsFor(it.origin, it.recordId)) setPanel(it);
    else if (it.action.kind === 'externo') setExt(it);
    else nav(it.action.to);
  };

  return (
    <>
      {compactHeader}
      {items.length > 0 && (
        <div className="wfilters">
          <div className="frow"><span className="lbl">Origem</span>
            <div className="seg-filter" role="group" aria-label="Filtrar por origem">
              <button aria-pressed={!orig} onClick={() => setOrig('')}>Todas<span className="n">{byOrig.length}</span></button>
              {origins.map((o) => <button key={o} aria-pressed={orig === o} onClick={() => setOrig(orig === o ? '' : o)}>{ORIGINS[o].name}<span className="n">{byOrig.filter((i) => i.origin === o).length}</span></button>)}
            </div>
          </div>
          <div className="frow"><span className="lbl">Situação</span>
            <div className="seg-filter" role="group" aria-label="Filtrar por situação">
              <button aria-pressed={!stage} onClick={() => setStage('')}>Todas<span className="n">{byStage.length}</span></button>
              {stages.map((s) => <button key={s} aria-pressed={stage === s} onClick={() => setStage(stage === s ? '' : s)}>{STAGE_LABEL[s]}<span className="n">{byStage.filter((i) => i.stage === s).length}</span></button>)}
            </div>
          </div>
        </div>
      )}
      {shown.length === 0 ? <EmptyState icon={<CheckCheck size={24} />} title={items.length ? 'Nada com estes filtros' : 'Tudo em dia'} text={items.length ? 'Ajuste a origem ou a situação.' : 'As tarefas dos módulos e sistemas que você acessa neste ambiente aparecem aqui.'} /> : (
        <div role="list" aria-label="Itens de trabalho">
          {visible.map((it) => {
            const O = ORIGINS[it.origin]; const due = dueInfo(it); const R = REL[it.relation];
            return (
              <div key={it.key} className={`witem rel-${it.relation}`} role="listitem">
                <span className="t-ic" aria-hidden><O.icon size={18} /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="w-top"><span className="w-ref">{it.ref}</span><OriginChip origin={it.origin} withSystem /><span className="rel-tag"><R.icon size={12} />{R.label}</span></div>
                  <div className="w-title" title={it.title}>{it.title}</div>
                  <div className="w-meta">
                    <Badge tone={it.tone}>{it.status}</Badge>
                    {it.priority && <span className={`prio ${it.priority}`}>{PRIORITY[it.priority].label}</span>}
                    {it.subject && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', minWidth: 0 }}>{it.subject}</span>}
                  </div>
                </div>
                <span className={`w-due ${due?.cls ?? ''}`}>{due?.text ?? ''}</span>
                <button className={`btn btn-sm w-act ${it.stage === 'acao' || it.stage === 'aprovacao' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => act(it)}>
                  {it.action.label}{it.action.kind === 'externo' && <ArrowUpRight size={14} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {(showQueues && queues.length > 0) || (limit && shown.length > limit) ? (
        <div className="work-foot" aria-label="Filas de trabalho">
          {limit && shown.length > limit && <Link to="/pendencias" style={{ color: 'var(--text)' }}>Mostrando {limit} de {shown.length} · ver tudo</Link>}
          {showQueues && queues.map((q) => <Link key={q.id} to={q.to}>{q.label} <b>{q.items.length}</b></Link>)}
        </div>
      ) : null}
      <WorkPanel open={!!panel} onClose={() => setPanel(null)} origin={panel?.origin ?? 'chamados'} recordId={panel?.recordId ?? null} ops={panel ? taskOpsFor(panel.origin, panel.recordId) : undefined} />
      <Dialog open={!!ext} onClose={() => setExt(null)} title={ext?.title ?? ''} desc={ext ? `${ORIGINS[ext.origin].name} · ${ORIGINS[ext.origin].system}` : ''}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setExt(null)}>Fechar</button>
          {ext?.action.to ? <a className="btn btn-primary" href={ext.action.to} target="_blank" rel="noreferrer"><ArrowUpRight size={16} />{ext.action.label}</a>
            : <button className="btn btn-primary" disabled><ArrowUpRight size={16} />{ext?.action.label} · não configurado</button>}
        </>}>
        {ext && <div className="stack-sm small">
          <p>{ext.subject}{ext.due ? ` · prazo ${fmtDate(ext.due)}` : ''}</p>
          <div className="banner banner-info"><span className="b-text">Esta pendência vem do sistema de {ORIGINS[ext.origin].name} ({ORIGINS[ext.origin].system}), que continua sendo o lugar de responder. Integração <b>{integration(ext.origin === 'feedback' ? 'feedback' : 'sharepoint').mode === 'real' ? 'real' : 'simulada'}</b>: o endereço real será configurado na etapa de integração.</span></div>
        </div>}
      </Dialog>
    </>
  );
}
