// Cenário 0.3: Chamados e Acompanhamento, intranet (SharePoint), Feedback (SharePoint), Teams e e-mails.
// Todo conteúdo é fictício. Conteúdos corporativos compartilhados declaram seu ALCANCE (grupo ou ambientes).
import { rel } from './seed';
import type { Chamado, Comment, EmailMessage, FeedbackItem, IntranetPost, Tarefa, TeamsMessage } from './types';

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

let cc = 0;
const cm = (module: Comment['module'], recordId: string, authorId: string, ts: string, text: string): Comment => ({ id: `cm${++cc}`, module, recordId, authorId, ts, text, via: 'plataforma' });
export const seedComments = (): Comment[] => {
  cc = 0;
  return [
    cm('chamados', 'c2', 'u5', ago(200), 'Rodei o diagnóstico remoto. Vou reinstalar o driver de vídeo amanhã às 10h.'),
    cm('chamados', 'c3', 'u5', ago(95), 'Qual workspace do Power BI você precisa: Comercial ou Diretoria?'),
    cm('chamados', 'c1', 'u2', rel(-3, 10, 20), 'Novo comprador: Marcelo. Condição de pagamento 30/60.'),
    cm('chamados', 't1', 'u2', rel(-1, 9), 'Inclua os números do último trimestre na apresentação.'),
    cm('chamados', 't1', 'u1', ago(60), 'Combinado. Estou incluindo hoje e envio para revisão.'),
    cm('chamados', 't4', 'u1', ago(300), 'Proposta revisada com desconto escalonado por volume. Pode validar?'),
    cm('chamados', 't5', 'u2', ago(600), 'Priorize as peças em ouro 18k.'),
    cm('chamados', 'c8', 'u1', ago(260), 'O tablet mostra a versão de outubro mesmo após reiniciar.'),
  ];
};

export const seedPosts = (): IntranetPost[] => [
  { id: 'p1', titulo: 'Festa de fim de ano 2026: confirme sua presença', resumo: 'Sexta, 12 de dezembro, às 19h, no Espaço Villa Jardim. Confirmações até 28/11.', publicadoEm: ago(150), autor: 'Mariana Alves', area: 'Comunicação Interna', categoria: 'Comunicado', imagem: 'festa', alcance: { tipo: 'grupo' }, destaque: true,
    conteudo: ['A festa de encerramento de 2026 reúne os colaboradores da AZIME, Alinare e Novitah na sexta-feira, 12 de dezembro, a partir das 19h, no Espaço Villa Jardim (Rua das Palmeiras, 400 · São Paulo).', 'Confirme sua presença até 28 de novembro pelo formulário da intranet. Cada colaborador pode levar um acompanhante.', 'Haverá transporte saindo da sede às 18h15 e retorno às 23h30. Informe restrições alimentares no formulário de confirmação.', 'Dúvidas: Comunicação Interna, ramal 2010.'] },
  { id: 'p2', titulo: 'Verificação em duas etapas obrigatória a partir de 01/12', resumo: 'Todas as contas Microsoft passam a exigir o aplicativo Authenticator. Configure até 30/11.', publicadoEm: rel(-2, 10), autor: 'Elisa Moura', area: 'Tecnologia da Informação', categoria: 'Orientação', imagem: 'seguranca', alcance: { tipo: 'grupo' },
    conteudo: ['A partir de 1º de dezembro, o acesso ao e-mail, ao Teams e à Plataforma AZIME exigirá verificação em duas etapas.', 'Instale o Microsoft Authenticator no celular e siga o passo a passo disponível na central de ajuda da TI.', 'Quem não configurar até 30/11 terá o acesso suspenso até concluir a configuração com a TI.'] },
  { id: 'p3', titulo: 'Procedimento atualizado: logística reversa com etiqueta digital', resumo: 'A expedição passa a emitir a etiqueta pela plataforma; prazo de coleta reduzido para 3 dias úteis.', publicadoEm: rel(-3, 15), autor: 'Diego Santos', area: 'Operações', categoria: 'Procedimento', imagem: 'procedimento', alcance: { tipo: 'ambientes', ids: ['alinare', 'novitah'] },
    conteudo: ['Revisão 4 do procedimento de logística reversa, válida para Alinare e Novitah.', '1. Solicitação aberta pelo setor com justificativa quando aplicável. 2. Aprovação do líder. 3. Etiqueta digital emitida pela expedição na plataforma. 4. Coleta em até 3 dias úteis.', 'O procedimento completo está na biblioteca de documentos da intranet.'] },
  { id: 'p4', titulo: 'Inventário anual de equipamentos: confira seus itens até 05/12', resumo: 'A TI enviará a lista de equipamentos sob sua responsabilidade. Confirme ou aponte divergências.', publicadoEm: rel(-1, 9), autor: 'Elisa Moura', area: 'Tecnologia da Informação', categoria: 'Comunicado', imagem: 'inventario', alcance: { tipo: 'ambientes', ids: ['azime'] },
    conteudo: ['O inventário anual de equipamentos da AZIME começa em 24/11.', 'Cada colaborador confirma os itens sob sua responsabilidade diretamente na plataforma, no módulo Inventário.', 'Divergências devem ser registradas como chamado na fila de TI.'] },
  { id: 'p5', titulo: 'Novitah apresenta a coleção Terracota', resumo: 'Peças em tons terrosos chegam às lojas parceiras em janeiro. Conheça os destaques.', publicadoEm: rel(-1, 16), autor: 'Henrique Prado', area: 'Marketing Novitah', categoria: 'Notícia', imagem: 'colecao', alcance: { tipo: 'ambientes', ids: ['novitah'] },
    conteudo: ['A coleção Terracota traz 32 peças inspiradas em cerâmica artesanal.', 'O material de vendas estará disponível na pasta de Marketing a partir de 02/12.'] },
  { id: 'p6', titulo: 'Showroom Alinare com novo horário em dezembro', resumo: 'Atendimento estendido até 20h de segunda a sábado durante o mês de dezembro.', publicadoEm: rel(-4, 11), autor: 'Gabriela Nunes', area: 'Comercial Alinare', categoria: 'Comunicado', alcance: { tipo: 'ambientes', ids: ['alinare'] },
    conteudo: ['De 1º a 23 de dezembro o showroom atende de segunda a sábado das 9h às 20h.', 'Agendamentos de clientes VIP continuam pela agenda compartilhada.'] },
];

