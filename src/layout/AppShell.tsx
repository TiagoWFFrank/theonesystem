import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Presentation } from 'lucide-react';
import { useDemo } from '@/platform/store';
import { useTrackNavDepth } from '@/platform/hooks';
import { Drawer } from '@/ui/core';
import { Ambient, COMPANIES, Logo } from '@/ui/brand';
import { ForbiddenInline, ModuleUnavailable } from '@/pages/NotFound';
import { Header, lastList } from './Header';
import { Sidebar, SidebarNav } from './Sidebar';
import { PresenterPanel } from './Presenter';
import { ALL_MODULES } from './modules';
import type { ModuleId } from '@/platform/types';

export function AppShell() {
  const { me, session, company } = useDemo();
  const loc = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const [presenter, setPresenter] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const prevCompany = useRef(company);
  useTrackNavDepth();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [loc.pathname]);
  // lembra a última lista de cada módulo (tela equivalente na troca de ambiente)
  useEffect(() => {
    for (const m of ALL_MODULES) if (m.menu.some((x) => x.path === loc.pathname)) lastList[m.id] = loc.pathname + loc.search;
  }, [loc.pathname, loc.search]);
  // mudança de contexto: luz da nova marca atravessa a tela
  useEffect(() => {
    if (prevCompany.current !== company) { prevCompany.current = company; setFlashKey((k) => k + 1); }
  }, [company]);
  if (!me) return <Navigate to={`/entrar?voltar=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  const sticky = /\/(entrega|nova|novo)$/.test(loc.pathname);
  return (
    <>
      <Ambient />
      {flashKey > 0 && <div key={flashKey} className="ctx-flash" aria-hidden />}
      <div className={`shell ${session.sidebarCollapsed ? 'collapsed' : ''} ${sticky ? 'has-sticky' : ''}`}>
        <a href="#conteudo" className="sr-only">Pular para o conteúdo</a>
        <Sidebar />
        <div className="main">
          <Header onMenu={() => setMobileNav(true)} onPresenter={() => setPresenter(true)} />
          <main id="conteudo" className="content ctx-enter" key={company} aria-label={`Ambiente ${COMPANIES[company].name}`}>
            <div className="page-enter" key={loc.pathname}><Outlet /></div>
          </main>
        </div>
        <Drawer open={mobileNav} onClose={() => setMobileNav(false)} side="left" title={<div className="product-lockup"><span className="product-name">The One System</span><Logo brand={company} /></div>}>
          <div style={{ margin: -12 }}><SidebarNav onNavigate={() => setMobileNav(false)} /></div>
        </Drawer>
        <button className="presenter-fab glass" onClick={() => setPresenter(true)} aria-label="Abrir painel do apresentador"><Presentation size={17} /><span className="lbl">Demonstração</span></button>
        <PresenterPanel open={presenter} onClose={() => setPresenter(false)} />
      </div>
    </>
  );
}

/** Aplica disponibilidade do módulo (instalação/manutenção) e permissão do perfil antes de renderizar a tela. */
export function ModuleGate({ module, element: El, mode = 'demo', requires }: { module: ModuleId; element: ComponentType; mode?: 'demo' | 'real'; requires?: string | string[] }) {
  const { available, grant, can } = useDemo();
  const m = ALL_MODULES.find((x) => x.id === module)!;
  const a = available(module);
  if (a !== 'ok') return <ModuleUnavailable name={m.name} reason={a} />;
  const allowed = Array.isArray(requires) ? requires.some((action) => can(module, action)) : requires ? can(module, requires) : !!grant(module);
  if (!allowed) return <ForbiddenInline module={m.name} />;
  return (
    <>
      {mode === 'demo' && (
        <div className="banner banner-info" role="note" style={{ marginBottom: 16 }}>
          <span className="b-text"><b>Demonstração · dados fictícios.</b> Esta rota usa apenas o cenário local; nenhum registro real será consultado ou alterado.</span>
        </div>
      )}
      <El />
    </>
  );
}
