// Regras e operações do plugin Chamados e Acompanhamento.
// Estas funções representam o ADAPTADOR do sistema de chamados existente: na integração real, cada
// operação chama a API do sistema (comentar, transicionar) e a plataforma mantém histórico, notificação e e-mail.
import type { Chamado, ContribCtx, PlatformApi, Tarefa, TaskOps, TaskView, Transition } from '@/platform/types';
import { CH_STATUS, PRIORITY, TF_STATUS } from './meta';
import { fmtDate, uid } from '@/platform/format';

type Rec = { kind: 'chamado'; ch: Chamado } | { kind: 'tarefa'; tf: Tarefa; ch: Chamado };
export function findRec(c: Pick<ContribCtx, 'data'>, id: string): Rec | null {
  const tf = c.data.tarefas.find((t) => t.id === id);
  if (tf) return { kind: 'tarefa', tf, ch: c.data.chamados.find((x) => x.id === tf.chamadoId)! };
  const ch = c.data.chamados.find((x) => x.id === id);
  return ch ? { kind: 'chamado', ch } : null;
}
export const chPath = (id: string) => (id.startsWith('t') ? `/chamados/tarefas/${id}` : `/chamados/${id}`);

/** Escopo: registros próprios = solicitante, responsável ou revisor; ambiente = todos. */
export function seesChamado(c: ContribCtx, r: Rec) {
  const sc = c.scope('chamados');
  if (!sc) return false;
  if (sc === 'empresa') return true;
  const ids = r.kind === 'tarefa' ? [r.tf.responsavelId, r.tf.revisorId, r.ch.solicitanteId] : [r.ch.solicitanteId, r.ch.responsavelId];
  return ids.includes(c.me.id) || c.data.tarefas.some((t) => r.kind === 'chamado' && t.chamadoId === r.ch.id && t.responsavelId === c.me.id);
}

/** Transições válidas para a situação e a permissão da pessoa (painel e módulo). Aprovações ficam fora. */
export function transitionsFor(c: ContribCtx, id: string): Transition[] {
  const r = findRec(c, id);
  if (!r || !c.can('chamados', 'atender') && !c.can('chamados', 'abrir')) return [];
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
  if (ch.solicitanteId === me) {
    if (ch.status === 'aguardando_solicitante') out.push({ id: 'responder', label: 'Responder e devolver ao atendimento', primary: true, needsComment: true });
    if (ch.status === 'resolvido') out.push({ id: 'confirmar', label: 'Confirmar solução', primary: true }, { id: 'reabrir', label: 'Reabrir', needsComment: true });
  }
  return out;
}

/** Decisões de revisão: só no módulo (tela da tarefa), para o revisor. */
export function reviewDecisions(c: ContribCtx, id: string): Transition[] {
  const r = findRec(c, id);
  if (!r || r.kind !== 'tarefa' || r.tf.status !== 'em_revisao' || r.tf.revisorId !== c.me.id) return [];
  return [{ id: 'aprovar', label: 'Aprovar e concluir', primary: true }, { id: 'devolver', label: 'Devolver com ajustes', needsComment: true }];
}

function guard(api: PlatformApi) {
  if (api.down('chamados')) throw new Error('O sistema de Chamados não respondeu. Nada foi alterado e seu texto foi mantido; tente novamente em instantes.');
}

