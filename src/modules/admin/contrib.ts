import { originMeta } from '@/platform/registry';
import { Download, KeyRound, ScrollText, UserPlus } from 'lucide-react';
import type { ModuleManifest, WorkQueue } from '@/platform/types';

const plus = (iso: string, d: number) => new Date(new Date(iso).getTime() + d * 86400000).toISOString();

export const adminContrib: ModuleManifest['contributes'] = {
  recordPath: (id, c) => (c?.data.accessRequests.some((x) => x.id === id) ? `/admin/acessos/${id}` : c?.data.exportRequests.some((x) => x.id === id) ? `/exportacoes/${id}` : `/admin/colaboradores/${id}`),
  queues: (c) => {
    const d = c.data;
    const out: WorkQueue[] = [];
    if (c.can('admin', 'aplicar_acesso')) {
      out.push({ id: 'acess', origin: 'admin', label: 'Acessos para aplicar', to: '/admin/acessos?situacao=pendente',
        items: d.accessRequests.filter((a) => a.companyId === c.company && a.status === 'pendente').map((a) => ({
          key: `admin:acess:${a.id}`, origin: 'admin' as const, companyId: a.companyId, recordId: a.id, userId: c.me.id, relation: 'responsavel' as const,
          ref: a.numero, title: `Aplicar acesso para ${c.userName(a.targetId)}`, subject: `Solicitado por ${c.userName(a.requesterId)}`, status: 'Aguardando TI', tone: 'warn' as const, stage: 'acao' as const,
          due: plus(a.criadoEm, 1), action: { label: 'Revisar e aplicar', kind: 'abrir' as const, to: `/admin/acessos/${a.id}` },
        })) });
      out.push({ id: 'lib', origin: 'admin', label: 'Contas para liberar', to: `/admin/colaboradores?situacao=aguardando&empresa=${c.company}`,
        items: d.users.filter((u) => u.status === 'aguardando' && u.companies.includes(c.company)).map((u) => ({
          key: `admin:lib:${u.id}`, origin: 'admin' as const, companyId: c.company, recordId: u.id, userId: c.me.id, relation: 'responsavel' as const,
          ref: 'CONTA', title: `Liberar conta Microsoft de ${u.name}`, subject: u.sector, status: 'Aguardando liberação', tone: 'warn' as const, stage: 'acao' as const,
          action: { label: 'Abrir ficha', kind: 'abrir' as const, to: `/admin/colaboradores/${u.id}` },
        })) });
    }
    if (c.can('admin', 'solicitar_acesso')) {
      out.push({ id: 'minhas-acess', origin: 'admin', label: 'Acessos solicitados', to: '/admin/acessos?situacao=pendente',
        items: d.accessRequests.filter((a) => a.companyId === c.company && a.requesterId === c.me.id && a.status === 'pendente').map((a) => ({
          key: `admin:minhas:${a.id}`, origin: 'admin' as const, companyId: a.companyId, recordId: a.id, userId: c.me.id, relation: 'solicitante' as const,
          ref: a.numero, title: `Acesso para ${c.userName(a.targetId)}`, subject: 'Aguardando a TI', status: 'Com a TI', tone: 'neutral' as const, stage: 'acompanhando' as const,
          action: { label: 'Acompanhar', kind: 'abrir' as const, to: `/admin/acessos/${a.id}` },
        })) });
    }
    if (c.can('admin', 'exportacoes')) {
      out.push({ id: 'exp-decidir', origin: 'admin', label: 'Exportações para decidir', to: '/admin/exportacoes?aba=solicitacoes&situacao=pendente',
        items: d.exportRequests.filter((x) => x.companyId === c.company && x.status === 'pendente').map((x) => ({
          key: `admin:exp:${x.id}`, origin: 'admin' as const, companyId: x.companyId, recordId: x.id, userId: c.me.id, relation: 'aprovador' as const,
          ref: x.numero, title: `Decidir exportação de ${originMeta(x.module).name}`, subject: `${c.userName(x.requesterId)} · ${x.content.recordIds.length} registros · ${x.content.fields.length} campos · ${x.content.formato}`, status: 'Aguardando Gerência', tone: 'warn' as const, stage: 'aprovacao' as const,
          due: plus(x.criadoEm, 1), action: { label: 'Decidir', kind: 'abrir' as const, to: `/exportacoes/${x.id}` },
        })) });
    }
    return out;
  },
  quickActions: (c) => [
    ...(c.can('admin', 'aplicar_acesso') ? [{ id: 'adm-acess', origin: 'admin' as const, label: 'Aplicar acessos solicitados', to: '/admin/acessos?situacao=pendente', icon: KeyRound, weight: 78 }] : []),
    ...(c.can('admin', 'solicitar_acesso') ? [{ id: 'adm-sol', origin: 'admin' as const, label: 'Solicitar acesso para a equipe', to: '/admin/acessos/nova', icon: UserPlus, weight: 60 }] : []),
    ...(c.can('admin', 'exportacoes') ? [{ id: 'adm-exp', origin: 'admin' as const, label: 'Exportações e solicitações', to: '/admin/exportacoes', icon: Download, weight: 72 }] : []),
    ...(c.can('admin', 'auditoria') ? [{ id: 'adm-aud', origin: 'admin' as const, label: 'Auditoria', to: '/admin/auditoria', icon: ScrollText, weight: 30 }] : []),
  ],
};
