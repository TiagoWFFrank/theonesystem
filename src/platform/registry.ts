// Metadados das ORIGENS (plugins e fontes externas) consultados pelo núcleo.
// Plugins se descrevem no próprio manifesto; o núcleo não conhece nomes de sistemas de cada plugin.
// Acesso preguiçoso ao registro de módulos para evitar dependência circular na inicialização.
import { DoorOpen, FileDown, Mail, MessageSquareHeart, MessagesSquare, Newspaper, ShieldCheck, type LucideIcon } from 'lucide-react';
import { ALL_MODULES } from '@/layout/modules';
import type { HealthId, ModuleManifest, OriginId } from './types';

export interface OriginMeta { name: string; system: string; icon: LucideIcon; external?: boolean; integration?: string; outageNote?: string; plugin?: boolean }

const SOURCES: Record<string, OriginMeta> = {
  sharepoint: { name: 'Intranet', system: 'SharePoint', icon: Newspaper, external: true, integration: 'sharepoint' },
  feedback: { name: 'Feedback', system: 'SharePoint', icon: MessageSquareHeart, external: true, integration: 'feedback', outageNote: 'As pendências exibidas podem estar desatualizadas.' },
  teams: { name: 'Teams', system: 'Microsoft Teams', icon: MessagesSquare, external: true, integration: 'teams' },
  email: { name: 'E-mail', system: 'Exchange Online', icon: Mail, external: true, integration: 'email' },
  arquivos: { name: 'Arquivos', system: 'Serviço de arquivos da plataforma', icon: FileDown },
};

export const manifestOf = (id: string): ModuleManifest | undefined => ALL_MODULES.find((m) => m.id === id);

export function originMeta(id: OriginId | HealthId): OriginMeta {
  if (SOURCES[id]) return SOURCES[id];
  const m = manifestOf(id);
  if (m) return { name: m.name, system: m.origin?.system ?? (m.id === 'admin' ? 'Plataforma' : 'Plugin da plataforma'), icon: m.icon ?? (m.id === 'admin' ? ShieldCheck : DoorOpen), integration: m.origin?.integration, outageNote: m.origin?.outageNote, plugin: m.id !== 'admin' };
  return { name: id, system: 'Plataforma', icon: ShieldCheck };
}

/** Nome usado em avisos de disponibilidade ("O sistema de Chamados", "A intranet"). */
export function healthLabel(id: HealthId): string {
  const o = originMeta(id);
  if (id === 'sharepoint') return 'A intranet';
  if (id === 'arquivos') return 'O serviço de arquivos';
  if (o.plugin && o.integration) return `O sistema de ${o.name}`;
  return `O ${o.name}`;
}

/** Recursos de exportação fornecidos pelo plugin (ou undefined se ele não exporta). */
export const exportsOf = (id: string) => manifestOf(id)?.contributes?.exports;
/** Módulos que oferecem exportação. */
export const exportModules = () => ALL_MODULES.filter((m) => m.contributes?.exports).map((m) => m.id);
