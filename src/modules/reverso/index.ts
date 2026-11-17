import { PackageOpen } from 'lucide-react';
import type { ModuleManifest } from '@/platform/types';
import SolicitacoesList from './SolicitacoesList';
import NovaSolicitacao from './NovaSolicitacao';
import SolicitacaoDetail from './SolicitacaoDetail';

export const reverso: ModuleManifest = {
  id: 'reverso',
  name: 'Reverso',
  description: 'Logística reversa: solicitação, aprovação, etiqueta e rastreio de devoluções.',
  icon: PackageOpen,
  basePath: '/reverso/solicitacoes',
  version: '1.8.2',
  menu: [
    { label: 'Solicitações', path: '/reverso/solicitacoes' },
    { label: 'Nova solicitação', path: '/reverso/solicitacoes/nova', requires: 'abrir' },
  ],
  actions: [
    { id: 'ver', label: 'Consultar solicitações' },
    { id: 'abrir', label: 'Abrir solicitação' },
    { id: 'aprovar', label: 'Aprovar ou devolver' },
    { id: 'expedir', label: 'Incluir etiqueta e rastreio' },
  ],
  requirements: ['Identidade central da plataforma', 'Consulta ao cadastro de clientes', 'Armazenamento de etiquetas'],
  routes: [
    { path: '/reverso/solicitacoes', element: SolicitacoesList },
    { path: '/reverso/solicitacoes/nova', element: NovaSolicitacao },
    { path: '/reverso/solicitacoes/:id', element: SolicitacaoDetail },
  ],
};
