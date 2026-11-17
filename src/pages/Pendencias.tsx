import { Link } from 'react-router-dom';
import { ArrowRight, CheckCheck } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { computePendencias } from '@/platform/pendencias';
import { fmtDate } from '@/platform/format';
import { Badge, EmptyState, PageHeader } from '@/ui/core';
import { ALL_MODULES } from '@/layout/modules';

export default function Pendencias() {
  const { data, me, company } = useDemo();
  const pend = computePendencias(data, me, company).filter((p) => p.records.length);
  return (
    <>
      <PageHeader crumbs={[{ label: 'Início', to: '/inicio' }, { label: 'Meu trabalho' }]} title="Meu trabalho"
        sub="Tarefas dos módulos que você acessa neste ambiente, agrupadas por fila e ordenadas por prazo." />
      {pend.length === 0 ? <div className="card"><EmptyState icon={<CheckCheck size={24} />} title="Tudo em dia" text="Nenhuma tarefa para o seu perfil neste ambiente." /></div> : (
        <div className="stack" style={{ gap: 20 }}>
          {pend.map((p) => {
            const m = ALL_MODULES.find((x) => x.id === p.module)!;
            return (
              <section className="card" key={p.id} aria-labelledby={`q-${p.id}`}>
                <div className="card-head">
                  <span className="mod-icon" style={{ width: 34, height: 34, borderRadius: 10 }}><m.icon size={16} /></span>
                  <h2 id={`q-${p.id}`}>{p.label}</h2><span className="badge badge-accent plain tnum">{p.records.length}</span>
                  <Link to={p.to} className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>Abrir lista<ArrowRight size={15} /></Link>
                </div>
                {[...p.records].sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9')).map((r) => (
                  <div key={r.id} className="task">
                    <span className="t-ic"><m.icon size={18} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="t-title">{r.title}</div>
                      <div className="t-meta"><span>{r.subject}</span><Badge tone={r.tone}>{r.status}</Badge></div>
                    </div>
                    <span className="t-due">{r.due ? `${r.dueLabel ?? 'Prazo'} ${fmtDate(r.due)}` : '—'}</span>
                    <Link to={r.link} className="btn btn-secondary btn-sm t-act">{r.action}</Link>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
