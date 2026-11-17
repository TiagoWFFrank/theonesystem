// Camada de dados demonstrativos. Persistida no navegador durante a sessão de apresentação.
// Na etapa funcional, cada operação aqui vira uma chamada ao backend do domínio (Supabase/PostgreSQL).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { seedData } from './seed';
import { effectiveGrant, moduleAvailability, inScope, isLeader } from './permissions';
import { uid } from './format';
import type { AuditKind, BrandId, ContribCtx, DemoData, EmailMessage, Grant, ModuleId, Notification, OriginId, PlatformApi, Session, SourceId, User } from './types';

const DATA_KEY = 'azime-demo-data-v3';
const SESSION_KEY = 'azime-demo-session-v3';

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* armazenamento indisponível: segue em memória */
  }
}

/** Nome exibido de cada origem (assunto de e-mail, etiquetas) */
export const ORIGIN_NAME: Partial<Record<OriginId, string>> = {
  inventario: 'Inventário', reverso: 'Reverso', viagens: 'Viagens', reservas: 'Reservas', chamados: 'Chamados', admin: 'Administração',
  sharepoint: 'Intranet', feedback: 'Feedback', teams: 'Teams', email: 'E-mail',
};

const defaultSession: Session = { userId: null, companyId: 'azime', theme: 'light', sim: 'normal', sidebarCollapsed: false };

interface Ctx {
  data: DemoData;
  session: Session;
  me: User | undefined;
  company: BrandId;
  /** aplica uma alteração sobre uma cópia dos dados */
  update: (fn: (d: DemoData) => void) => void;
  setSession: (patch: Partial<Session>) => void;
  grant: (m: ModuleId) => Grant | null;
  can: (m: ModuleId, action: string) => boolean;
  available: (m: ModuleId) => ReturnType<typeof moduleAvailability>;
  sees: (m: ModuleId, ownerId?: string) => boolean;
  /** registra no histórico/auditoria e devolve o id do evento */
  log: (e: { module: ModuleId; recordId: string; recordLabel: string; action: string; kind?: AuditKind; companyId?: BrandId }) => string;
  /** notificação interna + e-mail (canais definidos) */
  notify: (n: Omit<Notification, 'id' | 'ts' | 'read'>, opts?: { email?: boolean }) => void;
  markRead: (ids: string[]) => void;
  /** fonte ou módulo indisponível (simulado pelo apresentador) */
  down: (id: SourceId | ModuleId) => boolean;
  isLeader: boolean;
  /** contexto para contribuições dos plugins */
  contrib: ContribCtx | null;
  api: PlatformApi | null;
  touchRecent: (item: { module: ModuleId; recordId: string; label: string; action: string; link: string }) => void;
  userName: (id?: string) => string;
  reset: () => void;
  dirty: boolean;
  setDirty: (v: boolean) => void;
}

