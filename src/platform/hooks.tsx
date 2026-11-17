import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { useBlocker, useSearchParams, type NavigateFunction } from 'react-router-dom';
import { Confirm } from '@/ui/core';
import { useDemo } from './store';

/** Permite que a troca de empresa (já confirmada pelo usuário) saia do formulário sem segunda confirmação. */
export const guardBypass = { current: false };

/** Protege formulários com alterações pendentes (navegação, troca de empresa e fechamento da aba). */
export function useUnsavedGuard(dirty: boolean) {
  const { setDirty } = useDemo();
  const allow = useRef(false);
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirty && !allow.current && !guardBypass.current && currentLocation.pathname !== nextLocation.pathname);
  const guard = (
    <Confirm open={blocker.state === 'blocked'} title="Descartar alterações?"
      desc="Há informações preenchidas que ainda não foram salvas."
      confirmLabel="Descartar e sair" danger
      onConfirm={() => blocker.proceed?.()} onClose={() => blocker.state === 'blocked' && blocker.reset?.()} />
  );
  const release = useCallback(() => { allow.current = true; setDirty(false); }, [setDirty]);
  return { guard, release };
}

/** Estado de filtros guardado na URL: voltar de um detalhe preserva busca, filtros, ordenação e página. */
export function useUrlState<T extends Record<string, string>>(defaults: T) {
  const [params, setParams] = useSearchParams();
  const values = useMemo(() => {
    const out = { ...defaults };
    for (const k of Object.keys(defaults)) {
      const v = params.get(k);
      if (v != null) (out as Record<string, string>)[k] = v;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  const set = useCallback((patch: Partial<T>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '' || v === (defaults as Record<string, string>)[k]) next.delete(k);
        else next.set(k, String(v));
      }
      if (!('page' in patch)) next.delete('page');
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setParams]);
  return [values, set] as const;
}

export function useSort<T>(rows: T[], key: string, dir: string, getters: Record<string, (r: T) => string | number>) {
  return useMemo(() => {
    const g = getters[key];
    if (!g) return rows;
    return [...rows].sort((a, b) => {
      const x = g(a), y = g(b);
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR');
      return dir === 'desc' ? -c : c;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, key, dir]);
}

export function useRecordVisit(module: Parameters<ReturnType<typeof useDemo>['touchRecent']>[0]['module'], recordId: string | undefined, label: string | undefined, link: string) {
  const { touchRecent } = useDemo();
  useEffect(() => {
    if (recordId && label) touchRecent({ module, recordId, label, action: 'Consultado', link });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);
}

// ---------- Retorno contextual após salvar ----------
const flashes = new Map<string, { tab?: string; highlight?: string }>();
/** Guarda uma indicação (aba / evento destacado) para a próxima abertura do registro. */
export const flash = {
  set: (recordId: string, v: { tab?: string; highlight?: string }) => flashes.set(recordId, v),
  take: (recordId?: string) => {
    if (!recordId) return undefined;
    const v = flashes.get(recordId);
    // remoção adiada: o StrictMode executa inicializadores duas vezes em desenvolvimento
    if (v) setTimeout(() => flashes.delete(recordId), 0);
    return v;
  },
};
/** Volta uma página no histórico (preservando a lista de origem) ou vai para `fallback`. */
export function goBackOr(nav: NavigateFunction, fallback: string) {
  if (navDepth.current > 0) nav(-1);
  else nav(fallback, { replace: true });
}

/** Profundidade de navegação dentro da plataforma (funciona com hash router e memory router). */
export const navDepth = { current: 0 };
export function useTrackNavDepth() {
  const loc = useLocation();
  const type = useNavigationType();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (type === 'PUSH') navDepth.current += 1;
    else if (type === 'POP') navDepth.current = Math.max(0, navDepth.current - 1);
  }, [loc.key, type]);
}
