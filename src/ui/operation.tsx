// Execução de operações em registros de plugins (comentar, avançar) com:
//  · revalidação no momento da execução, com o contexto ATUAL (usuário, ambiente, módulo, registro, permissão, situação);
//  · cada nova tentativa monta a operação de novo com o texto e o contexto do momento;
//  · cancelamento quando usuário, ambiente ou registro mudam enquanto a operação está pendente (nada é enviado);
//  · texto preservado como rascunho por pessoa × ambiente × registro, inclusive após falha ou cancelamento.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getLiveSession, useDemo } from '@/platform/store';
import { moduleAvailability } from '@/platform/permissions';
import { originMeta } from '@/platform/registry';
import { taskOpsFor } from '@/platform/work';
import { OpError, type BrandId, type ModuleId, type OpFailure, type OriginId } from '@/platform/types';
import { useToast } from './toast';

/** Latência simulada do sistema de origem. */
export const OP_LATENCY = 900;

// ---------- rascunhos ----------
// guardados também na sessão do navegador: sobrevivem a recarregar a página (não vão para outros dispositivos)
const DRAFTS_KEY = 'azime-demo-drafts-v4';
const drafts = new Map<string, { text: string; ts: string }>((() => {
  try { return Object.entries(JSON.parse(sessionStorage.getItem(DRAFTS_KEY) ?? '{}')) as [string, { text: string; ts: string }][]; } catch { return []; }
})());
const persistDrafts = () => { try { sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(Object.fromEntries(drafts))); } catch { /* sem armazenamento: só memória */ } };
export const draftKey = (userId: string | undefined, company: BrandId, origin: OriginId, recordId: string | null) =>
  userId && recordId ? `${userId}|${company}|${origin}|${recordId}` : null;
/** Texto do compositor guardado por pessoa × ambiente × registro (sobrevive a falhas, trocas e fechamento do painel). */
export function useDraft(key: string | null) {
  const [text, setTextState] = useState(() => (key ? drafts.get(key)?.text ?? '' : ''));
  const [savedAt, setSavedAt] = useState<string | undefined>(() => (key ? drafts.get(key)?.ts : undefined));
  useEffect(() => { setTextState(key ? drafts.get(key)?.text ?? '' : ''); setSavedAt(key ? drafts.get(key)?.ts : undefined); }, [key]);
  const setText = useCallback((v: string) => {
    setTextState(v);
    if (!key) return;
    if (v.trim()) drafts.set(key, { text: v, ts: new Date().toISOString() }); else drafts.delete(key);
    persistDrafts();
  }, [key]);
  return { text, setText, clear: () => setText(''), restoredAt: savedAt };
}
export const peekDraft = (key: string | null) => (key ? drafts.get(key)?.text : undefined);

// ---------- operação ----------
export type Intent = { kind: 'comment' } | { kind: 'transition'; id: string; label: string; needsComment?: boolean };
interface Op { intent: Intent; text?: string; userId: string; companyId: BrandId; recordId: string; attempt: number }
export type OpState =
  | { phase: 'idle'; lastOk?: string }
  | { phase: 'sending'; intent: Intent; attempt: number }
  | { phase: 'failed'; intent: Intent; code: OpFailure; msg: string; retryable: boolean; attempt: number; at: number }
  | { phase: 'cancelled'; intent: Intent; msg: string };

const CANCEL_MSG = {
  usuario: 'a pessoa conectada mudou',
  ambiente: 'o ambiente foi trocado',
  registro: 'outro registro foi aberto',
  fechado: 'o painel foi fechado',
  saida: 'você saiu da tela',
  pessoa: 'você cancelou o envio',
} as const;

