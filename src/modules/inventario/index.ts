import { Laptop } from 'lucide-react';
import type { ModuleManifest } from '@/platform/types';
import EquipamentosList from './EquipamentosList';
import EquipamentoDetail from './EquipamentoDetail';
import EntregaForm from './EntregaForm';
import CadastroForm from './CadastroForm';
import { Manutencoes, Movimentacoes, Relatorios } from './InventarioExtras';

/** Manifesto do plugin: páginas, rotas, menu e permissões que o módulo oferece à plataforma. */
export const inventario: ModuleManifest = {
  id: 'inventario',
  name: 'Inventário',
  description: 'Equipamentos de TI, responsáveis, entregas, devoluções e manutenções.',
  icon: Laptop,
  basePath: '/inventario/equipamentos',
  version: '2.3.0',
  menu: [
    { label: 'Equipamentos', path: '/inventario/equipamentos' },
    { label: 'Entregas e devoluções', path: '/inventario/movimentacoes' },
    { label: 'Manutenções', path: '/inventario/manutencoes' },
    { label: 'Relatórios', path: '/inventario/relatorios', requires: 'cadastrar' },
  ],
  actions: [
    { id: 'ver', label: 'Consultar equipamentos' },
    { id: 'cadastrar', label: 'Cadastrar equipamento' },
    { id: 'registrar_entrega', label: 'Registrar entrega' },
  ],
  requirements: ['Identidade central da plataforma', 'Armazenamento de documentos (termos)'],
  routes: [
    { path: '/inventario/equipamentos', element: EquipamentosList },
    { path: '/inventario/equipamentos/novo', element: CadastroForm },
    { path: '/inventario/equipamentos/:id', element: EquipamentoDetail },
    { path: '/inventario/equipamentos/:id/entrega', element: EntregaForm },
    { path: '/inventario/movimentacoes', element: Movimentacoes },
    { path: '/inventario/manutencoes', element: Manutencoes },
    { path: '/inventario/relatorios', element: Relatorios },
  ],
};