export const chamadosOps: TaskOps = {
  supports: (id) => /^[ct]/.test(id),
  view: (c, id): TaskView | null => {
    const r = findRec(c, id);
    if (!r) return null;
    if (r.kind === 'tarefa') {
      const s = TF_STATUS[r.tf.status];
      return { ref: r.tf.codigo, title: r.tf.titulo, status: s.label, tone: s.tone, priority: r.tf.prioridade, due: r.tf.prazo, description: r.tf.descricao, openTo: chPath(id), companyId: r.tf.companyId,
        facts: [['Chamado', `${r.ch.numero} · ${r.ch.titulo}`], ['Responsável', c.userName(r.tf.responsavelId)], ['Revisor', c.userName(r.tf.revisorId)], ['Prazo', r.tf.prazo ? fmtDate(r.tf.prazo) : '—']] };
    }
    const s = CH_STATUS[r.ch.status];
    return { ref: r.ch.numero, title: r.ch.titulo, status: s.label, tone: s.tone, priority: r.ch.prioridade, due: r.ch.prazo, description: r.ch.descricao, openTo: chPath(id), companyId: r.ch.companyId,
      facts: [['Solicitante', c.userName(r.ch.solicitanteId)], ['Responsável', c.userName(r.ch.responsavelId)], ['Fila', `${r.ch.fila} · ${r.ch.categoria}`], ['Prioridade', PRIORITY[r.ch.prioridade].label]] };
  },
  comments: (c, id) => c.data.comments.filter((x) => x.module === 'chamados' && x.recordId === id).sort((a, b) => a.ts.localeCompare(b.ts)),
  transitions: transitionsFor,

  comment: (api, id, text) => {
    guard(api);
    const c = api.ctx; const r = findRec(c, id); if (!r) throw new Error('Registro não encontrado.');
    const ref = r.kind === 'tarefa' ? r.tf.codigo : r.ch.numero;
    const companyId = r.kind === 'tarefa' ? r.tf.companyId : r.ch.companyId;
    const now = new Date().toISOString();
    api.update((d) => {
      d.comments.push({ id: uid('cm'), module: 'chamados', recordId: id, authorId: c.me.id, ts: now, text, via: 'painel' });
      const rec = r.kind === 'tarefa' ? d.tarefas.find((x) => x.id === id)! : d.chamados.find((x) => x.id === id)!;
      rec.atualizadoEm = now; d.sync.chamados = now;
    });
    api.log({ module: 'chamados', recordId: id, recordLabel: ref, action: `Comentário: “${text.length > 80 ? text.slice(0, 80) + '…' : text}”`, kind: 'comentario', companyId });
    const others = r.kind === 'tarefa' ? [r.tf.responsavelId, r.tf.revisorId] : [r.ch.solicitanteId, r.ch.responsavelId];
    for (const u of new Set(others)) if (u !== c.me.id)
      api.notify({ userId: u, module: 'chamados', kind: 'comentario', title: `Novo comentário em ${ref}`, subject: `${c.me.name.split(' ')[0]}: “${text.slice(0, 60)}”`, link: chPath(id), recordId: id, companyId });
  },

  apply: (api, id, tId, comment) => {
    guard(api);
    const c = api.ctx; const r = findRec(c, id); if (!r) throw new Error('Registro não encontrado.');
    const valid = [...transitionsFor(c, id), ...reviewDecisions(c, id)].find((t) => t.id === tId);
    if (!valid) throw new Error('Esta ação não está disponível para a situação atual ou para o seu acesso.');
    if (valid.needsComment && !comment?.trim()) throw new Error('Escreva um comentário para concluir esta ação.');
    const now = new Date().toISOString();
    const companyId = r.kind === 'tarefa' ? r.tf.companyId : r.ch.companyId;
    const ref = r.kind === 'tarefa' ? r.tf.codigo : r.ch.numero;
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
        const x = d.tarefas.find((y) => y.id === id)!; x.status = next; x.atualizadoEm = now;
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
        const x = d.chamados.find((y) => y.id === id)!; if (tId === 'assumir') x.responsavelId = c.me.id; x.status = next; x.atualizadoEm = now;
        if (comment?.trim()) d.comments.push({ id: uid('cm'), module: 'chamados', recordId: id, authorId: c.me.id, ts: now, text: comment.trim(), via: 'painel' });
        d.sync.chamados = now;
      });
    }
    api.log({ module: 'chamados', recordId: id, recordLabel: ref, action: comment?.trim() ? `${action} — “${comment.trim().slice(0, 80)}”` : action, kind: tId === 'aprovar' || tId === 'devolver' ? 'decisao' : 'tarefa', companyId });
    for (const n of notes) if (n.userId !== c.me.id)
      api.notify({ userId: n.userId, module: 'chamados', kind: 'tarefa', title: n.title, subject: r.kind === 'tarefa' ? r.tf.titulo : r.ch.titulo, link: chPath(id), recordId: id, companyId });
    return msg;
  },
};
