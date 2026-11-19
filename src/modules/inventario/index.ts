import { Laptop } from 'lucide-react';
import type { ModuleManifest } from '@/platform/types';
import { inventarioContrib } from './contrib';
import EquipamentosList from './EquipamentosList';
import EquipamentoDetail from './EquipamentoDetail';
import EntregaForm from './EntregaForm';
import CadastroForm from './CadastroForm';
import { Manutencoes, Movimentacoes, Relatorios } from './InventarioExtras';
import { InventoryLiveDetail, InventoryLiveList } from '@/modules/real/ReadOnly';

/** Manifesto do plugin: páginas, rotas, menu e permissões que o módulo oferece à plataforma. */
export const inventario: ModuleManifest = {
  id: 'inventario',
  name: 'Inventário',
  description: 'Equipamentos de TI, responsáveis, entregas, devoluções e manutenções.',
  icon: Laptop,
  basePath: '/inventario/consulta',
  version: '2.3.0',
  menu: [
    { label: 'Consultar patrimônio', path: '/inventario/consulta', requires: 'ver' },
  ],
  actions: [
    { id: 'ver', label: 'Consultar equipamentos' },
    { id: 'cadastrar', label: 'Cadastrar equipamento' },
    { id: 'registrar_entrega', label: 'Registrar entrega' },
  ],
  requirements: ['Identidade central da plataforma', 'Armazenamento de documentos (termos)'],
  business: true,
  contributes: inventarioContrib,
  routes: [
    { path: '/inventario/consulta', element: InventoryLiveList, mode: 'real', requires: 'ver' },
    { path: '/inventario/consulta/:id', element: InventoryLiveDetail, mode: 'real', requires: 'ver' },
    { path: '/inventario/equipamentos', element: EquipamentosList },
    { path: '/inventario/equipamentos/novo', element: CadastroForm },
    { path: '/inventario/equipamentos/:id', element: EquipamentoDetail },
    { path: '/inventario/equipamentos/:id/entrega', element: EntregaForm },
    { path: '/inventario/movimentacoes', element: Movimentacoes },
    { path: '/inventario/manutencoes', element: Manutencoes },
    { path: '/inventario/relatorios', element: Relatorios },
  ],
};
