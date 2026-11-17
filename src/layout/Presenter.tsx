import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Monitor, Plug, Presentation, RotateCcw, Smartphone } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { INTEGRATIONS } from '@/platform/integrations';
import { fmtDateTime, fmtRelative } from '@/platform/format';
import { Badge, Confirm, Drawer } from '@/ui/core';
import { COMPANIES } from '@/ui/brand';
import { ORIGINS } from '@/ui/origin';
import { useToast } from '@/ui/toast';
import type { BrandId, EmailMessage, ModuleId, Session, SimMode, SourceId } from '@/platform/types';

type Prep = { user?: string; company?: BrandId; to?: string; outages?: Session['outages']; logout?: boolean };
/** Roteiro de validação da versão 0.3 (10 cenários). */
const SCRIPT: { n: number; label: string; msg: string; steps: ({ label: string } & Prep)[] }[] = [
  { n: 1, label: 'Entrar como colaboradora e ver chamados, tarefas, intranet e mensagens', msg: 'Ana · AZIME. Meu trabalho reúne Chamados, Feedback e Viagens; à direita, Teams e notificações.',
    steps: [{ label: 'Pela entrada Microsoft', logout: true, to: '/entrar', outages: {} }, { label: 'Direto no Início', user: 'u1', company: 'azime', to: '/inicio', outages: {} }] },
  { n: 2, label: 'Comentar a tarefa TF-311 pelo painel', msg: 'Abre o painel de trabalho com resumo, comentários e ações válidas.', steps: [{ label: 'Abrir TF-311', user: 'u1', company: 'azime', to: '/inicio?painel=t1' }] },
  { n: 3, label: 'Avançar a TF-311 e conferir no módulo', msg: '“Enviar para revisão” → abrir no módulo Chamados → histórico, lista e notificação do revisor.', steps: [{ label: 'Abrir TF-311', user: 'u1', company: 'azime', to: '/inicio?painel=t1' }, { label: 'Ver no módulo', user: 'u1', company: 'azime', to: '/chamados/tarefas/t1' }] },
  { n: 4, label: 'Abrir uma aprovação pelo painel e decidir no módulo', msg: 'Bruno (líder) vê “Revisar” em Meu trabalho; a decisão acontece na tarefa, dentro de Chamados.', steps: [{ label: 'Bruno · Início', user: 'u2', company: 'azime', to: '/inicio' }] },
  { n: 5, label: 'Abrir o comunicado da festa da empresa', msg: 'Conteúdo do SharePoint com origem, autoria e alcance (todo o grupo).', steps: [{ label: 'Ana · Início', user: 'u1', company: 'azime', to: '/inicio#intranet' }, { label: 'Comunicado', user: 'u1', company: 'azime', to: '/intranet/p1' }] },
  { n: 6, label: 'Consultar uma mensagem do Teams', msg: 'Conversa de exemplo; “Abrir no Teams” só usa destino real quando configurado.', steps: [{ label: 'Abrir mensagem de Bruno', user: 'u1', company: 'azime', to: '/inicio?mensagem=m1' }] },
  { n: 7, label: 'Trocar de ambiente e conferir o conteúdo', msg: 'Alinare: outras tarefas e chamados, procedimento de reverso, canal do Showroom.', steps: [{ label: 'Ana · Alinare', user: 'u1', company: 'alinare', to: '/inicio' }, { label: 'Ana · Novitah', user: 'u1', company: 'novitah', to: '/inicio' }] },
  { n: 8, label: 'Simular indisponibilidade apenas da intranet', msg: 'Aviso na área de comunicados, conteúdo em cache com horário e “Tentar novamente”; chamados seguem utilizáveis.', steps: [{ label: 'Intranet fora do ar', user: 'u1', company: 'azime', to: '/inicio', outages: { sharepoint: true } }, { label: 'Restabelecer', outages: {} }] },
  { n: 9, label: 'TI concede e retira uma permissão individual', msg: 'Ficha da Ana em Alinare: marque/desmarque uma ação, revise e aplique; auditoria e e-mail registram.', steps: [{ label: 'Elisa · ficha da Ana', user: 'u5', company: 'alinare', to: '/admin/colaboradores/u1' }, { label: 'Ver como Ana', user: 'u1', company: 'alinare', to: '/inicio' }] },
  { n: 10, label: 'Exportação permanente e exportação sujeita à aprovação', msg: 'TI exporta Inventário direto; Expedição solicita Reverso; Gerência decide; Diego baixa.', steps: [
    { label: 'TI · Inventário', user: 'u5', company: 'azime', to: '/inventario/equipamentos' }, { label: 'Diego · solicitar', user: 'u4', company: 'alinare', to: '/reverso/solicitacoes' },
    { label: 'Fábio · decidir', user: 'u6', company: 'alinare', to: '/inicio' }, { label: 'Diego · baixar', user: 'u4', company: 'alinare', to: '/inicio' }] },
];
const OUTAGE_KEYS: { id: SourceId | ModuleId; label: string }[] = [
  { id: 'sharepoint', label: 'Intranet (SharePoint)' }, { id: 'feedback', label: 'Feedback (SharePoint)' }, { id: 'teams', label: 'Teams' }, { id: 'chamados', label: 'Chamados (sistema próprio)' },
];

