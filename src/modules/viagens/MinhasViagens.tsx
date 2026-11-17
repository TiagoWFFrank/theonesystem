import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronRight, CircleAlert, Plane, Plus, Search } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { useUrlState } from '@/platform/hooks';
import { fmtDateShort } from '@/platform/format';
import { Badge, EmptyState, ErrorState, NoResults, PageHeader, SkeletonRows, useSimLoad } from '@/ui/core';
import { VG_STATUS, docsChecklist } from './meta';
import type { ViagemStatus } from '@/platform/types';


export default function MinhasViagens() {
  const { data, company, me, can, grant, sees, userName } = useDemo();
  const nav = useNavigate();
  const { state, retry } = useSimLoad();
  const scope = grant('viagens')?.scope;
  const broad = scope !== 'proprios';
  const [f, setF] = useUrlState({ ver: broad ? 'todas' : 'minhas', q: '', situacao: '', excecao: '' });
  const showAll = broad && f.ver === 'todas';

  const base = useMemo(() => data.viagens.filter((v) => v.companyId === company && (showAll ? sees('viagens', v.viajanteId) : v.viajanteId === me?.id)),
    [data.viagens, company, showAll, sees, me]);
  const pre = useMemo(() => {
    const q = f.q.toLowerCase();
    return base.filter((v) => (!q || [v.codigo, v.destino, userName(v.viajanteId), v.motivo].join(' ').toLowerCase().includes(q)) && (!f.excecao || !!v.compraExterna));
  }, [base, f.q, f.excecao, userName]);
  const rows = useMemo(() => pre.filter((v) => !f.situacao || v.status === f.situacao).sort((a, b) => a.inicio.localeCompare(b.inicio)), [pre, f.situacao]);
  const companyTrips = data.viagens.filter((v) => v.companyId === company);
  const kpis = can('viagens', 'registrar_compra') ? [
    { k: 'Aguardando emissão', n: companyTrips.filter((v) => v.status === 'aguardando_emissao').length, to: '?ver=todas&situacao=aguardando_emissao' },
    { k: 'Emitidas', n: companyTrips.filter((v) => v.status === 'emitida').length, to: '?ver=todas&situacao=emitida' },
    { k: 'Compras por exceção', n: companyTrips.filter((v) => v.compraExterna).length, to: '?ver=todas&excecao=1' },
  ] : null;
  const clear = () => setF({ q: '', situacao: '', excecao: '' });

  return (
    <>
      <PageHeader crumbs={[{ label: 'Viagens', to: '/viagens/minhas' }, { label: showAll ? 'Viagens do ambiente' : 'Minhas viagens' }]}
        title={showAll ? (scope === 'equipe' ? 'Viagens da equipe' : 'Viagens do ambiente') : 'Minhas viagens'}
        sub="Destino, período, situação e disponibilidade dos documentos."
        actions={can('viagens', 'registrar_compra') && <Link className="btn btn-primary" to="/viagens/compras/nova"><Plus size={18} />Registrar compra externa</Link>} />
      {kpis && (
        <div className="grid-3" style={{ marginBottom: 16 }}>
          {kpis.map((k) => (
            <Link key={k.k} to={k.to} className="card stat" style={{ textDecoration: 'none' }}>
              <div className="v">{k.n}</div><div className="k">{k.k}</div>
            </Link>
          ))}
        </div>
      )}
      <div className="card">
        <div className="list-tools">
          <div className="tools-row">
            {broad && (
              <div className="seg" style={{ width: 'auto' }} role="group" aria-label="Visão">
                <button aria-pressed={!showAll} onClick={() => setF({ ver: 'minhas' })}>Minhas</button>
                <button aria-pressed={showAll} onClick={() => setF({ ver: 'todas' })}>{scope === 'equipe' ? 'Equipe' : 'Ambiente'}</button>
              </div>
            )}
            <div className="input-icon"><Search size={17} /><input className="input" aria-label="Buscar viagens" placeholder="Código, destino ou viajante" value={f.q} onChange={(e) => setF({ q: e.target.value })} /></div>
          </div>
          <div className="tools-row">
            <div className="seg-filter" role="group" aria-label="Situação">
              <button aria-pressed={!f.situacao} onClick={() => setF({ situacao: '' })}>Todas<span className="n">{pre.length}</span></button>
              {(Object.keys(VG_STATUS) as ViagemStatus[]).map((k) => <button key={k} aria-pressed={f.situacao === k} onClick={() => setF({ situacao: f.situacao === k ? '' : k })}>{VG_STATUS[k].label}<span className="n">{pre.filter((v) => v.status === k).length}</span></button>)}
            </div>
            {f.excecao && <span className="chip">Compras por exceção<button aria-label="Remover filtro" onClick={() => setF({ excecao: '' })}>×</button></span>}
          </div>
        </div>
        {state === 'loading' ? <SkeletonRows cols={5} rows={4} /> : state === 'error' ? <ErrorState onRetry={retry} /> : state === 'empty' || base.length === 0 ? (
          <EmptyState icon={<Plane size={22} />} title="Nenhuma viagem programada" text="Quando uma viagem for registrada para você, ela aparecerá aqui com os documentos." />
        ) : rows.length === 0 ? <NoResults onClear={clear} /> : (
          <div className="card-body stack-sm">
            {rows.map((v) => {
              const d = docsChecklist(v);
              return (
                <div key={v.id} className="att" style={{ cursor: 'pointer', flexWrap: 'wrap' }} onClick={() => nav(`/viagens/${v.id}`)}>
                  <span className="att-icon" style={{ background: 'var(--accent-soft)', color: 'var(--on-accent-soft)' }}><Plane size={18} /></span>
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <Link to={`/viagens/${v.id}`} className="strong" style={{ textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>{v.destino}</Link>
                    <div className="xs muted"><span className="tnum">{v.codigo}</span> · {fmtDateShort(v.inicio)} – {fmtDateShort(v.fim)}{showAll ? ` · ${userName(v.viajanteId)}` : ''}</div>
                  </div>
                  <div className="row-wrap">
                    {v.compraExterna && <Badge tone="accent" plain>Compra por exceção</Badge>}
                    <Badge tone={VG_STATUS[v.status].tone}>{VG_STATUS[v.status].label}</Badge>
                    <span className="row small" style={{ gap: 6, color: d.complete ? 'var(--ok)' : 'var(--warn)', fontWeight: 600 }}>
                      {d.complete ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}{d.complete ? 'Documentos completos' : 'Documentos pendentes'}
                    </span>
                    <ChevronRight size={18} className="muted" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

