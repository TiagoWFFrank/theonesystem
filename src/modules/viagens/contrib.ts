import { Plane, Ticket } from 'lucide-react';
import type { ModuleManifest } from '@/platform/types';

const plus = (iso: string, d: number) => new Date(new Date(iso).getTime() + d * 86400000).toISOString();

export const viagensContrib: ModuleManifest['contributes'] = {
  recordPath: (id) => `/viagens/${id}`,
  queues: (c) => [
    ...(c.can('viagens', 'registrar_compra') && !c.isLeader ? [{
      id: 'emiss', origin: 'viagens' as const, label: 'Emissões pendentes', to: '/viagens/minhas?ver=todas&situacao=aguardando_emissao',
      items: c.data.viagens.filter((v) => v.companyId === c.company && v.status === 'aguardando_emissao').map((v) => ({
        key: `viagens:emiss:${v.id}`, origin: 'viagens' as const, companyId: v.companyId, recordId: v.id, userId: c.me.id, relation: 'responsavel' as const,
        ref: v.codigo, title: `Emitir passagem para ${v.destino}`, subject: c.userName(v.viajanteId), status: 'Aguardando emissão', tone: 'warn' as const, stage: 'acao' as const,
        due: plus(v.inicio, -7), dueLabel: 'Emitir até', action: { label: 'Abrir viagem', kind: 'abrir' as const, to: `/viagens/${v.id}` },
      })),
    }] : []),
    {
      id: 'pass', origin: 'viagens', label: 'Passagens disponíveis', to: '/viagens/minhas?ver=minhas&situacao=emitida',
      items: c.data.viagens.filter((v) => v.companyId === c.company && v.viajanteId === c.me.id && v.status === 'emitida').sort((a, b) => a.inicio.localeCompare(b.inicio)).map((v) => ({
        key: `viagens:pass:${v.id}`, origin: 'viagens' as const, companyId: v.companyId, recordId: v.id, userId: c.me.id, relation: 'destinatario' as const,
        ref: v.codigo, title: `Consultar passagem · ${v.destino}`, subject: v.motivo, status: 'Emitida', tone: 'info' as const, stage: 'informativo' as const,
        due: v.inicio, dueLabel: 'Embarque', action: { label: 'Abrir passagem', kind: 'abrir' as const, to: `/viagens/${v.id}` },
      })),
    },
  ],
  quickActions: (c) => [
    ...(c.can('viagens', 'registrar_compra') ? [{ id: 'vg-compra', origin: 'viagens' as const, label: 'Registrar compra externa', to: '/viagens/compras/nova', icon: Ticket, weight: c.isLeader ? 15 : 75 }] : []),
    { id: 'vg-minhas', origin: 'viagens', label: 'Minhas viagens', to: '/viagens/minhas', icon: Plane, weight: 25 },
  ],
};