export function PresenterPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, session, setSession, reset, update, me, userName } = useDemo();
  const nav = useNavigate();
  const toast = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const [mails, setMails] = useState(false);
  const [mail, setMail] = useState<EmailMessage | null>(null);
  const personas = data.users.filter((u) => u.persona);
  const rev = data.plugins.find((p) => p.id === 'reverso')!;
  const outages = session.outages ?? {};

  const go = (s: Prep) => {
    const patch: Partial<Session> = {};
    if (s.outages) patch.outages = s.outages;
    if (s.logout) patch.userId = null;
    else { if (s.user) patch.userId = s.user; if (s.company) patch.companyId = s.company; }
    setSession(patch);
    if (s.to) nav(s.to);
    if (s.to || s.user) onClose();
  };

  return (
    <>
      <Drawer open={open} onClose={onClose} title={<span className="row"><Presentation size={18} />Painel do apresentador</span>}
        footer={<button className="btn btn-secondary btn-block" onClick={() => setConfirmReset(true)}><RotateCcw size={16} />Restaurar demonstração</button>}>
        <div className="stack" style={{ gap: 22 }}>
          <div className="grid-2" style={{ gap: 10 }}>
            <div>
              <div className="label" style={{ marginBottom: 6 }}>Perfil</div>
              <select className="select" value={me?.id} onChange={(e) => { setSession({ userId: e.target.value }); nav('/inicio'); }} aria-label="Perfil de demonstração">
                {personas.map((u) => <option key={u.id} value={u.id}>{u.persona} · {u.name.split(' ')[0]}</option>)}
              </select>
            </div>
            <div>
              <div className="label" style={{ marginBottom: 6 }}>Aparência</div>
              <div className="seg" role="group" aria-label="Aparência">
                <button aria-pressed={session.theme === 'light'} onClick={() => setSession({ theme: 'light' })}>Claro</button>
                <button aria-pressed={session.theme === 'dark'} onClick={() => setSession({ theme: 'dark' })}>Escuro</button>
              </div>
            </div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Ambiente</div>
            <div className="seg" role="group" aria-label="Ambiente">
              {(Object.keys(COMPANIES) as BrandId[]).map((b) => <button key={b} aria-pressed={session.companyId === b} onClick={() => setSession({ companyId: b })}>{COMPANIES[b].name}</button>)}
            </div>
          </div>

          <div>
            <div className="label" style={{ marginBottom: 4 }}>Roteiro de validação · 0.3</div>
            {SCRIPT.map((s) => (
              <div className="script-step" key={s.n} style={{ gridTemplateColumns: '28px 1fr' }}>
                <span className="step-num">{s.n}</span>
                <div>
                  <div className="strong">{s.label}</div>
                  <div className="xs muted">{s.msg}</div>
                  <div className="row-wrap" style={{ gap: 4, marginTop: 6 }}>
                    {s.steps.map((st) => <button key={st.label} className="btn btn-secondary btn-xs" onClick={() => go(st)}>{st.label}<ArrowRight size={12} /></button>)}
                  </div>
                </div>
              </div>
            ))}
            <div className="row xs muted" style={{ marginTop: 6 }}><Smartphone size={13} />360 / 390 px · <Monitor size={13} />1280 / 1440 px</div>
          </div>

          <div>
            <div className="label row" style={{ marginBottom: 8 }}><Plug size={15} />Integrações · todas simuladas nesta versão</div>
            <div className="stack-sm">
              {INTEGRATIONS.map((i) => {
                const key = OUTAGE_KEYS.find((o) => o.id === i.id);
                return (
                  <div key={i.id} className="att" style={{ padding: '10px 12px', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row" style={{ gap: 6 }}><b className="small">{i.name}</b><Badge tone={i.mode === 'real' ? 'ok' : 'neutral'} plain>{i.mode === 'real' ? 'Real' : 'Simulado'}</Badge></div>
                      <div className="xs muted">{i.system} · {i.endpoint ? i.endpoint : 'endereço não configurado'}</div>
                    </div>
                    {key && (
                      <label className="check xs" style={{ alignItems: 'center', whiteSpace: 'nowrap' }}>
                        <input type="checkbox" checked={!!outages[key.id]} onChange={(e) => setSession({ outages: { ...outages, [key.id]: e.target.checked } })} />Indisponível
                      </label>
                    )}
                    {i.id === 'email' && <button className="btn btn-secondary btn-xs" onClick={() => setMails(true)}><Mail size={13} />Caixa de saída · {data.emails.length}</button>}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="label" style={{ marginBottom: 8 }}>Estados e acessibilidade</div>
            <div className="seg" role="group" aria-label="Estado simulado">
              {(['normal', 'carregando', 'erro', 'vazio'] as SimMode[]).map((m) => <button key={m} aria-pressed={session.sim === m} onClick={() => setSession({ sim: m })} style={{ textTransform: 'capitalize' }}>{m}</button>)}
            </div>
            <label className="check small" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={rev.maintenance} onChange={() => update((d) => { const p = d.plugins.find((x) => x.id === 'reverso')!; p.maintenance = !p.maintenance; })} />Reverso em manutenção
            </label>
            <label className="check small" style={{ marginTop: 8 }}><input type="checkbox" checked={!!session.reduceTransparency} onChange={(e) => setSession({ reduceTransparency: e.target.checked })} />Reduzir transparência</label>
            <label className="check small" style={{ marginTop: 8 }}><input type="checkbox" checked={!!session.reduceMotion} onChange={(e) => setSession({ reduceMotion: e.target.checked })} />Reduzir movimento</label>
          </div>

          <div>
            <div className="label" style={{ marginBottom: 8 }}>Telas de entrada</div>
            <div className="stack-sm small">
              <Link to="/entrar?motivo=sessao" onClick={() => setSession({ userId: null })}>Entrada Microsoft · sessão encerrada</Link>
              <Link to="/entrar" onClick={() => setSession({ userId: null })}>Conta não liberada (João Victor)</Link>
              <Link to="/rota-que-nao-existe" onClick={onClose}>Endereço inválido</Link>
            </div>
          </div>
        </div>
      </Drawer>

      <Drawer open={mails} onClose={() => { setMails(false); setMail(null); }} wide label="Caixa de saída de e-mails simulados"
        title={<span className="row"><Mail size={17} />E-mails simulados · {data.emails.length}</span>}
        footer={mail ? <button className="btn btn-secondary btn-sm" onClick={() => setMail(null)}>Voltar à lista</button> : <span className="xs muted">Gerados pelos mesmos eventos das notificações internas · nada é enviado de verdade</span>}>
        {mail ? (
          <div className="stack">
            <dl className="kv" style={{ gridTemplateColumns: '1fr', gap: 10 }}>
              <div><dt>Para</dt><dd>{userName(mail.toUserId)} &lt;{mail.to}&gt;</dd></div>
              <div><dt>Assunto</dt><dd className="strong">{mail.subject}</dd></div>
              <div><dt>Enviado</dt><dd>{fmtDateTime(mail.ts)}</dd></div>
              <div><dt>Registro relacionado</dt><dd>{ORIGINS[mail.module]?.name} · <Link to={mail.link} onClick={() => { setMails(false); onClose(); if (mail.companyId) setSession({ companyId: mail.companyId }); }}>{mail.link}</Link></dd></div>
              <div><dt>Evento de origem</dt><dd className="small muted">Notificação {mail.notificationId ?? '—'} · mesmo destinatário, assunto e registro</dd></div>
            </dl>
            <div className="email-body">{mail.body}</div>
          </div>
        ) : (
          <div>
            {[...data.emails].sort((a, b) => b.ts.localeCompare(a.ts)).map((m) => (
              <div key={m.id} className="email-row" onClick={() => setMail(m)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setMail(m)}>
                <span className="strong small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.subject}</span>
                <span className="xs muted tnum">{fmtRelative(m.ts)}</span>
                <span className="xs muted">Para {userName(m.toUserId)} · {m.to}</span>
              </div>
            ))}
          </div>
        )}
      </Drawer>

      <Confirm open={confirmReset} onClose={() => setConfirmReset(false)} title="Restaurar demonstração?" confirmLabel="Restaurar dados iniciais"
        desc="Todos os registros, e-mails e indisponibilidades voltam ao cenário inicial. A aparência é mantida."
        onConfirm={() => { reset(); setSession({ userId: 'u1', companyId: 'azime', outages: {} }); nav('/inicio'); onClose(); toast('Demonstração restaurada.'); }} />
    </>
  );
}
