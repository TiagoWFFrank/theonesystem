# Roteiro demonstrativo · The One System 0.5.0

Duração sugerida: 15 a 18 minutos. Todos os passos estão no **painel do apresentador** (selo *Demonstração* no cabeçalho; no celular, botão flutuante) com botões que já preparam perfil, ambiente e tela. Antes de começar: **Restaurar demonstração**.

| # | Cenário | Como fazer | O que conferir |
|---|---|---|---|
| 1 | Entrar como colaboradora e ver chamados, tarefas, intranet e mensagens | *Pela entrada Microsoft* → Ana Ribeiro → AZIME | Meu trabalho com origens Chamados, Feedback (SharePoint) e Viagens; faixa sólida = sob sua responsabilidade, faixa tracejada = chamados que você abriu; comunicados, Teams e notificações à direita |
| 2 | Comentar uma tarefa pelo painel | Em Meu trabalho, **TF-311 → Trabalhar** | Resumo, comentários, campo de comentário e só as ações válidas (Enviar para revisão, Voltar para A fazer). Comente: aparece “Enviando…” com *Cancelar envio* e depois a confirmação |
| 3 | Avançar a tarefa e conferir no módulo | No painel: **Enviar para revisão** → **Abrir no módulo** | Situação “Em revisão”, histórico com o comentário e o avanço, lista Chamados › Tarefas atualizada, notificação + e-mail para o revisor |
| 4 | Abrir uma aprovação pelo painel e decidir dentro do módulo | Passo 4 → Bruno (líder) · Início → **TF-311 · Decidir no módulo** → Aprovar e concluir | A aprovação não acontece no painel; abre a tarefa no módulo Chamados. Ana recebe notificação e e-mail |
| 5 | Abrir o comunicado da festa | Ana · Início → card **Festa de fim de ano 2026** | Conteúdo, área, autoria, alcance “Todo o grupo” e origem SharePoint; a notificação do comunicado passa a lida também no sino |
| 6 | Consultar uma mensagem do Teams | Ana · Início → mensagem de **Bruno Teixeira** | Conversa de exemplo e marcação de lida. “Abrir no Teams” fica desabilitado, com o motivo: registro demonstrativo, sem endereço real. Rodapé: adaptador simulado |
| 7 | Trocar de ambiente | Cabeçalho → Ambiente → **Alinare**, depois **Novitah** | Alinare: TF-207, CH-1190, procedimento de logística reversa, canal Showroom. Novitah: sem Chamados (plugin não habilitado pela TI), coleção Terracota |
| 8 | Indisponibilidade só da intranet | Passo 8 → *Intranet fora do ar*, depois *Restabelecer* | Aviso apenas na área de comunicados, com o horário do cache e a contagem da próxima tentativa automática. Mostre *Pausar automáticas*/*Retomar* e *Tentar agora*. Depois de restabelecer, o aviso continua até a próxima tentativa; aí aparece “voltou a responder”. Chamados seguem comentáveis |
| 9 | TI concede e retira uma permissão individual | Passo 9 → Elisa (TI) · ficha da Ana em **Alinare** → marque *Reverso · Aprovar ou devolver*, desmarque *Abrir solicitação* → Revisar e aplicar | Lista de alterações (+/−), auditoria, e-mail para a Ana; *Ver como Ana*: o botão “Abrir solicitação” some |
| 10 | Exportação permanente e sujeita à aprovação | TI · Inventário → **Exportar**; Diego · Reverso → **Solicitar exportação**; Fábio · Início → **Decidir**; Diego · Início → **Baixar** | Permanente gera direto; por solicitação passa pela Gerência; tudo na Auditoria; e-mails na caixa de saída |

### Robustez (0.4)

Use também a seção **Eventos de outras pessoas** do painel do apresentador. Ela simula o que outra pessoa ou sistema faz enquanto você usa a plataforma.

| # | Cenário | Como fazer | O que conferir |
|---|---|---|---|
| 11 | Falha e recuperação | Passo 11 → *Chamados fora do ar*; comente a TF-311; *Restabelecer sistema*; **Tentar novamente** | Falha clara: nada alterado, texto mantido, tentativa numerada. A nova tentativa usa o texto e o contexto do momento e reconecta a origem (aviso verde). Operações não são reenviadas sozinhas |
| 12 | Trocar de contexto com envio pendente | Comente a TF-311 e, durante “Enviando…”, troque de ambiente (ou feche o painel) | Aviso “não foi enviado: o ambiente foi trocado…”. Nada é gravado. Ao voltar para AZIME e reabrir a TF-311, o rascunho está lá. Outra pessoa conectada não vê o rascunho |
| 13 | Permissão retirada antes do envio | TF-311 aberta → desmarque *Ana pode Atender* → clique em *Enviar para revisão* | Recusa por “Permissão alterada”, ações somem do painel, texto mantido. Com *TF-311 em andamento* desmarcado, a recusa é por “A situação mudou” e o painel passa a oferecer *Iniciar tarefa* |
| 14 | Regra de exportação alterada após aprovação | Diego · EXP-0006 → *Verificação no download* toda verde → desmarque *Regra de Reverso inclui Cliente* → **Baixar de novo** | Download bloqueado com o motivo, registrado em Tentativas e na Auditoria. Marque de novo: o arquivo é gerado e confere com o conteúdo autorizado (#código). Em Fábio · Regras, ao retirar um campo, aparece o aviso das aprovações que serão bloqueadas |

Ao final, abra **Integrações › E-mail › Caixa de saída** no painel do apresentador para mostrar os e-mails gerados pelos eventos (destinatário, assunto e registro relacionado).

### Instalação e consulta do Plugin Demo pelo Git (0.5.0)

| # | Cenário | Como fazer | O que conferir |
|---|---|---|---|
| 15 | Instalar uma cópia de plugin que a instância ainda não conhece | Elisa (TI) → Administração → Catálogo de plugins → Instalar pelo Git → repositório Demo → tag v1.1.0 → validar | **Conferido visualmente no repositório local:** SHA `c3d7a2439f8a3137db3051fbfdedd8d0e84be907`; acesso, revisão, compatibilidade e conexão aparecem em verificações separadas. Sem conexão, a tentativa fica pendente; depois de configurar a API, repetir com a mesma revisão. |
| 16 | Habilitar por marca e pessoa | Detalhe do plugin → habilitar somente AZIME; conceder à Ana a ação **Consultar o Plugin Demo**; manter Carla sem grant | **Conferido visualmente:** só AZIME ficou habilitada; o menu apareceu para Ana e ficou oculto para Carla. A rota direta de Carla exibiu acesso negado sem dados. O grant **editar** e a tela de preferências pertencem ao roteiro completo, mas não foram exercitados neste aceite visual. |
| 17 | Consultar lista e ficha no The One System | Ana → Plugin Demo → abrir `DEMO-1001` | **Conferido visualmente:** a API própria do plugin retornou `DEMO-1001` e `DEMO-1002`; Ana abriu a ficha `DEMO-1001`. Os dados são fictícios e identificados como demonstração. |
| 18 | Atualizar o plugin | Depois de publicar uma nova revisão, instalar pelo mesmo catálogo | O SHA deve mudar; configurações, preferências individuais e dados do plugin devem ser preservados. A atualização visual ainda não foi repetida nesta revisão. |

O aceite visual desta revisão usou Chromium (1440 × 1000), a tag local `v1.1.0` e a API de exemplo em loopback. Ana e Carla são personas locais simuladas, sem autenticação corporativa. O repositório do Demo não tem remoto Git configurado; a instalação publicada continua pendente.

## Sequência para a diretoria

1. Início demonstrativo atual, com Ana Ribeiro e AZIME. Chamados, Meu trabalho, notificações, Intranet, Feedback e Teams permanecem no cenário aprovado.
2. Viagens pelo menu: abrir lista, escolher uma viagem real e conferir ficha, trechos, situação e documentos.
3. Inventário pelo menu: buscar patrimônio real e conferir situação, responsável e movimentações.
4. Reverso pelo menu: abrir solicitações reais e conferir situação, histórico e rastreio.
5. Plugin Demo pelo catálogo Git e depois pelo menu: instalar a revisão, habilitar uma marca, comparar conta autorizada e conta sem permissão e consultar um registro fictício.

## Status das fontes reais nesta máquina

| Módulo | Conta/ambiente real | Percurso real | Estado |
|---|---|---|---|
| Viagens | Aguardando repositório, projeto Supabase e conta autorizada | Lista → ficha → trechos, situação e documentos | Não validado com dados reais |
| Inventário | Aguardando repositório, projeto Supabase e conta autorizada | Busca de patrimônio → ficha → situação, responsável e movimentações | Não validado com dados reais |
| Reverso | Aguardando repositório, projeto Supabase e conta autorizada | Lista → ficha → situação, histórico e rastreio | Não validado com dados reais |

A prova automatizada do Plugin Demo usa perfis e dados fictícios em armazenamento temporário; ela não valida contas corporativas nem os três sistemas de origem. Se uma consulta real for negada ou a integração estiver indisponível, a tela deve exibir esse estado sem substituir a resposta por dados demonstrativos.
## Celular

Abra em 390 px (ou 360 px). O Início empilha: prioridade → Meu trabalho → comunicados → mensagens → notificações → ações → atividades. O painel de trabalho ocupa a tela com ações e comentário acessíveis.

## Perguntas para a gestão

1. A hierarquia do Início (trabalho → comunicados → mensagens) é a correta?
2. Quais filas do sistema de Chamados devem aparecer no Meu trabalho de cada setor?
3. Quais comunicados da intranet devem ter alcance por ambiente e quais por grupo?
4. Quais módulos exportam com autorização permanente e quais por solicitação?
5. Aprovações de exportação devem expirar (prazo ou número de downloads)?
6. Intervalo das tentativas automáticas em produção (na demonstração: 15, 30 e 60 s).
