// Cenário de demonstração. Todos os nomes, clientes, valores e documentos são fictícios.
import { seedComments, seedEmails, seedFeedback, seedPosts, seedTeams } from './seed03';
import { hashContent } from './exports';
import { PLUGIN_SEEDS } from '@/modules/seeds';
import type {
  ExportContent, ExportRequest,
  Attachment, BrandId, DemoData, Equipment, Grant, HistoryEvent, ModuleId, Notification,
  PermissionMatrix, RoleId, Reverso, Viagem, User,
} from './types';

const DAY = 86_400_000;
const base = new Date();
base.setMinutes(0, 0, 0);
/** data relativa a hoje (dias, hora) em ISO */
export function rel(days: number, hour = 10, minute = 0): string {
  const d = new Date(base.getTime() + days * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const ALL: BrandId[] = ['azime', 'alinare', 'novitah'];

export const seedUsers: User[] = [
  { id: 'u1', name: 'Ana Ribeiro', email: 'ana.ribeiro@exemplo.com', sector: 'Comercial', companies: ALL, roles: ['colaborador'], status: 'ativo', managerId: 'u2', persona: 'Colaborador' },
  { id: 'u2', name: 'Bruno Teixeira', email: 'bruno.teixeira@exemplo.com', sector: 'Comercial', companies: ALL, roles: ['colaborador', 'gestor'], status: 'ativo', persona: 'Líder' },
  { id: 'u3', name: 'Carla Mendes', email: 'carla.mendes@exemplo.com', sector: 'Compras', companies: ALL, roles: ['colaborador', 'compras'], status: 'ativo', managerId: 'u2', persona: 'Compras' },
  { id: 'u4', name: 'Diego Santos', email: 'diego.santos@exemplo.com', sector: 'Expedição', companies: ALL, roles: ['colaborador', 'expedicao'], status: 'ativo', managerId: 'u2', persona: 'Expedição' },
  { id: 'u5', name: 'Elisa Moura', email: 'elisa.moura@exemplo.com', sector: 'Tecnologia', companies: ALL, roles: ['colaborador', 'ti'], status: 'ativo', managerId: 'u6', persona: 'TI' },
  { id: 'u6', name: 'Fábio Lima', email: 'fabio.lima@exemplo.com', sector: 'Gerência', companies: ALL, roles: ['colaborador', 'gerencia'], status: 'ativo', persona: 'Gerência' },
  { id: 'u7', name: 'Gabriela Nunes', email: 'gabriela.nunes@exemplo.com', sector: 'Comercial', companies: ['alinare'], roles: ['colaborador'], status: 'ativo', managerId: 'u2', grants: { alinare: { inventario: { actions: ['ver'], scope: 'empresa' } } } },
  { id: 'u8', name: 'Henrique Prado', email: 'henrique.prado@exemplo.com', sector: 'Marketing', companies: ['novitah'], roles: ['colaborador'], status: 'ativo', managerId: 'u2' },
  { id: 'u9', name: 'Isabela Costa', email: 'isabela.costa@exemplo.com', sector: 'Financeiro', companies: ['azime', 'alinare'], roles: ['colaborador'], status: 'ativo', managerId: 'u6' },
  { id: 'u10', name: 'João Victor Alves', email: 'joao.alves@exemplo.com', sector: 'Comercial', companies: ['novitah'], roles: ['colaborador'], status: 'aguardando', managerId: 'u2' },
  { id: 'u11', name: 'Larissa Fontes', email: 'larissa.fontes@exemplo.com', sector: 'Atendimento', companies: ['alinare', 'novitah'], roles: ['colaborador'], status: 'ativo', managerId: 'u2' },
  { id: 'u12', name: 'Marcos Rocha', email: 'marcos.rocha@exemplo.com', sector: 'Logística', companies: ['azime'], roles: ['colaborador'], status: 'bloqueado', managerId: 'u6' },
];

const g = (actions: string[], scope: Grant['scope']): Grant => ({ actions, scope });
function defaultGrants(): Partial<Record<RoleId, Partial<Record<ModuleId, Grant>>>> {
  return {
    colaborador: {
      inventario: g(['ver'], 'proprios'),
      reverso: g(['ver', 'abrir'], 'proprios'),
      viagens: g(['ver'], 'proprios'),
      chamados: g(['ver', 'abrir', 'atender'], 'proprios'),
    },
    // Líderes: acesso total de consulta em todas as marcas; solicitam acessos da equipe
    gestor: {
      inventario: g(['ver'], 'empresa'),
      reverso: g(['ver', 'abrir', 'aprovar'], 'empresa'),
      viagens: g(['ver'], 'empresa'),
      admin: g(['colaboradores', 'solicitar_acesso'], 'equipe'),
    },
    compras: { viagens: g(['ver', 'registrar_compra'], 'empresa') },
    expedicao: { reverso: g(['ver', 'expedir'], 'empresa') },
    // TI: opera o inventário e aplica as alterações de acesso
    ti: {
      inventario: g(['ver', 'cadastrar', 'registrar_entrega'], 'empresa'),
      chamados: g(['ver', 'abrir', 'atender', 'gerenciar'], 'empresa'),
      admin: g(['colaboradores', 'aplicar_acesso', 'plugins', 'auditoria'], 'empresa'),
    },
    // Gerência: consulta tudo e configura exportações
    gerencia: {
      inventario: g(['ver'], 'empresa'),
      reverso: g(['ver'], 'empresa'),
      viagens: g(['ver'], 'empresa'),
      chamados: g(['ver'], 'empresa'),
      admin: g(['colaboradores', 'exportacoes', 'auditoria'], 'empresa'),
    },
  };
}
export const seedPermissions = (): PermissionMatrix => ({
  azime: defaultGrants(),
  alinare: defaultGrants(),
  novitah: defaultGrants(),
});

const eq = (e: Omit<Equipment, 'docs' | 'aquisicao'> & Partial<Pick<Equipment, 'docs' | 'aquisicao'>>): Equipment => ({
  docs: [], aquisicao: rel(-420), ...e,
});

export const seedEquipments: Equipment[] = [
  eq({ id: 'e1', companyId: 'azime', patrimonio: 'AZ-0107', descricao: 'Notebook Dell Latitude 5440', tipo: 'Notebook', marcaModelo: 'Dell Latitude 5440 · i7 · 16 GB', serie: '7KX4L93', status: 'disponivel', localizacao: 'Sala de TI · São Paulo', ultimaMov: rel(-6, 15), aquisicao: rel(-60) }),
  eq({ id: 'e2', companyId: 'azime', patrimonio: 'AZ-0093', descricao: 'Monitor LG 27" UltraFine', tipo: 'Monitor', marcaModelo: 'LG 27UP550', serie: '304NTVW2K118', status: 'em_uso', responsavelId: 'u1', localizacao: 'Comercial · 3º andar', ultimaMov: rel(-41, 10), docs: ['a1'] }),
  eq({ id: 'e3', companyId: 'azime', patrimonio: 'AZ-0081', descricao: 'Notebook Lenovo ThinkPad E14', tipo: 'Notebook', marcaModelo: 'Lenovo ThinkPad E14 Gen 4', serie: 'PF3Z8KQ1', status: 'manutencao', localizacao: 'Assistência TecnoServ', ultimaMov: rel(-3, 9), maintenance: [{ inicio: rel(-3, 9), fornecedor: 'TecnoServ Assistência', motivo: 'Teclado com teclas falhando', previsao: rel(4) }] }),
  eq({ id: 'e4', companyId: 'azime', patrimonio: 'AZ-0112', descricao: 'Smartphone Apple iPhone 14 128 GB', tipo: 'Celular', marcaModelo: 'Apple iPhone 14', serie: 'F17HG2K9PLJ', status: 'conferencia', localizacao: 'Recebimento TI', ultimaMov: rel(-1, 16), aquisicao: rel(-1) }),
  eq({ id: 'e5', companyId: 'azime', patrimonio: 'AZ-0064', descricao: 'Impressora HP LaserJet Pro M428', tipo: 'Impressora', marcaModelo: 'HP LaserJet Pro M428fdw', serie: 'BRBSN8Q2F1', status: 'em_uso', responsavelId: 'u9', localizacao: 'Financeiro · 2º andar', ultimaMov: rel(-120) }),
  eq({ id: 'e6', companyId: 'azime', patrimonio: 'AZ-0099', descricao: 'Notebook Dell Latitude 5430', tipo: 'Notebook', marcaModelo: 'Dell Latitude 5430 · i5 · 16 GB', serie: '3JH8M72', status: 'em_uso', responsavelId: 'u2', localizacao: 'Comercial · 3º andar', ultimaMov: rel(-88), docs: ['a2'] }),
  eq({ id: 'e7', companyId: 'alinare', patrimonio: 'AL-0231', descricao: 'Notebook Apple MacBook Air M2', tipo: 'Notebook', marcaModelo: 'Apple MacBook Air 13" M2', serie: 'C02HX1Q8Q6L4', status: 'em_uso', responsavelId: 'u7', localizacao: 'Showroom Alinare', ultimaMov: rel(-55), docs: ['a3'] }),
  eq({ id: 'e8', companyId: 'alinare', patrimonio: 'AL-0245', descricao: 'Monitor Dell 24" P2422H', tipo: 'Monitor', marcaModelo: 'Dell P2422H', serie: 'CN0K8T9D', status: 'disponivel', localizacao: 'Almoxarifado Alinare', ultimaMov: rel(-12) }),
  eq({ id: 'e9', companyId: 'alinare', patrimonio: 'AL-0219', descricao: 'Smartphone Samsung Galaxy A54', tipo: 'Celular', marcaModelo: 'Samsung Galaxy A54 5G', serie: 'R58W30ABCDE', status: 'em_uso', responsavelId: 'u11', localizacao: 'Atendimento Alinare', ultimaMov: rel(-150) }),
  eq({ id: 'e10', companyId: 'alinare', patrimonio: 'AL-0250', descricao: 'Desktop Dell OptiPlex 7010', tipo: 'Desktop', marcaModelo: 'Dell OptiPlex 7010 SFF', serie: '9PL2QX3', status: 'conferencia', localizacao: 'Recebimento TI', ultimaMov: rel(-2, 11), aquisicao: rel(-2) }),
  eq({ id: 'e11', companyId: 'alinare', patrimonio: 'AL-0198', descricao: 'Leitor de código de barras Zebra DS2208', tipo: 'Periférico', marcaModelo: 'Zebra DS2208', serie: 'S21093522019', status: 'manutencao', localizacao: 'Assistência Zebra', ultimaMov: rel(-8), maintenance: [{ inicio: rel(-8), fornecedor: 'Zebra Autorizada SP', motivo: 'Leitura intermitente', previsao: rel(2) }] }),
  eq({ id: 'e12', companyId: 'novitah', patrimonio: 'NV-0311', descricao: 'Notebook Lenovo IdeaPad 5', tipo: 'Notebook', marcaModelo: 'Lenovo IdeaPad 5 14"', serie: 'PF4A1B2C', status: 'em_uso', responsavelId: 'u8', localizacao: 'Marketing Novitah', ultimaMov: rel(-70) }),
  eq({ id: 'e13', companyId: 'novitah', patrimonio: 'NV-0322', descricao: 'Monitor Samsung 24" S24C310', tipo: 'Monitor', marcaModelo: 'Samsung S24C310', serie: 'H4ZN700123', status: 'disponivel', localizacao: 'Almoxarifado Novitah', ultimaMov: rel(-20) }),
  eq({ id: 'e14', companyId: 'novitah', patrimonio: 'NV-0305', descricao: 'Impressora térmica Zebra ZD220', tipo: 'Impressora', marcaModelo: 'Zebra ZD220 · etiquetas', serie: 'D4J194800123', status: 'em_uso', responsavelId: 'u4', localizacao: 'Expedição Novitah', ultimaMov: rel(-200) }),
  eq({ id: 'e15', companyId: 'novitah', patrimonio: 'NV-0329', descricao: 'Notebook Dell Vostro 3520', tipo: 'Notebook', marcaModelo: 'Dell Vostro 3520 · i5 · 8 GB', serie: '5GT2W81', status: 'disponivel', localizacao: 'Sala de TI · Novitah', ultimaMov: rel(-9) }),
  eq({ id: 'e16', companyId: 'novitah', patrimonio: 'NV-0290', descricao: 'Smartphone Motorola Edge 40', tipo: 'Celular', marcaModelo: 'Motorola Edge 40', serie: 'ZY22H7KQ9', status: 'manutencao', localizacao: 'Assistência Motorola', ultimaMov: rel(-5), maintenance: [{ inicio: rel(-5), fornecedor: 'Moto Service', motivo: 'Tela trincada', previsao: rel(6) }] }),
];

const rv = (r: Omit<Reverso, 'docs'> & { docs?: string[] }): Reverso => ({ docs: [], ...r });
export const seedReversos: Reverso[] = [
  rv({ id: 'r1', numero: 'REV-2026-0148', companyId: 'alinare', solicitanteId: 'u11', setor: 'Atendimento', clienteCodigo: 'C-20871', clienteNome: 'Joalheria Bela Vista Ltda.', endereco: 'Rua das Acácias, 210 · Centro · Campinas/SP · 13010-120', motivo: 'Mercadoria errada', justificativa: 'Cliente recebeu brinco argola ouro 18k de 2 cm no lugar do modelo de 3 cm do pedido 55821.', itens: [{ descricao: 'Brinco argola ouro 18k 2 cm', ref: 'ALN-BR-2210', qtd: 1 }], status: 'aguardando_aprovacao', criadoEm: rel(-1, 14, 20), aprovadorId: 'u2' }),
  rv({ id: 'r2', numero: 'REV-2026-0145', companyId: 'alinare', solicitanteId: 'u7', setor: 'Comercial', clienteCodigo: 'C-19034', clienteNome: 'Ouro Fino Presentes ME', endereco: 'Av. Brasil, 1450 · Jardim América · Ribeirão Preto/SP · 14020-260', motivo: 'Defeito', justificativa: 'Fecho do colar soltando após primeiro uso.', itens: [{ descricao: 'Colar veneziana prata 925 45 cm', ref: 'ALN-CO-1188', qtd: 2 }], status: 'aguardando_expedicao', criadoEm: rel(-4, 10), aprovadorId: 'u2', decisao: { por: 'u2', em: rel(-3, 9, 40), tipo: 'aprovado' } }),
  rv({ id: 'r3', numero: 'REV-2026-0139', companyId: 'alinare', solicitanteId: 'u11', setor: 'Atendimento', clienteCodigo: 'C-18712', clienteNome: 'Brilho & Cia Acessórios', endereco: 'Rua XV de Novembro, 88 · Centro · Curitiba/PR · 80020-310', motivo: 'Arrependimento', itens: [{ descricao: 'Pulseira riviera zircônias', ref: 'ALN-PU-0942', qtd: 1 }], status: 'em_transito', criadoEm: rel(-9, 11), aprovadorId: 'u2', decisao: { por: 'u2', em: rel(-8, 16), tipo: 'aprovado' }, rastreio: 'BR548812937BR', docs: ['a10'] }),
  rv({ id: 'r4', numero: 'REV-2026-0151', companyId: 'alinare', solicitanteId: 'u1', setor: 'Comercial', clienteCodigo: 'C-21455', clienteNome: 'Atelier Dourado Joias', endereco: 'Rua Oscar Freire, 512 · Jardins · São Paulo/SP · 01426-000', motivo: 'Troca de tamanho', itens: [{ descricao: 'Anel solitário ouro 18k aro 16', ref: 'ALN-AN-3301', qtd: 1 }], status: 'aguardando_aprovacao', criadoEm: rel(0, 9, 10), aprovadorId: 'u2' }),
  rv({ id: 'r5', numero: 'REV-2026-0131', companyId: 'alinare', solicitanteId: 'u7', setor: 'Comercial', clienteCodigo: 'C-17320', clienteNome: 'Casa das Alianças Ltda.', endereco: 'Av. Afonso Pena, 3000 · Funcionários · Belo Horizonte/MG · 30130-009', motivo: 'Defeito', justificativa: 'Gravação com erro de grafia.', itens: [{ descricao: 'Par de alianças ouro 18k 4 mm', ref: 'ALN-AL-0450', qtd: 1 }], status: 'concluido', criadoEm: rel(-22), aprovadorId: 'u2', decisao: { por: 'u2', em: rel(-21), tipo: 'aprovado' }, rastreio: 'BR530011245BR', docs: ['a11'] }),
  rv({ id: 'r6', numero: 'REV-2026-0150', companyId: 'novitah', solicitanteId: 'u11', setor: 'Atendimento', clienteCodigo: 'N-08812', clienteNome: 'Bijoux Terra Boutique', endereco: 'Rua Padre Chagas, 77 · Moinhos de Vento · Porto Alegre/RS · 90570-080', motivo: 'Mercadoria errada', justificativa: 'Enviado conjunto banho ródio em vez de banho ouro.', itens: [{ descricao: 'Conjunto colar e brinco gota banho ródio', ref: 'NVT-CJ-0715', qtd: 3 }], status: 'ajuste', criadoEm: rel(-2, 15), aprovadorId: 'u2', decisao: { por: 'u2', em: rel(-1, 10), tipo: 'ajuste', obs: 'Informe o número da nota fiscal de venda na justificativa.' } }),
  rv({ id: 'r7', numero: 'REV-2026-0147', companyId: 'novitah', solicitanteId: 'u1', setor: 'Comercial', clienteCodigo: 'N-07740', clienteNome: 'Nude Store Multimarcas', endereco: 'Av. Sete de Setembro, 1200 · Vitória · Salvador/BA · 40080-001', motivo: 'Defeito', justificativa: 'Pedra solta no pingente.', itens: [{ descricao: 'Pingente gota quartzo rosa', ref: 'NVT-PG-0233', qtd: 2 }], status: 'aguardando_expedicao', criadoEm: rel(-5), aprovadorId: 'u2', decisao: { por: 'u2', em: rel(-4, 11), tipo: 'aprovado' } }),
  rv({ id: 'r8', numero: 'REV-2026-0142', companyId: 'novitah', solicitanteId: 'u11', setor: 'Atendimento', clienteCodigo: 'N-06521', clienteNome: 'Areia Acessórios', endereco: 'Rua Visconde de Pirajá, 330 · Ipanema · Rio de Janeiro/RJ · 22410-002', motivo: 'Arrependimento', itens: [{ descricao: 'Brinco ear cuff terracota', ref: 'NVT-BR-1120', qtd: 1 }], status: 'concluido', criadoEm: rel(-16), aprovadorId: 'u2', decisao: { por: 'u2', em: rel(-15), tipo: 'aprovado' }, rastreio: 'BR528877102BR', docs: ['a12'] }),
  rv({ id: 'r9', numero: 'REV-2026-0152', companyId: 'novitah', solicitanteId: 'u11', setor: 'Atendimento', clienteCodigo: 'N-09102', clienteNome: 'Lótus Bijuterias Finas', endereco: 'Rua Halfeld, 640 · Centro · Juiz de Fora/MG · 36010-002', motivo: 'Mercadoria errada', justificativa: 'Cor da pedra divergente do pedido 71204.', itens: [{ descricao: 'Anel cocktail pedra verde', ref: 'NVT-AN-0871', qtd: 2 }], status: 'aguardando_aprovacao', criadoEm: rel(0, 8, 45), aprovadorId: 'u2' }),
];

export const seedViagens: Viagem[] = [
  { id: 'v1', codigo: 'VG-0412', companyId: 'azime', viajanteId: 'u1', destino: 'Belo Horizonte/MG', motivo: 'Visita a lojistas parceiros', inicio: rel(12, 7), fim: rel(14, 20), status: 'emitida',
    trechos: [
      { tipo: 'ida', cia: 'GOL', voo: 'G3 1302', origem: 'GRU', destino: 'CNF', data: rel(12, 7, 15), localizador: 'KJ8T4P', valor: 612.4 },
      { tipo: 'volta', cia: 'GOL', voo: 'G3 1319', origem: 'CNF', destino: 'GRU', data: rel(14, 19, 40), localizador: 'KJ8T4P', valor: 587.9 },
    ],
    hospedagem: { hotel: 'Hotel Savassi Executive', checkin: rel(12, 14), checkout: rel(14, 12), confirmado: true }, docs: ['a20', 'a21'] },
  { id: 'v2', codigo: 'VG-0418', companyId: 'azime', viajanteId: 'u1', destino: 'Recife/PE', motivo: 'Feira Nordeste Varejo', inicio: rel(26, 6), fim: rel(28, 21), status: 'aguardando_emissao',
    trechos: [
      { tipo: 'ida', cia: 'A definir', voo: '—', origem: 'GRU', destino: 'REC', data: rel(26, 6) },
      { tipo: 'volta', cia: 'A definir', voo: '—', origem: 'REC', destino: 'GRU', data: rel(28, 20) },
    ], docs: [] },
  { id: 'v3', codigo: 'VG-0405', companyId: 'alinare', viajanteId: 'u2', destino: 'Rio de Janeiro/RJ', motivo: 'Reunião com franqueados', inicio: rel(5, 6), fim: rel(5, 22), status: 'emitida',
    trechos: [
      { tipo: 'ida', cia: 'LATAM', voo: 'LA 3910', origem: 'CGH', destino: 'SDU', data: rel(5, 6, 30), localizador: 'PZ2M7Q', valor: 498.0 },
      { tipo: 'volta', cia: 'LATAM', voo: 'LA 3947', origem: 'SDU', destino: 'CGH', data: rel(5, 20, 50), localizador: 'PZ2M7Q', valor: 455.3 },
    ], compraExterna: { por: 'u3', em: rel(-6, 17) }, docs: ['a22'] },
  { id: 'v4', codigo: 'VG-0398', companyId: 'alinare', viajanteId: 'u7', destino: 'Curitiba/PR', motivo: 'Treinamento de vendas', inicio: rel(-18, 7), fim: rel(-16, 20), status: 'concluida',
    trechos: [
      { tipo: 'ida', cia: 'Azul', voo: 'AD 4471', origem: 'VCP', destino: 'CWB', data: rel(-18, 7), localizador: 'AZ5R1T', valor: 389.9 },
      { tipo: 'volta', cia: 'Azul', voo: 'AD 4480', origem: 'CWB', destino: 'VCP', data: rel(-16, 19), localizador: 'AZ5R1T', valor: 402.1 },
    ], hospedagem: { hotel: 'Bourbon Curitiba', checkin: rel(-18, 14), checkout: rel(-16, 12), confirmado: true }, docs: ['a23'] },
  { id: 'v5', codigo: 'VG-0420', companyId: 'novitah', viajanteId: 'u8', destino: 'Porto Alegre/RS', motivo: 'Produção de campanha', inicio: rel(19, 8), fim: rel(21, 19), status: 'aguardando_emissao',
    trechos: [
      { tipo: 'ida', cia: 'A definir', voo: '—', origem: 'GRU', destino: 'POA', data: rel(19, 8) },
      { tipo: 'volta', cia: 'A definir', voo: '—', origem: 'POA', destino: 'GRU', data: rel(21, 18) },
    ], hospedagem: { hotel: 'A definir', checkin: rel(19, 14), checkout: rel(21, 12), confirmado: false }, docs: [] },
  { id: 'v6', codigo: 'VG-0409', companyId: 'novitah', viajanteId: 'u11', destino: 'Salvador/BA', motivo: 'Visita a cliente estratégico', inicio: rel(8, 9), fim: rel(10, 18), status: 'emitida',
    trechos: [
      { tipo: 'ida', cia: 'LATAM', voo: 'LA 3364', origem: 'GRU', destino: 'SSA', data: rel(8, 9, 5), localizador: 'TQ4N8B', valor: 734.5 },
      { tipo: 'volta', cia: 'LATAM', voo: 'LA 3371', origem: 'SSA', destino: 'GRU', data: rel(10, 17, 55), localizador: 'TQ4N8B', valor: 701.2 },
    ], hospedagem: { hotel: 'Hotel Barra Mar', checkin: rel(8, 14), checkout: rel(10, 12), confirmado: false }, docs: ['a24'] },
  { id: 'v7', codigo: 'VG-0401', companyId: 'azime', viajanteId: 'u9', destino: 'Brasília/DF', motivo: 'Auditoria fiscal', inicio: rel(-25, 7), fim: rel(-24, 21), status: 'concluida',
    trechos: [
      { tipo: 'ida', cia: 'GOL', voo: 'G3 1450', origem: 'CGH', destino: 'BSB', data: rel(-25, 7), localizador: 'BS9D2L', valor: 455.0 },
      { tipo: 'volta', cia: 'GOL', voo: 'G3 1477', origem: 'BSB', destino: 'CGH', data: rel(-24, 20), localizador: 'BS9D2L', valor: 470.0 },
    ], hospedagem: { hotel: 'Brasília Palace', checkin: rel(-25, 14), checkout: rel(-24, 12), confirmado: true }, docs: [] },
];

export const seedAttachments: Attachment[] = [
  { id: 'a1', nome: 'Termo de responsabilidade — AZ-0093.pdf', tipo: 'PDF', tamanho: '184 KB', em: rel(-41, 10), kind: 'termo', ref: 'e2' },
  { id: 'a2', nome: 'Termo de responsabilidade — AZ-0099.pdf', tipo: 'PDF', tamanho: '181 KB', em: rel(-88), kind: 'termo', ref: 'e6' },
  { id: 'a3', nome: 'Termo de responsabilidade — AL-0231.pdf', tipo: 'PDF', tamanho: '179 KB', em: rel(-55), kind: 'termo', ref: 'e7' },
  { id: 'a10', nome: 'Etiqueta de postagem — REV-2026-0139.png', tipo: 'PNG', tamanho: '96 KB', em: rel(-8, 17), kind: 'etiqueta', ref: 'r3' },
  { id: 'a11', nome: 'Etiqueta de postagem — REV-2026-0131.png', tipo: 'PNG', tamanho: '94 KB', em: rel(-21, 15), kind: 'etiqueta', ref: 'r5' },
  { id: 'a12', nome: 'Etiqueta de postagem — REV-2026-0142.png', tipo: 'PNG', tamanho: '97 KB', em: rel(-15, 14), kind: 'etiqueta', ref: 'r8' },
  { id: 'a20', nome: 'Bilhete GOL — VG-0412 ida e volta.pdf', tipo: 'PDF', tamanho: '212 KB', em: rel(-3, 11), kind: 'bilhete', ref: 'v1' },
  { id: 'a21', nome: 'Voucher hospedagem — VG-0412.pdf', tipo: 'PDF', tamanho: '143 KB', em: rel(-3, 11), kind: 'nota', ref: 'v1' },
  { id: 'a22', nome: 'Bilhete LATAM — VG-0405.pdf', tipo: 'PDF', tamanho: '205 KB', em: rel(-6, 17), kind: 'bilhete', ref: 'v3' },
  { id: 'a23', nome: 'Bilhete Azul — VG-0398.pdf', tipo: 'PDF', tamanho: '198 KB', em: rel(-25), kind: 'bilhete', ref: 'v4' },
  { id: 'a24', nome: 'Bilhete LATAM — VG-0409.pdf', tipo: 'PDF', tamanho: '207 KB', em: rel(-4), kind: 'bilhete', ref: 'v6' },
];

let evc = 0;
const ev = (e: Omit<HistoryEvent, 'id'>): HistoryEvent => ({ id: `ev${++evc}`, ...e });
export const seedEvents = (): HistoryEvent[] => [
  ev({ ts: rel(-60), companyId: 'azime', module: 'inventario', recordId: 'e1', recordLabel: 'AZ-0107', action: 'Equipamento cadastrado', actorId: 'u5' }),
  ev({ ts: rel(-20, 11), companyId: 'azime', module: 'inventario', recordId: 'e1', recordLabel: 'AZ-0107', action: 'Devolvido por Marcos Rocha — conferido sem avarias', actorId: 'u5' }),
  ev({ ts: rel(-6, 15), companyId: 'azime', module: 'inventario', recordId: 'e1', recordLabel: 'AZ-0107', action: 'Formatado e preparado para nova entrega', actorId: 'u5' }),
  ev({ ts: rel(-41, 10), companyId: 'azime', module: 'inventario', recordId: 'e2', recordLabel: 'AZ-0093', action: 'Entrega registrada para Ana Ribeiro', actorId: 'u5' }),
  ev({ ts: rel(-3, 9), companyId: 'azime', module: 'inventario', recordId: 'e3', recordLabel: 'AZ-0081', action: 'Enviado para manutenção — TecnoServ Assistência', actorId: 'u5' }),
  ev({ ts: rel(-1, 16), companyId: 'azime', module: 'inventario', recordId: 'e4', recordLabel: 'AZ-0112', action: 'Recebido do fornecedor — aguardando conferência', actorId: 'u5' }),
  ev({ ts: rel(-88), companyId: 'azime', module: 'inventario', recordId: 'e6', recordLabel: 'AZ-0099', action: 'Entrega registrada para Bruno Teixeira', actorId: 'u5' }),
  ev({ ts: rel(-55), companyId: 'alinare', module: 'inventario', recordId: 'e7', recordLabel: 'AL-0231', action: 'Entrega registrada para Gabriela Nunes', actorId: 'u5' }),
  ev({ ts: rel(-2, 11), companyId: 'alinare', module: 'inventario', recordId: 'e10', recordLabel: 'AL-0250', action: 'Recebido do fornecedor — aguardando conferência', actorId: 'u5' }),
  ev({ ts: rel(-8), companyId: 'alinare', module: 'inventario', recordId: 'e11', recordLabel: 'AL-0198', action: 'Enviado para manutenção — Zebra Autorizada SP', actorId: 'u5' }),
  ev({ ts: rel(-5), companyId: 'novitah', module: 'inventario', recordId: 'e16', recordLabel: 'NV-0290', action: 'Enviado para manutenção — Moto Service', actorId: 'u5' }),
  ev({ ts: rel(-1, 14, 20), companyId: 'alinare', module: 'reverso', recordId: 'r1', recordLabel: 'REV-2026-0148', action: 'Solicitação aberta', actorId: 'u11' }),
  ev({ ts: rel(-4, 10), companyId: 'alinare', module: 'reverso', recordId: 'r2', recordLabel: 'REV-2026-0145', action: 'Solicitação aberta', actorId: 'u7' }),
  ev({ ts: rel(-3, 9, 40), companyId: 'alinare', module: 'reverso', recordId: 'r2', recordLabel: 'REV-2026-0145', action: 'Aprovada — aguardando expedição', kind: 'decisao', actorId: 'u2' }),
  ev({ ts: rel(-9, 11), companyId: 'alinare', module: 'reverso', recordId: 'r3', recordLabel: 'REV-2026-0139', action: 'Solicitação aberta', actorId: 'u11' }),
  ev({ ts: rel(-8, 16), companyId: 'alinare', module: 'reverso', recordId: 'r3', recordLabel: 'REV-2026-0139', action: 'Aprovada — aguardando expedição', kind: 'decisao', actorId: 'u2' }),
  ev({ ts: rel(-8, 17), companyId: 'alinare', module: 'reverso', recordId: 'r3', recordLabel: 'REV-2026-0139', action: 'Etiqueta incluída · rastreio BR548812937BR', actorId: 'u4' }),
  ev({ ts: rel(0, 9, 10), companyId: 'alinare', module: 'reverso', recordId: 'r4', recordLabel: 'REV-2026-0151', action: 'Solicitação aberta', actorId: 'u1' }),
  ev({ ts: rel(-2, 15), companyId: 'novitah', module: 'reverso', recordId: 'r6', recordLabel: 'REV-2026-0150', action: 'Solicitação aberta', actorId: 'u11' }),
  ev({ ts: rel(-1, 10), companyId: 'novitah', module: 'reverso', recordId: 'r6', recordLabel: 'REV-2026-0150', action: 'Devolvida para ajuste: informe o número da nota fiscal de venda', kind: 'decisao', actorId: 'u2' }),
  ev({ ts: rel(-5), companyId: 'novitah', module: 'reverso', recordId: 'r7', recordLabel: 'REV-2026-0147', action: 'Solicitação aberta', actorId: 'u1' }),
  ev({ ts: rel(-4, 11), companyId: 'novitah', module: 'reverso', recordId: 'r7', recordLabel: 'REV-2026-0147', action: 'Aprovada — aguardando expedição', kind: 'decisao', actorId: 'u2' }),
  ev({ ts: rel(0, 8, 45), companyId: 'novitah', module: 'reverso', recordId: 'r9', recordLabel: 'REV-2026-0152', action: 'Solicitação aberta', actorId: 'u11' }),
  ev({ ts: rel(-10), companyId: 'azime', module: 'viagens', recordId: 'v1', recordLabel: 'VG-0412', action: 'Viagem solicitada', actorId: 'u1' }),
  ev({ ts: rel(-3, 11), companyId: 'azime', module: 'viagens', recordId: 'v1', recordLabel: 'VG-0412', action: 'Passagens e hospedagem emitidas', actorId: 'u3' }),
  ev({ ts: rel(-2), companyId: 'azime', module: 'viagens', recordId: 'v2', recordLabel: 'VG-0418', action: 'Viagem solicitada', actorId: 'u1' }),
  ev({ ts: rel(-6, 17), companyId: 'alinare', module: 'viagens', recordId: 'v3', recordLabel: 'VG-0405', action: 'Compra externa registrada (exceção)', actorId: 'u3' }),
  ev({ ts: rel(-4), companyId: 'novitah', module: 'viagens', recordId: 'v6', recordLabel: 'VG-0409', action: 'Passagens emitidas — hospedagem pendente', actorId: 'u3' }),
  ev({ ts: rel(-7, 10), companyId: 'novitah', module: 'admin', recordId: 'u10', recordLabel: 'João Victor Alves', action: 'Conta Microsoft cadastrada — aguardando liberação da TI', kind: 'acesso', actorId: 'u5' }),
  ev({ ts: rel(-12, 16), companyId: 'azime', module: 'admin', recordId: 'u12', recordLabel: 'Marcos Rocha', action: 'Acesso bloqueado — desligamento (registros preservados)', kind: 'acesso', actorId: 'u5' }),
  ev({ ts: rel(-15, 11), companyId: 'alinare', module: 'admin', recordId: 'ar1', recordLabel: 'ACS-0011', action: 'Bruno Teixeira solicitou: Inventário · consultar (empresa) para Gabriela Nunes', kind: 'acesso', actorId: 'u2' }),
  ev({ ts: rel(-14, 9), companyId: 'alinare', module: 'admin', recordId: 'ar1', recordLabel: 'ACS-0011', action: 'Aplicada pela TI · permissão individual criada', kind: 'acesso', actorId: 'u5' }),
  ev({ ts: rel(-14, 9), companyId: 'alinare', module: 'admin', recordId: 'u7', recordLabel: 'Gabriela Nunes', action: 'Permissão individual: Inventário · consultar (empresa) · ACS-0011', kind: 'acesso', actorId: 'u5' }),
  ev({ ts: rel(-2, 15), companyId: 'alinare', module: 'admin', recordId: 'export-reverso', recordLabel: 'Exportação reversos-alinare', action: 'Exportação CSV · 5 registros · 5 campos (Diego Santos)', kind: 'exportacao', actorId: 'u4' }),
  ev({ ts: rel(-1, 17), companyId: 'alinare', module: 'admin', recordId: 'ar2', recordLabel: 'ACS-0014', action: 'Bruno Teixeira solicitou: Reverso · aprovar (equipe) para Ana Ribeiro', kind: 'acesso', actorId: 'u2' }),
];

let nc = 0;
const nt = (n: Omit<Notification, 'id'>): Notification => ({ id: `n${++nc}`, ...n });
export const seedNotifications = (): Notification[] => [
  nt({ userId: 'u1', ts: rel(-3, 11), module: 'viagens', kind: 'documento', title: 'Documento de viagem disponível', subject: 'VG-0412 · Belo Horizonte/MG', recordId: 'v1', link: '/viagens/v1', companyId: 'azime', read: false }),
  nt({ userId: 'u1', ts: new Date(Date.now() - 95 * 60000).toISOString(), module: 'chamados', kind: 'comentario', title: 'Novo comentário em CH-2044', subject: 'Elisa Moura: “Qual workspace do Power BI você precisa?”', link: '/chamados/c3', recordId: 'c3', companyId: 'azime', read: false }),
  nt({ userId: 'u1', ts: rel(-1, 11), module: 'chamados', kind: 'tarefa', title: 'Tarefa TF-314 atribuída a você', subject: 'Confirmar agenda de visitas a lojistas · prazo em 6 dias', link: '/chamados/tarefas/t3', recordId: 't3', companyId: 'azime', read: false }),
  nt({ userId: 'u1', ts: new Date(Date.now() - 150 * 60000).toISOString(), module: 'sharepoint', kind: 'comunicado', title: 'Comunicado publicado na intranet', subject: 'Festa de fim de ano 2026: confirme sua presença', link: '/intranet/p1', recordId: 'p1', read: false }),
  nt({ userId: 'u2', ts: new Date(Date.now() - 150 * 60000).toISOString(), module: 'sharepoint', kind: 'comunicado', title: 'Comunicado publicado na intranet', subject: 'Festa de fim de ano 2026: confirme sua presença', link: '/intranet/p1', recordId: 'p1', read: false }),
  nt({ userId: 'u1', ts: rel(0, 9, 10), module: 'reverso', title: 'Solicitação enviada para aprovação', subject: 'REV-2026-0151 · Atelier Dourado Joias', link: '/reverso/solicitacoes/r4', companyId: 'alinare', read: true }),
  nt({ userId: 'u2', ts: rel(-1, 14, 20), module: 'reverso', title: 'Aprovação aguardando sua decisão', subject: 'REV-2026-0148 · Mercadoria errada', link: '/reverso/solicitacoes/r1', companyId: 'alinare', read: false }),
  nt({ userId: 'u2', ts: rel(0, 9, 10), module: 'reverso', title: 'Aprovação aguardando sua decisão', subject: 'REV-2026-0151 · Troca de tamanho', link: '/reverso/solicitacoes/r4', companyId: 'alinare', read: false }),
  nt({ userId: 'u3', ts: rel(-2), module: 'viagens', title: 'Emissão pendente', subject: 'VG-0418 · Recife/PE · Ana Ribeiro', link: '/viagens/v2', companyId: 'azime', read: false }),
  nt({ userId: 'u4', ts: rel(-3, 9, 40), module: 'reverso', title: 'Reverso aprovado para expedição', subject: 'REV-2026-0145 · Ouro Fino Presentes', link: '/reverso/solicitacoes/r2', companyId: 'alinare', read: false }),
  nt({ userId: 'u5', ts: rel(-1, 16), module: 'inventario', title: 'Equipamento aguardando conferência', subject: 'AZ-0112 · iPhone 14', link: '/inventario/equipamentos/e4', companyId: 'azime', read: false }),
  nt({ userId: 'u5', ts: rel(-1, 17), module: 'admin', title: 'Solicitação de acesso para aplicar', subject: 'ACS-0014 · Ana Ribeiro · Reverso', link: '/admin/acessos/ar2', companyId: 'alinare', read: false }),
  nt({ userId: 'u5', ts: rel(-7, 10), module: 'admin', title: 'Conta aguardando liberação', subject: 'João Victor Alves · Novitah', link: '/admin/colaboradores/u10', companyId: 'novitah', read: true }),
  nt({ userId: 'u6', ts: rel(-2, 15), module: 'admin', title: 'Exportação de Reverso realizada', subject: 'Diego Santos · CSV · 9 registros', link: '/admin/exportacoes', companyId: 'alinare', read: false }),
];

/** Concessões individuais iniciais: a TI partiu do modelo do cargo de cada pessoa (o acesso efetivo é sempre individual). */
function materializeGrants(users: User[], templates: PermissionMatrix): User[] {
  return users.map((u) => {
    const grants: NonNullable<User['grants']> = structuredClone(u.grants ?? {});
    for (const b of u.companies) {
      grants[b] ??= {};
      for (const r of u.roles) for (const [m, gr] of Object.entries(templates[b]?.[r] ?? {})) {
        const prev = grants[b]![m as ModuleId];
        grants[b]![m as ModuleId] = prev
          ? { actions: Array.from(new Set([...prev.actions, ...gr!.actions])), scope: (['proprios', 'equipe', 'empresa'].indexOf(gr!.scope) > ['proprios', 'equipe', 'empresa'].indexOf(prev.scope) ? gr!.scope : prev.scope) as Grant['scope'] }
          : structuredClone(gr!);
      }
    }
    return { ...u, grants };
  });
}

/** Exportação já concluída no histórico da demonstração (conteúdo exato, aprovação e arquivo gerado). */
function exp6(): ExportRequest {
  const content: ExportContent = {
    companyId: 'alinare', module: 'reverso', recordIds: ['r1', 'r2', 'r3', 'r4', 'r5'],
    recordLabels: ['REV-2026-0148', 'REV-2026-0145', 'REV-2026-0139', 'REV-2026-0151', 'REV-2026-0131'],
    fields: [{ key: 'numero', label: 'Número' }, { key: 'motivo', label: 'Motivo' }, { key: 'cliente', label: 'Cliente' }, { key: 'situacao', label: 'Situação' }, { key: 'abertura', label: 'Abertura' }],
    formato: 'CSV', includeHistory: true, filtros: 'Todas as situações',
  };
  const hash = hashContent(content);
  return {
    id: 'x1', numero: 'EXP-0006', module: 'reverso', companyId: 'alinare', requesterId: 'u4', content, hash, regra: { mode: 'aprovacao', versao: 1 },
    justificativa: 'Fechamento mensal da expedição.', status: 'gerada', criadoEm: rel(-3, 14), decididoPor: 'u6', decididoEm: rel(-2, 14), aprovado: { hash, regraVersao: 1 },
    tentativas: [{ ts: rel(-2, 15), by: 'u4', result: 'gerado', detail: 'CSV com 5 registros e 6 colunas', bytes: 1480, hash }],
  };
}

export function seedData(): DemoData {
  evc = 0; nc = 0;
  const templates = seedPermissions();
  const now = Date.now();
  return {
    users: materializeGrants(structuredClone(seedUsers), templates),
    config: { leaders: ['u2'] },
    ext: Object.fromEntries(Object.entries(PLUGIN_SEEDS).map(([k, f]) => [k, f!()])),
    comments: seedComments(),
    posts: seedPosts(),
    feedback: seedFeedback(),
    teams: seedTeams(),
    emails: seedEmails(),
    sync: { sharepoint: new Date(now - 18 * 60000).toISOString(), feedback: new Date(now - 18 * 60000).toISOString(), teams: new Date(now - 2 * 60000).toISOString(), chamados: new Date(now - 60000).toISOString() },
    exportRequests: [
      exp6(),
    ],
    equipments: structuredClone(seedEquipments),
    reversos: structuredClone(seedReversos),
    viagens: structuredClone(seedViagens),
    salas: [
      { id: 's1', companyId: 'azime', nome: 'Sala Paulista', capacidade: 8, recursos: 'TV 55" · videoconferência' },
      { id: 's2', companyId: 'azime', nome: 'Sala Faria Lima', capacidade: 4, recursos: 'Quadro branco' },
      { id: 's3', companyId: 'azime', nome: 'Auditório', capacidade: 30, recursos: 'Projetor · som' },
      { id: 's4', companyId: 'alinare', nome: 'Showroom', capacidade: 6, recursos: 'Vitrines · iluminação de joias' },
      { id: 's5', companyId: 'alinare', nome: 'Sala Atelier', capacidade: 4, recursos: 'TV 43"' },
      { id: 's6', companyId: 'novitah', nome: 'Sala Nude', capacidade: 6, recursos: 'TV 50" · videoconferência' },
      { id: 's7', companyId: 'novitah', nome: 'Sala Terracota', capacidade: 10, recursos: 'Projetor' },
    ],
    reservas: [
      { id: 'rs1', salaId: 's1', data: rel(0).slice(0, 10), hora: 9, userId: 'u2', titulo: 'Alinhamento comercial' },
      { id: 'rs2', salaId: 's1', data: rel(0).slice(0, 10), hora: 14, userId: 'u6', titulo: 'Comitê de TI' },
      { id: 'rs3', salaId: 's3', data: rel(0).slice(0, 10), hora: 16, userId: 'u9', titulo: 'Treinamento financeiro' },
      { id: 'rs4', salaId: 's4', data: rel(0).slice(0, 10), hora: 11, userId: 'u7', titulo: 'Atendimento VIP' },
      { id: 'rs5', salaId: 's6', data: rel(0).slice(0, 10), hora: 10, userId: 'u8', titulo: 'Briefing campanha' },
    ],
    attachments: structuredClone(seedAttachments),
    events: seedEvents(),
    notifications: seedNotifications(),
    permissions: templates,
    plugins: [
      { id: 'inventario', version: '2.3.0', status: 'instalado', maintenance: false, companies: ['azime', 'alinare', 'novitah'] },
      { id: 'reverso', version: '1.8.2', status: 'instalado', maintenance: false, companies: ['alinare', 'novitah'] },
      { id: 'viagens', version: '1.2.0', status: 'instalado', maintenance: false, companies: ['azime', 'alinare', 'novitah'] },
      { id: 'reservas', version: '0.9.0', status: 'disponivel', maintenance: false, companies: [] },
      { id: 'chamados', version: '0.1.0-demo', status: 'instalado', maintenance: false, companies: ['azime', 'alinare'] },
    ],
    favorites: { u1: ['viagens'], u2: ['reverso'], u3: ['viagens'], u4: ['reverso'], u5: ['inventario'], u6: [] },
    accessRequests: [
      { id: 'ar1', numero: 'ACS-0011', requesterId: 'u2', targetId: 'u7', companyId: 'alinare', module: 'inventario', actions: ['ver'], scope: 'empresa', justificativa: 'Gabriela passa a apoiar a conferência do showroom.', status: 'aplicada', criadoEm: rel(-15, 11), resolvidoPor: 'u5', resolvidoEm: rel(-14, 9) },
      { id: 'ar2', numero: 'ACS-0014', requesterId: 'u2', targetId: 'u1', companyId: 'alinare', module: 'reverso', actions: ['ver', 'abrir', 'aprovar'], scope: 'equipe', justificativa: 'Ana cobrirá as aprovações de reverso da equipe durante as férias do líder (01 a 15/12).', status: 'pendente', criadoEm: rel(-1, 17) },
    ],
    exportConfig: {
      inventario: { versao: 1, enabled: true, mode: 'permanente', formats: ['CSV', 'XLSX'], roles: ['ti', 'gerencia'], fields: ['patrimonio', 'descricao', 'tipo', 'responsavel', 'localizacao', 'situacao', 'ultimaMov'], includeHistory: false },
      reverso: { versao: 1, enabled: true, mode: 'aprovacao', formats: ['CSV', 'XLSX'], roles: ['expedicao', 'gestor'], fields: ['numero', 'motivo', 'cliente', 'situacao', 'abertura'], includeHistory: true },
      viagens: { versao: 1, enabled: false, mode: 'aprovacao', formats: ['CSV'], roles: ['compras'], fields: ['codigo', 'viajante', 'destino', 'periodo', 'situacao'], includeHistory: false },
      chamados: { versao: 1, enabled: true, mode: 'permanente', formats: ['CSV'], roles: ['ti', 'gerencia'], fields: ['numero', 'assunto', 'solicitante', 'responsavel', 'prioridade', 'situacao', 'prazo'], includeHistory: false },
    },
    recent: {},
  };
}
