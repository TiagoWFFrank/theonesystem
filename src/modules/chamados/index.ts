import { Headset } from 'lucide-react';
import type { ModuleManifest } from '@/platform/types';
import { ChamadoDetail, ChamadosList, TarefaDetail, TarefasList } from './pages';
import { chamadosContrib } from './contrib';
import { seedChamadosStore } from './seed';

/**
 * Plugin DEMONSTRATIVO que representa a incorporação do sistema próprio de Chamados e Acompanhamento.
 * Pontos de integração/adaptação do sistema real: ver INTEGRACOES.md (adaptador em ./ops.ts).
 */
export const chamados: ModuleManifest = {
  id: 'chamados',
  name: 'Chamados',
  description: 'Chamados e acompanhamento de tarefas do sistema próprio, incorporado como plugin.',
  icon: Headset,
  basePath: '/chamados',
  version: '0.1.0-demo',
  business: true,
  menu: [
    { label: 'Chamados', path: '/chamados' },
    { label: 'Tarefas', path: '/chamados/tarefas' },
  ],
  actions: [
    { id: 'ver', label: 'Consultar chamados e tarefas' },
    { id: 'abrir', label: 'Abrir chamado' },
    { id: 'atender', label: 'Atender chamados e tarefas atribuídos' },
    { id: 'gerenciar', label: 'Gerenciar filas e assumir chamados' },
  ],
  requirements: ['Identidade central da plataforma', 'API do sistema de Chamados (adaptador)', 'Envio de e-mail'],
  routes: [
    { path: '/chamados', element: ChamadosList },
    { path: '/chamados/tarefas', element: TarefasList },
    { path: '/chamados/tarefas/:id', element: TarefaDetail },
    { path: '/chamados/:id', element: ChamadoDetail },
  ],
  origin: { system: 'Sistema próprio · plugin', integration: 'chamados', outageNote: 'Comentários e transições são enviados quando você confirma; se o sistema continuar fora, nada é alterado e o texto fica guardado. Operações não são reenviadas automaticamente.' },
  data: { seed: seedChamadosStore },
  contributes: chamadosContrib,
};
