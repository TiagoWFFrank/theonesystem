import { useDemo } from '@/platform/store';
import { PLUGINS } from '@/modules/plugins';
import { admin } from '@/modules/admin';
import type { ModuleManifest } from '@/platform/types';

export const ALL_MODULES: ModuleManifest[] = [...PLUGINS, admin];

/** Módulos que o perfil ativo enxerga na empresa ativa (instalados, habilitados e com permissão). */
export function useVisibleModules(): (ModuleManifest & { maintenance: boolean })[] {
  const { grant, available, can } = useDemo();
  return ALL_MODULES.filter((m) => {
    const visibleRoute = m.menu.some((item) => !item.requires || (Array.isArray(item.requires) ? item.requires.some((action) => can(m.id, action)) : can(m.id, item.requires)));
    return available(m.id) !== 'nao_instalado' && !!grant(m.id) && visibleRoute;
  }).map((m) => ({ ...m, maintenance: available(m.id) === 'manutencao' }));
}
