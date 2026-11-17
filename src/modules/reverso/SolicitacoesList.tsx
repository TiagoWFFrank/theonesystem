import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronRight, Plus, Search, X } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { useSort, useUrlState } from '@/platform/hooks';
import { fmtDate } from '@/platform/format';
import { Badge, EmptyState, ErrorState, NoResults, PageHeader, Pager, SkeletonRows, useSimLoad } from '@/ui/core';
import { COMPANIES } from '@/ui/brand';
import { ExportButton } from '@/ui/export';
import { MOTIVOS, RV_STATUS } from './meta';
import type { Reverso, ReversoStatus } from '@/platform/types';

const PER_PAGE = 8;

export default function SolicitacoesList() {
  const { data, company, can, sees, userName, me, grant } = useDemo();
  const nav = useNavigate();
  const { state, retry } = useSimLoad();
  const [f, setF] = useUrlState({ q: '', situacao: '', motivo: '', fila: '', sort: 'criado', dir: 'desc', page: '1' });
  const scope = grant('reverso')?.scope;

  const base = useMemo(() => data.reversos.filter((r) => r.companyId === company && sees('reverso', r.solicitanteId)), [data.reversos, company, sees]);
  const pre = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return base.filter((r) =>
      (!q || [r.numero, r.clienteNome, r.clienteCodigo, userName(r.solicitanteId)].join(' ').toLowerCase().includes(q)) &&
      (!f.motivo || r.motivo === f.motivo) &&
      (f.fila !== 'aprovacao' || (r.status === 'aguardando_aprovacao' && r.aprovadorId === me?.id)) &&
      (f.fila !== 'expedicao' || r.status === 'aguardando_expedicao'));
  }, [base, f, userName, me]);
  const filtered = useMemo(() => pre.filter((r) => !f.situacao || r.status === f.situacao), [pre, f.situacao]);
  const sorted = useSort<Reverso>(filtered, f.sort, f.dir, {
    numero: (r) => r.numero, criado: (r) => r.criadoEm, status: (r) => RV_STATUS[r.status].label, solicitante: (r) => userName(r.solicitanteId),
  });
  const page = Number(f.page) || 1;
  const rows = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const clear = () => setF({ q: '', situacao: '', motivo: '', fila: '' });
  const chips = [
    f.fila === 'aprovacao' && { k: 'fila', label: 'Aguardando minha decisão' },
    f.fila === 'expedicao' && { k: 'fila', label: 'Fila da expedição' },
    f.q && { k: 'q', label: `Busca: “${f.q}”` },
    f.situacao && { k: 'situacao', label: RV_STATUS[f.situacao as ReversoStatus]?.label },
    f.motivo && { k: 'motivo', label: f.motivo },
  ].filter(Boolean) as { k: string; label: string }[];

  const Th = ({ k, children }: { k: string; children: string }) => (
    <th aria-sort={f.sort === k ? (f.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => setF({ sort: k, dir: f.sort === k && f.dir === 'asc' ? 'desc' : 'asc' })}>
        {children}{f.sort === k && (f.dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
      </button>
    </th>
  );

  return (
    <>
      <PageHeader crumbs={[{ label: 'Reverso', to: '/reverso/solicitacoes' }, { label: 'Solicitações' }]}
        title={scope === 'proprios' ? 'Minhas solicitações' : 'Solicitações de reverso'}
        sub="Logística reversa de mercadorias: abertura, aprovação, etiqueta e rastreio."
        actions={<>
          <ExportButton module="reverso" rows={sorted} name={`reversos-${company}`} filtros={[f.situacao ? RV_STATUS[f.situacao as ReversoStatus]?.label : 'Todas as situações', f.motivo, f.q && `busca “${f.q}”`].filter(Boolean).join(' · ')} />
          {can('reverso', 'abrir') && <Link to="/reverso/solicitacoes/nova" className="btn btn-primary"><Plus size={18} />Abrir solicitação</Link>}
        </>} />
      <div className="card">
        <div className="list-tools">
          <div className="tools-row">
            <div className="input-icon"><Search size={17} />
              <input className="input" placeholder="Número, cliente ou solicitante" aria-label="Buscar solicitações" value={f.q} onChange={(e) => setF({ q: e.target.value })} />
            </div>
            <select className="select" aria-label="Motivo" value={f.motivo} onChange={(e) => setF({ motivo: e.target.value })}>
              <option value="">Motivo: todos</option>
              {MOTIVOS.map((m) => <option key={m}>{m}</option>)}
            </select>
            {can('reverso', 'aprovar') && (
              <button className={`btn btn-sm ${f.fila === 'aprovacao' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={f.fila === 'aprovacao'} onClick={() => setF({ fila: f.fila === 'aprovacao' ? '' : 'aprovacao' })}>Aguardando minha decisão</button>
            )}
            {can('reverso', 'expedir') && (
              <button className={`btn btn-sm ${f.fila === 'expedicao' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={f.fila === 'expedicao'} onClick={() => setF({ fila: f.fila === 'expedicao' ? '' : 'expedicao' })}>Fila da expedição</button>
            )}
          </div>
          <div className="tools-row">
            <div className="seg-filter" role="group" aria-label="Situação">
              <button aria-pressed={!f.situacao} onClick={() => setF({ situacao: '' })}>Todas<span className="n">{pre.length}</span></button>
              {(Object.keys(RV_STATUS) as ReversoStatus[]).map((k) => <button key={k} aria-pressed={f.situacao === k} onClick={() => setF({ situacao: f.situacao === k ? '' : k })}>{RV_STATUS[k].label}<span className="n">{pre.filter((r) => r.status === k).length}</span></button>)}
            </div>
            {chips.filter((c) => c.k !== 'situacao').length > 0 && (
              <div className="active-filters">
                {chips.filter((c) => c.k !== 'situacao').map((a) => <span className="chip" key={a.k + a.label}>{a.label}<button aria-label={`Remover filtro ${a.label}`} onClick={() => setF({ [a.k]: '' })}><X size={14} /></button></span>)}
              </div>
            )}
            {chips.length > 0 && <button className="btn btn-ghost btn-sm" onClick={clear}>Limpar filtros</button>}
          </div>
        </div>
        {state === 'loading' ? <SkeletonRows cols={6} /> : state === 'error' ? <ErrorState onRetry={retry} /> : state === 'empty' || base.length === 0 ? (
          <EmptyState title="Nenhuma solicitação por aqui" text="Abra uma solicitação para iniciar a devolução de uma mercadoria."
            action={can('reverso', 'abrir') && <Link to="/reverso/solicitacoes/nova" className="btn btn-primary btn-sm"><Plus size={16} />Abrir solicitação</Link>} />
        ) : rows.length === 0 ? <NoResults onClear={clear} /> : (
          <>
            <div className="table-wrap responsive">
              <table className="tbl">
                <thead><tr><Th k="numero">Número</Th><th>Motivo</th><Th k="solicitante">Solicitante</Th><th>Cliente</th><Th k="status">Situação</Th><Th k="criado">Abertura</Th><th>Ambiente</th><th /></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} onClick={() => nav(`/reverso/solicitacoes/${r.id}`)}>
                      <td className="id-cell"><Link to={`/reverso/solicitacoes/${r.id}`} onClick={(e) => e.stopPropagation()} style={{ textDecoration: 'none' }}>{r.numero}</Link></td>
                      <td>{r.motivo}</td>
                      <td className="small">{userName(r.solicitanteId)}</td>
                      <td><div className="truncate" style={{ maxWidth: 220 }} title={r.clienteNome}>{r.clienteNome}</div><div className="xs muted tnum">{r.clienteCodigo}</div></td>
                      <td><Badge tone={RV_STATUS[r.status].tone}>{RV_STATUS[r.status].label}</Badge></td>
                      <td className="num small">{fmtDate(r.criadoEm)}</td>
                      <td className="small muted">{COMPANIES[r.companyId].name}</td>
                      <td className="row-action"><ChevronRight size={18} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-cards">
              {rows.map((r) => (
                <Link key={r.id} to={`/reverso/solicitacoes/${r.id}`} className="m-card">
                  <div className="row"><span className="strong tnum">{r.numero}</span><span className="spacer" /><Badge tone={RV_STATUS[r.status].tone}>{RV_STATUS[r.status].label}</Badge></div>
                  <div style={{ marginTop: 4 }}>{r.motivo} · {r.clienteNome}</div>
                  <div className="xs muted">{userName(r.solicitanteId)} · {fmtDate(r.criadoEm)}</div>
                </Link>
              ))}
            </div>
            <Pager page={page} pages={Math.ceil(sorted.length / PER_PAGE)} total={sorted.length} label={sorted.length === 1 ? 'solicitação' : 'solicitações'} onPage={(p) => setF({ page: String(p) })} />
          </>
        )}
      </div>
    </>
  );
}
