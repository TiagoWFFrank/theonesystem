# Integrações · o que funciona, o que é simulado e o que está preparado

Versão 0.5 em preparação, com o Início e os fluxos demonstrativos da 0.4 preservados. Intranet, Feedback, Chamados, Teams e e-mail continuam simulados. Viagens, Inventário e Reverso têm rotas separadas de consulta real somente leitura; os projetos-fonte, schemas e JWT autorizado ainda não estão disponíveis nesta máquina, portanto esses percursos permanecem **NÃO VALIDADOS**. Sem configuração, as rotas mostram indisponibilidade ou acesso não validado e não usam seeds.

## Situações de uma integração

| Situação | Quando | Adaptador em uso | Como aparece |
|---|---|---|---|
| **Simulado** | Nenhum endereço configurado | Simulado | “Adaptador simulado · dados demonstrativos” |
| **Configurado · não validado** | Endereço definido na variável de ambiente, conexão ainda não confirmada | Simulado | Etiqueta azul + endereço |
| **Conexão validada** | O backend de integração confirmou a conexão | Simulado até o adaptador real ser implementado (`realAdapter`) | Etiqueta verde + “adaptador simulado” |
| **Falha na validação** | A validação foi tentada e falhou | Simulado | Etiqueta vermelha + motivo |

- A validação é pedida ao backend de integração (`VITE_INTEGRATION_API` → `GET /integracoes/<id>/status`). O navegador nunca recebe credenciais. Sem backend configurado, a validação informa que não pode ser feita.
- Nesta versão nenhum adaptador real foi implementado. Por isso, mesmo com conexão validada, os dados continuam vindo do adaptador simulado, e a interface diz isso.
- Arquivo: `src/platform/integrations.ts` (`integrationStatus`, `validateIntegration`).

### Consultas reais dos módulos

As entradas do menu levam a `/inventario/consulta`, `/viagens/consulta` e `/reverso/consulta`. As rotas legadas continuam sendo demonstrações marcadas e usam apenas o estado local. As consultas reais usam um cliente Supabase por domínio, chave publishable pública e o JWT do núcleo via `window.horizonAuth.getAccessToken()`. O The One System mantém esse identificador de sessão por compatibilidade com as integrações existentes. Sem JWT, a aplicação não envia consultas anônimas. O acesso ao menu e à rota direta exige a mesma ação `ver`; as políticas RLS da origem limitam conta e registro.

Cada projeto deve expor uma view de leitura com o nome configurado no `.env.example` e as colunas canônicas documentadas abaixo. O filtro `company_id` recebe o identificador do ambiente ativo (`azime`, `alinare` ou `novitah`). Os nomes das views e as conversões precisam ser conferidos com o código dos sistemas quando os repositórios forem anexados.

- Inventário: `id, company_id, patrimonio, descricao, tipo, modelo, serie, situacao, responsavel_nome, responsavel_email, localizacao, aquisicao, ultima_movimentacao, movimentacoes, documentos, updated_at`.
- Viagens: `id, company_id, codigo, situacao, viajante_nome, viajante_email, destino, motivo, inicio, fim, trechos, documentos, updated_at`.
- Reverso: `id, company_id, numero, situacao, solicitante_nome, solicitante_email, cliente_codigo, cliente_nome, motivo, aberto_em, historico, rastreio, documentos, updated_at`.
- `movimentacoes`, `trechos`, `historico` e `documentos` são JSON; documentos podem trazer uma URL HTTPS fornecida pela origem ou `bucket` + `path` protegidos por Storage/RLS. Nenhum endereço é montado a partir de um id fictício.
- A lista busca por patrimônio, código da viagem ou número da solicitação; a ficha é lida por id e ambiente. As telas não oferecem operações de escrita.
- Resultado 401/403/RLS: **Acesso negado**; falta de JWT: **Acesso não validado**; fonte/view/rede ausente: **Indisponível**. Nenhum erro troca para os dados demonstrativos.
- Não use `service_role` no navegador. A conta e os ambientes reais de apresentação ainda estão **NÃO VALIDADOS**.

### Destinos (abrir registros e conversas)

