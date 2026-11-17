import { ClipboardCheck, FilePlus2 } from 'lucide-react';
import type { ModuleManifest } from '@/platform/types';

const plus = (iso: string, d: number) => new Date(new Date(iso).getTime() + d * 86400000).toISOString();

export const reversoContrib: ModuleManifest['contributes'] = {
  recordPath: (id) => `/reverso/solicitacoes/${id}`,
  queues: (c) => [
    // aprovação acontece DENTRO do módulo: o painel só abre o registro
    ...(c.can('reverso', 'aprovar') ? [{
      id: 'aprov', origin: 'reverso' as const, label: 'Aprovações de reverso', to: '/reverso/solicitacoes?fila=aprovacao',
      items: c.data.reversos.filter((r) => r.companyId === c.company && r.status === 'aguardando_aprovacao' && r.aprovadorId === c.me.id).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)).map((r) => ({
        key: `reverso:aprov:${r.id}`, origin: 'reverso' as const, companyId: r.companyId, recordId: r.id, userId: c.me.id, relation: 'aprovador' as const,
        ref: r.numero, title: `Aprovar reverso · ${r.motivo}`, subject: r.clienteNome, status: 'Aguardando aprovação', tone: 'warn' as const, stage: 'aprovacao' as const,
        due: plus(r.criadoEm, 2), action: { label: 'Analisar no módulo', kind: 'abrir' as const, to: `/reverso/solicitacoes/${r.id}` },
      })),
    }] : []),
    ...(c.can('reverso', 'expedir') && !c.isLeader ? [{
      id: 'exped', origin: 'reverso' as const, label: 'Reversos para expedir', to: '/reverso/solicitacoes?fila=expedicao',
      items: c.data.reversos.filter((r) => r.companyId === c.company && r.status === 'aguardando_expedicao').map((r) => ({
        key: `reverso:exped:${r.id}`, origin: 'reverso' as const, companyId: r.companyId, recordId: r.id, userId: c.me.id, relation: 'responsavel' as const,
        ref: r.numero, title: 'Incluir etiqueta de postagem', subject: r.clienteNome, status: 'Aguardando expedição', tone: 'accent' as const, stage: 'acao' as const,
        due: plus(r.decisao?.em ?? r.criadoEm, 1), action: { label: 'Incluir etiqueta', kind: 'abrir' as const, to: `/reverso/solicitacoes/${r.id}` },
      })),
    }] : []),
    ...(c.can('reverso', 'abrir') ? [{
      id: 'ajuste', origin: 'reverso' as const, label: 'Solicitações para ajustar', to: '/reverso/solicitacoes?situacao=ajuste',
      items: c.data.reversos.filter((r) => r.companyId === c.company && r.solicitanteId === c.me.id && r.status === 'ajuste').map((r) => ({
        key: `reverso:ajuste:${r.id}`, origin: 'reverso' as const, companyId: r.companyId, recordId: r.id, userId: c.me.id, relation: 'solicitante' as const,
        ref: r.numero, title: 'Ajustar solicitação de reverso', subject: r.decisao?.obs ?? r.clienteNome, status: 'Devolvida para ajuste', tone: 'danger' as const, stage: 'acao' as const,
        action: { label: 'Ajustar', kind: 'abrir' as const, to: `/reverso/solicitacoes/${r.id}` },
      })),
    }] : []),
  ],
  quickActions: (c) => [
    ...(c.can('reverso', 'aprovar') ? [{ id: 'rev-aprov', origin: 'reverso' as const, label: 'Aprovações de reverso', to: '/reverso/solicitacoes?fila=aprovacao', icon: ClipboardCheck, weight: 70 }] : []),
    ...(c.can('reverso', 'abrir') ? [{ id: 'rev-nova', origin: 'reverso' as const, label: 'Abrir solicitação de reverso', to: '/reverso/solicitacoes/nova', icon: FilePlus2, weight: 35 }] : []),
  ],
};
