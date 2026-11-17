import { Headset, ListChecks } from 'lucide-react';
import { fmtDate } from '@/platform/format';
import type { ContribCtx, ModuleManifest, WorkItem, WorkStage } from '@/platform/types';
import { chStore } from './model';
import { CH_STATUS, PRIORITY, prio, TF_STATUS } from './meta';
import { chamadosOps, findRec, pathOf, seesChamado } from './ops';

/** Filtros das listas do módulo — as filas do painel usam exatamente as mesmas regras. */
export const chamadoFilters = {
  atribuidos: (c: ContribCtx) => chStore(c.data).chamados.filter((x) => x.companyId === c.company && x.responsavelId === c.me.id && !['resolvido', 'fechado'].includes(x.status)),
  abertos: (c: ContribCtx) => chStore(c.data).chamados.filter((x) => x.companyId === c.company && x.solicitanteId === c.me.id && x.responsavelId !== c.me.id && x.status !== 'fechado'),
  minhasTarefas: (c: ContribCtx) => chStore(c.data).tarefas.filter((t) => t.companyId === c.company && t.responsavelId === c.me.id && t.status !== 'concluida'),
  revisar: (c: ContribCtx) => chStore(c.data).tarefas.filter((t) => t.companyId === c.company && t.revisorId === c.me.id && t.status === 'em_revisao'),
};
const chPath = (id: string) => `/chamados/${id}`;
const tfPath = (id: string) => `/chamados/tarefas/${id}`;

