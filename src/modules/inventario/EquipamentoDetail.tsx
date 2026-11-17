import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, FileText, PackageCheck, UserCheck, Wrench } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { flash, useRecordVisit } from '@/platform/hooks';
import { fmtDate, fmtRelative, uid } from '@/platform/format';
import { Avatar, BackToList, Badge, Confirm, EmptyState, KV, Tabs } from '@/ui/core';
import { AttachmentList, Timeline } from '@/ui/records';
import { COMPANIES } from '@/ui/brand';
import { useToast } from '@/ui/toast';
import { NotFoundInline } from '@/pages/NotFound';
import { EQ_STATUS, TYPE_ICON } from './meta';
import type { Equipment } from '@/platform/types';

type Tab = 'geral' | 'mov' | 'man' | 'docs';

export default function EquipamentoDetail() {
  const { id } = useParams();
  const { data, company, can, sees, update, me, notify } = useDemo();
  const toast = useToast();
  const loc = useLocation();
  const e = data.equipments.find((x) => x.id === id && x.companyId === company);
  const [fl] = useState(() => flash.take(id) ?? (loc.state as { tab?: Tab; highlight?: string } | null) ?? undefined);
  const [tab, setTab] = useState<Tab>((fl?.tab as Tab) ?? 'geral');
  const [highlight, setHighlight] = useState(fl?.highlight);
  const [dlg, setDlg] = useState<null | 'conf' | 'aceite'>(null);
  useRecordVisit('inventario', e?.id, e ? `${e.patrimonio} · ${e.descricao}` : undefined, `/inventario/equipamentos/${id}`);

  if (!e || !sees('inventario', e.responsavelId)) return <NotFoundInline what="equipamento" back="/inventario/equipamentos" />;
  const events = data.events.filter((x) => x.recordId === e.id).sort((a, b) => b.ts.localeCompare(a.ts));
  const st = EQ_STATUS[e.status];
  const Ic = TYPE_ICON[e.tipo];
  const canDeliver = can('inventario', 'registrar_entrega');
  const isMine = e.responsavelId === me?.id;
  const resp = data.users.find((u) => u.id === e.responsavelId);

  const record = (action: string, fn: (x: Equipment) => void, msg: React.ReactNode) => {
    const evId = uid('ev');
    update((d) => {
      const x = d.equipments.find((y) => y.id === e.id)!;
      fn(x);
      d.events.push({ id: evId, ts: new Date().toISOString(), companyId: company, module: 'inventario', recordId: e.id, recordLabel: e.patrimonio, action, actorId: me!.id });
    });
    setHighlight(evId); setTab('mov'); toast(msg);
  };

  const primary = canDeliver && e.status === 'disponivel'
    ? <Link className="btn btn-primary" to={`/inventario/equipamentos/${e.id}/entrega`}><PackageCheck size={18} />Registrar entrega</Link>
    : canDeliver && e.status === 'conferencia'
      ? <button className="btn btn-primary" onClick={() => setDlg('conf')}><ClipboardCheck size={18} />Concluir conferência</button>
      : isMine && e.aceitePendente
        ? <button className="btn btn-primary" onClick={() => setDlg('aceite')}><UserCheck size={18} />Confirmar recebimento</button>
        : null;

  return (
    <>
      <nav className="crumbs" aria-label="Você está em">
        <Link to="/inventario/equipamentos">Inventário</Link><span aria-hidden>›</span><Link to="/inventario/equipamentos">Equipamentos</Link><span aria-hidden>›</span><span aria-current="page">{e.patrimonio}</span>
      </nav>

      {/* Identificação, situação e ação principal */}
      <section className="card" style={{ marginBottom: 20, overflow: 'hidden' }} aria-labelledby="eq-title">
        <div className="hero">
          <span className="hero-ic"><Ic size={30} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="hero-id">PATRIMÔNIO {e.patrimonio}</div>
            <h1 className="hero-title" id="eq-title">{e.descricao}</h1>
            <div className="row-wrap" style={{ gap: 10 }}>
              <Badge tone={st.tone}>{st.label}</Badge>
              {e.aceitePendente && <Badge tone="info">Entrega a confirmar</Badge>}
              <span className="small muted">{e.tipo} · {COMPANIES[e.companyId].name}</span>
            </div>
          </div>
          <div className="hero-actions row">
            <BackToList fallback="/inventario/equipamentos" />
            {primary}
          </div>
        </div>
        <dl className="facts" style={{ margin: 0 }}>
          <div className="fact"><dt>Responsável</dt><dd>{resp ? <span className="person"><Avatar name={resp.name} sm />{resp.name}</span> : <span className="muted">Em estoque</span>}</dd></div>
          <div className="fact"><dt>Localização</dt><dd title={e.localizacao}>{e.localizacao}</dd></div>
          <div className="fact"><dt>Número de série</dt><dd className="mono">{e.serie}</dd></div>
          <div className="fact"><dt>Última movimentação</dt><dd className="tnum">{fmtDate(e.ultimaMov)}</dd></div>
        </dl>
      </section>

      {isMine && e.aceitePendente && (
        <div className="banner banner-info" style={{ marginBottom: 20 }}>
          <UserCheck size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <span className="b-text">A TI registrou a entrega deste equipamento para você. Confira o item e confirme o recebimento para aceitar o termo de responsabilidade.</span>
        </div>
      )}
      {e.status === 'manutencao' && (
        <div className="banner banner-warn" style={{ marginBottom: 20 }}>
          <Wrench size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <span className="b-text">Em assistência técnica{e.maintenance?.length ? ` (${e.maintenance[e.maintenance.length - 1].fornecedor}, previsão ${fmtDate(e.maintenance[e.maintenance.length - 1].previsao)})` : ''}. A entrega fica disponível quando retornar.</span>
        </div>
      )}

      <div className="layout-detail">
        <div className="card">
          <Tabs<Tab> value={tab} onChange={setTab} tabs={[
            { id: 'geral', label: 'Visão geral' },
            { id: 'mov', label: 'Movimentações', count: events.length },
            { id: 'man', label: 'Manutenções', count: e.maintenance?.length ?? 0 },
            { id: 'docs', label: 'Documentos', count: e.docs.length },
          ]} />
          <div className="card-body">
            {tab === 'geral' && (
              <>
                <div className="kv-group"><h4>Uso atual</h4>
                  <KV items={[['Responsável', resp?.name ?? 'Em estoque'], ['Setor', resp?.sector ?? '—'], ['Localização', e.localizacao], ['Situação', st.label]]} />
                </div>
                <div className="kv-group"><h4>Dados técnicos</h4>
                  <KV items={[['Tipo', e.tipo], ['Marca e modelo', e.marcaModelo], ['Número de série', <span className="mono">{e.serie}</span>]]} />
                </div>
                <div className="kv-group"><h4>Patrimônio</h4>
                  <KV items={[['Patrimônio', <span className="tnum strong">{e.patrimonio}</span>], ['Aquisição', fmtDate(e.aquisicao)], ['Ambiente', COMPANIES[e.companyId].name]]} />
                </div>
              </>
            )}
            {tab === 'mov' && <Timeline events={events} highlightId={highlight} />}
            {tab === 'man' && (e.maintenance?.length ? (
              <div className="stack-sm">
                {e.maintenance.map((m, i) => (
                  <div key={i} className="att">
                    <span className="att-icon" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}><Wrench size={18} /></span>
                    <div style={{ flex: 1 }}><div className="strong">{m.motivo}</div><div className="xs muted">{m.fornecedor} · desde {fmtDate(m.inicio)} · previsão {fmtDate(m.previsao)}</div></div>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={<Wrench size={22} />} title="Sem manutenções registradas" text="Envios para assistência técnica aparecerão aqui." />)}
            {tab === 'docs' && <AttachmentList ids={e.docs} empty="O termo de responsabilidade é gerado ao registrar uma entrega." />}
          </div>
        </div>
        <aside className="stack">
          <div className="card card-pad">
            <div className="label" style={{ marginBottom: 8 }}>Próximo passo</div>
            <p className="small muted">{e.aceitePendente ? `Aguardando ${resp?.name.split(' ')[0]} confirmar o recebimento.` : st.next}</p>
            {primary && <div style={{ marginTop: 14 }}>{primary}</div>}
          </div>
          <div className="card">
            <div className="card-head"><h3>Histórico recente</h3><button className="btn btn-ghost btn-xs" style={{ marginLeft: 'auto' }} onClick={() => setTab('mov')}>Ver tudo<ArrowRight size={13} /></button></div>
            <div className="card-body" style={{ paddingTop: 16 }}>
              {events.length ? <Timeline events={events.slice(0, 3)} highlightId={highlight} /> : <p className="small muted">Sem movimentações.</p>}
            </div>
          </div>
          {e.docs.length > 0 && (
            <div className="card">
              <div className="card-head"><h3>Documentos</h3><button className="btn btn-ghost btn-xs" style={{ marginLeft: 'auto' }} onClick={() => setTab('docs')}><FileText size={13} />{e.docs.length}</button></div>
              <div className="card-body" style={{ paddingTop: 14 }}><AttachmentList ids={e.docs.slice(0, 1)} /></div>
            </div>
          )}
          <p className="xs muted" style={{ padding: '0 6px' }}>Atualizado {fmtRelative(e.ultimaMov)} · registros preservados com histórico completo.</p>
        </aside>
      </div>

      <Confirm open={dlg === 'conf'} onClose={() => setDlg(null)} title={`Concluir conferência de ${e.patrimonio}?`} confirmLabel="Concluir conferência"
        desc="O equipamento passa para Disponível na Sala de TI e pode ser entregue."
        onConfirm={() => record('Conferência concluída — itens e número de série conferidos', (x) => { x.status = 'disponivel'; x.localizacao = 'Sala de TI'; x.ultimaMov = new Date().toISOString(); }, <><b>{e.patrimonio}</b> conferido e disponível para entrega.</>)} />
      <Confirm open={dlg === 'aceite'} onClose={() => setDlg(null)} title="Confirmar recebimento?" confirmLabel="Confirmar recebimento"
        desc={`Você declara ter recebido ${e.patrimonio} · ${e.descricao} em perfeito estado e aceita o termo de responsabilidade.`}
        onConfirm={() => {
          record(`Recebimento confirmado por ${me!.name} — termo de responsabilidade aceito`, (x) => { x.aceitePendente = false; }, <>Recebimento de <b>{e.patrimonio}</b> confirmado. Obrigado!</>);
          notify({ userId: 'u5', module: 'inventario', title: 'Recebimento confirmado', subject: `${e.patrimonio} · ${me!.name}`, link: `/inventario/equipamentos/${e.id}` });
        }} />
    </>
  );
}
