import { Plane } from 'lucide-react';
import type { ModuleManifest } from '@/platform/types';
import { viagensContrib } from './contrib';
import MinhasViagens from './MinhasViagens';
import ViagemDetail from './ViagemDetail';
import CompraExterna from './CompraExterna';

export const viagens: ModuleManifest = {
  id: 'viagens',
  name: 'Viagens',
  description: 'Viagens corporativas: trechos, hospedagem, documentos e compras por exceção.',
  icon: Plane,
  basePath: '/viagens/minhas',
  version: '1.2.0',
  menu: [
    { label: 'Minhas viagens', path: '/viagens/minhas' },
    { label: 'Registrar compra externa', path: '/viagens/compras/nova', requires: 'registrar_compra' },
  ],
  actions: [
    { id: 'ver', label: 'Consultar viagens' },
    { id: 'registrar_compra', label: 'Registrar compra externa' },
  ],
  requirements: ['Identidade central da plataforma', 'Leitura de documentos (OCR) — futura', 'Armazenamento de bilhetes'],
  business: true,
  contributes: viagensContrib,
  routes: [
    { path: '/viagens/minhas', element: MinhasViagens },
    { path: '/viagens/compras/nova', element: CompraExterna },
    { path: '/viagens/:id', element: ViagemDetail },
  ],
};
