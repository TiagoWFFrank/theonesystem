// Painel pessoal: trabalho (plugins + fontes), intranet, mensagens, notificações, ações e atividades.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCheck, Newspaper } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { collectQuickActions, taskOpsFor } from '@/platform/work';
import { postsFor } from '@/platform/sources';
import { fmtRelative } from '@/platform/format';
import { ALL_MODULES, useVisibleModules } from '@/layout/modules';
import { COMPANIES, Monogram } from '@/ui/brand';
import { ORIGINS } from '@/ui/origin';
import { SourceNotice, SyncStamp } from '@/ui/source';
import { WorkPanel } from '@/ui/WorkPanel';
import { dueInfo, useWork, WorkList } from '@/ui/work';
import { NotificationsCard, TeamsCard } from '@/ui/feeds';
import { PostCard } from './Intranet';
import type { ModuleId, RecentItem, WorkItem } from '@/platform/types';

function greeting() {
  const h = Number(new Date().toLocaleString('pt-BR', { hour: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export default function Inicio() {
  const { me, company, data, down } = useDemo();
  const nav = useNavigate();
  const mods = useVisibleModules();
  const { items } = useWork();
  const [panel, setPanel] = useState<Pick<WorkItem, 'origin' | 'recordId'> | null>(null);
  const [params, setParams] = useSearchParams();
  // atalho do roteiro: /inicio?painel=<registro> abre o painel de trabalho
  useEffect(() => {
    const id = params.get('painel');
    if (id) { setPanel({ origin: 'chamados', recordId: id }); params.delete('painel'); setParams(params, { replace: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!me) return null;
  const top = items.find((i) => i.stage === 'acao' || i.stage === 'aprovacao') ?? items[0];
  const quick = collectQuickActions(data, me, company).slice(0, 4);
  const posts = postsFor(data, company, me).slice(0, 3);
  const pendingCount = items.filter((i) => i.stage === 'acao' || i.stage === 'aprovacao').length;

  const linkOf = (m: ModuleId, id: string) => ALL_MODULES.find((x) => x.id === m)?.contributes?.recordPath?.(id) ?? '/inicio';
  const fromEvents: RecentItem[] = data.events.filter((e) => e.actorId === me.id).map((e) => ({
    module: e.module, recordId: e.recordId, label: e.recordLabel, action: e.action.split(' —')[0].split(':')[0], ts: e.ts, companyId: e.companyId, link: linkOf(e.module, e.recordId),
  }));
  const seen = new Set<string>();
  const recent = [...(data.recent[me.id] ?? []), ...fromEvents]
    .filter((r) => r.companyId === company && mods.some((m) => m.id === r.module))
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .filter((r) => (seen.has(r.recordId) ? false : (seen.add(r.recordId), true)))
    .slice(0, 4);
  const topDue = top ? dueInfo(top) : null;
  const openTop = () => {
    if (!top) return;
    if (top.action.kind === 'painel' && taskOpsFor(top.origin, top.recordId)) setPanel(top); else nav(top.action.to.startsWith('http') ? '/pendencias' : top.action.to || '/pendencias');
  };
  const TopIcon = top ? ORIGINS[top.origin].icon : CheckCheck;

  return (
    <>
      <div className="hello">
        <div>
          <p className="muted small" style={{ marginBottom: 4 }}>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })}</p>
          <h1>{greeting()}, {me.name.split(' ')[0]}</h1>
        </div>
        <span className="env-chip glass" style={{ marginLeft: 'auto' }}><Monogram brand={company} size={22} />Ambiente {COMPANIES[company].name}</span>
      </div>

      {top && (top.stage === 'acao' || top.stage === 'aprovacao') ? (
        <section className="focus-card" aria-label="Pendência mais relevante">
          <span className="f-ic"><TopIcon size={24} /></span>
          <div style={{ minWidth: 0, position: 'relative', zIndex: 1 }}>
            <div className="f-k">Mais relevante agora · {ORIGINS[top.origin].name} · {pendingCount} {pendingCount === 1 ? 'item precisa' : 'itens precisam'} de você</div>
            <div className="f-t">{top.ref} · {top.title}</div>
            <div className="f-m">{top.status}{topDue ? ` · ${topDue.text}` : ''}{top.subject ? ` · ${top.subject}` : ''}</div>
          </div>
          <button className="btn" onClick={openTop}>{top.action.label}<ArrowRight size={17} /></button>
        </section>
      ) : (
        <section className="focus-card" aria-label="Sem pendências">
          <span className="f-ic"><CheckCheck size={24} /></span>
          <div><div className="f-k">Tudo em dia</div><div className="f-t">Nada exige sua ação neste ambiente</div></div>
        </section>
      )}

      <div className="home3">
        <div className="stack" style={{ gap: 24, minWidth: 0 }}>
          <section className="card" aria-labelledby="mt-h">
            <div className="card-head">
              <h2 id="mt-h">Meu trabalho</h2><span className="badge badge-accent plain tnum">{items.length}</span>
              <span className="xs muted hide-mobile">Chamados, tarefas e pendências dos módulos</span>
              <Link to="/pendencias" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>Ver tudo<ArrowRight size={15} /></Link>
            </div>
            <SourceNotice id="chamados" label="O sistema de Chamados" cachedNote="Chamados e tarefas abaixo vêm do cache; comentar e avançar fica bloqueado até a conexão voltar" />
            <WorkList limit={7} />
          </section>

          <section aria-labelledby="in-h" id="intranet">
            <div className="section-head"><h2 id="in-h" className="section-title">Comunicados da intranet</h2><SyncStamp id="sharepoint" /><Link to="/intranet" className="link">Ver todos</Link></div>
            {down('sharepoint') && <div className="card" style={{ overflow: 'hidden' }}><SourceNotice id="sharepoint" label="A intranet" /></div>}
            {posts.length === 0 ? <div className="card"><p className="small muted" style={{ padding: 20 }}><Newspaper size={15} /> Nenhuma publicação para este ambiente.</p></div> : (
              <div className="posts" style={{ marginTop: 12 }}>{posts.map((p, i) => <PostCard key={p.id} p={p} featured={i === 0 && !!p.destaque} />)}</div>
            )}
          </section>
        </div>

        <aside className="stack" style={{ gap: 20, minWidth: 0 }}>
          <TeamsCard />
          <NotificationsCard />
          {quick.length > 0 && (
            <section aria-labelledby="qa-h">
              <div className="section-head"><h2 id="qa-h" className="section-title">Ações frequentes</h2></div>
              <div className="quick">{quick.map((q) => <Link key={q.id} to={q.to} className="interactive"><q.icon size={20} />{q.label}</Link>)}</div>
            </section>
          )}
          <section className="card" aria-labelledby="rec-h">
            <div className="card-head"><h2 id="rec-h">Atividades recentes</h2></div>
            {recent.length === 0 ? <p className="small muted" style={{ padding: 20 }}>Os registros que você consultar ou alterar aparecem aqui.</p> : recent.map((r) => {
              const O = ORIGINS[r.module];
              return (
                <Link key={r.recordId} to={r.link} className="recent-row">
                  <span className="mod-icon" style={{ width: 34, height: 34, borderRadius: 10 }}><O.icon size={16} /></span>
                  <span style={{ minWidth: 0 }}><span className="strong small" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span><span className="xs muted">{r.action}</span></span>
                  <span className="xs muted tnum">{fmtRelative(r.ts)}</span>
                </Link>
              );
            })}
          </section>
        </aside>
      </div>
      <WorkPanel open={!!panel} onClose={() => setPanel(null)} origin={panel?.origin ?? 'chamados'} recordId={panel?.recordId ?? null} ops={panel ? taskOpsFor(panel.origin, panel.recordId) : undefined} />
    </>
  );
}
