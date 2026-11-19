import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, createMemoryRouter, Navigate, RouterProvider, type RouteObject } from 'react-router-dom';
import { DemoProvider } from '@/platform/store';
import { ToastProvider } from '@/ui/toast';
import { AppShell, ModuleGate } from '@/layout/AppShell';
import { ALL_MODULES } from '@/layout/modules';
import { Convite, Login, Recuperar } from '@/pages/Entrada';
import Inicio from '@/pages/Inicio';
import Pendencias from '@/pages/Pendencias';
import Preferencias from '@/pages/Preferencias';
import NotFoundPage from '@/pages/NotFound';
import ExportRequestPage from '@/pages/ExportRequest';
import { IntranetList, IntranetPostPage } from '@/pages/Intranet';

const routes: RouteObject[] = [
  { path: '/entrar', element: <Login /> },
  { path: '/convite', element: <Convite /> },
  { path: '/recuperar-acesso', element: <Recuperar /> },
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Navigate to="/inicio" replace /> },
      { path: '/inicio', element: <Inicio /> },
      { path: '/pendencias', element: <Pendencias /> },
      { path: '/preferencias', element: <Preferencias /> },
      { path: '/exportacoes/:id', element: <ExportRequestPage /> },
      { path: '/intranet', element: <IntranetList /> },
      { path: '/intranet/:id', element: <IntranetPostPage /> },
      ...ALL_MODULES.flatMap((module) => module.routes.map((route) => {
        const menu = module.menu
          .filter((item) => route.path === item.path || route.path.startsWith(item.path + '/'))
          .sort((a, b) => b.path.length - a.path.length)[0];
        return {
          path: route.path,
          element: <ModuleGate module={module.id} element={route.element} mode={route.mode} requires={route.requires ?? menu?.requires} />,
        };
      })),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

const router = import.meta.env.MODE === 'singlefile'
  ? createMemoryRouter(routes, { initialEntries: ['/inicio'] })
  : createHashRouter(routes);

export function mountApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <DemoProvider>
        <ToastProvider>
          <RouterProvider router={router} future={{ v7_startTransition: true }} />
        </ToastProvider>
      </DemoProvider>
    </StrictMode>,
  );
}
