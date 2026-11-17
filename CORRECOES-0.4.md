# Versão 0.4 · correções e verificações

Base: 0.3 (frontend aprovado mantido como referência visual). Foco: consistência dos fluxos já entregues.

## 1. Retentativas e operações pendentes

**Problemas na 0.3**
- A nova tentativa repetia a mesma função, com o contexto capturado no primeiro clique: pessoa, ambiente, dados e permissões da hora do clique.
- Uma operação pendente continuava após trocar de pessoa, ambiente ou registro e gravava com o contexto antigo.
- O texto se perdia ao fechar o painel ou trocar de registro.

**Correções**
- Um executor comum (`src/ui/operation.tsx`) é usado pelo painel de trabalho e pelas telas do módulo Chamados.
- Cada tentativa é montada no momento do envio, com o texto atual. Antes de alterar qualquer coisa, a execução revalida nesta ordem:
  1. pessoa e ambiente;
  2. plugin habilitado e fora de manutenção;
  3. registro existente, do ambiente e no alcance da pessoa;
  4. permissão atual;
  5. situação atual;
  6. disponibilidade do sistema de origem.
- Falhas têm motivo próprio: *sem resposta* (permite nova tentativa), *permissão alterada*, *situação mudou*, *registro indisponível*, *módulo indisponível* e *falta o comentário*. O painel mostra só as ações válidas no momento.
- Troca de pessoa ou ambiente, troca de registro, fechamento do painel, saída da tela e o botão *Cancelar envio* cancelam a operação antes do envio. Nada é gravado e um aviso explica o motivo. Trocar de pessoa ou ambiente também fecha o painel.
- O texto fica como rascunho por pessoa × ambiente × registro. Sobrevive a falhas, cancelamentos e recarregamento da página, e não aparece para outra pessoa.
- O plugin confere tudo de novo no próprio adaptador (`canComment`, `checkTransition`) e distingue permissão retirada de situação alterada.

## 2. Mensagens de disponibilidade

**Problema na 0.3**: o aviso prometia uma nova tentativa automática em 1 minuto que não existia. A disponibilidade era lida direto do interruptor do apresentador.

**Correções**
- A plataforma separa o estado real do sistema externo (interruptor *Fora do ar*) do que ela sabe. A queda é percebida ao consultar. A volta só é percebida numa nova tentativa.
- As tentativas automáticas são agendadas em 15, 30 e 60 s, com contagem visível, número de tentativas sem resposta, *Pausar automáticas* e *Retomar automáticas*.
- Na reconexão aparece um retorno verde (“voltou a responder às HH:MM; conteúdo atualizado”) e o horário do cache é renovado.
- Os avisos dizem o que de fato acontece: conteúdo em cache com horário; comentários e transições enviados só ao confirmar; operações nunca reenviadas automaticamente.
- Cada origem que alimenta Meu trabalho (Chamados, Feedback) tem o próprio aviso. A geração de arquivos tem disponibilidade própria (*Serviço de arquivos*).

## 3. Integrações e destinos

**Problemas na 0.3**: só existiam os estados real e simulado, definidos pela presença de uma variável. O link do Teams era montado a partir do nome da conversa e o do SharePoint a partir do id demonstrativo.

**Correções** (`src/platform/integrations.ts`)
- Quatro situações: *Simulado*, *Configurado · não validado*, *Conexão validada* e *Falha na validação*.
- A validação é pedida ao backend de integração (`VITE_INTEGRATION_API`). Sem backend, a interface informa que não pode validar.
- A etiqueta sempre mostra o adaptador em uso. Nesta versão é sempre o simulado, inclusive com conexão validada, porque nenhum adaptador real foi implementado.
- Registros abrem só o endereço fornecido pela origem. Registros demonstrativos ficam com o botão desabilitado e o motivo.
- Destinos de sistema (abrir a intranet, o Feedback, o Teams do tenant) usam o endereço configurado.
- `VITE_TEAMS_ENABLED` foi trocado por `VITE_TEAMS_TENANT`. Foram incluídos `VITE_INTEGRATION_API` e o arquivo `.env.example`.

## 4. Contrato dos plugins

**Problemas na 0.3**: o núcleo importava tipos, prioridades e a busca do Chamados. Também dependia do formato dos ids (`t…` para tarefa, `c…` para chamado) e de textos de situação (“Em revisão”). As colunas de exportação e as ações dos líderes eram fixas no núcleo.

