import { PLUGINS } from '../plugins';
import type { AccessRequest, ModuleId } from '@/platform/types';
import type { Tone } from '@/ui/core';

export const ADMIN_ACTIONS = [
  { id: 'colaboradores', label: 'Consultar colaboradores' },
  { id: 'solicitar_acesso', label: 'Solicitar acessos da equipe' },
  { id: 'aplicar_acesso', label: 'Aplicar alterações de acesso' },
  { id: 'exportacoes', label: 'Configurar exportações' },
  { id: 'plugins', label: 'Gerenciar plugins' },
];

/** Módulos e ações declaradas (plugins + administração). */
export function moduleCatalog() {
  return [...PLUGINS.map((p) => ({ id: p.id, name: p.name, icon: p.icon, actions: p.actions })), { id: 'admin' as ModuleId, name: 'Administração', icon: undefined, actions: ADMIN_ACTIONS }];
}
export const actionLabel = (m: ModuleId, a: string) => moduleCatalog().find((x) => x.id === m)?.actions.find((y) => y.id === a)?.label ?? a;
export const moduleName = (m: ModuleId) => moduleCatalog().find((x) => x.id === m)?.name ?? m;

export const AR_STATUS: Record<AccessRequest['status'], { label: string; tone: Tone }> = {
  pendente: { label: 'Aguardando TI', tone: 'warn' },
  aplicada: { label: 'Aplicada', tone: 'ok' },
  recusada: { label: 'Recusada', tone: 'neutral' },
};
