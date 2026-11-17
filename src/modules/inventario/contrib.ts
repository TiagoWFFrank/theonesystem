import { ClipboardList, Laptop, PackageCheck, PackagePlus } from 'lucide-react';
import { fmtDate } from '@/platform/format';
import { EQ_STATUS } from './meta';
import type { ModuleManifest } from '@/platform/types';

const plus = (iso: string, d: number) => new Date(new Date(iso).getTime() + d * 86400000).toISOString();

export const inventarioContrib: ModuleManifest['contributes'] = {
  recordPath: (id) => `/inventario/equipamentos/${id}`,
  queues: (c) => [
    // fila operacional da TI (líderes não recebem filas operacionais, embora possam operar)
    ...(c.can('inventario', 'registrar_entrega') && !c.isLeader ? [{
      id: 'conf', origin: 'inventario' as const, label: 'Equipamentos para conferir', to: '/inventario/equipamentos?situacao=conferencia',
      items: c.data.equipments.filter((e) => e.companyId === c.company && e.status === 'conferencia').map((e) => ({
        key: `inventario:conf:${e.id}`, origin: 'inventario' as const, companyId: e.companyId, recordId: e.id, userId: c.me.id, relation: 'responsavel' as const,
        ref: e.patrimonio, title: `Conferir ${e.descricao}`, subject: e.localizacao, status: 'Aguardando conferência', tone: 'accent' as const, stage: 'acao' as const,
        due: plus(e.ultimaMov, 3), action: { label: 'Conferir', kind: 'abrir' as const, to: `/inventario/equipamentos/${e.id}` },
      })),
    }] : []),
    {
      id: 'aceite', origin: 'inventario', label: 'Entregas para confirmar', to: '/inventario/equipamentos?aceite=pendente',
      items: c.data.equipments.filter((e) => e.companyId === c.company && e.responsavelId === c.me.id && e.aceitePendente).map((e) => ({
        key: `inventario:aceite:${e.id}`, origin: 'inventario' as const, companyId: e.companyId, recordId: e.id, userId: c.me.id, relation: 'destinatario' as const,
        ref: e.patrimonio, title: `Conferir entrega de ${e.descricao}`, subject: 'Entregue pela TI', status: 'Recebimento a confirmar', tone: 'info' as const, stage: 'acao' as const,
        due: plus(e.ultimaMov, 2), action: { label: 'Conferir entrega', kind: 'abrir' as const, to: `/inventario/equipamentos/${e.id}` },
      })),
    },
  ],
  quickActions: (c) => [
    ...(c.can('inventario', 'registrar_entrega') ? [{ id: 'inv-entrega', origin: 'inventario' as const, label: 'Registrar entrega de equipamento', to: '/inventario/equipamentos?situacao=disponivel', icon: PackageCheck, weight: c.isLeader ? 20 : 80 }] : []),
    ...(c.can('inventario', 'cadastrar') ? [{ id: 'inv-novo', origin: 'inventario' as const, label: 'Cadastrar equipamento', to: '/inventario/equipamentos/novo', icon: PackagePlus, weight: c.isLeader ? 10 : 40 }] : []),
    ...(c.scope('inventario') === 'proprios' ? [{ id: 'inv-meus', origin: 'inventario' as const, label: 'Meus equipamentos', to: '/inventario/equipamentos', icon: Laptop, weight: 30 }] : []),
    ...(c.can('inventario', 'registrar_entrega') && !c.isLeader ? [{ id: 'inv-mov', origin: 'inventario' as const, label: 'Entregas e devoluções', to: '/inventario/movimentacoes', icon: ClipboardList, weight: 15 }] : []),
  ],
  search: (c, t) => c.data.equipments
    .filter((e) => e.companyId === c.company && c.sees('inventario', e.responsavelId) && [e.patrimonio, e.descricao, c.userName(e.responsavelId), e.serie].join(' ').toLowerCase().includes(t))
    .map((e) => ({ title: `${e.patrimonio} · ${e.descricao}`, sub: e.responsavelId ? c.userName(e.responsavelId) : 'Sem responsável', to: `/inventario/equipamentos/${e.id}` })),
  exports: {
    label: 'Equipamentos',
    fields: [{ key: 'patrimonio', label: 'Patrimônio' }, { key: 'descricao', label: 'Equipamento' }, { key: 'tipo', label: 'Tipo' }, { key: 'responsavel', label: 'Responsável' }, { key: 'localizacao', label: 'Localização' }, { key: 'situacao', label: 'Situação' }, { key: 'ultimaMov', label: 'Última movimentação' }],
    rows: (c, ids) => c.data.equipments.filter((e) => e.companyId === c.company && (!ids || ids.includes(e.id)) && c.sees('inventario', e.responsavelId))
      .map((e) => ({ id: e.id, label: e.patrimonio, values: { patrimonio: e.patrimonio, descricao: e.descricao, tipo: e.tipo, responsavel: e.responsavelId ? c.userName(e.responsavelId) : '', localizacao: e.localizacao, situacao: EQ_STATUS[e.status].label, ultimaMov: fmtDate(e.ultimaMov) } })),
    history: (c, id) => c.data.events.filter((e) => e.module === 'inventario' && e.recordId === id).map((e) => `${fmtDate(e.ts)} ${e.action}`).join(' | '),
  },
};