**Correções**
- Os tipos e dados do Chamados saíram do núcleo. Estão em `src/modules/chamados/model.ts`, com os dados próprios em `data.ext.chamados` e estado inicial declarado pelo plugin.
- A prioridade passou a ser normalizada (`PriorityTag`: rótulo, ordem, tom); cada plugin mapeia a sua escala.
- `recordPath` resolve o registro pelos dados, sem depender do formato do id. O atalho do roteiro passou a ser `?painel=<origem>:<registro>`.
- O painel de trabalho consome só o contrato: `view` (com aviso fornecido pelo plugin), `comments`, `transitions`, `canComment`, `checkTransition`, `comment` e `apply`.
- O manifesto ganhou `origin` (sistema, integração, texto do aviso), `data.seed`, `contributes.search` e `contributes.exports` (campos, linhas visíveis e histórico).
- Inventário, Reverso e Viagens também fornecem busca e exportação. As ações dos líderes vêm das ações declaradas pelos módulos de negócio.
- Chamados ganhou exportação própria (permanente para TI e Gerência).
- Ainda citam o Chamados fora do plugin: o tipo `ModuleId`, a configuração da integração, o registro de estados iniciais (`modules/seeds.ts`) e os arquivos exclusivos da demonstração (roteiro e eventos do apresentador).

## 5. Exportações por aprovação

**Problemas na 0.3**: o pedido não guardava campos, formato aprovado nem ambiente de forma verificável. O download usava os campos da regra vigente naquele momento. Não havia revalidação de acesso. “Baixado” valia também para formatos que não geram arquivo.

**Correções** (`src/platform/exports.ts`, `src/ui/export.tsx`, `src/pages/ExportRequest.tsx`)
- O pedido registra ambiente, módulo, registros (ids e rótulos), campos, formato, histórico, filtros, versão da regra e um código (hash) do conteúdo.
- A Gerência aprova exatamente esse conteúdo e só pode aprovar se ele couber na regra atual e continuar acessível ao solicitante.
- O download revalida, no clique:
  - solicitante ativo;
  - ambiente da solicitação;
  - autorização (hash igual ao aprovado);
  - acesso atual ao módulo;
  - regra atual (campos, formato, cargo e histórico);
  - acesso a cada registro.
  A página mostra essa verificação item a item.
- O arquivo é montado só com os registros e campos autorizados e conferido pelo hash. Qualquer divergência impede a geração.
- Os resultados são distintos e ficam registrados nas *Tentativas* da solicitação e na auditoria:
  - **arquivo gerado** (CSV);
  - **exportação simulada** (XLSX e PDF: conteúdo conferido, nenhum arquivo produzido);
  - **falha na geração** (serviço de arquivos ou navegador; permite nova tentativa);
  - **download bloqueado** (com o motivo).
- Cada alteração de regra gera uma nova versão. Antes de salvar, a Gerência vê quais aprovações a mudança vai bloquear.

## Verificações executadas

Testes automatizados em navegador (Playwright), na pasta `testes/` (instruções em `testes/README.md`).

| Conjunto | Cobertura | Resultado |
|---|---|---|
| `flow4.cjs` · regressão | Os 10 cenários da 0.3 com o comportamento novo: contagens = listas, comentar e avançar pelo painel, decisão no módulo, intranet e sino, Teams, troca de ambiente, indisponibilidade, concessão e retirada, exportação permanente e por aprovação (com download real), celular em 390 e 360 px | **48/48** |
| `robust4.cjs` · falha e recuperação | Falha clara com texto mantido; tentativa numerada; plataforma ainda “fora” após o sistema voltar; *Tentar novamente* com o texto atual reconecta; tentativa automática agendada, pausa, retomada, reconexão e retorno visual que some | 10 |
| `robust4.cjs` · mudança de contexto | Troca de ambiente, troca de pessoa, fechamento do painel e troca de registro durante o envio: nada gravado e rascunho preservado; rascunho não aparece para outra pessoa | 7 |
| `robust4.cjs` · permissão e situação | Permissão retirada durante o envio e antes de uma nova tentativa (recusa sem reenvio); situação alterada por outra pessoa (recusa explicada, ações atualizadas); sem acesso ao módulo o registro não é exibido | 6 |
| `robust4.cjs` · exportações | Conteúdo exato registrado; aprovação bloqueada se a regra não permite; falha na geração; regra alterada após aprovação bloqueia e registra; CSV gerado confere com o autorizado (linhas, cabeçalho, hash); acesso retirado bloqueia; outro ambiente; aviso de aprovações afetadas; nova versão da regra; XLSX simulado sem arquivo | 12 |
| `robust4.cjs` · integrações e console | Todas as integrações identificadas como simuladas, apresentador distingue sistema fora do ar e conhecimento da plataforma; nenhum erro de console | 3 · **total 38/38** |
| `integ4.cjs` · integrações configuradas | Servidor com endereços configurados e backend de validação falso: *Configurado · não validado*; nenhum link inventado para registros demonstrativos; destino de sistema com o endereço configurado (SharePoint, Teams do tenant); *Conexão validada* mantendo o adaptador simulado; *Falha na validação* com motivo; sem endereço continua *Simulado* | **7/7** |
| `mobile4.cjs` · celular | Avisos, falha no painel e verificação da exportação em 390 px (claro) e 360 px (Alinare escuro), sem rolagem horizontal | **7/7** |

Também verificado:
- `tsc -b` sem erros.
- Builds de produção e da prévia em arquivo único.
- Teste de fumaça da prévia: entrada, comentário pelo painel e integrações identificadas, sem erros de console. O gancho de testes não existe na build de produção.
