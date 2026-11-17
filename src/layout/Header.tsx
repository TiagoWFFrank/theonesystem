import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useMatches, useNavigate } from 'react-router-dom';
import { Bell, Check, ChevronDown, LogOut, Menu, Moon, Presentation, Search, Settings, Sun } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { guardBypass } from '@/platform/hooks';
import { moduleAvailability, effectiveGrant, ROLE_LABEL } from '@/platform/permissions';
import { Avatar, Dialog } from '@/ui/core';
import { COMPANIES, Monogram } from '@/ui/brand';
import { useToast } from '@/ui/toast';
import { ALL_MODULES, useVisibleModules } from './modules';
import { NotificationRows, useNotifications } from '@/ui/feeds';
import { ORIGINS } from '@/ui/origin';
import { postsFor } from '@/platform/sources';
import type { BrandId, ModuleId, OriginId } from '@/platform/types';

function useClickOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open, close]);
  return ref;
}

/** Última lista visitada por módulo (para voltar à tela equivalente ao trocar de ambiente). */
export const lastList: Partial<Record<ModuleId, string>> = {};

/**
 * Troca de ambiente.
 * - Tela equivalente existe (lista, Início, administração): permanece nela, com filtros, e os dados são recarregados.
 * - Ficha de um registro: o registro pertence ao ambiente anterior → volta à lista equivalente do módulo.
 * - Módulo não habilitado no novo ambiente: vai para o Início e explica.
 * - Edição pendente: pede decisão antes.
 */
export function useSwitchCompany() {
  const { setSession, dirty, setDirty, data, me } = useDemo();
  const nav = useNavigate();
  const loc = useLocation();
  const matches = useMatches();
  const toast = useToast();
  const [pending, setPending] = useState<BrandId | null>(null);
  const apply = (b: BrandId) => {
    const seg = loc.pathname.split('/').filter(Boolean);
    const mod = ALL_MODULES.find((m) => m.routes.some((r) => r.path.split('/')[1] === seg[0]));
    const isRecord = matches.some((m) => m.params && 'id' in m.params) || /\/(nova|novo)$|\/entrega$/.test(loc.pathname);
    let to: string | null = null;
    let msg = `Ambiente ${COMPANIES[b].name}.`;
    if (mod && (moduleAvailability(data, b, mod.id) === 'nao_instalado' || !effectiveGrant(data, me, b, mod.id))) {
      to = '/inicio'; msg = `${mod.name} não está disponível em ${COMPANIES[b].name}. Você foi para o Início.`;
    } else if (mod && isRecord) {
      to = lastList[mod.id] ?? mod.basePath;
      const label = mod.menu.find((x) => to!.startsWith(x.path))?.label ?? mod.name;
      msg = `Ambiente ${COMPANIES[b].name} · o registro aberto pertence a outro ambiente; você está em ${label}.`;
    } else {
      const label = mod?.menu.find((x) => loc.pathname === x.path)?.label ?? (seg[0] === 'inicio' ? 'Início' : seg[0] === 'pendencias' ? 'Meu trabalho' : null);
      if (label) msg = `Ambiente ${COMPANIES[b].name} · você continua em ${label}.`;
    }
    if (dirty) { guardBypass.current = true; setDirty(false); }
    setSession({ companyId: b });
    if (to) nav(to);
    setTimeout(() => { guardBypass.current = false; }, 50);
    toast(msg, { tone: 'info' });
  };
  const request = (b: BrandId) => (dirty ? setPending(b) : apply(b));
  const dialog = (
    <Dialog open={!!pending} onClose={() => setPending(null)} title="Você tem alterações não salvas"
      desc={pending ? `Trocar para o ambiente ${COMPANIES[pending].name} descarta o que foi preenchido neste formulário.` : ''}
      footer={<>
        <button className="btn btn-secondary" onClick={() => setPending(null)}>Continuar editando</button>
        <button className="btn btn-danger" onClick={() => { const b = pending!; setPending(null); apply(b); }}>Descartar e trocar</button>
      </>} />
  );
  return { request, dialog };
}

