import type { BrandId, DemoData, Grant, ModuleId, RoleId, Scope, User } from './types';

/** Cargos: organizam a administração e servem de MODELO para concessões. Não concedem acesso sozinhos. */
export const ROLE_LABEL: Record<RoleId, string> = {
  colaborador: 'Colaborador',
  gestor: 'Líder',
  compras: 'Compras',
  expedicao: 'Expedição',
  ti: 'TI',
  gerencia: 'Gerência',
};
export const ROLES: RoleId[] = ['colaborador', 'gestor', 'compras', 'expedicao', 'ti', 'gerencia'];

export const SCOPE_LABEL: Record<Scope, string> = {
  proprios: 'Registros próprios',
  equipe: 'Equipe',
  empresa: 'Ambiente inteiro',
};

/** Módulos de negócio e todas as suas operações (acesso total dos líderes definidos na configuração inicial). */
export const BUSINESS_ACTIONS: Partial<Record<ModuleId, string[]>> = {
  inventario: ['ver', 'cadastrar', 'registrar_entrega'],
  reverso: ['ver', 'abrir', 'aprovar', 'expedir'],
  viagens: ['ver', 'registrar_compra'],
  reservas: ['ver', 'reservar'],
  chamados: ['ver', 'abrir', 'atender', 'gerenciar'],
};

export const isLeader = (data: DemoData, user?: User) => !!user && data.config.leaders.includes(user.id);

/**
 * Acesso efetivo:
 *  - Líder (configuração inicial) → todas as ações dos módulos de negócio, em todos os ambientes vinculados.
 *  - Demais colaboradores → exatamente a concessão individual por ambiente × módulo (ações + escopo).
 *    Assim a TI concede e RETIRA uma ação de uma pessoa sem interferência de cargo.
 */
export function effectiveGrant(data: DemoData, user: User | undefined, company: BrandId, module: ModuleId): Grant | null {
  if (!user || user.status !== 'ativo' || !user.companies.includes(company)) return null;
  if (isLeader(data, user) && BUSINESS_ACTIONS[module]) return { actions: [...BUSINESS_ACTIONS[module]!], scope: 'empresa' };
  const gr = user.grants?.[company]?.[module];
  return gr && gr.actions.length ? { actions: [...gr.actions], scope: gr.scope } : null;
}

export type Availability = 'ok' | 'nao_instalado' | 'manutencao';
export function moduleAvailability(data: DemoData, company: BrandId, module: ModuleId): Availability {
  if (module === 'admin') return 'ok';
  const p = data.plugins.find((x) => x.id === module);
  if (!p || p.status !== 'instalado' || !p.companies.includes(company)) return 'nao_instalado';
  if (p.maintenance) return 'manutencao';
  return 'ok';
}

/** O registro pertencente a `ownerId` está no escopo do usuário? */
export function inScope(scope: Scope, user: User, ownerId: string | undefined, users: User[]): boolean {
  if (scope === 'empresa') return true;
  if (!ownerId) return false;
  if (ownerId === user.id) return true;
  if (scope === 'equipe') return users.find((u) => u.id === ownerId)?.managerId === user.id;
  return false;
}

/** Origem da permissão exibida na ficha do colaborador. */
export function grantSources(data: DemoData, user: User, company: BrandId, module: ModuleId) {
  const g = effectiveGrant(data, user, company, module);
  if (!g) return [];
  return [{ source: isLeader(data, user) && BUSINESS_ACTIONS[module] ? 'Líder · configuração inicial' : 'Concessão individual', grant: g, individual: !(isLeader(data, user) && BUSINESS_ACTIONS[module]) }];
}
