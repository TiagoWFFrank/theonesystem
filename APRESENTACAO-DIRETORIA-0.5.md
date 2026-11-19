# Roteiro curto para a diretoria · The One System 0.5.0

## Sequência da apresentação

1. **Início demonstrativo** — abrir o painel atual com Ana Ribeiro e ambiente AZIME. Preservar os cenários aprovados de Meu trabalho, Chamados, Acompanhamento, notificações, Intranet, Feedback e Teams.
2. **Viagens real** — pelo mesmo menu, abrir a lista, escolher uma viagem autorizada e consultar ficha, trechos, situação e documentos.
3. **Inventário real** — pelo mesmo menu, buscar um número de patrimônio autorizado e consultar situação, responsável e movimentações.
4. **Reverso real** — pelo mesmo menu, abrir solicitações autorizadas e consultar situação, histórico e rastreio.
5. **Plugin Demo** — no catálogo administrativo, instalar uma revisão Git, habilitar somente AZIME, comparar a conta com acesso e a conta sem acesso e consultar um registro fictício do Demo dentro do The One System.

O Início permanece uma demonstração. Pendências demonstrativas de Viagens, Inventário ou Reverso não apontam para registros reais e não executam operações sobre eles. As consultas reais são somente leitura.

## Validação dos módulos reais

| Módulo | Conta e ambiente usados | Percurso conferido | Resultado e dependência |
|---|---|---|---|
| Início | Ana Ribeiro · AZIME, perfil local de demonstração | Início e cenários aprovados atuais | Demonstrativo preservado; não representa autenticação corporativa. |
| Viagens | Conta real e ambiente real ainda não disponíveis | Lista → seleção de viagem → ficha, trechos, situação e documentos | Não validado com dados reais. Aguardando repositório, projeto Supabase, schema e conta autorizada. |
| Inventário | Conta real e ambiente real ainda não disponíveis | Busca de patrimônio → ficha, situação, responsável e movimentações | Não validado com dados reais. Aguardando repositório, projeto Supabase, schema e conta autorizada. |
| Reverso | Conta real e ambiente real ainda não disponíveis | Lista → solicitação → situação, histórico e rastreio | Não validado com dados reais. Aguardando repositório, projeto Supabase, schema e conta autorizada. |

Esta máquina não tem acesso aos projetos e contas dos três sistemas, conforme combinado. As conexões de produção, a resposta real de acesso negado e a indisponibilidade das fontes ainda precisam ser verificadas quando os repositórios forem anexados. O The One System deve mostrar esses estados sem recorrer ao conteúdo fictício do painel.

## Plugin Demo e instalação

O template local declara manifesto, menu e rotas, lista e ficha somente leitura, conexão própria, preferências pessoais e permissões distintas **ver** e **editar**. Seus registros são fictícios e aparecem identificados como demonstração.

| Etapa | Conta e ambiente | Percurso conferido | Estágio |
|---|---|---|---|
| Aceite automatizado do backend | Instância temporária; personas u1/u3 e marca AZIME | Git local de uma cópia renomeada → conexão ausente/negada/indisponível → correção → lista/ficha → grants → revogação → atualização | Passou. Confere SHA, bloqueios, auditoria e preservação de acesso, configuração e dados. Não usa contas corporativas. |
| Instalação por Git na interface da TI | Elisa (TI) · instância local; personas de demonstração | Catálogo administrativo → tag `v1.1.0` → conexão pendente → configuração da API local → repetir tentativa → habilitação de AZIME | Passou visualmente nesta revisão. O catálogo fixou o commit `c3d7a2439f8a3137db3051fbfdedd8d0e84be907`; a tentativa ficou pendente sem conexão e instalou após a correção, mantendo o mesmo SHA. |
| Consulta e bloqueio pela interface | Ana e Carla · AZIME · perfis simulados | Ana: menu → lista `DEMO-1001`/`DEMO-1002` → ficha `DEMO-1001`; Carla: menu ausente → rota direta | Passou no Chromium a 1440 × 1000, sem erros de console. Ana consultou a API própria do Demo; Carla recebeu acesso negado sem dados. Os registros são fictícios. |
| Instalação por pacote | Catálogo ainda contém importação local de ZIP declarativo | ZIP local → leitura do manifesto | Prova local existente, separada do Git; não substitui o aceite de instalação a partir de pacote remoto. |
| Publicação remota do Demo | `git remote -v` não retorna remotes; URL e credenciais da equipe não fornecidas | Publicar tag imutável e instalá-la pelo catálogo a partir do remoto | Pendente. A validação visual usou o repositório Git local; o teste automatizado usa uma cópia temporária. |

O Plugin Demo valida o contrato de extensão, não dados reais de negócio. O aceite visual local usou as personas simuladas Ana e Carla; a comparação com contas corporativas, a instalação a partir do remoto da equipe e os três percursos reais ainda dependem das respectivas fontes e credenciais.

## Próximas dependências

- Receber os repositórios de Viagens, Inventário e Reverso, os schemas/views de leitura, URLs dos projetos Supabase e as contas autorizadas para apresentação.
- Integrar ao host emissor o JWT de sessão assinado e claims confiáveis de pessoa, marcas, liderança e administração.
- Configurar e publicar o remoto Git do Plugin Demo e a API de exemplo no ambiente da apresentação; repetir a instalação da tag aprovada a partir desse remoto.
- Repetir a comparação com contas corporativas autorizada e sem acesso. A prova local já confirmou menu oculto, rota direta bloqueada e ausência de dados para Carla.

## Validação executada nesta revisão

- **Build**: TypeScript e Vite.
- **Teste Git end-to-end**: instância isolada em diretório temporário, sem plugin previamente instalado.
- **Acesso**: consulta sem sessão, marca desabilitada, pessoa sem grant, grant de consulta, grant de edição, revogação e acesso de líder a plugin de negócio.
- **Atualização**: versão incompatível mantém a anterior; atualização aprovada preserva dados, conexão e preferências individuais.
- **Aceite visual**: Chromium, 1440 × 1000; instalação da tag `v1.1.0` pelo repositório local; conexão pendente corrigida na mesma tentativa; AZIME habilitada; Ana consultou lista e ficha; Carla teve menu oculto e rota direta bloqueada; nenhum erro de console.
- **Limite**: a API e os perfis usados são locais e os dados são fictícios. Não prova publicação remota, contas corporativas nem integração real com Viagens, Inventário ou Reverso.
