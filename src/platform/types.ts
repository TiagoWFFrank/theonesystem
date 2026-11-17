// Tipos centrais da plataforma. O que está aqui é contrato entre a plataforma e os módulos (plugins).
import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';

export type BrandId = 'azime' | 'alinare' | 'novitah';
export type ThemeMode = 'light' | 'dark';

export interface Company {
  id: BrandId;
  name: string;
  legalName: string;
}

export type RoleId = 'colaborador' | 'gestor' | 'compras' | 'expedicao' | 'ti' | 'gerencia';
export type Scope = 'proprios' | 'equipe' | 'empresa';
export type ModuleId = 'inventario' | 'reverso' | 'viagens' | 'reservas' | 'chamados' | 'admin';
/** Fontes externas integradas por adaptador (não são plugins) */
export type SourceId = 'sharepoint' | 'feedback' | 'teams' | 'email';
/** Origem de uma informação no painel: um plugin ou uma fonte externa */
export type OriginId = ModuleId | SourceId;

export interface User {
  id: string;
  name: string;
  email: string;
  sector: string;
  companies: BrandId[];
  roles: RoleId[];
  /** ativo = liberado pela TI · aguardando = conta corporativa ainda não liberada · bloqueado = acesso suspenso (registro preservado) */
  status: 'ativo' | 'aguardando' | 'bloqueado';
  managerId?: string;
  persona?: string; // rótulo do perfil de apresentação
  /** permissões individuais, somadas às dos perfis */
  grants?: Partial<Record<BrandId, Partial<Record<ModuleId, Grant>>>>;
}

/** permissions[empresa][perfil][módulo] = { ações, escopo } */
export interface Grant {
  actions: string[];
  scope: Scope;
}
export type PermissionMatrix = Record<BrandId, Partial<Record<RoleId, Partial<Record<ModuleId, Grant>>>>>;

// ---------- Inventário ----------
export type EquipStatus = 'disponivel' | 'em_uso' | 'manutencao' | 'conferencia';
export interface Equipment {
  id: string;
  companyId: BrandId;
  patrimonio: string;
  descricao: string;
  tipo: 'Notebook' | 'Monitor' | 'Celular' | 'Impressora' | 'Periférico' | 'Desktop';
  marcaModelo: string;
  serie: string;
  status: EquipStatus;
  responsavelId?: string;
  localizacao: string;
  aquisicao: string; // ISO
  ultimaMov: string; // ISO
  maintenance?: { inicio: string; fornecedor: string; motivo: string; previsao: string }[];
  docs: string[]; // ids de anexos
  /** entrega registrada aguardando confirmação de recebimento pelo colaborador */
  aceitePendente?: boolean;
}

// ---------- Reverso ----------
export type ReversoStatus = 'aguardando_aprovacao' | 'ajuste' | 'aguardando_expedicao' | 'em_transito' | 'concluido';
export interface Reverso {
  id: string;
  numero: string;
  companyId: BrandId;
  solicitanteId: string;
  setor: string;
  clienteCodigo: string;
  clienteNome: string;
  endereco: string;
  motivo: string;
  justificativa?: string;
  itens: { descricao: string; ref: string; qtd: number }[];
  status: ReversoStatus;
  criadoEm: string;
  aprovadorId?: string;
  decisao?: { por: string; em: string; tipo: 'aprovado' | 'ajuste'; obs?: string };
  rastreio?: string;
  docs: string[];
}

// ---------- Viagens ----------
export type ViagemStatus = 'aguardando_emissao' | 'emitida' | 'concluida';
export interface Trecho {
  tipo: 'ida' | 'volta';
  cia: string;
  voo: string;
  origem: string;
  destino: string;
  data: string; // ISO datetime
  localizador?: string;
  valor?: number;
}
export interface Viagem {
  id: string;
  codigo: string;
  companyId: BrandId;
  viajanteId: string;
  destino: string;
  motivo: string;
  inicio: string;
  fim: string;
  status: ViagemStatus;
  trechos: Trecho[];
  hospedagem?: { hotel: string; checkin: string; checkout: string; confirmado: boolean };
  compraExterna?: { por: string; em: string };
  docs: string[];
}