- **Registro** (publicação, conversa, item de Feedback): só abre o endereço **fornecido pela origem** (`webUrl` do Graph, `url` do item). Registros do adaptador simulado não têm endereço real; o botão fica desabilitado e o motivo aparece.
- **Sistema** (página inicial da intranet, do Feedback, Teams do tenant): usa o **endereço configurado**. Só aparece quando a variável correspondente existe.
- Nenhum link é montado a partir de nomes ou identificadores demonstrativos.
- Arquivo: `recordDestination` e `systemDestination` em `src/platform/integrations.ts`.

| Variável | Uso |
|---|---|
| `VITE_ENTRA_TENANT` | Login OIDC com Microsoft Entra ID, sessão no backend |
| `VITE_SHAREPOINT_SITE` | Site da intranet. Também é o destino “Abrir a intranet” |
| `VITE_FEEDBACK_URL` | App de Feedback. Também é o destino “Abrir o Feedback” |
| `VITE_CHAMADOS_API` | API do sistema de Chamados |
| `VITE_TEAMS_TENANT` | Tenant do Teams (“Abrir o Teams”); conversas usam o `webUrl` de cada uma |
| `VITE_MAIL_SENDER` | Remetente do envio pelo backend (Graph `sendMail`) |
| `VITE_INTEGRATION_API` | Backend que valida conexões e guarda credenciais |
| `VITE_SUPABASE_<MÓDULO>_URL` e `_PUBLISHABLE_KEY` | Uma conexão pública por projeto de domínio; nunca usar chave service_role |
| `VITE_<MÓDULO>_READ_VIEW` | View canônica somente leitura publicada pelo projeto do domínio |

## O que funciona localmente (no navegador, sem backend)

- Painel pessoal, plugin Chamados, painel de trabalho, concessões individuais, solicitações de acesso, auditoria, notificações e e-mails simulados, três identidades × claro/escuro, desktop e celular.
- **Operações com revalidação** (`src/ui/operation.tsx`): cada envio e cada nova tentativa conferem, com o estado do momento, pessoa, ambiente, módulo habilitado, registro, permissão e situação. Troca de pessoa, ambiente ou registro, fechamento do painel e saída da tela antes da confirmação cancelam o envio sem alterar nada. O texto fica guardado como rascunho por pessoa × ambiente × registro e sobrevive a recarregar a página.
- **Disponibilidade** (`src/platform/store.tsx`, `src/ui/source.tsx`): a plataforma distingue o estado real do sistema externo (controlado pelo apresentador) do que ela conhece. A queda é percebida ao consultar. A volta só é percebida numa nova tentativa: automática a 15, 30 e 60 s, com contagem visível, pausa e retomada, ou manual em “Tentar agora”. A reconexão mostra um retorno verde e atualiza o horário do cache. Operações (comentários, transições) **não** são reenviadas automaticamente.
- **Exportações** (`src/platform/exports.ts`, `src/ui/export.tsx`, `src/pages/ExportRequest.tsx`): o conteúdo exato fica registrado e é verificado por um código (hash). O download é revalidado. CSV é gerado de verdade.
- Persistência local (`localStorage`; rascunhos em `sessionStorage`) e restauração do cenário.

## O que está simulado

| Integração | Simulação | Arquivo |
|---|---|---|
| Conta Microsoft | Seletor de contas e verificação de liberação | `src/pages/Entrada.tsx` |
| Intranet e Feedback (SharePoint) | Publicações e pendências demonstrativas | `src/platform/seed03.ts`, `src/platform/sources.ts` |
| Chamados (sistema próprio) | Chamados, tarefas, comentários e transições locais | `src/modules/chamados/ops.ts`, `seed.ts` |
| Microsoft Teams | Conversas de exemplo, somente leitura | `src/ui/feeds.tsx` |
| E-mail | Caixa de saída local; nada é enviado | `src/platform/store.tsx` (`notify`) |
| XLSX / PDF | Conteúdo conferido, **nenhum arquivo produzido** (“exportação simulada”) | `src/ui/export.tsx` |
| Sistemas fora do ar | Interruptores “Fora do ar” no painel do apresentador | `src/layout/Presenter.tsx` |
| Ações de outras pessoas | “Eventos de outras pessoas” no painel do apresentador | `src/layout/demoEvents.ts` |

## Contrato dos plugins

Declarado em `ModuleManifest` (`src/platform/types.ts`). O núcleo consome só o contrato. Ele não importa tipos, prioridades, situações nem identificadores de nenhum plugin; Chamados é o primeiro caso migrado.

