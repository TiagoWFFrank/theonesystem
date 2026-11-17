// Dados demonstrativos do plugin Chamados (estado inicial do adaptador simulado).
import { rel } from '@/platform/seed';
import type { Chamado, ChamadosStore, Tarefa } from './model';

const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();

export const seedChamados = (): Chamado[] => [
  // ----- AZIME -----
  { id: 'c1', numero: 'CH-2041', companyId: 'azime', titulo: 'Atualizar cadastro do lojista Casa Dourada no CRM', descricao: 'O lojista mudou de endereço e de comprador responsável. Atualizar cadastro e condições comerciais antes do próximo pedido.', categoria: 'CRM', fila: 'Comercial', solicitanteId: 'u2', responsavelId: 'u1', status: 'em_atendimento', prioridade: 'alta', criadoEm: rel(-3, 10), prazo: rel(1, 18), atualizadoEm: ago(180) },
  { id: 'c2', numero: 'CH-2038', companyId: 'azime', titulo: 'Notebook lento após atualização do Windows', descricao: 'Desde a última atualização o notebook demora para abrir o Excel e o Teams.', categoria: 'Equipamentos', fila: 'TI', solicitanteId: 'u1', responsavelId: 'u5', status: 'em_atendimento', prioridade: 'media', criadoEm: rel(-2, 9), prazo: rel(2, 18), atualizadoEm: ago(200) },
  { id: 'c3', numero: 'CH-2044', companyId: 'azime', titulo: 'Acesso ao relatório de vendas no Power BI', descricao: 'Preciso consultar o relatório de vendas por lojista para preparar a feira.', categoria: 'Acessos', fila: 'TI', solicitanteId: 'u1', responsavelId: 'u5', status: 'aguardando_solicitante', prioridade: 'baixa', criadoEm: rel(-1, 15), prazo: rel(3, 18), atualizadoEm: ago(95) },
  { id: 'c4', numero: 'CH-2030', companyId: 'azime', titulo: 'Preparação da Feira Nordeste Varejo', descricao: 'Organizar material, estande e agenda de visitas para a feira em Recife.', categoria: 'Eventos', fila: 'Comercial', solicitanteId: 'u2', responsavelId: 'u1', status: 'em_atendimento', prioridade: 'alta', criadoEm: rel(-8, 11), prazo: rel(9, 18), atualizadoEm: ago(60) },
  { id: 'c5', numero: 'CH-2047', companyId: 'azime', titulo: 'Impressora do Financeiro sem conexão', descricao: 'A impressora HP do 2º andar não aparece na rede desde hoje cedo.', categoria: 'Equipamentos', fila: 'TI', solicitanteId: 'u9', responsavelId: 'u5', status: 'aberto', prioridade: 'urgente', criadoEm: ago(70), prazo: rel(0, 18), atualizadoEm: ago(70) },
  { id: 'c6', numero: 'CH-2033', companyId: 'azime', titulo: 'Proposta comercial Rede Brilho', descricao: 'Montar proposta com desconto escalonado para a rede de 12 lojas.', categoria: 'Propostas', fila: 'Comercial', solicitanteId: 'u2', responsavelId: 'u1', status: 'em_atendimento', prioridade: 'media', criadoEm: rel(-6, 14), prazo: rel(4, 18), atualizadoEm: ago(300) },
  // ----- Alinare -----
  { id: 'c7', numero: 'CH-1188', companyId: 'alinare', titulo: 'Atualizar catálogo digital do showroom', descricao: 'Revisar fotos e descrições das peças da coleção de verão no catálogo do tablet.', categoria: 'Catálogo', fila: 'Comercial', solicitanteId: 'u2', responsavelId: 'u7', status: 'em_atendimento', prioridade: 'media', criadoEm: rel(-4, 10), prazo: rel(5, 18), atualizadoEm: ago(400) },
  { id: 'c8', numero: 'CH-1190', companyId: 'alinare', titulo: 'Tablet do showroom não sincroniza o catálogo', descricao: 'O aplicativo do catálogo exibe a versão de outubro.', categoria: 'Equipamentos', fila: 'TI', solicitanteId: 'u1', responsavelId: 'u5', status: 'aberto', prioridade: 'alta', criadoEm: ago(260), prazo: rel(1, 18), atualizadoEm: ago(260) },
];

export const seedTarefas = (): Tarefa[] => [
  { id: 't1', codigo: 'TF-311', chamadoId: 'c4', companyId: 'azime', titulo: 'Preparar material de apresentação da feira', descricao: 'Apresentação de 10 slides com lançamentos, condições e números do trimestre.', responsavelId: 'u1', revisorId: 'u2', status: 'em_andamento', prioridade: 'alta', prazo: rel(3, 18), atualizadoEm: ago(60) },
  { id: 't2', codigo: 'TF-312', chamadoId: 'c4', companyId: 'azime', titulo: 'Reservar estande e credenciais', descricao: 'Estande 3x3 no pavilhão B e 3 credenciais.', responsavelId: 'u3', revisorId: 'u2', status: 'concluida', prazo: rel(-1, 18), atualizadoEm: rel(-1, 16) },
  { id: 't3', codigo: 'TF-314', chamadoId: 'c4', companyId: 'azime', titulo: 'Confirmar agenda de visitas a lojistas', descricao: 'Agendar 6 visitas durante a feira e registrar no CRM.', responsavelId: 'u1', revisorId: 'u2', status: 'a_fazer', prioridade: 'media', prazo: rel(6, 18), atualizadoEm: rel(-1, 11) },
  { id: 't4', codigo: 'TF-309', chamadoId: 'c6', companyId: 'azime', titulo: 'Revisar proposta com desconto escalonado', descricao: 'Proposta revisada aguardando validação do líder.', responsavelId: 'u1', revisorId: 'u2', status: 'em_revisao', prioridade: 'media', prazo: rel(2, 18), atualizadoEm: ago(300) },
  { id: 't5', codigo: 'TF-207', chamadoId: 'c7', companyId: 'alinare', titulo: 'Revisar descrições das peças da coleção', descricao: '24 peças com descrição, material e cuidados.', responsavelId: 'u1', revisorId: 'u2', status: 'em_andamento', prioridade: 'media', prazo: rel(4, 18), atualizadoEm: ago(500) },
];

export const seedChamadosStore = (): ChamadosStore => ({ chamados: seedChamados(), tarefas: seedTarefas() });
