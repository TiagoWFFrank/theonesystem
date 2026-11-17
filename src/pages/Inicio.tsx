import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCheck, ClipboardCheck, Download, FilePlus2, KeyRound, Laptop, PackageCheck, PackagePlus, Plane, Ticket, UserPlus } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { computePendencias, type Task } from '@/platform/pendencias';
import { fmtDate, fmtDateShort, fmtRelative } from '@/platform/format';
import { Badge, EmptyState } from '@/ui/core';
import { COMPANIES, Monogram } from '@/ui/brand';
import { ALL_MODULES, useVisibleModules } from '@/layout/modules';
import type { ModuleId, RecentItem } from '@/platform/types';

function greeting() {
  const h = Number(new Date().toLocaleString('pt-BR', { hour: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}
const DAY = 86400000;
function dueInfo(t: Task) {
  if (!t.due) return null;
  const d = Math.ceil((new Date(t.due).getTime() - Date.now()) / DAY);
  const label = t.dueLabel ?? 'Prazo';
  if (t.dueLabel === 'Embarque') return { text: `${label} ${fmtDateShort(t.due)}`, cls: d <= 3 ? 'soon' : '' };
  if (d < 0) return { text: `Atrasada · ${fmtDateShort(t.due)}`, cls: 'late' };
  if (d === 0) return { text: `${label}: hoje`, cls: 'soon' };
  if (d === 1) return { text: `${label}: amanhã`, cls: 'soon' };
  return { text: `${label} ${fmtDateShort(t.due)}`, cls: '' };
}

export default function Inicio() {
  const { me, company, data, can, grant } = useDemo();
  const mods = useVisibleModules();
  const [tab, setTab] = useState<'todas' | ModuleId>('todas');
  if (!me) return null;
  const pend = computePendencias(data, me, company);
  const tasks = pend.flatMap((p) => p.records.map((r) => ({ ...r, module: p.module, queue: p.label })));
  const sorted = [...tasks].sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9'));
  const top = sorted.find((t) => !t.title.startsWith('Consultar') && !t.title.startsWith('Acompanhar')) ?? sorted[0];
  const byMod = ALL_MODULES.filter((m) => tasks.some((t) => t.module === m.id));
  const shown = sorted.filter((t) => tab === 'todas' || t.module === tab);
  const modOf = (id: ModuleId) => ALL_MODULES.find((m) => m.id === id)!;

  const quick = [
    can('inventario', 'registrar_entrega') && { to: '/inventario/equipamentos?situacao=disponivel', label: 'Registrar entrega de equipamento', icon: PackageCheck },
    can('admin', 'aplicar_acesso') && { to: '/admin/acessos?situacao=pendente', label: 'Aplicar acessos solicitados', icon: KeyRound },
    can('reverso', 'aprovar') && { to: '/reverso/solicitacoes?fila=aprovacao', label: 'Aprovações de reverso', icon: ClipboardCheck },
    can('admin', 'solicitar_acesso') && { to: '/admin/acessos/nova', label: 'Solicitar acesso para a equipe', icon: UserPlus },
    can('viagens', 'registrar_compra') && { to: '/viagens/compras/nova', label: 'Registrar compra externa', icon: Ticket },
    can('reverso', 'abrir') && { to: '/reverso/solicitacoes/nova', label: 'Abrir solicitação de reverso', icon: FilePlus2 },
    can('admin', 'exportacoes') && { to: '/admin/exportacoes', label: 'Configurar exportações', icon: Download },
    can('inventario', 'cadastrar') && { to: '/inventario/equipamentos/novo', label: 'Cadastrar equipamento', icon: PackagePlus },
    grant('viagens') && { to: '/viagens/minhas', label: 'Minhas viagens', icon: Plane },
    grant('inventario')?.scope === 'proprios' && { to: '/inventario/equipamentos', label: 'Meus equipamentos', icon: Laptop },
  ].filter(Boolean).slice(0, 4) as { to: string; label: string; icon: typeof Plane }[];

  // atividade recente: registros consultados/alterados + ações do próprio perfil
  const linkOf = (m: ModuleId, id: string) => m === 'inventario' ? `/inventario/equipamentos/${id}` : m === 'reverso' ? `/reverso/solicitacoes/${id}` : m === 'viagens' ? `/viagens/${id}` : id.startsWith('ar') ? `/admin/acessos/${id}` : id.startsWith('u') ? `/admin/colaboradores/${id}` : '/admin/perfis';
  const fromEvents: RecentItem[] = data.events.filter((e) => e.actorId === me.id).map((e) => ({
    module: e.module, recordId: e.recordId, label: e.recordLabel, action: e.action.split(' —')[0].split(':')[0], ts: e.ts, companyId: e.companyId, link: linkOf(e.module, e.recordId),
  }));
  const seen = new Set<string>();
  const recent = [...(data.recent[me.id] ?? []), ...fromEvents]
    .filter((r) => r.companyId === company && mods.some((m) => m.id === r.module))
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .filter((r) => (seen.has(r.recordId) ? false : (seen.add(r.recordId), true)))
    .slice(0, 5);
  const topDue = top ? dueInfo(top) : null;

  return (
    <>
      <div className="hello">
        <div>
          <p className="muted small" style={{ marginBottom: 4 }}>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })}</p>
          <h1>{greeting()}, {me.name.split(' ')[0]}</h1>
        </div>
        <span className="env-chip glass" style={{ marginLeft: 'auto' }}><Monogram brand={company} size={22} />Ambiente {COMPANIES[company].name}</span>
      </div>

      {top ? (
        <section className="focus-card" aria-label="Pendência mais relevante">
          <span className="f-ic">{(() => { const M = modOf(top.module).icon; return <M size={24} />; })()}</span>
          <div style={{ minWidth: 0, position: 'relative', zIndex: 1 }}>
            <div className="f-k">Mais relevante agora · {modOf(top.module).name}</div>
            <div className="f-t">{top.title}</div>
            <div className="f-m">{top.subject}{topDue ? ` · ${topDue.text}` : ''}</div>
          </div>
          <Link to={top.link} className="btn">{top.action}<ArrowRight size={17} /></Link>
        </section>
      ) : (
        <section className="focus-card" aria-label="Sem pendências">
          <span className="f-ic"><CheckCheck size={24} /></span>
          <div><div className="f-k">Tudo em dia</div><div className="f-t">Nenhuma pendência neste ambiente</div></div>
        </section>
      )}

      <div className="home-grid">
        <section className="card" aria-labelledby="mt-h">
          <div className="card-head">
            <h2 id="mt-h">Meu trabalho</h2>
            <span className="badge badge-accent plain tnum">{tasks.length}</span>
            <Link to="/pendencias" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>Ver tudo<ArrowRight size={15} /></Link>
          </div>
          {byMod.length > 1 && (
            <div className="work-tabs" role="tablist">
              <button role="tab" className="tab" aria-selected={tab === 'todas'} onClick={() => setTab('todas')}>Todas<span className="tab-count">{tasks.length}</span></button>
              {byMod.map((m) => <button key={m.id} role="tab" className="tab" aria-selected={tab === m.id} onClick={() => setTab(m.id)}><m.icon size={15} />{m.name}<span className="tab-count">{tasks.filter((t) => t.module === m.id).length}</span></button>)}
            </div>
          )}
          {shown.length === 0 ? <EmptyState icon={<CheckCheck size={24} />} title="Nada pendente" text="As tarefas dos módulos que você acessa aparecem aqui." /> : (
            <div role="list">
              {shown.slice(0, 7).map((t) => {
                const m = modOf(t.module); const due = dueInfo(t);
                return (
                  <div key={t.queue + t.id} className="task" role="listitem">
                    <span className="t-ic"><m.icon size={18} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="t-title">{t.title}</div>
                      <div className="t-meta"><span>{m.name}</span><span aria-hidden>·</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>{t.subject}</span><Badge tone={t.tone}>{t.status}</Badge></div>
                    </div>
                    <span className={`t-due ${due?.cls ?? ''}`}>{due?.text ?? '—'}</span>
                    <Link to={t.link} className="btn btn-secondary btn-sm t-act">{t.action}</Link>
                  </div>
                );
              })}
            </div>
          )}
          {pend.length > 0 && (
            <div className="work-foot" aria-label="Filas de trabalho">
              {pend.map((p) => <Link key={p.id} to={p.to}>{p.label} <b>{p.records.length}</b></Link>)}
            </div>
          )}
        </section>

        <aside className="stack" style={{ gap: 20 }}>
          {quick.length > 0 && (
            <section aria-labelledby="qa-h">
              <div className="section-head"><h2 id="qa-h" className="section-title">Ações frequentes</h2></div>
              <div className="quick">{quick.map((q) => <Link key={q.to} to={q.to} className="interactive"><q.icon size={20} />{q.label}</Link>)}</div>
            </section>
          )}
          <section className="card" aria-labelledby="rec-h">
            <div className="card-head"><h2 id="rec-h">Atividades recentes</h2></div>
            {recent.length === 0 ? <p className="small muted" style={{ padding: 20 }}>Os registros que você consultar ou alterar aparecem aqui.</p> : recent.map((r) => {
              const m = modOf(r.module);
              return (
                <Link key={r.recordId} to={r.link} className="recent-row">
                  <span className="mod-icon" style={{ width: 34, height: 34, borderRadius: 10 }}><m.icon size={16} /></span>
                  <span style={{ minWidth: 0 }}>
                    <span className="strong small" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                    <span className="xs muted">{r.action}</span>
                  </span>
                  <span className="xs muted tnum">{fmtRelative(r.ts)}</span>
                </Link>
              );
            })}
          </section>
          <section aria-labelledby="mods-h">
            <div className="section-head"><h2 id="mods-h" className="section-title">Módulos</h2></div>
            <div className="mod-mini">
              {mods.map((m) => {
                const n = tasks.filter((t) => t.module === m.id).length;
                return <Link key={m.id} to={m.basePath} className="interactive"><span className="mi"><m.icon size={15} /></span>{m.name}{n > 0 && <span className="nb tnum">{n}</span>}</Link>;
              })}
            </div>
            <p className="xs muted" style={{ marginTop: 10 }}>Atualizado em {fmtDate(new Date().toISOString())} · ambiente {COMPANIES[company].name}</p>
          </section>
        </aside>
      </div>
    </>
  );
}
