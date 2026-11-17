// Modelo de dados do plugin Chamados e Acompanhamento. Pertence ao plugin: o núcleo não importa estes tipos.
import type { BrandId, DemoData } from '@/platform/types';

export type ChPriority = 'baixa' | 'media' | 'alta' | 'urgente';
export type ChamadoStatus = 'aberto' | 'em_atendimento' | 'aguardando_solicitante' | 'resolvido' | 'fechado';
export type TarefaStatus = 'a_fazer' | 'em_andamento' | 'em_revisao' | 'concluida';
export interface Chamado {
  id: string;
  numero: string;
  companyId: BrandId;
  titulo: string;
  descricao: string;
  categoria: string;
  fila: string;
  solicitanteId: string;
  responsavelId: string;
  status: ChamadoStatus;
  prioridade: ChPriority;
  criadoEm: string;
  prazo?: string;
  atualizadoEm: string;
}
export interface Tarefa {
  id: string;
  codigo: string;
  chamadoId: string;
  companyId: BrandId;
  titulo: string;
  descricao: string;
  responsavelId: string;
  revisorId: string;
  status: TarefaStatus;
  prioridade?: ChPriority;
  prazo?: string;
  atualizadoEm: string;
}
export interface ChamadosStore { chamados: Chamado[]; tarefas: Tarefa[] }

/** Acesso ao espaço de dados do plugin dentro dos dados da plataforma. */
export function chStore(d: Pick<DemoData, 'ext'>): ChamadosStore {
  const s = d.ext.chamados as ChamadosStore | undefined;
  return s ?? { chamados: [], tarefas: [] };
}
