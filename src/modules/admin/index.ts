import { ShieldCheck } from 'lucide-react';
import type { ModuleManifest } from '@/platform/types';
import { ColaboradorDetail, ColaboradoresList } from './Colaboradores';
import { AcessoDetail, AcessoNovo, AcessosList } from './Acessos';
import Perfis from './Perfis';
import Exportacoes from './Exportacoes';
import { PluginCatalog, PluginDetail } from './Plugins';
import { ADMIN_ACTIONS } from './meta';
import { adminContrib } from './contrib';
import Auditoria from './Auditoria';

/** Administração é parte do núcleo da plataforma (não pode ser desinstalada). */
export const admin: ModuleManifest = {
  id: 'admin',
  name: 'Administração',
  description: 'Colaboradores, acessos, perfis, exportações e catálogo de plugins.',
  icon: ShieldCheck,
  basePath: '/admin/colaboradores',
  version: '1.1.0',
  core: true,
  menu: [
    { label: 'Colaboradores', path: '/admin/colaboradores', requires: 'colaboradores' },
    { label: 'Solicitações de acesso', path: '/admin/acessos', requires: ['solicitar_acesso', 'aplicar_acesso'] },
    { label: 'Modelos de acesso', path: '/admin/perfis', requires: 'aplicar_acesso' },
    { label: 'Exportações', path: '/admin/exportacoes', requires: 'exportacoes' },
    { label: 'Auditoria', path: '/admin/auditoria', requires: 'auditoria' },
    { label: 'Catálogo de plugins', path: '/admin/plugins', requires: 'plugins' },
  ],
  actions: ADMIN_ACTIONS,
  requirements: [],
  contributes: adminContrib,
  routes: [
    { path: '/admin/colaboradores', element: ColaboradoresList },
    { path: '/admin/colaboradores/:id', element: ColaboradorDetail },
    { path: '/admin/acessos', element: AcessosList },
    { path: '/admin/acessos/nova', element: AcessoNovo },
    { path: '/admin/acessos/:id', element: AcessoDetail },
    { path: '/admin/perfis', element: Perfis },
    { path: '/admin/exportacoes', element: Exportacoes },
    { path: '/admin/auditoria', element: Auditoria },
    { path: '/admin/plugins', element: PluginCatalog },
    { path: '/admin/plugins/:id', element: PluginDetail },
  ],
};
