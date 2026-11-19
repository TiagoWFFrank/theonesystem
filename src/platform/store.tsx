// Camada de dados demonstrativos. Persistida no navegador durante a sessão de apresentação.
// Na etapa funcional, cada operação aqui vira uma chamada ao backend do domínio (Supabase/PostgreSQL).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { seedData } from './seed';
import { effectiveGrant, moduleAvailability, inScope, isLeader } from './permissions';
import { uid } from './format';
import { healthLabel, originMeta } from './registry';
import { validateIntegration, type IntegrationId, type Validation } from './integrations';
import { readGitInstalledPackages } from './externalPackages';
import { OpError } from './types';
import type { AuditKind, BrandId, ContribCtx, DemoData, EmailMessage, Grant, HealthId, ModuleId, Notification, PlatformApi, Session, User } from './types';

const DATA_KEY = 'azime-demo-data-v4';
const SESSION_KEY = 'azime-demo-session-v4';

/**
 * Disponibilidade CONHECIDA pela plataforma (diferente do estado real do sistema externo, que o apresentador controla).
 * A plataforma descobre a queda ao consultar e só descobre a volta numa nova tentativa (automática ou manual).
 */
export interface Health {
  status: 'ok' | 'down' | 'checking';
  since?: string;
  /** tentativas de reconexão já feitas */
  attempts: number;
  /** horário (ms) da próxima tentativa automática; ausente = sem agendamento */
  nextAt?: number;
  /** tentativas automáticas ativas */
  auto: boolean;
  restoredAt?: number;
  lastCheck?: string;
}
/** Intervalos das tentativas automáticas (curtos para a apresentação). */
export const RETRY_DELAYS = [15_000, 30_000, 60_000];
const delayFor = (attempts: number) => RETRY_DELAYS[Math.min(attempts, RETRY_DELAYS.length - 1)];
const CHECK_LATENCY = 800;

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function withGitPluginStates(data: DemoData): DemoData {
  for (const entry of readGitInstalledPackages()) {
    const saved = data.plugins.find((plugin) => plugin.id === entry.manifest.id);
    const status = entry.install.active === false ? 'desativado' : 'instalado';
    const companies = entry.install.enabledBrands ?? [];
    if (!saved) data.plugins.push({ id: entry.manifest.id, version: entry.manifest.version, status, maintenance: false, companies: [...companies] });
    else { saved.version = entry.manifest.version; saved.status = status; saved.companies = [...companies]; }
  }
  return data;
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* armazenamento indisponível: segue em memória */
  }
}


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
  log: (e: { module: ModuleId; recordId: string; recordLabel: string; action: string; kind?: AuditKind; companyId?: BrandId; actorId?: string }) => string;
  /** notificação interna + e-mail (canais definidos) */
  notify: (n: Omit<Notification, 'id' | 'ts' | 'read'>, opts?: { email?: boolean }) => void;
  markRead: (ids: string[]) => void;
  /** a plataforma sabe que a fonte/sistema está indisponível (ou verificando) */
  down: (id: HealthId) => boolean;
  health: Partial<Record<HealthId, Health>>;
  /** nova tentativa de conexão (manual) */
  checkNow: (id: HealthId) => void;
  setAutoRetry: (id: HealthId, on: boolean) => void;
  /** chamada ao sistema de origem (lança OpError quando não responde) */
  call: (id: HealthId) => void;
  validations: Partial<Record<IntegrationId, Validation>>;
  validate: (id: IntegrationId) => Promise<Validation>;
  isLeader: boolean;
  /** contexto para contribuições dos plugins */
  contrib: ContribCtx | null;
  api: PlatformApi | null;
  touchRecent: (item: { module: ModuleId; recordId: string; label: string; action: string; link: string }) => void;
  userName: (id?: string) => string;
  reset: () => void;
  dirty: boolean;
  setDirty: (v: boolean) => void;
  pluginAuthReady: boolean;
  pluginAuthIdentity: string;
}

const DemoCtx = createContext<Ctx | null>(null);

/** Sessão vigente, legível fora do ciclo de renderização (ex.: ao desmontar uma tela com operação pendente). */
let liveSession: Session = defaultSession;
export const getLiveSession = () => liveSession;

