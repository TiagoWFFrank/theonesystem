// Identificação visual das ORIGENS das informações no painel (plugins e fontes externas).
import { DoorOpen, Headset, Laptop, Mail, MessageSquareHeart, MessagesSquare, Newspaper, PackageOpen, Plane, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { OriginId } from '@/platform/types';

export const ORIGINS: Record<OriginId, { name: string; system: string; icon: LucideIcon; external?: boolean }> = {
  inventario: { name: 'Inventário', system: 'Plugin da plataforma', icon: Laptop },
  reverso: { name: 'Reverso', system: 'Plugin da plataforma', icon: PackageOpen },
  viagens: { name: 'Viagens', system: 'Plugin da plataforma', icon: Plane },
  reservas: { name: 'Reservas', system: 'Plugin da plataforma', icon: DoorOpen },
  chamados: { name: 'Chamados', system: 'Sistema próprio · plugin', icon: Headset },
  admin: { name: 'Administração', system: 'Plataforma', icon: ShieldCheck },
  sharepoint: { name: 'Intranet', system: 'SharePoint', icon: Newspaper, external: true },
  feedback: { name: 'Feedback', system: 'SharePoint', icon: MessageSquareHeart, external: true },
  teams: { name: 'Teams', system: 'Microsoft Teams', icon: MessagesSquare, external: true },
  email: { name: 'E-mail', system: 'Exchange Online', icon: Mail, external: true },
};

export function OriginChip({ origin, withSystem }: { origin: OriginId; withSystem?: boolean }) {
  const o = ORIGINS[origin];
  const I = o.icon;
  return <span className="origin-chip" title={`${o.name} · ${o.system}`}><I size={13} />{o.name}{withSystem && o.external ? ` · ${o.system}` : ''}</span>;
}
