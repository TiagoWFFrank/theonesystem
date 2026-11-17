import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BedDouble, CheckCircle2, CircleAlert, Plane, PlaneLanding, PlaneTakeoff } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { flash, useRecordVisit } from '@/platform/hooks';
import { fmtDate, fmtDateTime, fmtMoney, fmtTime } from '@/platform/format';
import { Avatar, BackToList, Badge, Tabs } from '@/ui/core';
import { AttachmentList, Timeline } from '@/ui/records';
import { NotFoundInline } from '@/pages/NotFound';
import { VG_STATUS, docsChecklist } from './meta';

type Tab = 'trechos' | 'docs' | 'historico';

export default function ViagemDetail() {
  const { id } = useParams();
  const { data, company, sees, userName } = useDemo();
  const v = data.viagens.find((x) => x.id === id && x.companyId === company);
  const [fl] = useState(() => flash.take(id));
  const [tab, setTab] = useState<Tab>((fl?.tab as Tab) ?? 'trechos');
  useRecordVisit('viagens', v?.id, v ? `${v.codigo} · ${v.destino}` : undefined, `/viagens/${id}`);
  if (!v || !sees('viagens', v.viajanteId)) return <NotFoundInline what="viagem" back="/viagens/minhas" />;
  const d = docsChecklist(v);
  const events = data.events.filter((e) => e.recordId === v.id);
  const total = v.trechos.reduce((s, t) => s + (t.valor ?? 0), 0);

  return (
    <>
      <nav className="crumbs" aria-label="Você está em"><Link to="/viagens/minhas">Viagens</Link><span aria-hidden>›</span><span aria-current="page">{v.codigo}</span></nav>
      <section className="card" style={{ marginBottom: 20, overflow: 'hidden' }} aria-labelledby="vg-title">
        <div className="hero">
          <span className="hero-ic"><Plane size={30} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="hero-id">{v.codigo}</div>
            <h1 className="hero-title" id="vg-title">{v.destino}</h1>
            <div className="row-wrap" style={{ gap: 10 }}>
              <Badge tone={VG_STATUS[v.status].tone}>{VG_STATUS[v.status].label}</Badge>
              {v.compraExterna && <Badge tone="accent" plain>Compra por exceção</Badge>}
              <span className="small muted">{v.motivo}</span>
            </div>
          </div>
          <div className="hero-actions row"><BackToList fallback="/viagens/minhas" />{v.docs.length > 0 && <button className="btn btn-primary" onClick={() => setTab('docs')}>Abrir passagem</button>}</div>
        </div>
        <dl className="facts" style={{ margin: 0 }}>
          <div className="fact"><dt>Viajante</dt><dd><span className="person"><Avatar name={userName(v.viajanteId)} sm />{userName(v.viajanteId)}</span></dd></div>
          <div className="fact"><dt>Ida</dt><dd className="tnum">{fmtDate(v.inicio)}</dd></div>
          <div className="fact"><dt>Volta</dt><dd className="tnum">{fmtDate(v.fim)}</dd></div>
          <div className="fact"><dt>Documentação</dt><dd style={{ color: d.complete ? 'var(--ok)' : 'var(--warn)' }}>{d.complete ? 'Completa' : 'Pendente'}</dd></div>
        </dl>
      </section>
      {v.compraExterna && (
        <div className="banner banner-info" style={{ marginBottom: 20 }}>
          <span className="b-text">Passagem comprada fora do fluxo padrão e registrada por <b>{userName(v.compraExterna.por)}</b> (Compras) em {fmtDateTime(v.compraExterna.em)}.</span>
        </div>
      )}
      <div className="layout-detail">
        <div className="card">
          <Tabs<Tab> value={tab} onChange={setTab} tabs={[
            { id: 'trechos', label: 'Trechos e hospedagem' }, { id: 'docs', label: 'Documentos', count: v.docs.length }, { id: 'historico', label: 'Histórico', count: events.length },
          ]} />
          <div className="card-body">
            {tab === 'trechos' && (
              <div className="stack">
                <div>
                  {v.trechos.map((t) => (
                    <div className="leg" key={t.tipo}>
                      <div>
                        <div className="xs muted strong" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.tipo === 'ida' ? <><PlaneTakeoff size={13} /> Ida</> : <><PlaneLanding size={13} /> Volta</>}</div>
                        <div className="city tnum">{t.origem}</div>
                        <div className="xs muted">{fmtDate(t.data)} · {t.localizador ? fmtTime(t.data) : 'horário a definir'}</div>
                      </div>
                      <div style={{ textAlign: 'center' }} className="muted">
                        <Plane size={18} />
                        <div className="xs">{t.cia} {t.voo !== '—' ? t.voo : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="xs muted strong">{t.localizador ? <>Loc. <span className="mono">{t.localizador}</span></> : 'Aguardando emissão'}</div>
                        <div className="city tnum">{t.destino}</div>
                        <div className="xs muted tnum">{fmtMoney(t.valor)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {v.hospedagem ? (
                  <div className="att">
                    <span className="att-icon" style={{ background: 'var(--accent-soft)', color: 'var(--on-accent-soft)' }}><BedDouble size={18} /></span>
                    <div style={{ flex: 1 }}>
                      <div className="strong">{v.hospedagem.hotel}</div>
                      <div className="xs muted">Check-in {fmtDateTime(v.hospedagem.checkin)} · Check-out {fmtDateTime(v.hospedagem.checkout)}</div>
                    </div>
                    <Badge tone={v.hospedagem.confirmado ? 'ok' : 'warn'}>{v.hospedagem.confirmado ? 'Confirmada' : 'Pendente'}</Badge>
                  </div>
                ) : <p className="small muted">Viagem sem hospedagem.</p>}
              </div>
            )}
            {tab === 'docs' && <AttachmentList ids={v.docs} empty="Bilhetes e vouchers aparecem aqui assim que forem emitidos." />}
            {tab === 'historico' && <Timeline events={events} highlightId={fl?.highlight} />}
          </div>
        </div>
        <aside className="stack">
          <div className="card card-pad">
            <div className="row" style={{ marginBottom: 12, color: d.complete ? 'var(--ok)' : 'var(--warn)', fontWeight: 600 }}>
              {d.complete ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}{d.complete ? 'Documentação completa' : 'Documentação pendente'}
            </div>
            <ul className="checklist">
              {d.items.map((i) => (
                <li key={i.label}>{i.ok ? <CheckCircle2 size={16} className="ok-ic" /> : <CircleAlert size={16} className="warn-ic" />}<span className={i.ok ? '' : 'strong'}>{i.label}</span></li>
              ))}
            </ul>
            <p className="xs muted" style={{ marginTop: 12 }}>A documentação fica completa quando ida, volta e hospedagem (se houver) estão emitidas e confirmadas.</p>
          </div>
          <div className="card card-pad">
            <div className="label" style={{ marginBottom: 12 }}>Viajante</div>
            <div className="row" style={{ gap: 12 }}><Avatar name={userName(v.viajanteId)} /><div><div className="strong">{userName(v.viajanteId)}</div><div className="xs muted">{data.users.find((u) => u.id === v.viajanteId)?.sector}</div></div></div>
            {total > 0 && <p className="small" style={{ marginTop: 14 }}>Total das passagens: <b className="tnum">{fmtMoney(total)}</b></p>}
          </div>
        </aside>
      </div>
    </>
  );
}
