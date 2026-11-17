// Regras e operações do plugin Chamados e Acompanhamento.
// Estas funções representam o ADAPTADOR do sistema de chamados existente: na integração real, cada
// operação chama a API do sistema (comentar, transicionar) e a plataforma mantém histórico, notificação e e-mail.
// Toda operação revalida, com o estado ATUAL, registro, ambiente, permissão e situação antes de alterar.
import { OpError, type ContribCtx, type OpCheck, type TaskOps, type TaskView, type Transition } from '@/platform/types';
import { fmtDate, uid } from '@/platform/format';
import { chStore, type Chamado, type Tarefa } from './model';
import { CH_STATUS, PRIORITY, prio, TF_STATUS } from './meta';

type Rec = { kind: 'chamado'; ch: Chamado } | { kind: 'tarefa'; tf: Tarefa; ch: Chamado };
/** Resolve o registro pelo identificador, sem depender de formato de id. */
export function findRec(c: Pick<ContribCtx, 'data'>, id: string): Rec | null {
  const s = chStore(c.data);
  const tf = s.tarefas.find((t) => t.id === id);
  if (tf) { const ch = s.chamados.find((x) => x.id === tf.chamadoId); return ch ? { kind: 'tarefa', tf, ch } : null; }
  const ch = s.chamados.find((x) => x.id === id);
  return ch ? { kind: 'chamado', ch } : null;
}
const recCompany = (r: Rec) => (r.kind === 'tarefa' ? r.tf.companyId : r.ch.companyId);
const recRef = (r: Rec) => (r.kind === 'tarefa' ? r.tf.codigo : r.ch.numero);
const recStatus = (r: Rec) => (r.kind === 'tarefa' ? TF_STATUS[r.tf.status].label : CH_STATUS[r.ch.status].label);
/** Destino do registro no módulo (a partir do tipo resolvido, não do formato do id). */
export const pathOf = (r: Rec) => (r.kind === 'tarefa' ? `/chamados/tarefas/${r.tf.id}` : `/chamados/${r.ch.id}`);
export const chPathFor = (c: Pick<ContribCtx, 'data'>) => (id: string) => { const r = findRec(c, id); return r ? pathOf(r) : '/chamados'; };

/** Escopo: registros próprios = solicitante, responsável ou revisor; ambiente = todos. */
export function seesChamado(c: ContribCtx, r: Rec) {
  const sc = c.scope('chamados');
  if (!sc || recCompany(r) !== c.company) return false;
  if (sc === 'empresa') return true;
  const ids = r.kind === 'tarefa' ? [r.tf.responsavelId, r.tf.revisorId, r.ch.solicitanteId] : [r.ch.solicitanteId, r.ch.responsavelId];
  return ids.includes(c.me.id) || (r.kind === 'chamado' && chStore(c.data).tarefas.some((t) => t.chamadoId === r.ch.id && t.responsavelId === c.me.id));
}
/** Registro visível para a pessoa no ambiente atual. */
function visible(c: ContribCtx, id: string): Rec | null {
  const r = findRec(c, id);
  return r && seesChamado(c, r) ? r : null;
}

/** Transições válidas para a situação e a permissão da pessoa (painel e módulo). Aprovações ficam fora. */
export function transitionsFor(c: ContribCtx, id: string): Transition[] {
  const r = visible(c, id);
  if (!r) return [];
  const me = c.me.id;
  if (r.kind === 'tarefa') {
    const { tf } = r;
    if (tf.responsavelId !== me || !c.can('chamados', 'atender')) return [];
    if (tf.status === 'a_fazer') return [{ id: 'iniciar', label: 'Iniciar tarefa', primary: true }];
    if (tf.status === 'em_andamento') return [
      { id: 'revisao', label: 'Enviar para revisão', primary: true, hint: `Revisor: ${c.userName(tf.revisorId)}` },
      { id: 'pausar', label: 'Voltar para A fazer' },
    ];
    return [];
  }
  const { ch } = r;
  const out: Transition[] = [];
  if (ch.responsavelId === me && c.can('chamados', 'atender')) {
    if (ch.status === 'aberto') out.push({ id: 'atender', label: 'Iniciar atendimento', primary: true });
    if (ch.status === 'em_atendimento') out.push({ id: 'resolver', label: 'Resolver chamado', primary: true, needsComment: true, hint: 'Descreva a solução' }, { id: 'pedir_info', label: 'Solicitar informação', needsComment: true });
  } else if (ch.status === 'aberto' && c.can('chamados', 'gerenciar')) out.push({ id: 'assumir', label: 'Assumir chamado', primary: true });
  if (ch.solicitanteId === me && c.can('chamados', 'abrir')) {
    if (ch.status === 'aguardando_solicitante') out.push({ id: 'responder', label: 'Responder e devolver ao atendimento', primary: true, needsComment: true });
    if (ch.status === 'resolvido') out.push({ id: 'confirmar', label: 'Confirmar solução', primary: true }, { id: 'reabrir', label: 'Reabrir', needsComment: true });
  }
  return out;
}

