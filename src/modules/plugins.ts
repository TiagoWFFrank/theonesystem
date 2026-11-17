// Registro local de plugins. Na etapa funcional, este registro virá do catálogo da plataforma
// (pacotes verificados, versão, permissões declaradas e empresas habilitadas).
import type { ModuleId, ModuleManifest } from '@/platform/types';
import { inventario } from './inventario';
import { reverso } from './reverso';
import { viagens } from './viagens';
import { reservas } from './reservas';

export const PLUGINS: ModuleManifest[] = [inventario, reverso, viagens, reservas];
export const pluginById = (id: ModuleId) => PLUGINS.find((p) => p.id === id);
