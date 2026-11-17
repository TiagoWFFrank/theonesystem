// Adaptadores das fontes externas (SIMULADOS). Mesma forma de contribuição dos plugins.
import { recordDestination, systemDestination } from './integrations';
import type { BrandId, ContribCtx, DemoData, IntranetPost, Reach, SourceId, TeamsMessage, User, WorkQueue } from './types';

/** Conteúdo compartilhado com alcance explícito: grupo inteiro ou ambientes específicos. */
export const inReach = (r: Reach, company: BrandId, user?: User) =>
  !!user && (r.tipo === 'grupo' ? true : r.ids.includes(company) && user.companies.includes(company));

export interface SourceAdapter {
  id: SourceId;
  name: string;
  queues?: (c: ContribCtx) => WorkQueue[];
  recordPath?: (id: string) => string;
}

/** Destino do item de Feedback: endereço do item (origem) ou página inicial configurada do sistema. */
function feedbackAction(url?: string) {
  const rec = recordDestination('feedback', url, 'Abrir no Feedback');
  if (rec.href) return { label: rec.label, kind: 'externo' as const, to: rec.href };
  const sys = systemDestination('feedback', 'Abrir o Feedback');
  return { label: sys.label, kind: 'externo' as const, to: sys.href ?? '', reason: sys.href ? undefined : `${rec.reason}; ${sys.reason}` };
}

export const SOURCE_ADAPTERS: SourceAdapter[] = [
  {
    id: 'feedback', name: 'Feedback',
    queues: (c) => [{
      id: 'feedback', origin: 'feedback', label: 'Feedback (SharePoint)', to: '/inicio#feedback',
      items: c.data.feedback.filter((f) => f.userId === c.me.id && f.status === 'pendente' && inReach(f.alcance, c.company, c.me)).map((f) => ({
        key: `feedback:${f.id}`, origin: 'feedback', recordId: f.id, userId: c.me.id, relation: 'destinatario' as const, ref: f.ciclo.replace('Ciclo anual ', 'CICLO '),
        title: f.titulo, subject: `${f.ciclo} · sistema de Feedback`, status: 'Pendente', tone: 'warn' as const, stage: 'acao' as const, due: f.prazo,
        action: feedbackAction(f.url),
      })),
    }],
  },
  { id: 'sharepoint', name: 'Intranet', recordPath: (id) => `/intranet/${id}` },
  { id: 'teams', name: 'Teams', recordPath: () => '/inicio#mensagens' },
];

export const postsFor = (data: DemoData, company: BrandId, user?: User): IntranetPost[] =>
  data.posts.filter((p) => inReach(p.alcance, company, user)).sort((a, b) => Number(!!b.destaque) - Number(!!a.destaque) || b.publicadoEm.localeCompare(a.publicadoEm));

export const teamsFor = (data: DemoData, company: BrandId, user?: User): TeamsMessage[] =>
  data.teams.filter((m) => user && m.userId === user.id && inReach(m.alcance, company, user)).sort((a, b) => b.ts.localeCompare(a.ts));

export const reachLabel = (r: Reach, names: Record<BrandId, { name: string }>) =>
  r.tipo === 'grupo' ? 'Todo o grupo' : r.ids.map((i) => names[i].name).join(' e ');

/** Notificações pessoais do ambiente ativo + as de alcance de grupo (mesma regra no sino e no painel). */
export const notificationsFor = (data: DemoData, user: User | undefined, company: BrandId) =>
  data.notifications.filter((n) => user && n.userId === user.id && (!n.companyId || n.companyId === company)).sort((a, b) => b.ts.localeCompare(a.ts));
export const unreadElsewhere = (data: DemoData, user: User | undefined, company: BrandId) =>
  data.notifications.filter((n) => user && n.userId === user.id && !n.read && n.companyId && n.companyId !== company).length;