// ---------- Reservas (plugin de exemplo) ----------
export interface Sala { id: string; companyId: BrandId; nome: string; capacidade: number; recursos: string }
export interface Reserva { id: string; salaId: string; data: string; hora: number; userId: string; titulo: string; cancelada?: boolean }

// ---------- Compartilhados ----------
export interface Attachment {
  id: string;
  nome: string;
  tipo: 'PDF' | 'PNG';
  tamanho: string;
  em: string;
  kind: 'termo' | 'etiqueta' | 'bilhete' | 'nota';
  ref?: string; // id do registro
}

export type AuditKind = 'comentario' | 'tarefa' | 'decisao' | 'acesso' | 'exportacao' | 'operacao';
export interface HistoryEvent {
  id: string;
  ts: string;
  companyId: BrandId;
  module: ModuleId;
  recordId: string;
  recordLabel: string;
  action: string;
  actorId: string;
  /** categoria de auditoria (comentários, tarefas, decisões, acessos, exportações) */
  kind?: AuditKind;
}

export interface Notification {
  id: string;
  userId: string;
  ts: string;
  module: OriginId;
  title: string;
  subject: string;
  link: string;
  read: boolean;
  companyId?: BrandId; // ausente = alcance de grupo
  recordId?: string;
  kind?: 'comentario' | 'tarefa' | 'comunicado' | 'documento' | 'decisao' | 'acesso' | 'exportacao' | 'geral';
}

/** E-mail simulado: canal definido junto com as notificações internas. */
export interface EmailMessage {
  id: string;
  ts: string;
  toUserId: string;
  to: string;
  subject: string;
  body: string;
  module: OriginId;
  recordId?: string;
  link: string;
  notificationId?: string;
  eventId?: string;
  companyId?: BrandId;
}

// ---------- Chamados e Acompanhamento (plugin demonstrativo) ----------
export type Priority = 'baixa' | 'media' | 'alta' | 'urgente';
export type ChamadoStatus = 'aberto' | 'em_atendimento' | 'aguardando_solicitante' | 'resolvido' | 'fechado';
export type TarefaStatus = 'a_fazer' | 'em_andamento' | 'em_revisao' | 'concluida';
export interface Chamado {
  id: string;
  numero: string;
  companyId: BrandId;
  titulo: string;
  descricao: string;
  categoria: string;
  fila: string;
  solicitanteId: string;
  responsavelId: string;
  status: ChamadoStatus;
  prioridade: Priority;
  criadoEm: string;
  prazo?: string;
  atualizadoEm: string;
}
export interface Tarefa {
  id: string;
  codigo: string;
  chamadoId: string;
  companyId: BrandId;
  titulo: string;
  descricao: string;
  responsavelId: string;
  revisorId: string;
  status: TarefaStatus;
  prioridade?: Priority;
  prazo?: string;
  atualizadoEm: string;
}
export interface Comment { id: string; module: ModuleId; recordId: string; authorId: string; ts: string; text: string; via?: 'plataforma' | 'painel' | 'sistema' }

// ---------- Fontes externas (dados demonstrativos dos adaptadores) ----------
/** Alcance explícito de conteúdo corporativo compartilhado */
export type Reach = { tipo: 'grupo' } | { tipo: 'ambientes'; ids: BrandId[] };
export interface IntranetPost {
  id: string;
  titulo: string;
  resumo: string;
  conteudo: string[];
  publicadoEm: string;
  autor: string;
  area: string;
  categoria: 'Comunicado' | 'Orientação' | 'Procedimento' | 'Notícia';
  imagem?: 'festa' | 'seguranca' | 'procedimento' | 'colecao' | 'inventario';
  alcance: Reach;
  url?: string; // endereço real no SharePoint (configurado na integração)
  destaque?: boolean;
}
export interface FeedbackItem { id: string; userId: string; titulo: string; ciclo: string; prazo: string; status: 'pendente' | 'concluido'; alcance: Reach; url?: string }
export interface TeamsMessage {
  id: string;
  userId: string; // destinatário (dono da caixa)
  conversa: { tipo: 'chat' | 'canal'; nome: string; equipe?: string };
  remetenteId?: string;
  remetenteNome: string;
  resumo: string;
  ts: string;
  lida: boolean;
  alcance: Reach;
  thread: { autor: string; texto: string; ts: string }[];
  url?: string; // deep link real do Teams (somente quando configurado)
}
export type SourceStatus = 'ok' | 'indisponivel';

