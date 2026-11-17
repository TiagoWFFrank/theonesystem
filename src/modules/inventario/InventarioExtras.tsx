import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, ChevronRight, Wrench } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { fmtDate, fmtDateTime } from '@/platform/format';
import { Badge, EmptyState, ErrorState, PageHeader, SkeletonRows, useSimLoad } from '@/ui/core';
import { EQ_STATUS, EQ_TYPES } from './meta';
import type { EquipStatus } from '@/platform/types';

const crumbs = (label: string) => [{ label: 'Inventário', to: '/inventario/equipamentos' }, { label }];

export function Movimentacoes() {
  const { data, company, userName, sees } = useDemo();
  const { state, retry } = useSimLoad();
  const nav = useNavigate();
  const rows = data.events
    .filter((e) => e.module === 'inventario' && e.companyId === company && /entrega|devolv/i.test(e.action))
    .filter((e) => sees('inventario', data.equipments.find((x) => x.id === e.recordId)?.responsavelId))
    .sort((a, b) => b.ts.localeCompare(a.ts));
  return (
    <>
      <PageHeader crumbs={crumbs('Entregas e devoluções')} title="Entregas e devoluções" sub="Movimentações de responsabilidade registradas pela TI." />
      <div className="card">
        {state === 'loading' ? <SkeletonRows cols={4} /> : state === 'error' ? <ErrorState onRetry={retry} /> : rows.length === 0 || state === 'empty' ? (
          <EmptyState icon={<ArrowLeftRight size={22} />} title="Nenhuma movimentação" text="Entregas e devoluções registradas aparecerão aqui." />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Data</th><th>Patrimônio</th><th>Movimentação</th><th>Registrado por</th><th /></tr></thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} onClick={() => nav(`/inventario/equipamentos/${e.recordId}`)}>
                    <td className="num small">{fmtDateTime(e.ts)}</td>
                    <td className="id-cell">{e.recordLabel}</td>
                    <td><div className="truncate" style={{ maxWidth: 420 }}>{e.action}</div></td>
                    <td className="small">{userName(e.actorId)}</td>
                    <td className="row-action"><ChevronRight size={18} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export function Manutencoes() {
  const { data, company, sees } = useDemo();
  const { state, retry } = useSimLoad();
  const rows = data.equipments.filter((e) => e.companyId === company && e.maintenance?.length && sees('inventario', e.responsavelId));
  return (
    <>
      <PageHeader crumbs={crumbs('Manutenções')} title="Manutenções" sub="Equipamentos enviados para assistência técnica." />
      <div className="card">
        {state === 'loading' ? <SkeletonRows cols={4} rows={3} /> : state === 'error' ? <ErrorState onRetry={retry} /> : rows.length === 0 || state === 'empty' ? (
          <EmptyState icon={<Wrench size={22} />} title="Nenhum equipamento em manutenção" />
        ) : (
          <div className="card-body stack-sm">
            {rows.map((e) => {
              const m = e.maintenance![e.maintenance!.length - 1];
              return (
                <Link key={e.id} to={`/inventario/equipamentos/${e.id}`} className="att" style={{ textDecoration: 'none' }}>
                  <span className="att-icon" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}><Wrench size={18} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="strong">{e.patrimonio} · {e.descricao}</div>
                    <div className="xs muted">{m.motivo} · {m.fornecedor} · previsão {fmtDate(m.previsao)}</div>
                  </div>
                  <Badge tone={EQ_STATUS[e.status].tone}>{EQ_STATUS[e.status].label}</Badge>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export function Relatorios() {
  const { data, company, sees } = useDemo();
  const list = data.equipments.filter((e) => e.companyId === company && sees('inventario', e.responsavelId));
  const total = list.length || 1;
  const byStatus = (Object.keys(EQ_STATUS) as EquipStatus[]).map((s) => ({ s, n: list.filter((e) => e.status === s).length }));
  const byType = EQ_TYPES.map((t) => ({ t, n: list.filter((e) => e.tipo === t).length })).filter((x) => x.n > 0);
  return (
    <>
      <PageHeader crumbs={crumbs('Relatórios')} title="Relatórios" sub="Período: posição atual · ambiente ativo. Cada indicador abre a lista correspondente." />
      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 16 }}>
        {byStatus.map(({ s, n }) => (
          <Link key={s} to={`/inventario/equipamentos?situacao=${s}`} className="card stat" style={{ textDecoration: 'none' }}>
            <div className="v">{n}</div>
            <div className="k">{EQ_STATUS[s].label}</div>
          </Link>
        ))}
      </div>
      <div className="card">
        <div className="card-head"><h2>Equipamentos por tipo</h2></div>
        <div className="card-body stack-sm">
          {byType.map(({ t, n }) => (
            <Link key={t} to={`/inventario/equipamentos?tipo=${t}`} style={{ textDecoration: 'none', display: 'grid', gridTemplateColumns: '120px 1fr 40px', gap: 12, alignItems: 'center', padding: '6px 0' }}>
              <span className="small strong">{t}</span>
              <span className="bar"><span style={{ width: `${(n / total) * 100}%` }} /></span>
              <span className="tnum small" style={{ textAlign: 'right' }}>{n}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
