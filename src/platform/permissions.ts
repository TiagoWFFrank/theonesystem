import type { BrandId, DemoData, Grant, ModuleId, RoleId, Scope, User } from './types';

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
  empresa: 'Empresa inteira',
};
const SCOPE_RANK: Record<Scope, number> = { proprios: 0, equipe: 1, empresa: 2 };

/** Soma as permissões de todos os perfis do usuário naquela empresa. */
export function effectiveGrant(data: DemoData, user: User | undefined, company: BrandId, module: ModuleId): Grant | null {
  if (!user || !user.companies.includes(company)) return null;
  let out: Grant | null = null;
  const sources = [...user.roles.map((role) => data.permissions[company]?.[role]?.[module]), user.grants?.[company]?.[module]];
  for (const gr of sources) {
    if (!gr || gr.actions.length === 0) continue;
    if (!out) out = { actions: [...gr.actions], scope: gr.scope };
    else {
      out.actions = Array.from(new Set([...out.actions, ...gr.actions]));
      if (SCOPE_RANK[gr.scope] > SCOPE_RANK[out.scope]) out.scope = gr.scope;
    }
  }
  return out;
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

/** Origem de cada permissão do usuário (perfil x individual) — usada na ficha do colaborador. */
export function grantSources(data: DemoData, user: User, company: BrandId, module: ModuleId) {
  const out: { source: string; grant: Grant; individual: boolean }[] = [];
  for (const role of user.roles) {
    const gr = data.permissions[company]?.[role]?.[module];
    if (gr?.actions.length) out.push({ source: `Perfil ${ROLE_LABEL[role]}`, grant: gr, individual: false });
  }
  const ind = user.grants?.[company]?.[module];
  if (ind?.actions.length) out.push({ source: 'Individual', grant: ind, individual: true });
  return out;
}
