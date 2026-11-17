// Identificação visual das ORIGENS das informações no painel (plugins e fontes externas).
// Os dados vêm do manifesto de cada plugin e da lista de fontes (platform/registry).
import { originMeta, type OriginMeta } from '@/platform/registry';
import type { OriginId } from '@/platform/types';

/** Acesso por chave mantido por compatibilidade: ORIGINS[id] → metadados da origem. */
export const ORIGINS = new Proxy({} as Record<OriginId, OriginMeta>, { get: (_t, k: string) => originMeta(k as OriginId) });

export function OriginChip({ origin, withSystem }: { origin: OriginId; withSystem?: boolean }) {
  const o = originMeta(origin);
  const I = o.icon;
  return <span className="origin-chip" title={`${o.name} · ${o.system}`}><I size={13} />{o.name}{withSystem && o.external ? ` · ${o.system}` : ''}</span>;
}
