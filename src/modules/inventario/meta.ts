import { Computer, Laptop, Monitor, Printer, ScanBarcode, Smartphone, type LucideIcon } from 'lucide-react';
import type { Equipment, EquipStatus } from '@/platform/types';
import type { Tone } from '@/ui/core';

export const EQ_STATUS: Record<EquipStatus, { label: string; tone: Tone; next: string }> = {
  disponivel: { label: 'Disponível', tone: 'ok', next: 'Pronto para entrega a um colaborador.' },
  em_uso: { label: 'Em uso', tone: 'info', next: 'Vinculado a um colaborador. Devoluções entram na próxima etapa.' },
  manutencao: { label: 'Em manutenção', tone: 'warn', next: 'Em assistência técnica. A entrega libera quando retornar.' },
  conferencia: { label: 'Aguardando conferência', tone: 'accent', next: 'Recebido do fornecedor. A TI confere itens e número de série.' },
};
export const EQ_TYPES = ['Notebook', 'Monitor', 'Celular', 'Impressora', 'Periférico', 'Desktop'] as const;
export const TYPE_ICON: Record<Equipment['tipo'], LucideIcon> = {
  Notebook: Laptop, Monitor: Monitor, Celular: Smartphone, Impressora: Printer, 'Periférico': ScanBarcode, Desktop: Computer,
};
