// Integrações: três situações distintas, sempre identificadas na interface e no painel do apresentador.
//  · simulado    → nenhum endereço configurado; adaptador simulado com dados demonstrativos.
//  · configurado → endereço definido (variável de ambiente), conexão ainda NÃO validada; o adaptador simulado continua em uso.
//  · validado    → o backend confirmou a conexão. O adaptador real só entra em uso quando estiver implementado
//                  (`realAdapter`). Nesta versão nenhum está, então os dados continuam vindo do simulado.
//  · falhou      → a validação foi tentada e não passou.
// Credenciais nunca ficam no navegador: a validação é pedida ao backend de integração (VITE_INTEGRATION_API).
export type IntegrationId = 'entra' | 'sharepoint' | 'feedback' | 'chamados' | 'teams' | 'email';

export interface IntegrationInfo {
  id: IntegrationId;
  name: string;
  system: string;
  envKey: string;
  endpoint?: string;
  /** adaptador real implementado nesta versão do protótipo */
  realAdapter: boolean;
  /** página inicial do sistema a partir do endereço configurado (destino de sistema, não de registro) */
  home?: (endpoint: string) => string;
  futuro: string;
  participa: string;
}

const env = (k: string): string | undefined => (import.meta.env as Record<string, string | undefined>)[k]?.trim() || undefined;
export const INTEGRATION_API = env('VITE_INTEGRATION_API');

const BASE: Omit<IntegrationInfo, 'endpoint'>[] = [
  { id: 'entra', name: 'Conta Microsoft', system: 'Microsoft Entra ID', envKey: 'VITE_ENTRA_TENANT', realAdapter: false,
    futuro: 'OIDC com Entra ID → sessão no backend. Conta liberada previamente pela TI.', participa: 'Entrada e seleção dos ambientes autorizados.' },
  { id: 'sharepoint', name: 'Intranet', system: 'SharePoint Online', envKey: 'VITE_SHAREPOINT_SITE', realAdapter: false, home: (e) => e,
    futuro: 'Microsoft Graph: páginas de notícias do site da intranet (webUrl de cada página), filtradas pelo alcance.', participa: 'Comunicados no Início e leitura com identificação da origem.' },
  { id: 'feedback', name: 'Feedback', system: 'SharePoint Online', envKey: 'VITE_FEEDBACK_URL', realAdapter: false, home: (e) => e,
    futuro: 'Graph/lista do app de Feedback: ciclos e avaliações pendentes da pessoa, com o endereço de cada item.', participa: 'Pendências de feedback em Meu trabalho, respondidas no próprio sistema.' },
  { id: 'chamados', name: 'Chamados e Acompanhamento', system: 'Sistema próprio → plugin', envKey: 'VITE_CHAMADOS_API', realAdapter: false,
    futuro: 'Adaptação do sistema existente ao contrato de plugin: leitura, comentários e transições pela API dele.', participa: 'Chamados e tarefas, painel de trabalho, notificações e exportação.' },
  { id: 'teams', name: 'Mensagens', system: 'Microsoft Teams', envKey: 'VITE_TEAMS_TENANT', realAdapter: false, home: (t) => `https://teams.microsoft.com/?tenantId=${encodeURIComponent(t)}`,
    futuro: 'Graph /me/chats e canais permitidos (Chat.Read); cada conversa traz o próprio webUrl.', participa: 'Mensagens recentes e acesso à conversa.' },
  { id: 'email', name: 'E-mail', system: 'Exchange Online', envKey: 'VITE_MAIL_SENDER', realAdapter: false,
    futuro: 'Envio pelo backend (Graph sendMail) a partir do mesmo evento que gera a notificação interna.', participa: 'Cópia por e-mail das notificações; caixa de saída do apresentador.' },
];
export const INTEGRATIONS: IntegrationInfo[] = BASE.map((i) => ({ ...i, endpoint: env(i.envKey) }));

export const integration = (id: string) => INTEGRATIONS.find((i) => i.id === id);

export interface Validation { at: string; ok: boolean; detail: string }
export type IntegrationState = 'simulado' | 'configurado' | 'validado' | 'falhou';
export interface IntegrationStatus { state: IntegrationState; adapter: 'simulado' | 'real'; label: string; detail: string; tone: 'neutral' | 'info' | 'ok' | 'danger' }

export function integrationStatus(id: string, v?: Validation): IntegrationStatus {
  const i = integration(id);
  if (!i) return { state: 'simulado', adapter: 'simulado', label: 'Plataforma', detail: 'Serviço interno', tone: 'neutral' };
  if (!i.endpoint) return { state: 'simulado', adapter: 'simulado', label: 'Simulado', detail: 'Sem endereço configurado · adaptador simulado com dados demonstrativos', tone: 'neutral' };
  if (!v) return { state: 'configurado', adapter: 'simulado', label: 'Configurado · não validado', detail: `Endereço ${i.endpoint} · conexão ainda não validada · adaptador simulado em uso`, tone: 'info' };
  if (!v.ok) return { state: 'falhou', adapter: 'simulado', label: 'Falha na validação', detail: `${v.detail} · adaptador simulado em uso`, tone: 'danger' };
  const real = i.realAdapter;
  return { state: 'validado', adapter: real ? 'real' : 'simulado', label: real ? 'Conectado' : 'Conexão validada', detail: real ? `Dados de ${i.endpoint}` : 'Conexão validada pelo backend · adaptador real ainda não implementado: dados do adaptador simulado', tone: 'ok' };
}

/** Validação pedida ao backend de integração (que guarda as credenciais). */
export async function validateIntegration(id: string): Promise<Validation> {
  const at = new Date().toISOString();
  const i = integration(id);
  if (!i?.endpoint) return { at, ok: false, detail: 'Sem endereço configurado' };
  if (!INTEGRATION_API) return { at, ok: false, detail: 'Backend de integração não configurado (VITE_INTEGRATION_API): a validação não pode ser feita pelo navegador' };
  try {
    const r = await fetch(`${INTEGRATION_API.replace(/\/$/, '')}/integracoes/${id}/status`, { headers: { Accept: 'application/json' } });
    if (!r.ok) return { at, ok: false, detail: `Backend respondeu ${r.status}` };
    const j = (await r.json()) as { ok?: boolean; detalhe?: string };
    return { at, ok: !!j.ok, detail: j.detalhe ?? (j.ok ? 'Conexão confirmada' : 'Conexão recusada pelo sistema') };
  } catch (e) {
    return { at, ok: false, detail: `Backend de integração inacessível (${(e as Error).message})` };
  }
}

export interface Destination { href?: string; label: string; reason?: string }
/**
 * Destino para abrir um REGISTRO no sistema de origem: só o endereço fornecido pela origem (webUrl).
 * Registros do adaptador simulado não têm endereço real.
 */
export function recordDestination(id: string, originUrl: string | undefined, label: string, v?: Validation): Destination {
  if (originUrl) return { href: originUrl, label };
  const st = integrationStatus(id, v);
  return { label, reason: st.adapter === 'simulado' ? 'Registro demonstrativo (adaptador simulado): não existe endereço real para abrir' : 'A origem não informou o endereço deste registro' };
}
/** Destino de SISTEMA (página inicial) a partir do endereço configurado. */
export function systemDestination(id: string, label: string): Destination {
  const i = integration(id);
  if (i?.endpoint && i.home) return { href: i.home(i.endpoint), label };
  return { label, reason: `Endereço de ${i?.system ?? 'origem'} não configurado (${i?.envKey ?? ''})` };
}
