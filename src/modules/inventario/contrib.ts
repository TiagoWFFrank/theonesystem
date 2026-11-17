import { ClipboardList, Laptop, PackageCheck, PackagePlus } from 'lucide-react';
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
};