/** Decisões de revisão: só no módulo (tela da tarefa), para o revisor. */
export function reviewDecisions(c: ContribCtx, id: string): Transition[] {
  const r = visible(c, id);
  if (!r || r.kind !== 'tarefa' || r.tf.status !== 'em_revisao' || r.tf.revisorId !== c.me.id || !c.can('chamados', 'atender')) return [];
  return [{ id: 'aprovar', label: 'Aprovar e concluir', primary: true }, { id: 'devolver', label: 'Devolver com ajustes', needsComment: true }];
}

const LABEL: Record<string, string> = {
  iniciar: 'Iniciar tarefa', revisao: 'Enviar para revisão', pausar: 'Voltar para A fazer', aprovar: 'Aprovar e concluir', devolver: 'Devolver com ajustes',
  atender: 'Iniciar atendimento', assumir: 'Assumir chamado', resolver: 'Resolver chamado', pedir_info: 'Solicitar informação', responder: 'Responder', confirmar: 'Confirmar solução', reabrir: 'Reabrir',
};
/** Que papel a transição exige: distingue "permissão retirada" de "situação mudou". */
const NEEDS: Record<string, { action: 'atender' | 'abrir' | 'gerenciar'; role: (r: Rec, me: string) => boolean }> = {
  iniciar: { action: 'atender', role: (r, me) => r.kind === 'tarefa' && r.tf.responsavelId === me },
  revisao: { action: 'atender', role: (r, me) => r.kind === 'tarefa' && r.tf.responsavelId === me },
  pausar: { action: 'atender', role: (r, me) => r.kind === 'tarefa' && r.tf.responsavelId === me },
  aprovar: { action: 'atender', role: (r, me) => r.kind === 'tarefa' && r.tf.revisorId === me },
  devolver: { action: 'atender', role: (r, me) => r.kind === 'tarefa' && r.tf.revisorId === me },
  atender: { action: 'atender', role: (r, me) => r.ch.responsavelId === me },
  resolver: { action: 'atender', role: (r, me) => r.ch.responsavelId === me },
  pedir_info: { action: 'atender', role: (r, me) => r.ch.responsavelId === me },
  assumir: { action: 'gerenciar', role: () => true },
  responder: { action: 'abrir', role: (r, me) => r.ch.solicitanteId === me },
  confirmar: { action: 'abrir', role: (r, me) => r.ch.solicitanteId === me },
  reabrir: { action: 'abrir', role: (r, me) => r.ch.solicitanteId === me },
};

function canComment(c: ContribCtx, id: string): OpCheck {
  const r = findRec(c, id);
  if (!r || recCompany(r) !== c.company) return { ok: false, code: 'registro', msg: 'Este registro não pertence ao ambiente atual.' };
  if (!c.scope('chamados')) return { ok: false, code: 'permissao', msg: 'Você não tem mais acesso ao módulo Chamados neste ambiente.' };
  if (!seesChamado(c, r)) return { ok: false, code: 'permissao', msg: `${recRef(r)} não está mais no seu alcance de acesso.` };
  if (!c.can('chamados', 'atender') && !c.can('chamados', 'abrir')) return { ok: false, code: 'permissao', msg: 'Seu acesso atual permite apenas consultar: comentar exige “Abrir chamado” ou “Atender”.' };
  if (r.kind === 'chamado' && r.ch.status === 'fechado') return { ok: false, code: 'situacao', msg: `${recRef(r)} foi fechado; não recebe novos comentários.` };
  return { ok: true };
}

