// Configuração das integrações. Nesta versão TODOS os adaptadores são SIMULADOS (dados demonstrativos).
// Na etapa de integração, preencha endereços e credenciais (via variáveis de ambiente / cofre do backend,
// nunca no navegador). Destinos reais (ex.: abrir no Teams ou no SharePoint) só são usados quando configurados.
export interface IntegrationInfo {
  id: string;
  name: string;
  system: string;
  mode: 'simulado' | 'real';
  endpoint?: string;
  futuro: string; // como será a integração real
  participa: string; // como participa da experiência
}

const env = (k: string): string | undefined => (import.meta.env as Record<string, string | undefined>)[k] || undefined;

export const INTEGRATIONS: IntegrationInfo[] = [
  { id: 'entra', name: 'Conta Microsoft', system: 'Microsoft Entra ID', mode: env('VITE_ENTRA_TENANT') ? 'real' : 'simulado', endpoint: env('VITE_ENTRA_TENANT'),
    futuro: 'OIDC com Entra ID → sessão no backend (Supabase Auth). Conta liberada previamente pela TI.', participa: 'Entrada e seleção dos ambientes autorizados.' },
  { id: 'sharepoint', name: 'Intranet', system: 'SharePoint Online (sistema interno)', mode: env('VITE_SHAREPOINT_SITE') ? 'real' : 'simulado', endpoint: env('VITE_SHAREPOINT_SITE'),
    futuro: 'Microsoft Graph: lista/páginas de notícias do site da intranet, filtradas pelo alcance (grupo ou ambiente).', participa: 'Comunicados e notícias no Início; leitura com identificação da origem.' },
  { id: 'feedback', name: 'Feedback', system: 'SharePoint Online (sistema interno)', mode: env('VITE_FEEDBACK_URL') ? 'real' : 'simulado', endpoint: env('VITE_FEEDBACK_URL'),
    futuro: 'Graph/lista do app de Feedback: ciclos e avaliações pendentes da pessoa.', participa: 'Pendências de feedback em Meu trabalho, com destino no próprio sistema.' },
  { id: 'chamados', name: 'Chamados e Acompanhamento', system: 'Sistema próprio → plugin', mode: env('VITE_CHAMADOS_API') ? 'real' : 'simulado', endpoint: env('VITE_CHAMADOS_API'),
    futuro: 'Adaptação do sistema existente ao contrato de plugin: leitura de chamados/tarefas, comentários e transições pela API dele.', participa: 'Chamados atribuídos e abertos, tarefas, painel de trabalho, notificações.' },
  { id: 'teams', name: 'Mensagens', system: 'Microsoft Teams', mode: env('VITE_TEAMS_ENABLED') ? 'real' : 'simulado', endpoint: env('VITE_TEAMS_ENABLED'),
    futuro: 'Graph /me/chats e mensagens de canais permitidos (consentimento Chat.Read); deep link para abrir a conversa.', participa: 'Área compacta de mensagens recentes e acesso à conversa.' },
  { id: 'email', name: 'E-mail', system: 'Exchange Online', mode: env('VITE_MAIL_SENDER') ? 'real' : 'simulado', endpoint: env('VITE_MAIL_SENDER'),
    futuro: 'Envio pelo backend (Graph sendMail ou SMTP) a partir do mesmo evento que gera a notificação interna.', participa: 'Cópia por e-mail das notificações; caixa de saída consultável pelo apresentador.' },
];

export const integration = (id: string) => INTEGRATIONS.find((i) => i.id === id)!;
/** Deep links reais só existem quando o endereço estiver configurado. */
export const teamsLink = (chatName: string) => (integration('teams').mode === 'real' ? `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(chatName)}` : undefined);
export const sharepointLink = (postId: string) => (integration('sharepoint').endpoint ? `${integration('sharepoint').endpoint}/SitePages/${postId}.aspx` : undefined);