export function useRecordOperation(origin: OriginId, recordId: string | null, opts: { getText: () => string; onSuccess: (intent: Intent) => void }) {
  const store = useDemo();
  const ref = useRef(store);
  ref.current = store;
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const toast = useToast();
  const [state, setState] = useState<OpState>({ phase: 'idle' });
  const pending = useRef<{ op: Op; timer: ReturnType<typeof setTimeout> } | null>(null);

  const cancel = useCallback((why: keyof typeof CANCEL_MSG) => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    const what = p.op.intent.kind === 'comment' ? 'O comentário' : `“${p.op.intent.label}”`;
    const msg = `${what} não foi enviado: ${CANCEL_MSG[why]} antes da confirmação. Nada foi alterado${p.op.text ? ' e o texto ficou guardado como rascunho' : ''}.`;
    setState({ phase: 'cancelled', intent: p.op.intent, msg });
    toast(msg, { tone: 'info' });
  }, [toast]);

  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  // troca de usuário, ambiente ou registro durante a operação pendente
  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    if (store.session.userId !== p.op.userId) cancel('usuario');
    else if (store.company !== p.op.companyId) cancel('ambiente');
    else if (recordId !== p.op.recordId) cancel(recordId ? 'registro' : 'fechado');
  }, [store.session.userId, store.company, recordId, cancel]);
  // ao sair da tela com operação pendente
  useEffect(() => () => {
    const p = pending.current; if (!p) return;
    const live = getLiveSession();
    cancelRef.current(live.userId !== p.op.userId ? 'usuario' : live.companyId !== p.op.companyId ? 'ambiente' : 'saida');
  }, []);
  // estado de erro/cancelamento não vale para outro registro, pessoa ou ambiente
  useEffect(() => { if (!pending.current) setState({ phase: 'idle' }); }, [recordId, store.session.userId, store.company]);

  const fail = (op: Op, code: OpFailure, msg: string) =>
    setState({ phase: 'failed', intent: op.intent, code, msg, retryable: code === 'indisponivel', attempt: op.attempt, at: Date.now() });

  const execute = (op: Op) => {
    pending.current = null;
    const cur = ref.current;
    // 1. contexto da operação ainda é o atual?
    if (cur.session.userId !== op.userId || cur.company !== op.companyId) { fail(op, 'contexto', 'O contexto mudou antes do envio. Nada foi alterado.'); return; }
    // 2. plugin habilitado e acessível no ambiente
    const ops = taskOpsFor(origin);
    const name = originMeta(origin).name;
    if (!ops || !cur.contrib || !cur.api) { fail(op, 'modulo', `${name} não oferece esta operação.`); return; }
    const avail = moduleAvailability(cur.data, cur.company, origin as ModuleId);
    if (avail !== 'ok') { fail(op, 'modulo', avail === 'manutencao' ? `${name} entrou em manutenção. Nada foi alterado.` : `${name} não está mais habilitado neste ambiente. Nada foi alterado.`); return; }
    // 3. registro ainda existe, pertence ao ambiente e está no alcance da pessoa
    const v = ops.view(cur.contrib, op.recordId);
    if (!v || v.companyId !== op.companyId) {
      const chk = ops.canComment(cur.contrib, op.recordId);
      fail(op, chk.ok ? 'registro' : chk.code, chk.ok ? 'O registro não está mais disponível para você neste ambiente.' : chk.msg); return;
    }
    // 4. permissão e situação atuais
    const chk = op.intent.kind === 'comment' ? ops.canComment(cur.contrib, op.recordId) : ops.checkTransition(cur.contrib, op.recordId, op.intent.id);
    if (!chk.ok) { fail(op, chk.code, chk.msg); return; }
    // 5. envio ao sistema de origem
    try {
      const msg = op.intent.kind === 'comment' ? ops.comment(cur.api, op.recordId, op.text ?? '') : ops.apply(cur.api, op.recordId, op.intent.id, op.text);
      setState({ phase: 'idle', lastOk: msg });
      optsRef.current.onSuccess(op.intent);
      if (msg) toast(msg);
    } catch (e) {
      const err = e as OpError;
      fail(op, err instanceof OpError ? err.code : 'indisponivel', err.message || 'Falha inesperada. Nada foi alterado.');
    }
  };

  /** Inicia (ou repete) uma operação com o texto e o contexto deste momento. */
  const run = (intent: Intent, attempt = 1) => {
    const cur = ref.current;
    if (!recordId || !cur.me || pending.current) return;
    const text = optsRef.current.getText().trim();
    const needsText = intent.kind === 'comment' || intent.needsComment;
    if (needsText && !text) {
      setState({ phase: 'failed', intent, code: 'validacao', msg: intent.kind === 'comment' ? 'Escreva o comentário antes de enviar.' : 'Esta ação exige um comentário. Escreva-o no campo e confirme de novo.', retryable: false, attempt, at: Date.now() });
      return;
    }
    const op: Op = { intent, text: needsText ? text : undefined, userId: cur.me.id, companyId: cur.company, recordId, attempt };
    setState({ phase: 'sending', intent, attempt });
    pending.current = { op, timer: setTimeout(() => execute(op), OP_LATENCY) };
  };
  const retry = () => { if (state.phase === 'failed') run(state.intent, state.attempt + 1); };
  const dismiss = () => setState({ phase: 'idle' });

  return { state, run, retry, cancel: () => cancel('pessoa'), dismiss, busy: state.phase === 'sending' };
}
