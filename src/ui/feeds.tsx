// Áreas compactas do painel: notificações (sincronizadas com o sino) e mensagens do Teams.
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Bell, CheckCheck, MessagesSquare } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { fmtDateTime, fmtRelative, fmtTime } from '@/platform/format';
import { notificationsFor, teamsFor, unreadElsewhere, reachLabel } from '@/platform/sources';
import { integration, teamsLink } from '@/platform/integrations';
import type { Notification, TeamsMessage } from '@/platform/types';
import { Avatar, Drawer, EmptyState } from './core';
import { COMPANIES } from './brand';
import { ORIGINS } from './origin';
import { SourceNotice, SyncStamp } from './source';

export function useNotifications() {
  const { data, me, company, markRead } = useDemo();
  const list = notificationsFor(data, me, company);
  return { list, unread: list.filter((n) => !n.read).length, elsewhere: unreadElsewhere(data, me, company), markRead };
}

export function NotificationRows({ items, onPick }: { items: Notification[]; onPick: (n: Notification) => void }) {
  return (
    <div className="nlist">
      {items.map((n) => {
        const O = ORIGINS[n.module];
        return (
          <button key={n.id} className={`nrow ${n.read ? '' : 'unread'}`} onClick={() => onPick(n)} aria-label={`${n.read ? '' : 'Não lida: '}${n.title}. ${n.subject}`}>
            <span className="mod-icon" style={{ width: 34, height: 34, borderRadius: 10 }}><O.icon size={15} /></span>
            <span style={{ minWidth: 0 }}><span className="who" style={{ display: 'block' }}>{n.title}</span><span className="txt" style={{ display: 'block' }}>{n.subject}</span></span>
            <span className="stack-sm" style={{ alignItems: 'flex-end', gap: 4 }}><span className="xs muted tnum">{fmtRelative(n.ts)}</span>{!n.read && <span className="udot" aria-hidden />}</span>
          </button>
        );
      })}
    </div>
  );
}

export function NotificationsCard() {
  const { list, unread, elsewhere, markRead } = useNotifications();
  const nav = useNavigate();
  const pick = (n: Notification) => { if (!n.read) markRead([n.id]); nav(n.link); };
  return (
    <section className="card" aria-labelledby="nt-h">
      <div className="card-head"><Bell size={17} /><h2 id="nt-h">Notificações</h2>{unread > 0 && <span className="badge badge-accent plain tnum">{unread} não lidas</span>}
        {unread > 0 && <button className="btn btn-ghost btn-xs" style={{ marginLeft: 'auto' }} onClick={() => markRead(list.filter((n) => !n.read).map((n) => n.id))}><CheckCheck size={14} />Marcar lidas</button>}
      </div>
      {list.length === 0 ? <p className="small muted" style={{ padding: 20 }}>Nenhuma notificação neste ambiente.</p> : <NotificationRows items={list.slice(0, 5)} onPick={pick} />}
      {elsewhere > 0 && <p className="xs muted" style={{ padding: '10px 18px', borderTop: '1px solid var(--border)' }}>+{elsewhere} não {elsewhere === 1 ? 'lida' : 'lidas'} em outros ambientes</p>}
    </section>
  );
}

export function TeamsCard() {
  const { data, company, me, update, down } = useDemo();
  const [open, setOpen] = useState<TeamsMessage | null>(null);
  const msgs = teamsFor(data, company, me);
  const unread = msgs.filter((m) => !m.lida).length;
  const openMsg = (m: TeamsMessage) => { setOpen(m); if (!m.lida && !down('teams')) update((d) => { d.teams.find((x) => x.id === m.id)!.lida = true; }); };
  const link = open ? open.url ?? teamsLink(open.conversa.nome) : undefined;
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const id = params.get('mensagem');
    const m = id && msgs.find((x) => x.id === id);
    if (m) { openMsg(m); params.delete('mensagem'); setParams(params, { replace: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <section className="card" aria-labelledby="tm-h" id="mensagens">
      <div className="card-head"><MessagesSquare size={17} /><h2 id="tm-h" style={{ whiteSpace: 'nowrap' }}>Mensagens · Teams</h2>{unread > 0 && <span className="badge badge-accent plain tnum" style={{ marginLeft: 'auto' }}>{unread} não lidas</span>}</div>
      <SourceNotice id="teams" label="O Teams" />
      {msgs.length === 0 ? <EmptyState icon={<MessagesSquare size={22} />} title="Sem mensagens recentes" /> : (
        <div className="mlist">
          {msgs.slice(0, 4).map((m) => (
            <button key={m.id} className={`mrow ${m.lida ? '' : 'unread'}`} onClick={() => openMsg(m)} aria-label={`${m.lida ? '' : 'Não lida: '}${m.conversa.nome}: ${m.resumo}`}>
              {m.conversa.tipo === 'chat' ? <Avatar name={m.remetenteNome} /> : <span className="tm-ic" aria-hidden>#</span>}
              <span style={{ minWidth: 0 }}>
                <span className="who" style={{ display: 'block' }}>{m.conversa.tipo === 'canal' ? `${m.conversa.equipe} › ${m.conversa.nome}` : m.conversa.nome}</span>
                <span className="txt" style={{ display: 'block' }}>{m.conversa.tipo === 'canal' ? `${m.remetenteNome.split(' ')[0]}: ` : ''}{m.resumo}</span>
              </span>
              <span className="stack-sm" style={{ alignItems: 'flex-end', gap: 4 }}><span className="xs muted tnum">{fmtTime(m.ts)}</span>{!m.lida && <span className="udot" aria-hidden />}</span>
            </button>
          ))}
        </div>
      )}
      <div className="row xs muted" style={{ padding: '8px 18px', borderTop: '1px solid var(--border)' }}><SyncStamp id="teams" /><span className="spacer" /><span>Integração {integration('teams').mode === 'real' ? 'real' : 'simulada'}</span></div>
      <Drawer open={!!open} onClose={() => setOpen(null)} label="Conversa do Teams"
        title={open ? <span className="row" style={{ gap: 10 }}><MessagesSquare size={17} />{open.conversa.tipo === 'canal' ? `${open.conversa.equipe} › ${open.conversa.nome}` : open.conversa.nome}</span> : ''}
        footer={<>
          {link ? <a className="btn btn-primary btn-sm" href={link} target="_blank" rel="noreferrer"><ArrowUpRight size={15} />Abrir no Teams</a>
            : <button className="btn btn-secondary btn-sm" disabled title="Deep link do Teams não configurado"><ArrowUpRight size={15} />Abrir no Teams · não configurado</button>}
          <span className="xs muted">Integração {integration('teams').mode === 'real' ? 'real' : 'simulada'}: consulta somente leitura</span>
        </>}>
        {open && (
          <div className="stack">
            <p className="xs muted">Alcance: {reachLabel(open.alcance, COMPANIES)} · mensagens de exemplo</p>
            <div className="thread">
              {open.thread.map((t, i) => (
                <div key={i} className={`cmt ${t.autor === me?.name ? 'mine' : ''}`}>
                  <Avatar name={t.autor} sm />
                  <div><div className="meta"><b>{t.autor}</b><span>{fmtDateTime(t.ts)}</span></div><div className="bubble">{t.texto}</div></div>
                </div>
              ))}
            </div>
            <div className="banner banner-info"><span className="b-text small">Responder acontece no Teams. Nesta etapa a plataforma demonstra a consulta e o acesso à conversa; envio de mensagens depende da futura integração Microsoft.</span></div>
          </div>
        )}
      </Drawer>
    </section>
  );
}
