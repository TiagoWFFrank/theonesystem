import type { ChamadoStatus, Priority, TarefaStatus } from '@/platform/types';
import type { Tone } from '@/ui/core';

export const CH_STATUS: Record<ChamadoStatus, { label: string; tone: Tone }> = {
  aberto: { label: 'Aberto', tone: 'warn' },
  em_atendimento: { label: 'Em atendimento', tone: 'info' },
  aguardando_solicitante: { label: 'Aguardando solicitante', tone: 'accent' },
  resolvido: { label: 'Resolvido', tone: 'ok' },
  fechado: { label: 'Fechado', tone: 'neutral' },
};
export const TF_STATUS: Record<TarefaStatus, { label: string; tone: Tone }> = {
  a_fazer: { label: 'A fazer', tone: 'neutral' },
  em_andamento: { label: 'Em andamento', tone: 'info' },
  em_revisao: { label: 'Em revisão', tone: 'warn' },
  concluida: { label: 'Concluída', tone: 'ok' },
};
export const PRIORITY: Record<Priority, { label: string; tone: Tone; rank: number }> = {
  urgente: { label: 'Urgente', tone: 'danger', rank: 0 },
  alta: { label: 'Alta', tone: 'warn', rank: 1 },
  media: { label: 'Média', tone: 'neutral', rank: 2 },
  baixa: { label: 'Baixa', tone: 'neutral', rank: 3 },
};
