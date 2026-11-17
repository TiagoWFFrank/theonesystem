import { Plane, Ticket } from 'lucide-react';
import { fmtDate } from '@/platform/format';
import { VG_STATUS } from './meta';
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
  search: (c, t) => c.data.viagens
    .filter((v) => v.companyId === c.company && c.sees('viagens', v.viajanteId) && [v.codigo, v.destino, c.userName(v.viajanteId)].join(' ').toLowerCase().includes(t))
    .map((v) => ({ title: `${v.codigo} · ${v.destino}`, sub: c.userName(v.viajanteId), to: `/viagens/${v.id}` })),
  exports: {
    label: 'Viagens',
    fields: [{ key: 'codigo', label: 'Código' }, { key: 'viajante', label: 'Viajante' }, { key: 'destino', label: 'Destino' }, { key: 'periodo', label: 'Período' }, { key: 'situacao', label: 'Situação' }],
    rows: (c, ids) => c.data.viagens.filter((v) => v.companyId === c.company && (!ids || ids.includes(v.id)) && c.sees('viagens', v.viajanteId))
      .map((v) => ({ id: v.id, label: v.codigo, values: { codigo: v.codigo, viajante: c.userName(v.viajanteId), destino: v.destino, periodo: `${fmtDate(v.inicio)} a ${fmtDate(v.fim)}`, situacao: VG_STATUS[v.status].label } })),
    history: (c, id) => c.data.events.filter((e) => e.module === 'viagens' && e.recordId === id).map((e) => `${fmtDate(e.ts)} ${e.action}`).join(' | '),
  },
};