function EnvironmentSwitcher() {
  const { me, company } = useDemo();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));
  const { request, dialog } = useSwitchCompany();
  if (!me) return null;
  const many = me.companies.length > 1;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="env-btn" onClick={() => many && setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label={`Ambiente ativo: ${COMPANIES[company].name}${many ? '. Trocar ambiente' : ''}`}>
        <Monogram brand={company} size={32} />
        <span className="e-txt" style={{ textAlign: 'left' }}><span className="e-k" style={{ display: 'block' }}>Ambiente</span><span className="e-n">{COMPANIES[company].name}</span></span>
        {many && <ChevronDown size={16} className="muted" style={{ transition: 'transform var(--dur)', transform: open ? 'rotate(180deg)' : undefined }} />}
      </button>
      {open && (
        <div className="popover glass-strong" role="menu" style={{ minWidth: 300, paddingBottom: 6 }}>
          <div className="menu-head">Ambientes autorizados</div>
          {me.companies.map((b) => (
            <button key={b} role="menuitemradio" aria-checked={b === company} className="menu-item" onClick={() => { setOpen(false); if (b !== company) request(b); }}>
              <Monogram brand={b} size={34} />
              <span style={{ flex: 1 }}><span className="strong" style={{ display: 'block' }}>{COMPANIES[b].name}</span><span className="xs muted">{COMPANIES[b].tagline}</span></span>
              <span className="env-swatch" aria-hidden>{COMPANIES[b].swatches.map((c) => <i key={c} style={{ background: c }} />)}</span>
              {b === company && <Check size={16} />}
            </button>
          ))}
          <p className="xs muted" style={{ padding: '8px 16px 6px' }}>A tela atual é mantida quando existir no outro ambiente.</p>
        </div>
      )}
      {dialog}
    </div>
  );
}

function Notifications() {
  const nav = useNavigate();
  const { list, unread, elsewhere, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));
  const recent = list.filter((n) => Date.now() - new Date(n.ts).getTime() < 86400000);
  const older = list.filter((n) => Date.now() - new Date(n.ts).getTime() >= 86400000);
  const pick = (n: (typeof list)[number]) => { if (!n.read) markRead([n.id]); setOpen(false); nav(n.link); };
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn" aria-label={`Notificações${unread ? `, ${unread} não lidas` : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Bell size={19} />{unread > 0 && <span className="count">{unread}</span>}
      </button>
      {open && (
        <div className="popover glass-strong" style={{ width: 'min(400px, calc(100vw - 24px))', right: -50 }}>
          <div className="row" style={{ padding: '14px 16px 8px' }}>
            <span className="strong">Notificações</span><span className="spacer" />
            {unread > 0 && <button className="btn btn-ghost btn-xs" onClick={() => markRead(list.filter((n) => !n.read).map((n) => n.id))}>Marcar todas como lidas</button>}
          </div>
          <div style={{ maxHeight: 440, overflowY: 'auto', paddingBottom: 6 }}>
            {list.length === 0 ? <p className="muted small" style={{ padding: 20 }}>Nenhuma notificação.</p> : <>
              {recent.length > 0 && <><div className="menu-head">Recentes</div><NotificationRows items={recent} onPick={pick} /></>}
              {older.length > 0 && <><div className="menu-head">Anteriores</div><NotificationRows items={older} onPick={pick} /></>}
            </>}
          </div>
          {elsewhere > 0 && <p className="xs muted" style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>+{elsewhere} não {elsewhere === 1 ? 'lida' : 'lidas'} em outros ambientes · troque de ambiente para ver</p>}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { me, session, setSession } = useDemo();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));
  if (!me) return null;
  const role = me.roles.filter((r) => r !== 'colaborador').map((r) => ROLE_LABEL[r])[0] ?? 'Colaborador';
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="user-btn" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label={`Menu do usuário: ${me.name}`}>
        <Avatar name={me.name} />
        <span className="u-name hide-mobile" style={{ textAlign: 'left', lineHeight: 1.2 }}><span className="strong small" style={{ display: 'block' }}>{me.name.split(' ')[0]}</span><span className="xs muted">{role}</span></span>
      </button>
      {open && (
        <div className="popover glass-strong" role="menu" style={{ paddingBottom: 6 }}>
          <div style={{ padding: '16px 16px 10px' }} className="row">
            <Avatar name={me.name} />
            <div><div className="strong">{me.name}</div><div className="xs muted">{me.email} · Microsoft</div></div>
          </div>
          <div className="menu-sep" />
          <Link to="/preferencias" className="menu-item" role="menuitem" onClick={() => setOpen(false)}><Settings size={16} />Perfil e preferências</Link>
          <button className="menu-item" role="menuitem" onClick={() => setSession({ theme: session.theme === 'light' ? 'dark' : 'light' })}>
            {session.theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}Aparência {session.theme === 'light' ? 'escura' : 'clara'}
          </button>
          <div className="menu-sep" />
          <button className="menu-item" role="menuitem" onClick={() => { setSession({ userId: null }); nav('/entrar'); }}><LogOut size={16} />Encerrar sessão</button>
        </div>
      )}
    </div>
  );
}