function checkTransition(c: ContribCtx, id: string, tId: string): OpCheck {
  const r = findRec(c, id);
  if (!r || recCompany(r) !== c.company) return { ok: false, code: 'registro', msg: 'Este registro não pertence ao ambiente atual.' };
  if (!c.scope('chamados') || !seesChamado(c, r)) return { ok: false, code: 'permissao', msg: `${recRef(r)} não está mais no seu alcance de acesso.` };
  const valid = [...transitionsFor(c, id), ...reviewDecisions(c, id)].some((t) => t.id === tId);
  if (valid) return { ok: true };
  const need = NEEDS[tId];
  if (need && need.role(r, c.me.id) && !c.can('chamados', need.action))
    return { ok: false, code: 'permissao', msg: `Sua permissão para “${LABEL[tId] ?? tId}” foi retirada. Nada foi alterado.` };
  if (need && !need.role(r, c.me.id))
    return { ok: false, code: 'situacao', msg: `${recRef(r)} mudou de responsável; “${LABEL[tId] ?? tId}” não cabe mais a você.` };
  return { ok: false, code: 'situacao', msg: `${recRef(r)} está agora em “${recStatus(r)}”; “${LABEL[tId] ?? tId}” não se aplica mais.` };
}
const must = (chk: OpCheck) => { if (!chk.ok) throw new OpError(chk.code, chk.msg); };

