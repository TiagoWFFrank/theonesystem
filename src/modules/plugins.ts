// Registro local de plugins. Na etapa funcional, este registro virá do catálogo da plataforma
// (pacotes verificados, versão, permissões declaradas e empresas habilitadas).
import type { ModuleId, ModuleManifest } from '@/platform/types';
import { inventario } from './inventario';
import { reverso } from './reverso';
import { viagens } from './viagens';
import { reservas } from './reservas';
import { chamados } from './chamados';
import { externalPackageModule } from './ExternalPackagePage';
import { readExternalPackages, readGitInstalledPackages } from '@/platform/externalPackages';

const corePlugins = [chamados, viagens, inventario, reverso, reservas];
const coreIds = new Set(corePlugins.map((plugin) => plugin.id));
const externalPackages = readExternalPackages().filter((plugin) => !coreIds.has(plugin.id));
const gitPackages = readGitInstalledPackages().filter((entry) => !coreIds.has(entry.manifest.id));

export const PLUGINS: ModuleManifest[] = [
  ...corePlugins,
  ...externalPackages.map(externalPackageModule),
  ...gitPackages.map((entry) => externalPackageModule(entry.manifest)),
];
export const pluginById = (id: ModuleId) => PLUGINS.find((p) => p.id === id);