| Campo | O que o plugin fornece |
|---|---|
| `actions`, `business` | Ações que o plugin declara. Para módulos de negócio, é a lista concedida aos líderes da configuração inicial |
| `origin` | Sistema de origem, integração usada e texto do aviso de indisponibilidade |
| `data.seed` | Estado inicial dos próprios dados, guardado em `data.ext.<plugin>` |
| `contributes.queues` | Filas de Meu trabalho. Cada item identifica origem, ambiente, registro e pessoa; a prioridade usa a escala normalizada (`PriorityTag`: rótulo, ordem, tom) |
| `contributes.quickActions` | Ações frequentes |
| `contributes.recordPath(id, ctx)` | Destino de um registro, resolvido pelos dados e não pelo formato do id |
| `contributes.taskOps` | Painel de trabalho: `view` (com aviso opcional, ex.: “decisão só no módulo”), `comments`, `transitions`, `canComment`, `checkTransition` (distingue permissão retirada de situação alterada), `comment`, `apply` |
| `contributes.search` | Resultados da busca global |
| `contributes.exports` | Campos, linhas visíveis para a pessoa e histórico de cada registro |

Inventário, Reverso e Viagens também passaram a fornecer `search` e `exports`. O núcleo não tem mais colunas nem buscas fixas desses módulos.

### Chamados e Acompanhamento: adaptação do sistema existente

Adaptador em `src/modules/chamados/ops.ts`. Cada operação chama `api.call('chamados')`, ponto onde a chamada real à API entra. Se o sistema não responder, a chamada lança `OpError('indisponivel')`.

1. **Leitura**: chamados atribuídos, chamados abertos pela pessoa, tarefas por responsável e por revisor, por ambiente.
2. **Comentários**: listar e incluir (autor, data, “pelo painel”).
3. **Transições**: lista válida por situação e permissão, conferida de novo no envio. Respostas distintas para permissão e situação.
4. **Revisão/aprovação**: decidida dentro do módulo; o painel só abre o registro.
5. **Eventos**: cada operação gera histórico, notificação e e-mail.
6. **Mapeamentos a validar**: usuários (e-mail Microsoft ↔ sistema), filas ↔ setores, situações ↔ etapas, ambientes ↔ empresas.

## Exportações

- **Permanente**: cargos autorizados exportam direto; a regra é conferida no clique.
- **Por solicitação**: o pedido registra ambiente, módulo, registros (ids e rótulos), campos, formato, inclusão do histórico, filtros, versão da regra e um hash do conteúdo. A Gerência aprova exatamente esse conteúdo e só pode aprovar se ele couber na regra atual.
- **Download**: revalida pessoa, ambiente, autorização (hash igual ao aprovado), acesso atual ao módulo, regra atual (campos, formato, cargo, histórico) e acesso a cada registro. O arquivo é montado só com os registros e campos autorizados e conferido pelo hash.
- **Resultados distintos**: arquivo gerado, exportação simulada (XLSX/PDF), falha na geração (serviço de arquivos ou navegador; permite nova tentativa) e download bloqueado (com o motivo). Todos ficam na solicitação e na auditoria.
- **Regra alterada**: cada alteração cria uma nova versão. Antes de salvar, a Gerência vê quais aprovações a mudança vai bloquear.

## Instalação de extensões pelo Git

O backend da plataforma acessa repositórios públicos ou privados, lê uma revisão exata e confere manifesto, compatibilidade, dependências e cada conexão declarada antes de registrar a instalação. A tentativa pendente mantém o mesmo SHA para nova validação. URLs privadas usam credenciais Git configuradas no servidor; não passe token pelo navegador.

O instalador aceita o contrato declarativo `horizon-plugin.json` e não executa scripts do repositório. O template e as etapas operacionais estão em [PLUGINS-GIT.md](PLUGINS-GIT.md).

## Regras de acesso

- A TI libera previamente a conta Microsoft. Na entrada, a pessoa escolhe entre os ambientes autorizados.
- Líderes da configuração inicial têm todas as ações dos módulos de negócio em todos os ambientes vinculados.
- Para os demais, o acesso efetivo é exatamente a concessão individual. Cargos são modelos, não somam acesso.
- Líderes solicitam acessos e a TI aplica. Retiradas valem na hora, inclusive para operações e downloads já iniciados.
- Registros são preservados, e a auditoria cobre comentários, tarefas, decisões, acessos e exportações.
