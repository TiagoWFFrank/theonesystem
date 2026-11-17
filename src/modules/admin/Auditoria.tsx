// Auditoria: comentários, alterações de tarefa, decisões, mudanças de acesso e exportações.
import { useNavigate } from 'react-router-dom';
import { ScrollText } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { useUrlState } from '@/platform/hooks';
import { fmtDateTime } from '@/platform/format';
import { recordPath } from '@/platform/work';
import { Avatar, Badge, EmptyState, PageHeader, type Tone } from '@/ui/core';
import { COMPANIES } from '@/ui/brand';
import { ORIGINS } from '@/ui/origin';
import { ForbiddenInline } from '@/pages/NotFound';
import type { AuditKind } from '@/platform/types';

const KINDS: Record<AuditKind, { label: string; tone: Tone }> = {
  comentario: { label: 'Comentário', tone: 'info' }, tarefa: { label: 'Tarefa', tone: 'accent' }, decisao: { label: 'Decisão', tone: 'warn' },
  acesso: { label: 'Acesso', tone: 'danger' }, exportacao: { label: 'Exportação', tone: 'ok' }, operacao: { label: 'Operação', tone: 'neutral' },
};

export default function Auditoria() {
  const { data, can, company, userName } = useDemo();
  const nav = useNavigate();
  const [f, setF] = useUrlState({ tipo: '', amb: 'atual' });
  if (!can('admin', 'auditoria')) return <ForbiddenInline module="Auditoria" />;
  const base = data.events.filter((e) => e.kind && (f.amb === 'todos' || e.companyId === company)).sort((a, b) => b.ts.localeCompare(a.ts));
  const rows = base.filter((e) => !f.tipo || e.kind === f.tipo).slice(0, 120);
  return (
    <>
      <PageHeader crumbs={[{ label: 'Administração' }, { label: 'Auditoria' }]} title="Auditoria"
        sub="Trilha dos comentários, alterações de tarefa, decisões, mudanças de acesso e exportações. Registros não são editáveis nem excluídos." />
      <div className="card">
        <div className="list-tools">
          <div className="tools-row">
            <div className="seg-filter" role="group" aria-label="Categoria">
              <button aria-pressed={!f.tipo} onClick={() => setF({ tipo: '' })}>Todas<span className="n">{base.length}</span></button>
              {(Object.keys(KINDS) as AuditKind[]).filter((k) => k !== 'operacao').map((k) => <button key={k} aria-pressed={f.tipo === k} onClick={() => setF({ tipo: k })}>{KINDS[k].label}<span className="n">{base.filter((e) => e.kind === k).length}</span></button>)}
            </div>
            <div className="seg" role="group" aria-label="Ambiente" style={{ width: 'auto' }}>
              <button aria-pressed={f.amb === 'atual'} onClick={() => setF({ amb: 'atual' })}>{COMPANIES[company].name}</button>
              <button aria-pressed={f.amb === 'todos'} onClick={() => setF({ amb: 'todos' })}>Todos os ambientes</button>
            </div>
          </div>
        </div>
        {rows.length === 0 ? <EmptyState icon={<ScrollText size={22} />} title="Nenhum evento nesta categoria" /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Data</th><th>Categoria</th><th>Origem · registro</th><th>Ação</th><th>Autor</th>{f.amb === 'todos' && <th>Ambiente</th>}</tr></thead>
              <tbody>{rows.map((e) => (
                <tr key={e.id} onClick={() => nav(recordPath(e.module, e.recordId, data))}>
                  <td className="num small" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(e.ts)}</td>
                  <td><Badge tone={KINDS[e.kind!].tone} plain>{KINDS[e.kind!].label}</Badge></td>
                  <td className="small"><span className="muted">{ORIGINS[e.module].name}</span> · <b className="tnum">{e.recordLabel}</b></td>
                  <td className="small"><div className="truncate" style={{ maxWidth: 420 }} title={e.action}>{e.action}</div></td>
                  <td className="small"><span className="person"><Avatar name={userName(e.actorId)} sm />{userName(e.actorId)}</span></td>
                  {f.amb === 'todos' && <td className="small">{COMPANIES[e.companyId].name}</td>}
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
