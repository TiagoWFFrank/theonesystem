// Painel pessoal: a plataforma coleta as CONTRIBUIÇÕES declaradas no contrato de cada plugin
// (filas de trabalho, ações rápidas, destinos de navegação) e das fontes externas (adaptadores).
// As filas usam as mesmas regras dos filtros das listas de destino: a contagem é igual às linhas.
import { ALL_MODULES } from '@/layout/modules';
import { effectiveGrant, inScope, isLeader, moduleAvailability } from './permissions';
import { SOURCE_ADAPTERS } from './sources';
import type { BrandId, ContribCtx, DemoData, ModuleId, OriginId, QuickAction, User, WorkItem, WorkQueue, WorkStage } from './types';

export function makeCtx(data: DemoData, me: User, company: BrandId): ContribCtx {
  const grant = (m: ModuleId) => (moduleAvailability(data, company, m) === 'ok' ? effectiveGrant(data, me, company, m) : null);
  return {
    data, me, company,
    can: (m, a) => !!grant(m)?.actions.includes(a),
    scope: (m) => grant(m)?.scope ?? null,
    userName: (id) => data.users.find((u) => u.id === id)?.name ?? '—',
    isLeader: isLeader(data, me),
    sees: (m, ownerId) => { const g = grant(m); return !!g && inScope(g.scope, me, ownerId, data.users); },
  };
}

/** Filas de trabalho do usuário no ambiente: plugins habilitados + fontes externas. */
export function collectWork(data: DemoData, me: User | undefined, company: BrandId): WorkQueue[] {
  if (!me) return [];
  const c = makeCtx(data, me, company);
  const out: WorkQueue[] = [];
  for (const m of ALL_MODULES) {
    if (!m.contributes?.queues || moduleAvailability(data, company, m.id) !== 'ok') continue;
    if (!effectiveGrant(data, me, company, m.id)) continue;
    out.push(...m.contributes.queues(c));
  }
  for (const s of SOURCE_ADAPTERS) if (s.queues) out.push(...s.queues(c));
  out.push(...coreQueues(c));
  // garante a identificação da contribuição (módulo, ambiente, registro, destinatário)
  for (const q of out) for (const it of q.items) { it.origin ??= q.origin; it.userId ??= me.id; }
  return out.filter((q) => q.items.length > 0);
}

export function collectQuickActions(data: DemoData, me: User | undefined, company: BrandId): QuickAction[] {
  if (!me) return [];
  const c = makeCtx(data, me, company);
  const out: QuickAction[] = [];
  for (const m of ALL_MODULES) {
    if (!m.contributes?.quickActions || moduleAvailability(data, company, m.id) !== 'ok' || !effectiveGrant(data, me, company, m.id)) continue;
    out.push(...m.contributes.quickActions(c));
  }
  return out.sort((a, b) => b.weight - a.weight);
}

/** Destino de navegação de um registro, declarado pelo plugin. */
export function recordPath(origin: OriginId, recordId: string, data?: DemoData): string {
  const m = ALL_MODULES.find((x) => x.id === origin);
  return m?.contributes?.recordPath?.(recordId, data ? { data } : undefined) ?? SOURCE_ADAPTERS.find((s) => s.id === origin)?.recordPath?.(recordId) ?? '/inicio';
}

/** Operações de painel declaradas pelo plugin de origem (se houver). */
export function taskOpsFor(origin: OriginId) {
  return ALL_MODULES.find((x) => x.id === origin)?.contributes?.taskOps;
}

/** Ordenação comum: decisões, ações, andamento; depois prioridade normalizada e prazo. */
export const STAGE_ORDER: WorkStage[] = ['aprovacao', 'acao', 'andamento', 'acompanhando', 'informativo'];
export const sortWork = (a: WorkItem, b: WorkItem) =>
  STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage)
  || (a.priority?.rank ?? 9) - (b.priority?.rank ?? 9)
  || (a.due ?? '9').localeCompare(b.due ?? '9');

export const STAGE_LABEL: Record<WorkStage, string> = {
  acao: 'Precisa de você', andamento: 'Em andamento', aprovacao: 'Aprovações', acompanhando: 'Acompanhando', informativo: 'Para consultar',
};

export const totalWork = (qs: WorkQueue[]) => qs.reduce((s, q) => s + q.items.length, 0);

/** Contribuições da própria plataforma (serviços comuns, como exportações solicitadas). */
function coreQueues(c: ContribCtx): WorkQueue[] {
  const mine = c.data.exportRequests.filter((x) => x.companyId === c.company && x.requesterId === c.me.id && (x.status === 'pendente' || x.status === 'aprovada'));
  return [{
    id: 'exp-minhas', origin: 'admin', label: 'Minhas exportações', to: mine[0] ? `/exportacoes/${mine[0].id}` : '/inicio',
    items: mine.map((x) => ({
      key: `core:exp:${x.id}`, origin: x.module, companyId: x.companyId, recordId: x.id, userId: c.me.id, relation: 'solicitante' as const,
      ref: x.numero, title: x.status === 'aprovada' ? 'Exportação aprovada: baixar arquivo' : 'Exportação aguardando a Gerência', subject: `${x.content.recordIds.length} registros · ${x.content.fields.length} campos · ${x.content.formato}`,
      status: x.status === 'aprovada' ? 'Aprovada' : 'Aguardando Gerência', tone: x.status === 'aprovada' ? 'ok' as const : 'neutral' as const,
      stage: x.status === 'aprovada' ? 'acao' as const : 'acompanhando' as const,
      action: { label: x.status === 'aprovada' ? 'Baixar' : 'Acompanhar', kind: 'abrir' as const, to: `/exportacoes/${x.id}` },
    })),
  }];
}

/** Origens que contribuem para o painel da pessoa no ambiente (para avisos de disponibilidade). */
export function contributingOrigins(data: DemoData, me: User | undefined, company: BrandId): OriginId[] {
  if (!me) return [];
  const mods = ALL_MODULES.filter((m) => m.contributes?.queues && moduleAvailability(data, company, m.id) === 'ok' && effectiveGrant(data, me, company, m.id)).map((m) => m.id as OriginId);
  return [...mods, ...SOURCE_ADAPTERS.filter((s) => s.queues).map((s) => s.id as OriginId)];
}
