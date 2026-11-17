// Registro dos dados iniciais fornecidos pelos plugins (cada plugin declara o seu em `data.seed`).
import { seedChamadosStore } from './chamados/seed';
import type { ModuleId } from '@/platform/types';

export const PLUGIN_SEEDS: Partial<Record<ModuleId, () => unknown>> = {
  chamados: seedChamadosStore,
};