export const chamadosOps: TaskOps = {
  view: (c, id): TaskView | null => {
    const r = visible(c, id);
    if (!r) return null;
    if (r.kind === 'tarefa') {
      const s = TF_STATUS[r.tf.status];
      const rev = r.tf.status === 'em_revisao' && r.tf.revisorId === c.me.id;
      return { ref: r.tf.codigo, title: r.tf.titulo, status: s.label, tone: s.tone, priority: prio(r.tf.prioridade), due: r.tf.prazo, description: r.tf.descricao, openTo: pathOf(r), companyId: r.tf.companyId,
        facts: [['Chamado', `${r.ch.numero} · ${r.ch.titulo}`], ['Responsável', c.userName(r.tf.responsavelId)], ['Revisor', c.userName(r.tf.revisorId)], ['Prazo', r.tf.prazo ? fmtDate(r.tf.prazo) : '—']],
        notice: rev ? { tone: 'warn', text: 'A revisão é uma aprovação e é decidida dentro do módulo Chamados.', action: { label: 'Abrir para decidir', to: pathOf(r) } } : undefined };
    }
    const s = CH_STATUS[r.ch.status];
    return { ref: r.ch.numero, title: r.ch.titulo, status: s.label, tone: s.tone, priority: prio(r.ch.prioridade), due: r.ch.prazo, description: r.ch.descricao, openTo: pathOf(r), companyId: r.ch.companyId,
      facts: [['Solicitante', c.userName(r.ch.solicitanteId)], ['Responsável', c.userName(r.ch.responsavelId)], ['Fila', `${r.ch.fila} · ${r.ch.categoria}`], ['Prioridade', PRIORITY[r.ch.prioridade].label]] };
  },
  comments: (c, id) => (visible(c, id) ? c.data.comments.filter((x) => x.module === 'chamados' && x.recordId === id).sort((a, b) => a.ts.localeCompare(b.ts)) : []),
  transitions: transitionsFor,
  canComment,
  checkTransition,

  comment: (api, id, text) => {
    const c = api.ctx;
    if (!text.trim()) throw new OpError('validacao', 'Escreva o comentário antes de enviar.');
    must(canComment(c, id));
    api.call('chamados'); // sistema de origem: pode falhar (indisponível)
    const r = findRec(c, id)!;
    const ref = recRef(r); const companyId = recCompany(r);
    const now = new Date().toISOString();
    api.update((d) => {
      d.comments.push({ id: uid('cm'), module: 'chamados', recordId: id, authorId: c.me.id, ts: now, text, via: 'painel' });
      const s = chStore(d);
      const rec = r.kind === 'tarefa' ? s.tarefas.find((x) => x.id === id) : s.chamados.find((x) => x.id === id);
      if (rec) rec.atualizadoEm = now;
      d.sync.chamados = now;
    });
    api.log({ module: 'chamados', recordId: id, recordLabel: ref, action: `Comentário: “${text.length > 80 ? text.slice(0, 80) + '…' : text}”`, kind: 'comentario', companyId });
    const others = r.kind === 'tarefa' ? [r.tf.responsavelId, r.tf.revisorId] : [r.ch.solicitanteId, r.ch.responsavelId];
    for (const u of new Set(others)) if (u !== c.me.id)
      api.notify({ userId: u, module: 'chamados', kind: 'comentario', title: `Novo comentário em ${ref}`, subject: `${c.me.name.split(' ')[0]}: “${text.slice(0, 60)}”`, link: pathOf(r), recordId: id, companyId });
    return `Comentário registrado em ${ref}.`;
  },

  apply: (api, id, tId, comment) => {
    const c = api.ctx;
    must(checkTransition(c, id, tId));
    const valid = [...transitionsFor(c, id), ...reviewDecisions(c, id)].find((t) => t.id === tId)!;
    if (valid.needsComment && !comment?.trim()) throw new OpError('validacao', 'Escreva um comentário para concluir esta ação.');
    api.call('chamados');
    const r = findRec(c, id)!;
    const now = new Date().toISOString();
    const companyId = recCompany(r); const ref = recRef(r);
    // calcula o resultado a partir do estado atual (antes de alterar)
    let action = ''; let msg = ''; const notes: { userId: string; title: string }[] = [];
    if (r.kind === 'tarefa') {
      const tf = r.tf;
      const next = ({ iniciar: 'em_andamento', revisao: 'em_revisao', pausar: 'a_fazer', aprovar: 'concluida', devolver: 'em_andamento' } as Record<string, Tarefa['status']>)[tId];
      action = { iniciar: 'Tarefa iniciada', revisao: `Enviada para revisão de ${c.userName(tf.revisorId)}`, pausar: 'Tarefa voltou para A fazer', aprovar: 'Revisão aprovada · tarefa concluída', devolver: 'Revisão devolvida com ajustes' }[tId]!;
      msg = { iniciar: `${ref} em andamento.`, revisao: `${ref} enviada para revisão de ${c.userName(tf.revisorId)}.`, pausar: `${ref} voltou para A fazer.`, aprovar: `${ref} aprovada e concluída.`, devolver: `${ref} devolvida para ${c.userName(tf.responsavelId)}.` }[tId]!;
      if (tId === 'revisao') notes.push({ userId: tf.revisorId, title: `Tarefa ${ref} aguardando sua revisão` });
      if (tId === 'iniciar' || tId === 'pausar') notes.push({ userId: tf.revisorId, title: `Tarefa ${ref} alterada: ${TF_STATUS[next].label}` });
      if (tId === 'aprovar' || tId === 'devolver') notes.push({ userId: tf.responsavelId, title: tId === 'aprovar' ? `Tarefa ${ref} aprovada` : `Tarefa ${ref} devolvida com ajustes` });
      api.update((d) => {
        const x = chStore(d).tarefas.find((y) => y.id === id)!; x.status = next; x.atualizadoEm = now;
        if (comment?.trim()) d.comments.push({ id: uid('cm'), module: 'chamados', recordId: id, authorId: c.me.id, ts: now, text: comment.trim(), via: 'painel' });
        d.sync.chamados = now;
      });
    } else {
      const ch = r.ch;
      const next = ({ atender: 'em_atendimento', assumir: 'em_atendimento', resolver: 'resolvido', pedir_info: 'aguardando_solicitante', responder: 'em_atendimento', confirmar: 'fechado', reabrir: 'em_atendimento' } as Record<string, Chamado['status']>)[tId];
      action = { atender: 'Atendimento iniciado', assumir: `Assumido por ${c.me.name}`, resolver: 'Chamado resolvido', pedir_info: 'Informação solicitada ao solicitante', responder: 'Solicitante respondeu', confirmar: 'Solução confirmada · chamado fechado', reabrir: 'Chamado reaberto' }[tId]!;
      msg = `${ref}: ${CH_STATUS[next].label.toLowerCase()}.`;
      const other = ch.solicitanteId === c.me.id ? ch.responsavelId : ch.solicitanteId;
      notes.push({ userId: other, title: `Chamado ${ref}: ${CH_STATUS[next].label}` });
      api.update((d) => {
        const x = chStore(d).chamados.find((y) => y.id === id)!; if (tId === 'assumir') x.responsavelId = c.me.id; x.status = next; x.atualizadoEm = now;
        if (comment?.trim()) d.comments.push({ id: uid('cm'), module: 'chamados', recordId: id, authorId: c.me.id, ts: now, text: comment.trim(), via: 'painel' });
        d.sync.chamados = now;
      });
    }
    api.log({ module: 'chamados', recordId: id, recordLabel: ref, action: comment?.trim() ? `${action} — “${comment.trim().slice(0, 80)}”` : action, kind: tId === 'aprovar' || tId === 'devolver' ? 'decisao' : 'tarefa', companyId });
    for (const n of notes) if (n.userId !== c.me.id)
      api.notify({ userId: n.userId, module: 'chamados', kind: 'tarefa', title: n.title, subject: r.kind === 'tarefa' ? r.tf.titulo : r.ch.titulo, link: pathOf(r), recordId: id, companyId });
    return msg;
  },
};