/** Busca global agrupada por módulo, respeitando permissões e ambiente ativo. */
function GlobalSearch() {
  const { data, company, can, contrib, me } = useDemo();
  const mods = useVisibleModules();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useClickOutside(open, () => setOpen(false));
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus(); setOpen(true); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  const on = (id: ModuleId) => mods.some((m) => m.id === id && !m.maintenance);
  const groups = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const has = (...s: (string | undefined)[]) => s.join(' ').toLowerCase().includes(t);
    const out: { mod: ModuleId; label: string; items: { title: string; sub: string; to: string }[] }[] = [];
    // cada plugin habilitado contribui com sua própria busca (contrato `contributes.search`)
    if (contrib) for (const m of ALL_MODULES) if (m.contributes?.search && on(m.id)) out.push({ mod: m.id, label: m.name, items: m.contributes.search(contrib, t) });
    out.push({ mod: 'sharepoint' as never, label: 'Intranet', items: postsFor(data, company, me).filter((p) => has(p.titulo, p.resumo, p.area)).map((p) => ({ title: p.titulo, sub: `${p.categoria} · ${p.area}`, to: `/intranet/${p.id}` })) });
    if (can('admin', 'colaboradores')) out.push({ mod: 'admin', label: 'Colaboradores', items: data.users.filter((u) => u.companies.includes(company) && has(u.name, u.email)).map((u) => ({ title: u.name, sub: `${u.sector} · ${u.email}`, to: `/admin/colaboradores/${u.id}` })) });
    return out.map((g) => ({ ...g, items: g.items.slice(0, 5) })).filter((g) => g.items.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, data, company, mods]);
  const flat = groups.flatMap((g) => g.items);
  const go = (to: string) => { setOpen(false); setQ(''); nav(to); };

  return (
    <div className="search" ref={ref}>
      <div className="input-icon">
        <Search size={17} />
        <input ref={inputRef} className="input" role="combobox" aria-expanded={open && q.length >= 2} aria-controls="search-results" aria-label="Buscar na plataforma"
          placeholder="Buscar em todos os módulos" value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === 'Enter' && flat[active]) go(flat[active].to);
          }} />
        <span className="trail kbd hide-mobile" style={{ right: 12 }}>Ctrl K</span>
      </div>
      {open && q.trim().length >= 2 && (
        <div className="search-results glass-strong" id="search-results" role="listbox">
          {groups.length === 0 ? <p className="small muted" style={{ padding: 16 }}>Nenhum resultado para “{q}” nos módulos que você acessa neste ambiente.</p> : groups.map((g) => {
            const m = { icon: ORIGINS[g.mod as OriginId].icon };
            return (
              <div className="search-group" key={g.mod}>
                <div className="search-group-label">{g.label} · {g.items.length}</div>
                {g.items.map((it) => {
                  const idx = flat.indexOf(it);
                  return (
                    <button key={it.to} role="option" aria-selected={idx === active} className="menu-item" data-active={idx === active} onMouseEnter={() => setActive(idx)} onClick={() => go(it.to)} style={{ width: 'calc(100% - 12px)', margin: '0 6px' }}>
                      <span className="mod-icon" style={{ width: 32, height: 32, borderRadius: 10 }}><m.icon size={15} /></span>
                      <span style={{ minWidth: 0 }}><span className="strong" style={{ display: 'block' }}>{it.title}</span><span className="xs muted">{it.sub}</span></span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Header({ onMenu, onPresenter }: { onMenu: () => void; onPresenter: () => void }) {
  const { session, setSession } = useDemo();
  return (
    <header className="header glass">
      <button className="icon-btn only-mobile" onClick={onMenu} aria-label="Abrir menu"><Menu size={20} /></button>
      <GlobalSearch />
      <span className="spacer hide-mobile" />
      <button className="demo-pill hide-mobile" onClick={onPresenter} title="Abrir painel do apresentador"><Presentation size={13} />Demonstração</button>
      <EnvironmentSwitcher />
      <Notifications />
      <button className="icon-btn hide-mobile" aria-label={session.theme === 'light' ? 'Usar aparência escura' : 'Usar aparência clara'} onClick={() => setSession({ theme: session.theme === 'light' ? 'dark' : 'light' })}>
        {session.theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
      </button>
      <UserMenu />
    </header>
  );
}
