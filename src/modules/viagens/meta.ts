import type { Viagem, ViagemStatus } from '@/platform/types';
import type { Tone } from '@/ui/core';

export const VG_STATUS: Record<ViagemStatus, { label: string; tone: Tone }> = {
  aguardando_emissao: { label: 'Aguardando emissão', tone: 'warn' },
  emitida: { label: 'Emitida', tone: 'info' },
  concluida: { label: 'Concluída', tone: 'neutral' },
};

/** Regra demonstrativa de documentação completa: bilhete de ida, de volta e hospedagem confirmada (quando houver). */
export function docsChecklist(v: Viagem) {
  const ida = v.trechos.find((t) => t.tipo === 'ida');
  const volta = v.trechos.find((t) => t.tipo === 'volta');
  const items = [
    { label: 'Bilhete de ida emitido', ok: !!ida?.localizador },
    { label: 'Bilhete de volta emitido', ok: !!volta?.localizador },
  ];
  if (v.hospedagem) items.push({ label: 'Hospedagem confirmada', ok: v.hospedagem.confirmado });
  return { items, complete: items.every((i) => i.ok) };
}