const DemoCtx = createContext<Ctx | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DemoData>(() => load<DemoData>(DATA_KEY) ?? seedData());
  const [session, setSessionState] = useState<Session>(() => ({ ...defaultSession, ...load<Session>(SESSION_KEY), sim: 'normal' }));
  const [dirty, setDirty] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => save(DATA_KEY, data), [data]);
  useEffect(() => save(SESSION_KEY, session), [session]);

  // tema e marca aplicados ao documento
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.brand = session.companyId;
    el.dataset.theme = session.theme;
    el.style.colorScheme = session.theme;
    if (session.reduceTransparency) el.dataset.transparency = 'reduced'; else delete el.dataset.transparency;
    if (session.reduceMotion) el.dataset.motion = 'reduced'; else delete el.dataset.motion;
    for (const k of ['sharepoint', 'feedback', 'teams', 'chamados', 'email']) { if (session.outages?.[k as SourceId]) el.dataset[`down${k}`] = '1'; else delete el.dataset[`down${k}`]; }
    const meta = document.querySelector('meta[name="theme-color"]') ?? Object.assign(document.head.appendChild(document.createElement('meta')), { name: 'theme-color' });
    meta.setAttribute('content', getComputedStyle(el).getPropertyValue('--amb-base').trim() || '#ffffff');
  }, [session.companyId, session.theme, session.reduceTransparency, session.reduceMotion, session.outages]);

  const update = useCallback((fn: (d: DemoData) => void) => {
    setData((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);
  const setSession = useCallback((patch: Partial<Session>) => setSessionState((s) => ({ ...s, ...patch })), []);

  const me = data.users.find((u) => u.id === session.userId);
  const company = session.companyId;

  const value = useMemo<Ctx>(() => {
    const grant = (m: ModuleId) => (moduleAvailability(data, company, m) === 'nao_instalado' ? null : effectiveGrant(data, me, company, m));
    return {
      data, session, me, company, update, setSession, dirty, setDirty,
      grant,
      can: (m, action) => !!grant(m)?.actions.includes(action),
      available: (m) => moduleAvailability(data, company, m),
      sees: (m, ownerId) => {
        const gr = grant(m);
        return !!gr && !!me && inScope(gr.scope, me, ownerId, data.users);
      },
      log: (e) => {
        const id = uid('ev');
        update((d) => {
          d.events.push({ id, ts: new Date().toISOString(), companyId: e.companyId ?? sessionRef.current.companyId, actorId: sessionRef.current.userId ?? '', module: e.module, recordId: e.recordId, recordLabel: e.recordLabel, action: e.action, kind: e.kind });
        });
        return id;
      },
      notify: (n, opts) =>
        update((d) => {
          const id = uid('n');
          const ts = new Date().toISOString();
          d.notifications.push({ id, ts, read: false, companyId: sessionRef.current.companyId, ...n });
          if (opts?.email !== false) {
            const u = d.users.find((x) => x.id === n.userId);
            if (u) {
              const mail: EmailMessage = {
                id: uid('em'), ts, toUserId: u.id, to: u.email, subject: `[${ORIGIN_NAME[n.module] ?? n.module}] ${n.title} · ${n.subject}`,
                body: `Olá, ${u.name.split(' ')[0]}.\n\n${n.title}: ${n.subject}.\n\nAbrir na Plataforma AZIME: ${n.link}\n\nMensagem automática · não responda.`,
                module: n.module, recordId: n.recordId, link: n.link, notificationId: id, companyId: n.companyId ?? sessionRef.current.companyId,
              };
              d.emails.push(mail);
            }
          }
        }),
      markRead: (ids) => update((d) => { for (const n of d.notifications) if (ids.includes(n.id)) n.read = true; }),
      touchRecent: (item) =>
        update((d) => {
          const uidv = sessionRef.current.userId;
          if (!uidv) return;
          const prev = (d.recent[uidv] ?? []).find((r) => r.recordId === item.recordId);
          const list = (d.recent[uidv] ?? []).filter((r) => r.recordId !== item.recordId);
          // uma consulta logo após uma alteração mantém a descrição da alteração
          const keepAction = item.action === 'Consultado' && prev && prev.action !== 'Consultado'
            && Date.now() - new Date(prev.ts).getTime() < 10 * 60_000;
          list.unshift({ ...item, companyId: sessionRef.current.companyId, action: keepAction ? prev!.action : item.action, ts: keepAction ? prev!.ts : new Date().toISOString() });
          d.recent[uidv] = list.slice(0, 8);
        }),
      userName: (id) => data.users.find((u) => u.id === id)?.name ?? '—',
      down: (id) => !!session.outages?.[id],
      isLeader: isLeader(data, me),
      contrib: null,
      api: null,
      reset: () => {
        setData(seedData());
        setSessionState((s) => ({ ...s, sim: 'normal' }));
      },
    };
  }, [data, session, me, company, update, setSession, dirty]);

  const full = useMemo<Ctx>(() => {
    if (!me) return value;
    const contrib: ContribCtx = {
      data, me, company, can: value.can, scope: (m) => value.grant(m)?.scope ?? null, userName: value.userName,
      isLeader: value.isLeader,
    };
    const api: PlatformApi = { ctx: contrib, update, log: value.log, notify: value.notify, down: value.down };
    return { ...value, contrib, api };
  }, [value, data, me, company, update]);

  return <DemoCtx.Provider value={full}>{children}</DemoCtx.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoCtx);
  if (!ctx) throw new Error('useDemo fora do DemoProvider');
  return ctx;
}
