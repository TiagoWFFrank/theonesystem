import { NavLink, useLocation } from 'react-router-dom';
import { ClipboardList, Download, Home, KeyRound, ListTodo, PanelLeftClose, PanelLeftOpen, Puzzle, Star, UserCog, Users, Wrench } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { computePendencias } from '@/platform/pendencias';
import { COMPANIES, Logo } from '@/ui/brand';
import { useVisibleModules } from './modules';
import type { MenuItem, ModuleId } from '@/platform/types';

const ADMIN_ICONS: Record<string, typeof Users> = {
  '/admin/colaboradores': Users, '/admin/acessos': UserCog, '/admin/perfis': KeyRound, '/admin/exportacoes': Download, '/admin/plugins': Puzzle,
};

export function useMenuAllowed() {
  const { can } = useDemo();
  return (mod: ModuleId, x: MenuItem) => !x.requires || (Array.isArray(x.requires) ? x.requires.some((r) => can(mod, r)) : can(mod, x.requires));
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const ctx = useDemo();
  const { data, me } = ctx;
  const loc = useLocation();
  const mods = useVisibleModules();
  const allowed = useMenuAllowed();
  const pend = computePendencias(ctx.data, ctx.me, ctx.company);
  const total = pend.reduce((s, p) => s + p.records.length, 0);
  const favs = (me && data.favorites[me.id]) || [];
  const plugins = mods.filter((m) => m.id !== 'admin');
  const adminMod = mods.find((m) => m.id === 'admin');
  const pendBy = (id: string) => pend.filter((p) => p.module === id).reduce((s, p) => s + p.records.length, 0);
  const rootOf = (m: { basePath: string }) => '/' + m.basePath.split('/')[1];
  const inModule = (m: { basePath: string }) => loc.pathname === rootOf(m) || loc.pathname.startsWith(rootOf(m) + '/');

  const Item = ({ m, fav }: { m: (typeof mods)[number]; fav?: boolean }) => {
    const active = !fav && inModule(m);
    const n = pendBy(m.id);
    const sub = m.menu.filter((x) => allowed(m.id, x));
    return (
      <>
        <NavLink to={m.basePath} onClick={onNavigate} className={() => `nav-item ${active ? 'active' : ''}`} title={m.name} aria-label={n ? `${m.name}, ${n} pendências` : m.name} aria-current={active ? 'page' : undefined} aria-expanded={!fav && sub.length > 1 ? active : undefined}>
          <m.icon size={19} />
          <span className="nav-label">{m.name}</span>
          {m.maintenance ? <span className="nav-badge" title="Em manutenção"><Wrench size={12} /></span> : n > 0 && <span className="nav-badge">{n}</span>}
          {n > 0 && <span className="dot-badge" />}
        </NavLink>
        {active && sub.length > 1 && (
          <div className="nav-sub" role="group" aria-label={`Páginas de ${m.name}`}>
            {sub.map((x) => {
              const shadowed = sub.some((y) => y.path !== x.path && y.path.startsWith(x.path) && loc.pathname.startsWith(y.path));
              return <NavLink key={x.path} to={x.path} end={x.path !== m.basePath} onClick={onNavigate} className={({ isActive }) => (isActive && !shadowed ? 'active' : '')}>{x.label}</NavLink>;
            })}
          </div>
        )}
      </>
    );
  };
  const cls = ({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'active' : ''}`;

  return (
    <nav className="sidebar-nav" aria-label="Navegação principal">
      <NavLink to="/inicio" onClick={onNavigate} className={cls} title="Início" aria-label="Início"><Home size={19} /><span className="nav-label">Início</span></NavLink>
      <NavLink to="/pendencias" onClick={onNavigate} className={cls} title="Meu trabalho" aria-label={`Meu trabalho (${total})`}>
        <ListTodo size={19} /><span className="nav-label">Meu trabalho</span>{total > 0 && <><span className="nav-badge">{total}</span><span className="dot-badge" /></>}
      </NavLink>
      {favs.some((f) => plugins.some((p) => p.id === f)) && (
        <>
          <div className="nav-group-label"><Star size={11} style={{ verticalAlign: '-1px' }} /> Favoritos</div><div className="nav-group-sep" />
          {plugins.filter((m) => favs.includes(m.id)).map((m) => <Item key={'f' + m.id} m={m} fav />)}
        </>
      )}
      <div className="nav-group-label">Módulos</div><div className="nav-group-sep" />
      {plugins.length === 0 && <p className="xs nav-label" style={{ color: 'var(--nav-muted)', padding: '0 12px' }}>Nenhum módulo liberado.</p>}
      {plugins.map((m) => <Item key={m.id} m={m} />)}
      {adminMod && (
        <>
          <div className="nav-group-label">Administração</div><div className="nav-group-sep" />
          {adminMod.menu.filter((x) => allowed('admin', x)).map((x) => {
            const Ic = ADMIN_ICONS[x.path] ?? ClipboardList;
            return (
              <NavLink key={x.path} to={x.path} onClick={onNavigate} className={({ isActive }) => `nav-item ${isActive || loc.pathname.startsWith(x.path + '/') ? 'active' : ''}`} title={x.label} aria-label={x.label}>
                <Ic size={19} /><span className="nav-label">{x.label}</span>
                {x.path === '/admin/acessos' && pendBy('admin') > 0 && <><span className="nav-badge">{pendBy('admin')}</span><span className="dot-badge" /></>}
              </NavLink>
            );
          })}
        </>
      )}
    </nav>
  );
}

export function Sidebar() {
  const { company, session, setSession } = useDemo();
  return (
    <aside className="sidebar desktop glass" aria-label="Plataforma">
      <div className="sidebar-head">
        <Logo brand={company} />
        <span className="env-tag">Ambiente {COMPANIES[company].name}</span>
      </div>
      <SidebarNav />
      <div className="sidebar-foot">
        <button className="nav-item collapse-btn" onClick={() => setSession({ sidebarCollapsed: !session.sidebarCollapsed })}
          aria-label={session.sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'} title={session.sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}>
          {session.sidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          <span className="nav-label">Recolher menu</span>
        </button>
      </div>
    </aside>
  );
}
