import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronRight, PackageCheck, Plus, Search, X } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { flash, useSort, useUrlState } from '@/platform/hooks';
import { fmtDate } from '@/platform/format';
import { Avatar, Badge, EmptyState, ErrorState, NoResults, PageHeader, Pager, SkeletonRows, useSimLoad } from '@/ui/core';
import { ExportButton } from '@/ui/export';
import { EQ_STATUS, EQ_TYPES, TYPE_ICON } from './meta';
import type { Equipment, EquipStatus } from '@/platform/types';

const PER_PAGE = 8;

export default function EquipamentosList() {
  const { data, company, can, sees, grant, userName } = useDemo();
  const nav = useNavigate();
  const { state, retry } = useSimLoad();
  const [f, setF] = useUrlState({ q: '', situacao: '', tipo: '', resp: '', aceite: '', sort: 'patrimonio', dir: 'asc', page: '1' });
  const [hl] = useState(() => flash.take('list:inventario')?.highlight);
  const scope = grant('inventario')?.scope;
  const canDeliver = can('inventario', 'registrar_entrega');

  const base = useMemo(() => data.equipments.filter((e) => e.companyId === company && sees('inventario', e.responsavelId)), [data.equipments, company, sees]);
  const responsaveis = useMemo(() => Array.from(new Set(base.map((e) => e.responsavelId).filter(Boolean))) as string[], [base]);
  // filtros exceto situação (para as contagens do seletor de situação)
  const pre = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return base.filter((e) =>
      (!q || [e.patrimonio, e.descricao, userName(e.responsavelId), e.serie].join(' ').toLowerCase().includes(q)) &&
      (!f.tipo || e.tipo === f.tipo) && (!f.resp || e.responsavelId === f.resp) && (!f.aceite || !!e.aceitePendente));
  }, [base, f, userName]);
  const filtered = useMemo(() => pre.filter((e) => !f.situacao || e.status === f.situacao), [pre, f.situacao]);
  const sorted = useSort<Equipment>(filtered, f.sort, f.dir, {
    patrimonio: (e) => e.patrimonio, descricao: (e) => e.descricao, responsavel: (e) => userName(e.responsavelId) || 'zzz',
    status: (e) => EQ_STATUS[e.status].label, mov: (e) => e.ultimaMov,
  });
  const page = Number(f.page) || 1;
  const pages = Math.ceil(sorted.length / PER_PAGE);
  const rows = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const chips = [
    f.tipo && { k: 'tipo', label: `Tipo: ${f.tipo}` },
    f.resp && { k: 'resp', label: `Responsável: ${userName(f.resp)}` },
    f.aceite && { k: 'aceite', label: 'Entrega a confirmar' },
  ].filter(Boolean) as { k: string; label: string }[];
  const clear = () => setF({ q: '', situacao: '', tipo: '', resp: '', aceite: '' });

  const Th = ({ k, children, className }: { k: string; children: string; className?: string }) => (
    <th className={className} aria-sort={f.sort === k ? (f.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => setF({ sort: k, dir: f.sort === k && f.dir === 'asc' ? 'desc' : 'asc' })}>
        {children}{f.sort === k && (f.dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
      </button>
    </th>
  );
  const isEmpty = state === 'empty' || base.length === 0;

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Inventário', to: '/inventario/equipamentos' }, { label: 'Equipamentos' }]}
        title={scope === 'proprios' ? 'Meus equipamentos' : 'Equipamentos'}
        sub={scope === 'proprios' ? 'Equipamentos sob sua responsabilidade.' : 'Patrimônio de TI do ambiente: responsável, localização e situação.'}
        actions={<>
          <ExportButton module="inventario" rows={sorted} name={`equipamentos-${company}`} columns={[
            { key: 'patrimonio', label: 'Patrimônio', get: (e) => e.patrimonio }, { key: 'descricao', label: 'Equipamento', get: (e) => e.descricao },
            { key: 'tipo', label: 'Tipo', get: (e) => e.tipo }, { key: 'responsavel', label: 'Responsável', get: (e) => userName(e.responsavelId) },
            { key: 'localizacao', label: 'Localização', get: (e) => e.localizacao }, { key: 'situacao', label: 'Situação', get: (e) => EQ_STATUS[e.status].label },
            { key: 'ultimaMov', label: 'Última movimentação', get: (e) => fmtDate(e.ultimaMov) },
          ]} />
          {can('inventario', 'cadastrar') && <Link className="btn btn-primary" to="/inventario/equipamentos/novo"><Plus size={18} />Cadastrar equipamento</Link>}
        </>}
      />
      <div className="card">
        <div className="list-tools">
          <div className="tools-row">
            <div className="input-icon">
              <Search size={17} />
              <input className="input" placeholder="Buscar por patrimônio, equipamento, série ou responsável" aria-label="Buscar equipamentos" value={f.q} onChange={(e) => setF({ q: e.target.value })} />
            </div>
            <select className="select" aria-label="Tipo" value={f.tipo} onChange={(e) => setF({ tipo: e.target.value })}>
              <option value="">Tipo: todos</option>{EQ_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            {scope !== 'proprios' && (
              <select className="select" aria-label="Responsável" value={f.resp} onChange={(e) => setF({ resp: e.target.value })}>
                <option value="">Responsável: todos</option>{responsaveis.map((id) => <option key={id} value={id}>{userName(id)}</option>)}
              </select>
            )}
          </div>
          <div className="tools-row">
            <div className="seg-filter" role="group" aria-label="Situação">
              <button aria-pressed={!f.situacao} onClick={() => setF({ situacao: '' })}>Todas<span className="n">{pre.length}</span></button>
              {(Object.keys(EQ_STATUS) as EquipStatus[]).map((k) => (
                <button key={k} aria-pressed={f.situacao === k} onClick={() => setF({ situacao: f.situacao === k ? '' : k })}>{EQ_STATUS[k].label}<span className="n">{pre.filter((e) => e.status === k).length}</span></button>
              ))}
            </div>
            {chips.length > 0 && (
              <div className="active-filters">
                {chips.map((a) => <span className="chip" key={a.k}>{a.label}<button aria-label={`Remover filtro ${a.label}`} onClick={() => setF({ [a.k]: '' })}><X size={14} /></button></span>)}
              </div>
            )}
            {(chips.length > 0 || f.q || f.situacao) && <button className="btn btn-ghost btn-sm" onClick={clear}>Limpar filtros</button>}
          </div>
        </div>
        {state === 'loading' ? <SkeletonRows cols={6} /> : state === 'error' ? <ErrorState onRetry={retry} /> : isEmpty ? (
          <EmptyState title={scope === 'proprios' ? 'Nenhum equipamento sob sua responsabilidade' : 'Nenhum equipamento cadastrado'}
            text={scope === 'proprios' ? 'Quando a TI registrar uma entrega para você, o equipamento aparecerá aqui.' : 'Cadastre o primeiro equipamento para começar a controlar o patrimônio.'}
            action={can('inventario', 'cadastrar') && <Link className="btn btn-primary btn-sm" to="/inventario/equipamentos/novo"><Plus size={16} />Cadastrar equipamento</Link>} />
        ) : rows.length === 0 ? <NoResults onClear={clear} /> : (
          <>
            <div className="table-wrap responsive">
              <table className="tbl">
                <thead><tr>
                  <Th k="patrimonio">Patrimônio</Th><Th k="descricao">Equipamento</Th><Th k="responsavel">Responsável e local</Th>
                  <Th k="status">Situação</Th><Th k="mov" className="r">Movimentação</Th><th className="r"><span className="sr-only">Ações</span></th>
                </tr></thead>
                <tbody>
                  {rows.map((e) => {
                    const Ic = TYPE_ICON[e.tipo];
                    return (
                      <tr key={e.id} className={e.id === hl ? 'flash' : ''} onClick={() => nav(`/inventario/equipamentos/${e.id}`)}>
                        <td><div className="asset"><span className="asset-ic"><Ic size={17} /></span><span><Link to={`/inventario/equipamentos/${e.id}`} onClick={(ev) => ev.stopPropagation()} className="id-cell" style={{ textDecoration: 'none', display: 'block' }}>{e.patrimonio}</Link><span className="xs muted">{e.tipo}</span></span></div></td>
                        <td><div className="truncate" style={{ fontWeight: 500, maxWidth: 260 }} title={e.descricao}>{e.descricao}</div><div className="xs subtle mono">{e.serie}</div></td>
                        <td>
                          <span className="person">
                            {e.responsavelId ? <Avatar name={userName(e.responsavelId)} sm /> : <span className="avatar sm" style={{ background: 'var(--surface-sunken)', color: 'var(--text-subtle)' }}>—</span>}
                            <span style={{ minWidth: 0 }}>
                              <span className="truncate" style={{ display: 'block', maxWidth: 200, fontWeight: e.responsavelId ? 500 : 400, color: e.responsavelId ? undefined : 'var(--text-subtle)' }}>{e.responsavelId ? userName(e.responsavelId) : 'Em estoque'}</span>
                              <span className="truncate xs muted" style={{ display: 'block', maxWidth: 200 }} title={e.localizacao}>{e.localizacao}</span>
                            </span>
                          </span>
                        </td>
                        <td><div className="stack-sm" style={{ gap: 4, alignItems: 'flex-start' }}><Badge tone={EQ_STATUS[e.status].tone}>{EQ_STATUS[e.status].label}</Badge>{e.aceitePendente && <span className="xs" style={{ color: 'var(--info)', fontWeight: 600 }}>Entrega a confirmar</span>}</div></td>
                        <td className="num small r">{fmtDate(e.ultimaMov)}</td>
                        <td className="row-action" onClick={(ev) => ev.stopPropagation()}>
                          {canDeliver && e.status === 'disponivel'
                            ? <Link className="btn btn-secondary btn-xs always" to={`/inventario/equipamentos/${e.id}/entrega`}><PackageCheck size={14} />Entregar</Link>
                            : <Link className="btn btn-ghost btn-xs" to={`/inventario/equipamentos/${e.id}`} aria-label={`Abrir ${e.patrimonio}`}>Abrir<ChevronRight size={14} /></Link>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mobile-cards">
              {rows.map((e) => {
                const Ic = TYPE_ICON[e.tipo];
                return (
                  <Link key={e.id} to={`/inventario/equipamentos/${e.id}`} className={`m-card ${e.id === hl ? 'flash' : ''}`}>
                    <div className="asset"><span className="asset-ic"><Ic size={17} /></span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="row"><span className="strong tnum">{e.patrimonio}</span><span className="spacer" /><Badge tone={EQ_STATUS[e.status].tone}>{EQ_STATUS[e.status].label}</Badge></div>
                        <div className="small" style={{ marginTop: 2 }}>{e.descricao}</div>
                        <div className="xs muted">{e.responsavelId ? userName(e.responsavelId) : 'Em estoque'} · {e.localizacao}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <Pager page={page} pages={pages} total={sorted.length} label={sorted.length === 1 ? 'equipamento' : 'equipamentos'} onPage={(p) => setF({ page: String(p) })} />
          </>
        )}
      </div>
    </>
  );
}