export type PluginStatus = 'disponivel' | 'instalado' | 'desativado';
export interface PluginState {
  id: ModuleId;
  version: string;
  status: PluginStatus;
  maintenance: boolean;
  companies: BrandId[];
}

export type SimMode = 'normal' | 'carregando' | 'erro' | 'vazio';

export interface AccessRequest {
  id: string;
  numero: string;
  requesterId: string; // líder
  targetId: string;
  companyId: BrandId;
  module: ModuleId;
  actions: string[];
  scope: Scope;
  justificativa: string;
  status: 'pendente' | 'aplicada' | 'recusada';
  criadoEm: string;
  resolvidoPor?: string;
  resolvidoEm?: string;
  obs?: string;
}

export interface ExportConfig {
  enabled: boolean;
  formats: ('CSV' | 'XLSX' | 'PDF')[];
  /** permanente: cargos autorizados exportam direto · aprovacao: cargos solicitam e a Gerência decide */
  mode: 'permanente' | 'aprovacao';
  roles: RoleId[];
  fields: string[];
  includeHistory: boolean;
}
export interface ExportRequest {
  id: string;
  numero: string;
  module: ModuleId;
  companyId: BrandId;
  requesterId: string;
  formato: 'CSV' | 'XLSX' | 'PDF';
  registros: number;
  filtros: string;
  recordIds: string[];
  justificativa: string;
  status: 'pendente' | 'aprovada' | 'recusada' | 'baixada';
  criadoEm: string;
  decididoPor?: string;
  decididoEm?: string;
  obs?: string;
}

export interface RecentItem { module: ModuleId; recordId: string; label: string; action: string; ts: string; link: string; companyId: BrandId }

export interface DemoData {
  users: User[];
  /** configuração inicial: líderes com acesso total aos módulos de negócio de todas as marcas */
  config: { leaders: string[] };
  equipments: Equipment[];
  reversos: Reverso[];
  viagens: Viagem[];
  salas: Sala[];
  reservas: Reserva[];
  chamados: Chamado[];
  tarefas: Tarefa[];
  comments: Comment[];
  posts: IntranetPost[];
  feedback: FeedbackItem[];
  teams: TeamsMessage[];
  emails: EmailMessage[];
  /** última sincronização bem-sucedida de cada fonte (conteúdo em cache) */
  sync: Partial<Record<SourceId | ModuleId, string>>;
  attachments: Attachment[];
  events: HistoryEvent[];
  notifications: Notification[];
  /** modelos de acesso por cargo (organizam a administração; não concedem acesso sozinhos) */
  permissions: PermissionMatrix;
  plugins: PluginState[];
  favorites: Record<string, ModuleId[]>;
  accessRequests: AccessRequest[];
  exportConfig: Partial<Record<ModuleId, ExportConfig>>;
  exportRequests: ExportRequest[];
  recent: Record<string, RecentItem[]>;
}

export interface Session {
  userId: string | null;
  companyId: BrandId;
  theme: ThemeMode;
  sim: SimMode;
  sidebarCollapsed: boolean;
  defaultCompany?: BrandId;
  /** reduz translucidez dos materiais (preferência de acessibilidade) */
  reduceTransparency?: boolean;
  reduceMotion?: boolean;
  /** fontes/módulos marcados como indisponíveis pelo apresentador */
  outages?: Partial<Record<SourceId | ModuleId, boolean>>;
}