export function DemoProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DemoData>(() => withGitPluginStates(load<DemoData>(DATA_KEY) ?? seedData()));
  const [session, setSessionState] = useState<Session>(() => ({ ...defaultSession, ...load<Session>(SESSION_KEY), sim: 'normal' }));
  const [dirty, setDirty] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  liveSession = session;
  const [health, setHealth] = useState<Partial<Record<HealthId, Health>>>(() =>
    Object.fromEntries(Object.entries(session.outages ?? {}).filter(([, v]) => v).map(([k]) => [k, { status: 'down', since: new Date().toISOString(), attempts: 0, auto: true, nextAt: Date.now() + RETRY_DELAYS[0] }])));
  const healthRef = useRef(health);
  healthRef.current = health;
  const [validations, setValidations] = useState<Partial<Record<IntegrationId, Validation>>>({});
  const [pluginAuthReady, setPluginAuthReady] = useState(!import.meta.env.DEV);
  const [pluginAuthIdentity, setPluginAuthIdentity] = useState('');
  const pluginAccessToken = useRef<string | null>(null);

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
    const meta = document.querySelector('meta[name="theme-color"]') ?? Object.assign(document.head.appendChild(document.createElement('meta')), { name: 'theme-color' });
    meta.setAttribute('content', getComputedStyle(el).getPropertyValue('--amb-base').trim() || '#ffffff');
  }, [session.companyId, session.theme, session.reduceTransparency, session.reduceMotion]);

  const update = useCallback((fn: (d: DemoData) => void) => {
    setData((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);
  const setSession = useCallback((patch: Partial<Session>) => setSessionState((s) => ({ ...s, ...patch })), []);

  // ---------- disponibilidade ----------
  const reportFailure = useCallback((id: HealthId) => {
    setHealth((h) => {
      const cur = h[id];
      if (!cur || cur.status === 'ok') return { ...h, [id]: { status: 'down', since: new Date().toISOString(), attempts: 0, auto: true, nextAt: Date.now() + delayFor(0), lastCheck: new Date().toISOString() } };
      const attempts = cur.attempts + 1;
      return { ...h, [id]: { ...cur, status: 'down', attempts, lastCheck: new Date().toISOString(), nextAt: cur.auto ? Date.now() + delayFor(attempts) : undefined } };
    });
  }, []);
  const reportSuccess = useCallback((id: HealthId) => {
    const cur = healthRef.current[id];
    if (!cur || cur.status === 'ok') return;
    const now = new Date().toISOString();
    healthRef.current = { ...healthRef.current, [id]: { status: 'ok', attempts: 0, auto: true, restoredAt: Date.now(), lastCheck: now } };
    setHealth(healthRef.current);
    // conteúdo atualizado na reconexão
    setData((d) => ({ ...d, sync: { ...d.sync, [id]: now } }));
  }, []);
  const checkNow = useCallback((id: HealthId) => {
    setHealth((h) => (h[id] && h[id]!.status !== 'ok' ? { ...h, [id]: { ...h[id]!, status: 'checking', nextAt: undefined } } : h));
    setTimeout(() => (sessionRef.current.outages?.[id] ? reportFailure(id) : reportSuccess(id)), CHECK_LATENCY);
  }, [reportFailure, reportSuccess]);
  const setAutoRetry = useCallback((id: HealthId, on: boolean) => {
    setHealth((h) => (h[id] ? { ...h, [id]: { ...h[id]!, auto: on, nextAt: on && h[id]!.status === 'down' ? Date.now() + delayFor(h[id]!.attempts) : undefined } } : h));
  }, []);
  // queda detectada na próxima consulta à fonte
  useEffect(() => {
    for (const [k, v] of Object.entries(session.outages ?? {})) if (v && (!health[k as HealthId] || health[k as HealthId]!.status === 'ok')) reportFailure(k as HealthId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.outages]);
  // agenda a próxima tentativa automática (a mais próxima entre as fontes)
  useEffect(() => {
    const due = Object.entries(health).filter(([, h]) => h?.status === 'down' && h.auto && h.nextAt).sort((a, b) => a[1]!.nextAt! - b[1]!.nextAt!)[0];
    if (!due) return;
    const t = setTimeout(() => checkNow(due[0] as HealthId), Math.max(0, due[1]!.nextAt! - Date.now()));
    return () => clearTimeout(t);
  }, [health, checkNow]);
  const call = useCallback((id: HealthId) => {
    if (sessionRef.current.outages?.[id]) { reportFailure(id); throw new OpError('indisponivel', `${healthLabel(id)} não respondeu. Nada foi alterado e seu texto foi mantido.`); }
    reportSuccess(id);
  }, [reportFailure, reportSuccess]);
  const validate = useCallback(async (id: IntegrationId) => {
    const v = await validateIntegration(id);
    setValidations((x) => ({ ...x, [id]: v }));
    return v;
  }, []);

  const me = data.users.find((u) => u.id === session.userId);
  const company = session.companyId;
  const leader = isLeader(data, me);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const previous = window.horizonAuth;
    const getDemoAccessToken = async () => pluginAccessToken.current;
    window.horizonAuth = { ...previous, getPluginAccessToken: getDemoAccessToken };
    return () => {
      if (window.horizonAuth?.getPluginAccessToken === getDemoAccessToken) {
        if (previous) window.horizonAuth = previous;
        else delete window.horizonAuth;
      }
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let active = true;
    pluginAccessToken.current = null;
    setPluginAuthReady(false);
    setPluginAuthIdentity('');
    if (!me || !session.userId) {
      setPluginAuthReady(true);
      return () => { active = false; };
    }
    fetch('/api/dev/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: me.id, brandId: company, brands: me.companies, leader, admin: me.roles.includes('ti') }),
    }).then(async (response) => {
      const result = await response.json() as { accessToken?: string };
      if (!response.ok || !result.accessToken) throw new Error('No demo plugin session');
      if (active) {
        pluginAccessToken.current = result.accessToken;
        setPluginAuthIdentity(me.id + ':' + company);
        setPluginAuthReady(true);
      }
    }).catch(() => { if (active) setPluginAuthReady(true); });
    return () => { active = false; };
  }, [session.userId, company, me?.id, me?.companies.join(','), leader]);

  const value = useMemo<Ctx>(() => {
    const grant = (m: ModuleId) => (moduleAvailability(data, company, m) === 'nao_instalado' ? null : effectiveGrant(data, me, company, m));
    return {
      data, session, me, company, update, setSession, dirty, setDirty, pluginAuthReady, pluginAuthIdentity,
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
          d.events.push({ id, ts: new Date().toISOString(), companyId: e.companyId ?? sessionRef.current.companyId, actorId: e.actorId ?? sessionRef.current.userId ?? '', module: e.module, recordId: e.recordId, recordLabel: e.recordLabel, action: e.action, kind: e.kind });
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
                id: uid('em'), ts, toUserId: u.id, to: u.email, subject: `[${originMeta(n.module).name}] ${n.title} · ${n.subject}`,
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
      down: (id) => !!health[id] && health[id]!.status !== 'ok',
      health, checkNow, setAutoRetry, call, validations, validate,
      isLeader: isLeader(data, me),
      contrib: null,
      api: null,
      reset: () => {
        setData(withGitPluginStates(seedData()));
        setHealth({});
        setSessionState((s) => ({ ...s, sim: 'normal', outages: {} }));
      },
    };
  }, [data, session, me, company, update, setSession, dirty, health, checkNow, setAutoRetry, call, validations, validate, pluginAuthReady, pluginAuthIdentity]);

  const full = useMemo<Ctx>(() => {
    if (!me) return value;
    const contrib: ContribCtx = {
      data, me, company, can: value.can, scope: (m) => value.grant(m)?.scope ?? null, userName: value.userName,
      isLeader: value.isLeader, sees: value.sees,
    };
    const api: PlatformApi = { ctx: contrib, update, log: value.log, notify: value.notify, call: value.call };
    return { ...value, contrib, api };
  }, [value, data, me, company, update]);

  // gancho de testes automatizados (somente em desenvolvimento)
  if (import.meta.env.DEV) (window as unknown as { __azimeDemo?: unknown }).__azimeDemo = { setSession, update, data, session, health };
  return <DemoCtx.Provider value={full}>{children}</DemoCtx.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoCtx);
  if (!ctx) throw new Error('useDemo fora do DemoProvider');
  return ctx;
}
