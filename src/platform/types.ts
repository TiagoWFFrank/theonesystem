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
export type ModuleId = 'inventario' | 'reverso' | 'viagens' | 'reservas' | 'admin';

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

export interface HistoryEvent {
  id: string;
  ts: string;
  companyId: BrandId;
  module: ModuleId;
  recordId: string;
  recordLabel: string;
  action: string;
  actorId: string;
}

export interface Notification {
  id: string;
  userId: string;
  ts: string;
  module: ModuleId;
  title: string;
  subject: string;
  link: string;
  read: boolean;
  companyId?: BrandId;
}

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
  roles: RoleId[];
  fields: string[];
  includeHistory: boolean;
}

export interface RecentItem { module: ModuleId; recordId: string; label: string; action: string; ts: string; link: string; companyId: BrandId }

export interface DemoData {
  users: User[];
  equipments: Equipment[];
  reversos: Reverso[];
  viagens: Viagem[];
  salas: Sala[];
  reservas: Reserva[];
  attachments: Attachment[];
  events: HistoryEvent[];
  notifications: Notification[];
  permissions: PermissionMatrix;
  plugins: PluginState[];
  favorites: Record<string, ModuleId[]>;
  accessRequests: AccessRequest[];
  exportConfig: Partial<Record<ModuleId, ExportConfig>>;
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
}

// ---------- Contrato de módulo / plugin ----------
export interface MenuItem {
  label: string;
  path: string;
  /** ação exigida para exibir o subitem (qualquer uma, se lista) */
  requires?: string | string[];
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
  routes: { path: string; element: ComponentType }[];
}