export const chamadosContrib: ModuleManifest['contributes'] = {
  recordPath: (id, c) => { const r = c ? findRec(c, id) : null; return r ? pathOf(r) : '/chamados'; },
  taskOps: chamadosOps,
  queues: (c) => {
    const atrib: WorkItem[] = chamadoFilters.atribuidos(c).map((x) => ({
      key: `chamados:resp:${x.id}`, origin: 'chamados', companyId: x.companyId, recordId: x.id, userId: c.me.id, relation: 'responsavel',
      ref: x.numero, title: x.titulo, subject: `Aberto por ${c.userName(x.solicitanteId)} · ${x.fila}`, status: CH_STATUS[x.status].label, tone: CH_STATUS[x.status].tone,
      stage: (x.status === 'aberto' ? 'acao' : x.status === 'aguardando_solicitante' ? 'acompanhando' : 'andamento') as WorkStage,
      priority: prio(x.prioridade), due: x.prazo, action: { label: x.status === 'aberto' ? 'Atender' : 'Trabalhar', kind: 'painel', to: chPath(x.id) },
    }));
    const abertos: WorkItem[] = chamadoFilters.abertos(c).map((x) => ({
      key: `chamados:sol:${x.id}`, origin: 'chamados', companyId: x.companyId, recordId: x.id, userId: c.me.id, relation: 'solicitante',
      ref: x.numero, title: x.titulo, subject: `Com ${c.userName(x.responsavelId)} · ${x.fila}`, status: CH_STATUS[x.status].label, tone: CH_STATUS[x.status].tone,
      stage: (['aguardando_solicitante', 'resolvido'].includes(x.status) ? 'acao' : 'acompanhando') as WorkStage,
      priority: prio(x.prioridade), due: x.prazo,
      action: { label: x.status === 'aguardando_solicitante' ? 'Responder' : x.status === 'resolvido' ? 'Confirmar' : 'Acompanhar', kind: 'painel', to: chPath(x.id) },
    }));
    const tarefas: WorkItem[] = chamadoFilters.minhasTarefas(c).map((t) => ({
      key: `chamados:tf:${t.id}`, origin: 'chamados', companyId: t.companyId, recordId: t.id, userId: c.me.id, relation: 'responsavel',
      ref: t.codigo, title: t.titulo, subject: `Tarefa do ${chStore(c.data).chamados.find((x) => x.id === t.chamadoId)?.numero}`, status: TF_STATUS[t.status].label, tone: TF_STATUS[t.status].tone,
      stage: (t.status === 'a_fazer' ? 'acao' : t.status === 'em_revisao' ? 'acompanhando' : 'andamento') as WorkStage,
      priority: prio(t.prioridade), due: t.prazo, action: { label: t.status === 'em_revisao' ? 'Ver' : 'Trabalhar', kind: 'painel', to: tfPath(t.id) },
    }));
    const revisar: WorkItem[] = chamadoFilters.revisar(c).map((t) => ({
      key: `chamados:rev:${t.id}`, origin: 'chamados', companyId: t.companyId, recordId: t.id, userId: c.me.id, relation: 'aprovador',
      ref: t.codigo, title: `Revisar: ${t.titulo}`, subject: `Enviada por ${c.userName(t.responsavelId)}`, status: 'Aguardando sua revisão', tone: 'warn',
      stage: 'aprovacao', priority: prio(t.prioridade), due: t.prazo, action: { label: 'Decidir no módulo', kind: 'abrir', to: tfPath(t.id) },
    }));
    return [
      { id: 'ch-resp', origin: 'chamados', label: 'Chamados atribuídos a mim', to: '/chamados?visao=atribuidos', items: atrib },
      { id: 'tf-resp', origin: 'chamados', label: 'Minhas tarefas', to: '/chamados/tarefas?visao=minhas', items: tarefas },
      { id: 'tf-rev', origin: 'chamados', label: 'Revisões de tarefas', to: '/chamados/tarefas?visao=revisar', items: revisar },
      { id: 'ch-sol', origin: 'chamados', label: 'Chamados que abri', to: '/chamados?visao=abertos', items: abertos },
    ];
  },
  quickActions: (c) => [
    { id: 'ch-meus', origin: 'chamados', label: 'Meus chamados', to: '/chamados?visao=atribuidos', icon: Headset, weight: c.isLeader ? 30 : 65 },
    { id: 'tf-minhas', origin: 'chamados', label: 'Minhas tarefas', to: '/chamados/tarefas?visao=minhas', icon: ListChecks, weight: c.isLeader ? 28 : 64 },
  ],
  search: (c, t) => {
    const has = (...s: string[]) => s.join(' ').toLowerCase().includes(t);
    const s = chStore(c.data);
    return [
      ...s.chamados.filter((x) => seesChamado(c, { kind: 'chamado', ch: x }) && has(x.numero, x.titulo)).map((x) => ({ title: `${x.numero} · ${x.titulo}`, sub: `${c.userName(x.solicitanteId)} → ${c.userName(x.responsavelId)}`, to: chPath(x.id) })),
      ...s.tarefas.filter((x) => { const r = findRec(c, x.id); return !!r && seesChamado(c, r) && has(x.codigo, x.titulo); }).map((x) => ({ title: `${x.codigo} · ${x.titulo}`, sub: c.userName(x.responsavelId), to: tfPath(x.id) })),
    ];
  },
  exports: {
    label: 'Chamados',
    fields: [
      { key: 'numero', label: 'Número' }, { key: 'assunto', label: 'Assunto' }, { key: 'solicitante', label: 'Solicitante' }, { key: 'responsavel', label: 'Responsável' },
      { key: 'fila', label: 'Fila' }, { key: 'prioridade', label: 'Prioridade' }, { key: 'situacao', label: 'Situação' }, { key: 'prazo', label: 'Prazo' },
    ],
    rows: (c, ids) => chStore(c.data).chamados
      .filter((x) => (!ids || ids.includes(x.id)) && seesChamado(c, { kind: 'chamado', ch: x }))
      .map((x) => ({ id: x.id, label: x.numero, values: {
        numero: x.numero, assunto: x.titulo, solicitante: c.userName(x.solicitanteId), responsavel: c.userName(x.responsavelId), fila: x.fila,
        prioridade: PRIORITY[x.prioridade].label, situacao: CH_STATUS[x.status].label, prazo: x.prazo ? fmtDate(x.prazo) : '',
      } })),
    history: (c, id) => c.data.events.filter((e) => e.module === 'chamados' && e.recordId === id).map((e) => `${fmtDate(e.ts)} ${e.action}`).join(' | '),
  },
};
