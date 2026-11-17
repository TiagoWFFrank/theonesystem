import { useDemo } from '@/platform/store';
import { PLUGINS } from '@/modules/plugins';
import { admin } from '@/modules/admin';
import type { ModuleManifest } from '@/platform/types';

export const ALL_MODULES: ModuleManifest[] = [...PLUGINS, admin];

/** Módulos que o perfil ativo enxerga na empresa ativa (instalados, habilitados e com permissão). */
export function useVisibleModules(): (ModuleManifest & { maintenance: boolean })[] {
  const { grant, available } = useDemo();
  return ALL_MODULES.filter((m) => available(m.id) !== 'nao_instalado' && grant(m.id)).map((m) => ({ ...m, maintenance: available(m.id) === 'manutencao' }));
}
