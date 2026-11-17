import { useState } from 'react';
import { CalendarDays, DoorOpen, Users } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { uid } from '@/platform/format';
import { Dialog, EmptyState, Field, PageHeader } from '@/ui/core';
import { useToast } from '@/ui/toast';
import type { ModuleManifest, Reserva } from '@/platform/types';

const HOURS = Array.from({ length: 10 }, (_, i) => 8 + i);
const dayKey = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
const dayLabel = (offset: number) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return offset === 0 ? 'Hoje' : offset === 1 ? 'Amanhã' : d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }).replace('.', '');
};

function ReservasPage() {
  const { data, company, me, can, update, userName } = useDemo();
  const toast = useToast();
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState<{ salaId: string; hora: number } | null>(null);
  const [cancel, setCancel] = useState<Reserva | null>(null);
  const [titulo, setTitulo] = useState('');
  const [err, setErr] = useState('');
  const salas = data.salas.filter((s) => s.companyId === company);
  const date = dayKey(day);
  const canBook = can('reservas', 'reservar');

  const confirm = () => {
    if (titulo.trim().length < 3) { setErr('Informe um assunto para a reserva.'); return; }
    update((d) => { d.reservas.push({ id: uid('rs'), salaId: slot!.salaId, data: date, hora: slot!.hora, userId: me!.id, titulo: titulo.trim() }); });
    toast(<>Sala <b>{salas.find((s) => s.id === slot!.salaId)?.nome}</b> reservada às {slot!.hora}h.</>);
    setSlot(null); setTitulo(''); setErr('');
  };

  return (
    <>
      <PageHeader crumbs={[{ label: 'Reservas de salas' }]} title="Reservas de salas" sub="Plugin de demonstração instalado pelo catálogo · salas e horários fictícios." />
      {salas.length === 0 ? <div className="card"><EmptyState icon={<DoorOpen size={22} />} title="Nenhuma sala cadastrada neste ambiente" /></div> : (
        <div className="card">
          <div className="toolbar">
            <CalendarDays size={18} className="muted" />
            <div className="seg" style={{ width: 'auto', overflowX: 'auto' }} role="group" aria-label="Dia">
              {[0, 1, 2, 3, 4].map((o) => <button key={o} aria-pressed={day === o} onClick={() => setDay(o)}>{dayLabel(o)}</button>)}
            </div>
          </div>
          <div className="card-body" style={{ overflowX: 'auto' }}>
            <div className="slot-grid" style={{ gridTemplateColumns: `56px repeat(${salas.length}, minmax(150px, 1fr))`, minWidth: 56 + salas.length * 150 }}>
              <div />
              {salas.map((s) => (
                <div key={s.id} style={{ paddingBottom: 8 }}>
                  <div className="strong">{s.nome}</div>
                  <div className="xs muted row" style={{ gap: 4 }}><Users size={12} />{s.capacidade} · {s.recursos}</div>
                </div>
              ))}
              {HOURS.map((h) => (
                <div key={h} style={{ display: 'contents' }}>
                  <div className="xs muted tnum" style={{ paddingTop: 12 }}>{String(h).padStart(2, '0')}:00</div>
                  {salas.map((s) => {
                    const r = data.reservas.find((x) => x.salaId === s.id && x.data === date && x.hora === h && !x.cancelada);
                    if (r) {
                      const mine = r.userId === me?.id;
                      return (
                        <button key={s.id} className={`slot busy ${mine ? 'mine' : ''}`} style={{ cursor: mine ? 'pointer' : 'default' }}
                          title={`${r.titulo} · ${userName(r.userId)}`} onClick={() => mine && setCancel(r)} aria-label={`${s.nome} ${h}h: ${r.titulo}, ${userName(r.userId)}`}>
                          {r.titulo} · {userName(r.userId).split(' ')[0]}
                        </button>
                      );
                    }
                    return (
                      <button key={s.id} className="slot" disabled={!canBook} onClick={() => setSlot({ salaId: s.id, hora: h })} aria-label={`Reservar ${s.nome} às ${h}h`}>
                        Livre
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <Dialog open={!!slot} onClose={() => setSlot(null)} title="Reservar sala"
        desc={slot ? `${salas.find((s) => s.id === slot.salaId)?.nome} · ${dayLabel(day)} · ${slot.hora}:00 às ${slot.hora + 1}:00` : ''}
        footer={<><button className="btn btn-secondary" onClick={() => setSlot(null)}>Cancelar</button><button className="btn btn-primary" onClick={confirm}>Reservar sala</button></>}>
        <Field label="Assunto" required error={err} htmlFor="assunto"><input id="assunto" className="input" value={titulo} onChange={(e) => { setTitulo(e.target.value); setErr(''); }} /></Field>
      </Dialog>
      <Dialog open={!!cancel} onClose={() => setCancel(null)} title="Cancelar reserva?" desc={cancel?.titulo}
        footer={<><button className="btn btn-secondary" onClick={() => setCancel(null)}>Manter</button><button className="btn btn-danger" onClick={() => { update((d) => { d.reservas.find((x) => x.id === cancel!.id)!.cancelada = true; }); toast('Reserva cancelada. O registro fica preservado no histórico.'); setCancel(null); }}>Cancelar reserva</button></>} />
    </>
  );
}

export const reservas: ModuleManifest = {
  id: 'reservas',
  name: 'Reservas de salas',
  description: 'Agenda das salas de reunião com reserva por horário.',
  icon: DoorOpen,
  basePath: '/reservas',
  version: '0.9.0',
  menu: [{ label: 'Agenda das salas', path: '/reservas' }],
  actions: [
    { id: 'ver', label: 'Consultar agenda' },
    { id: 'reservar', label: 'Reservar sala' },
  ],
  requirements: ['Identidade central da plataforma'],
  business: true,
  contributes: { recordPath: () => '/reservas' },
  routes: [{ path: '/reservas', element: ReservasPage }],
};
