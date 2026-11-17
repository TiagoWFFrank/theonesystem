// "Meu trabalho": tarefas do usuário no ambiente, derivadas dos MESMOS registros e filtros das listas
// que abrem ao clicar. Assim a contagem exibida é sempre igual ao número de linhas da lista de destino.
import { effectiveGrant, moduleAvailability } from './permissions';
import type { BrandId, DemoData, ModuleId, User } from './types';
import type { Tone } from '@/ui/core';

export interface Task {
  id: string;
  title: string;       // assunto
  subject: string;     // complemento
  status: string;      // situação
  tone: Tone;
  due?: string;        // prazo (ISO)
  dueLabel?: string;
  link: string;
  action: string;      // ação possível
}
export interface PendItem {
  id: string;
  module: ModuleId;
  label: string;       // nome da fila
  to: string;          // lista filtrada com as mesmas linhas
  verb: string;
  records: Task[];
}

const plus = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * 86400000).toISOString();

export function computePendencias(data: DemoData, me: User | undefined, company: BrandId): PendItem[] {
  if (!me) return [];
  const name = (id?: string) => data.users.find((u) => u.id === id)?.name ?? '—';
  const g = (m: ModuleId) => (moduleAvailability(data, company, m) === 'ok' ? effectiveGrant(data, me, company, m) : null);
  const can = (m: ModuleId, a: string) => !!g(m)?.actions.includes(a);
  const out: PendItem[] = [];

  if (can('reverso', 'aprovar')) {
    const rs = data.reversos.filter((r) => r.companyId === company && r.status === 'aguardando_aprovacao' && r.aprovadorId === me.id).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
    out.push({ id: 'aprov', module: 'reverso', label: 'Aprovações de reverso', verb: 'aprovar', to: '/reverso/solicitacoes?fila=aprovacao',
      records: rs.map((r) => ({ id: r.id, title: `Aprovar reverso ${r.numero}`, subject: `${r.motivo} · ${r.clienteNome}`, status: 'Aguardando aprovação', tone: 'warn', due: plus(r.criadoEm, 2), link: `/reverso/solicitacoes/${r.id}`, action: 'Analisar' })) });
  }
  if (can('reverso', 'expedir')) {
    const rs = data.reversos.filter((r) => r.companyId === company && r.status === 'aguardando_expedicao');
    out.push({ id: 'exped', module: 'reverso', label: 'Reversos para expedir', verb: 'expedir', to: '/reverso/solicitacoes?fila=expedicao',
      records: rs.map((r) => ({ id: r.id, title: `Incluir etiqueta ${r.numero}`, subject: r.clienteNome, status: 'Aguardando expedição', tone: 'accent', due: plus(r.decisao?.em ?? r.criadoEm, 1), link: `/reverso/solicitacoes/${r.id}`, action: 'Incluir etiqueta' })) });
  }
  if (can('inventario', 'registrar_entrega')) {
    const es = data.equipments.filter((e) => e.companyId === company && e.status === 'conferencia');
    out.push({ id: 'conf', module: 'inventario', label: 'Equipamentos para conferir', verb: 'conferir', to: '/inventario/equipamentos?situacao=conferencia',
      records: es.map((e) => ({ id: e.id, title: `Conferir ${e.patrimonio}`, subject: e.descricao, status: 'Aguardando conferência', tone: 'accent', due: plus(e.ultimaMov, 3), link: `/inventario/equipamentos/${e.id}`, action: 'Conferir' })) });
  }
  if (g('inventario')) {
    const es = data.equipments.filter((e) => e.companyId === company && e.responsavelId === me.id && e.aceitePendente);
    if (es.length || !can('inventario', 'registrar_entrega'))
      out.push({ id: 'aceite', module: 'inventario', label: 'Entregas para confirmar', verb: 'confirmar', to: '/inventario/equipamentos?aceite=pendente',
        records: es.map((e) => ({ id: e.id, title: `Conferir entrega de ${e.patrimonio}`, subject: `${e.descricao} · entregue por TI`, status: 'Recebimento a confirmar', tone: 'info', due: plus(e.ultimaMov, 2), link: `/inventario/equipamentos/${e.id}`, action: 'Conferir entrega' })) });
  }
  if (can('viagens', 'registrar_compra')) {
    const vs = data.viagens.filter((v) => v.companyId === company && v.status === 'aguardando_emissao');
    out.push({ id: 'emiss', module: 'viagens', label: 'Emissões pendentes', verb: 'emitir', to: '/viagens/minhas?ver=todas&situacao=aguardando_emissao',
      records: vs.map((v) => ({ id: v.id, title: `Emitir passagem ${v.codigo}`, subject: `${v.destino} · ${name(v.viajanteId)}`, status: 'Aguardando emissão', tone: 'warn', due: plus(v.inicio, -7), dueLabel: 'Emitir até', link: `/viagens/${v.id}`, action: 'Abrir viagem' })) });
  }
  if (g('viagens')) {
    const vs = data.viagens.filter((v) => v.companyId === company && v.viajanteId === me.id && v.status === 'emitida').sort((a, b) => a.inicio.localeCompare(b.inicio));
    out.push({ id: 'pass', module: 'viagens', label: 'Passagens disponíveis', verb: 'consultar', to: '/viagens/minhas?ver=minhas&situacao=emitida',
      records: vs.map((v) => ({ id: v.id, title: `Consultar passagem ${v.codigo}`, subject: v.destino, status: 'Emitida', tone: 'info', due: v.inicio, dueLabel: 'Embarque', link: `/viagens/${v.id}`, action: 'Abrir passagem' })) });
  }
  if (can('reverso', 'abrir')) {
    const rs = data.reversos.filter((r) => r.companyId === company && r.solicitanteId === me.id && r.status === 'ajuste');
    if (rs.length) out.push({ id: 'ajuste', module: 'reverso', label: 'Solicitações para ajustar', verb: 'ajustar', to: '/reverso/solicitacoes?situacao=ajuste',
      records: rs.map((r) => ({ id: r.id, title: `Ajustar ${r.numero}`, subject: r.decisao?.obs ?? r.clienteNome, status: 'Devolvida para ajuste', tone: 'danger', link: `/reverso/solicitacoes/${r.id}`, action: 'Ajustar' })) });
  }
  if (can('admin', 'aplicar_acesso')) {
    const ar = data.accessRequests.filter((a) => a.companyId === company && a.status === 'pendente');
    out.push({ id: 'acess', module: 'admin', label: 'Acessos para aplicar', verb: 'aplicar', to: '/admin/acessos?situacao=pendente',
      records: ar.map((a) => ({ id: a.id, title: `Aplicar acesso ${a.numero}`, subject: `${name(a.targetId)} · solicitado por ${name(a.requesterId)}`, status: 'Aguardando TI', tone: 'warn', due: plus(a.criadoEm, 1), link: `/admin/acessos/${a.id}`, action: 'Revisar e aplicar' })) });
    const us = data.users.filter((u) => u.status === 'aguardando' && u.companies.includes(company));
    if (us.length) out.push({ id: 'lib', module: 'admin', label: 'Contas para liberar', verb: 'liberar', to: `/admin/colaboradores?situacao=aguardando&empresa=${company}`,
      records: us.map((u) => ({ id: u.id, title: `Liberar conta de ${u.name}`, subject: `${u.sector} · conta Microsoft reconhecida`, status: 'Aguardando liberação', tone: 'warn', link: `/admin/colaboradores/${u.id}`, action: 'Abrir ficha' })) });
  }
  if (can('admin', 'solicitar_acesso')) {
    const ar = data.accessRequests.filter((a) => a.companyId === company && a.requesterId === me.id && a.status === 'pendente');
    if (ar.length) out.push({ id: 'minhas-acess', module: 'admin', label: 'Acessos solicitados', verb: 'acompanhar', to: '/admin/acessos?situacao=pendente',
      records: ar.map((a) => ({ id: a.id, title: `Acompanhar ${a.numero}`, subject: `${name(a.targetId)} · aguardando a TI`, status: 'Com a TI', tone: 'neutral', link: `/admin/acessos/${a.id}`, action: 'Acompanhar' })) });
  }
  return out;
}