// ---------- Contrato de módulo / plugin ----------
export interface MenuItem {
  label: string;
  path: string;
  /** ação exigida para exibir o subitem (qualquer uma, se lista) */
  requires?: string | string[];
}

/** Contexto entregue pela plataforma às contribuições de cada plugin. */
export interface ContribCtx {
  data: DemoData;
  me: User;
  company: BrandId;
  can: (m: ModuleId, action: string) => boolean;
  scope: (m: ModuleId) => Scope | null;
  userName: (id?: string) => string;
  isLeader: boolean;
}
export type WorkStage = 'acao' | 'andamento' | 'aprovacao' | 'acompanhando' | 'informativo';
/** Item de trabalho contribuído por um plugin ou fonte ao painel. */
export interface WorkItem {
  key: string;
  origin: OriginId;          // módulo/fonte de origem
  companyId?: BrandId;       // ambiente (ausente = grupo)
  recordId: string;          // registro de origem
  userId: string;            // destinatário ou responsável
  relation: 'responsavel' | 'solicitante' | 'aprovador' | 'destinatario';
  ref: string;               // identificação (CH-2041, REV-2026-0148…)
  title: string;             // assunto
  subject?: string;          // complemento
  status: string;
  tone: 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'accent';
  stage: WorkStage;
  priority?: Priority;
  due?: string;
  dueLabel?: string;
  action: { label: string; kind: 'painel' | 'abrir' | 'externo'; to: string };
}
export interface WorkQueue { id: string; origin: OriginId; label: string; to: string; items: WorkItem[] }
export interface QuickAction { id: string; origin: OriginId; label: string; to: string; icon: LucideIcon; weight: number }

/** Operações que um plugin expõe ao painel de trabalho (comentar e avançar sem sair do Início). */
export interface TaskView {
  ref: string; title: string; status: string; tone: WorkItem['tone']; priority?: Priority; due?: string;
  facts: [string, string][]; description: string; openTo: string; companyId: BrandId;
}
export interface Transition { id: string; label: string; needsComment?: boolean; primary?: boolean; hint?: string }
/** Serviços da plataforma entregues às operações dos plugins (registro, histórico, notificação + e-mail). */
export interface PlatformApi {
  ctx: ContribCtx;
  update: (fn: (d: DemoData) => void) => void;
  log: (e: { module: ModuleId; recordId: string; recordLabel: string; action: string; kind?: AuditKind; companyId?: BrandId }) => string;
  notify: (n: Omit<Notification, 'id' | 'ts' | 'read'>, opts?: { email?: boolean }) => void;
  down: (id: SourceId | ModuleId) => boolean;
}
export interface TaskOps {
  supports: (recordId: string) => boolean;
  comment: (api: PlatformApi, recordId: string, text: string) => void;
  /** aplica a transição e devolve a mensagem de confirmação */
  apply: (api: PlatformApi, recordId: string, transitionId: string, comment?: string) => string;
  view: (c: ContribCtx, recordId: string) => TaskView | null;
  comments: (c: ContribCtx, recordId: string) => Comment[];
  transitions: (c: ContribCtx, recordId: string) => Transition[];
}

export interface ModuleManifest {
  id: ModuleId;
  name: string;
  description: string;
  icon: LucideIcon;
  basePath: string;
  version: string;
  menu: MenuItem[];
  /** ações que o plugin declara */
  actions: { id: string; label: string }[];
  requirements: string[];
  core?: boolean; // não pode ser desinstalado na demo
  /** módulo de negócio (líderes recebem acesso total) */
  business?: boolean;
  routes: { path: string; element: ComponentType }[];
  /** participação no painel pessoal e na navegação */
  contributes?: {
    queues?: (c: ContribCtx) => WorkQueue[];
    quickActions?: (c: ContribCtx) => QuickAction[];
    /** destino de navegação de um registro (notificações, recentes, busca) */
    recordPath?: (recordId: string) => string;
    taskOps?: TaskOps;
  };
}
