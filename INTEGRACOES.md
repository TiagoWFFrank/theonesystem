# Integrações · o que funciona, o que é simulado e o que está preparado

Versão 0.3. **Todas as integrações externas são simuladas** com dados demonstrativos. Os adaptadores estão isolados para que a etapa de integração substitua apenas a implementação, sem mudar as telas.

## O que funciona localmente (no navegador, sem backend)

- Navegação completa, três identidades × claro/escuro, desktop e celular.
- Painel pessoal: Meu trabalho (contribuições dos plugins e fontes), filtros por origem e situação com contagens iguais às listas, comunicados, notificações (mesmo estado no painel e no sino), mensagens do Teams, ações frequentes e atividades.
- Plugin demonstrativo **Chamados e Acompanhamento**: listas, detalhe do chamado, tarefas, comentários, transições válidas por situação e permissão, revisão (aprovação) dentro do módulo.
- Painel de trabalho: comentar e avançar a partir do Início usando as regras do plugin.
- Regras administrativas: concessões individuais por ambiente × módulo × ação × escopo; líderes com acesso total pela configuração inicial; solicitações de acesso; exportação permanente e por solicitação; auditoria.
- Notificações internas + **e-mails simulados** gerados pelo mesmo evento (caixa de saída no painel do apresentador).
- Indisponibilidade por fonte com conteúdo em cache, horário da última sincronização, “Tentar novamente” e retorno de operações malsucedidas.
- Persistência local (`localStorage`) e restauração do cenário.
- CSV real na exportação (o visualizador da prévia pode bloquear downloads; localmente funciona).

## O que está simulado

| Integração | Simulação nesta versão | Arquivo |
|---|---|---|
| Conta Microsoft (Entra ID) | Seletor de contas e verificação de liberação pela TI | `src/pages/Entrada.tsx` |
| Intranet (SharePoint) | Publicações demonstrativas com alcance explícito | `src/platform/seed03.ts`, `src/platform/sources.ts` |
| Feedback (SharePoint) | Pendências de ciclo de avaliação; “Abrir no Feedback” sem destino | `src/platform/sources.ts` |
| Chamados (sistema próprio) | Chamados, tarefas, comentários e transições locais | `src/modules/chamados/ops.ts` |
| Microsoft Teams | Mensagens e conversas de exemplo, somente leitura | `src/platform/seed03.ts`, `src/ui/feeds.tsx` |
| E-mail (Exchange) | Caixa de saída local; nada é enviado | `src/platform/store.tsx` (`notify`) |
| XLSX / PDF | Registro da exportação sem gerar o arquivo | `src/ui/export.tsx` |

## Pontos preparados para a integração real

Configuração: `src/platform/integrations.ts`. Destinos reais (abrir no Teams/SharePoint) **só aparecem quando o endereço está configurado**. Credenciais ficam no backend, nunca no navegador.

| Variável | Uso |
|---|---|
| `VITE_ENTRA_TENANT` | Login OIDC com Microsoft Entra ID → sessão no backend (Supabase Auth) |
| `VITE_SHAREPOINT_SITE` | Site da intranet (Graph: páginas de notícias / lista de comunicados) |
| `VITE_FEEDBACK_URL` | App de Feedback no SharePoint |
| `VITE_CHAMADOS_API` | API do sistema de Chamados |
| `VITE_TEAMS_ENABLED` | Graph `/me/chats` + mensagens de canais permitidos; deep links |
| `VITE_MAIL_SENDER` | Remetente do envio pelo backend (Graph `sendMail` ou SMTP) |

### Chamados e Acompanhamento: adaptação do sistema existente

O plugin demonstrativo define o contrato que o sistema real precisa atender (`src/modules/chamados/ops.ts`):

1. **Leitura**: chamados atribuídos, chamados abertos pela pessoa, tarefas por responsável e por revisor, por ambiente (marca).
2. **Comentários**: listar e incluir, preservando autor, data e origem (“pelo painel”).
3. **Transições**: a lista de transições válidas por situação e permissão deve vir do sistema de origem; a plataforma apenas apresenta e executa.
4. **Revisão/aprovação**: decidida dentro do módulo; o painel apenas abre o registro.
5. **Eventos**: cada operação devolve o evento para histórico, notificação e e-mail.
6. **Mapeamentos a validar**: usuários (e-mail Microsoft ↔ usuário do sistema), filas ↔ setores, situações ↔ etapas da plataforma, ambientes ↔ empresas.

### Contrato de contribuição dos plugins

Cada plugin declara em `contributes` (ver `src/platform/types.ts`):

- `queues(ctx)` → filas de trabalho com itens identificados por **origem, ambiente, registro e usuário destinatário/responsável**, situação, prioridade, prazo e ação (`painel`, `abrir` ou `externo`).
- `quickActions(ctx)` → ações rápidas ponderadas.
- `recordPath(id)` → destino de navegação usado por notificações, auditoria, busca e recentes.
- `taskOps` → operações para o painel de trabalho (ver, comentar, transições, aplicar), usando as regras do próprio módulo.

A plataforma coleta tudo em `src/platform/work.ts`. As filas usam as mesmas regras dos filtros das listas de destino, garantindo que a contagem seja o número de linhas. Fontes externas (Feedback) usam o mesmo contrato em `src/platform/sources.ts`.

## Regras de acesso implementadas

- A TI libera previamente a conta Microsoft (`status: aguardando → ativo`).
- A entrada permite escolher entre os ambientes autorizados.
- Líderes da configuração inicial (`config.leaders`) têm todas as ações dos módulos de negócio em todos os ambientes vinculados.
- Demais colaboradores: o acesso efetivo é **exatamente** a concessão individual (ambiente × módulo × ações × escopo). Cargos são modelos para preencher concessões, não somam acesso. A TI concede e retira ações uma a uma.
- Líderes solicitam acessos para a equipe; a TI aplica.
- Exportações: autorização permanente ou por solicitação com decisão da Gerência, por módulo.
- Registros são preservados (bloqueio, cancelamento, desativação de plugin mantêm dados e histórico).
- Auditoria de comentários, alterações de tarefa, decisões, acessos e exportações em `/admin/auditoria`.
