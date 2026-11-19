import { Plane } from 'lucide-react';
import type { ModuleManifest } from '@/platform/types';
import { viagensContrib } from './contrib';
import MinhasViagens from './MinhasViagens';
import ViagemDetail from './ViagemDetail';
import CompraExterna from './CompraExterna';
import { TravelLiveDetail, TravelLiveList } from '@/modules/real/ReadOnly';

export const viagens: ModuleManifest = {
  id: 'viagens',
  name: 'Viagens',
  description: 'Viagens corporativas: trechos, hospedagem, documentos e compras por exceção.',
  icon: Plane,
  basePath: '/viagens/consulta',
  version: '1.2.0',
  menu: [
    { label: 'Consultar viagens', path: '/viagens/consulta', requires: 'ver' },
  ],
  actions: [
    { id: 'ver', label: 'Consultar viagens' },
    { id: 'registrar_compra', label: 'Registrar compra externa' },
  ],
  requirements: ['Identidade central da plataforma', 'Leitura de documentos (OCR) — futura', 'Armazenamento de bilhetes'],
  business: true,
  contributes: viagensContrib,
  routes: [
    { path: '/viagens/consulta', element: TravelLiveList, mode: 'real', requires: 'ver' },
    { path: '/viagens/consulta/:id', element: TravelLiveDetail, mode: 'real', requires: 'ver' },
    { path: '/viagens/minhas', element: MinhasViagens },
    { path: '/viagens/compras/nova', element: CompraExterna },
    { path: '/viagens/:id', element: ViagemDetail },
  ],
};