export const seedFeedback = (): FeedbackItem[] => [
  { id: 'f1', userId: 'u1', titulo: 'Autoavaliação do ciclo 2026', ciclo: 'Ciclo anual 2026', prazo: rel(13, 18), status: 'pendente', alcance: { tipo: 'grupo' } },
  { id: 'f2', userId: 'u2', titulo: 'Avaliar a equipe Comercial (6 pessoas)', ciclo: 'Ciclo anual 2026', prazo: rel(13, 18), status: 'pendente', alcance: { tipo: 'grupo' } },
  { id: 'f3', userId: 'u5', titulo: 'Autoavaliação do ciclo 2026', ciclo: 'Ciclo anual 2026', prazo: rel(13, 18), status: 'pendente', alcance: { tipo: 'grupo' } },
  { id: 'f4', userId: 'u3', titulo: 'Autoavaliação do ciclo 2026', ciclo: 'Ciclo anual 2026', prazo: rel(13, 18), status: 'pendente', alcance: { tipo: 'grupo' } },
];

const tm = (m: Omit<TeamsMessage, 'thread'> & { thread?: TeamsMessage['thread'] }): TeamsMessage => ({ thread: [{ autor: m.remetenteNome, texto: m.resumo, ts: m.ts }], ...m });
export const seedTeams = (): TeamsMessage[] => [
  tm({ id: 'm1', userId: 'u1', conversa: { tipo: 'chat', nome: 'Bruno Teixeira' }, remetenteId: 'u2', remetenteNome: 'Bruno Teixeira', resumo: 'Consegue enviar a apresentação da feira para revisão ainda hoje?', ts: ago(14), lida: false, alcance: { tipo: 'grupo' },
    thread: [{ autor: 'Ana Ribeiro', texto: 'Bom dia! Estou fechando os números do trimestre.', ts: ago(90) }, { autor: 'Bruno Teixeira', texto: 'Ótimo. Consegue enviar a apresentação da feira para revisão ainda hoje?', ts: ago(14) }] }),
  tm({ id: 'm2', userId: 'u1', conversa: { tipo: 'canal', nome: 'Feira Nordeste', equipe: 'AZIME Comercial' }, remetenteId: 'u3', remetenteNome: 'Carla Mendes', resumo: 'As credenciais da feira chegaram, deixei na recepção.', ts: ago(55), lida: false, alcance: { tipo: 'ambientes', ids: ['azime'] } }),
  tm({ id: 'm3', userId: 'u1', conversa: { tipo: 'chat', nome: 'Elisa Moura' }, remetenteId: 'u5', remetenteNome: 'Elisa Moura', resumo: 'Passo na sua mesa amanhã às 10h para ver o notebook.', ts: ago(190), lida: true, alcance: { tipo: 'grupo' } }),
  tm({ id: 'm4', userId: 'u1', conversa: { tipo: 'canal', nome: 'Showroom', equipe: 'Alinare Comercial' }, remetenteId: 'u7', remetenteNome: 'Gabriela Nunes', resumo: 'Vitrine nova montada, fotos no canal.', ts: ago(1300), lida: false, alcance: { tipo: 'ambientes', ids: ['alinare'] } }),
  tm({ id: 'm5', userId: 'u1', conversa: { tipo: 'canal', nome: 'Campanhas', equipe: 'Novitah Marketing' }, remetenteId: 'u8', remetenteNome: 'Henrique Prado', resumo: 'Briefing da campanha Terracota aprovado. Obrigado pelo apoio!', ts: ago(1500), lida: true, alcance: { tipo: 'ambientes', ids: ['novitah'] } }),
  tm({ id: 'm6', userId: 'u2', conversa: { tipo: 'chat', nome: 'Fábio Lima' }, remetenteId: 'u6', remetenteNome: 'Fábio Lima', resumo: 'Data da festa fechada: 12/12. Pode avisar a equipe?', ts: ago(40), lida: false, alcance: { tipo: 'grupo' } }),
  tm({ id: 'm7', userId: 'u2', conversa: { tipo: 'canal', nome: 'Liderança', equipe: 'AZIME Gestão' }, remetenteId: 'u6', remetenteNome: 'Fábio Lima', resumo: 'Pauta do comitê de quinta publicada.', ts: ago(240), lida: true, alcance: { tipo: 'grupo' } }),
  tm({ id: 'm8', userId: 'u5', conversa: { tipo: 'chat', nome: 'Isabela Costa' }, remetenteId: 'u9', remetenteNome: 'Isabela Costa', resumo: 'A impressora do Financeiro parou de novo, abri o CH-2047.', ts: ago(68), lida: false, alcance: { tipo: 'grupo' } }),
  tm({ id: 'm9', userId: 'u5', conversa: { tipo: 'canal', nome: 'Suporte', equipe: 'TI' }, remetenteId: 'u6', remetenteNome: 'Fábio Lima', resumo: 'Lembrete: janela de manutenção sábado das 8h às 12h.', ts: ago(400), lida: true, alcance: { tipo: 'grupo' } }),
  tm({ id: 'm10', userId: 'u3', conversa: { tipo: 'chat', nome: 'Ana Ribeiro' }, remetenteId: 'u1', remetenteNome: 'Ana Ribeiro', resumo: 'Obrigada pelas credenciais!', ts: ago(50), lida: false, alcance: { tipo: 'grupo' } }),
  tm({ id: 'm11', userId: 'u4', conversa: { tipo: 'canal', nome: 'Expedição', equipe: 'Operações' }, remetenteId: 'u11', remetenteNome: 'Larissa Fontes', resumo: 'Cliente da REV-2026-0145 confirmou a coleta para amanhã.', ts: ago(120), lida: false, alcance: { tipo: 'ambientes', ids: ['alinare', 'novitah'] } }),
  tm({ id: 'm12', userId: 'u6', conversa: { tipo: 'chat', nome: 'Diego Santos' }, remetenteId: 'u4', remetenteNome: 'Diego Santos', resumo: 'Vou precisar da exportação dos reversos para o fechamento.', ts: ago(30), lida: false, alcance: { tipo: 'grupo' } }),
];

export const seedEmails = (): EmailMessage[] => [
  { id: 'em1', ts: rel(-3, 11), toUserId: 'u1', to: 'ana.ribeiro@exemplo.com', subject: '[Viagens] Documentos disponíveis · VG-0412 Belo Horizonte/MG', body: 'Olá, Ana.\n\nOs bilhetes e o voucher da viagem VG-0412 estão disponíveis na Plataforma AZIME.\n\nAbrir: /viagens/v1', module: 'viagens', recordId: 'v1', link: '/viagens/v1', companyId: 'azime' },
];
