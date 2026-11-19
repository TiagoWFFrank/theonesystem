import { PackageOpen } from 'lucide-react';
import type { ModuleManifest } from '@/platform/types';
import { reversoContrib } from './contrib';
import SolicitacoesList from './SolicitacoesList';
import NovaSolicitacao from './NovaSolicitacao';
import SolicitacaoDetail from './SolicitacaoDetail';
import { ReverseLiveDetail, ReverseLiveList } from '@/modules/real/ReadOnly';

export const reverso: ModuleManifest = {
  id: 'reverso',
  name: 'Reverso',
  description: 'Logística reversa: solicitação, aprovação, etiqueta e rastreio de devoluções.',
  icon: PackageOpen,
  basePath: '/reverso/consulta',
  version: '1.8.2',
  menu: [
    { label: 'Consultar solicitações', path: '/reverso/consulta', requires: 'ver' },
  ],
  actions: [
    { id: 'ver', label: 'Consultar solicitações' },
    { id: 'abrir', label: 'Abrir solicitação' },
    { id: 'aprovar', label: 'Aprovar ou devolver' },
    { id: 'expedir', label: 'Incluir etiqueta e rastreio' },
  ],
  requirements: ['Identidade central da plataforma', 'Consulta ao cadastro de clientes', 'Armazenamento de etiquetas'],
  business: true,
  contributes: reversoContrib,
  routes: [
    { path: '/reverso/consulta', element: ReverseLiveList, mode: 'real', requires: 'ver' },
    { path: '/reverso/consulta/:id', element: ReverseLiveDetail, mode: 'real', requires: 'ver' },
    { path: '/reverso/solicitacoes', element: SolicitacoesList },
    { path: '/reverso/solicitacoes/nova', element: NovaSolicitacao },
    { path: '/reverso/solicitacoes/:id', element: SolicitacaoDetail },
  ],
};
