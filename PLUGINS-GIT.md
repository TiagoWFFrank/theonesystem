# Plugins Git no The One System 0.5.0

## Compatibilidade com instalações existentes

A mudança de nome do produto não altera os identificadores de protocolo nem a chave de armazenamento dos plugins instalados. O catálogo continua lendo `horizon-plugin.json`, `format: horizon-plugin` e `compatibility.horizon`; a sessão integrada continua expondo `window.horizonAuth`, e o backend mantém os headers `x-horizon-*`, a audiência `horizon-plugin-query` e as variáveis `HORIZON_*`. O diretório `.horizon-data/` também permanece válido. Textos legados do manifesto exibidos nas telas são apresentados com o nome The One System, sem reescrever o manifesto ou mudar sua revisão. Instalações existentes podem ser atualizadas pelo mesmo fluxo; versão ativa, permissões, preferências, configuração e dados são preservados.

## Instalação e atualização

Em **Administração → Catálogo de plugins → Instalar pelo Git**, a TI informa a URL e escolhe uma tag ou SHA completo. O servidor acessa o repositório, fixa o commit resolvido, lê **horizon-plugin.json** naquela revisão e mostra separadamente acesso, revisão, compatibilidade declarada com o The One System e o SDK, dependências e conexões. Repositórios privados usam o helper de credenciais ou a chave SSH do servidor; não coloque tokens na URL ou no manifesto.

O plugin só é instalado quando todas as verificações passam. Se faltar configuração, o acesso for negado ou o serviço estiver indisponível, a tentativa permanece pendente e inativa. A TI pode corrigir a configuração e tentar novamente com a mesma revisão. Uma atualização malsucedida mantém a versão anterior ativa. O catálogo registra ref, SHA completo, versão e data; configurações e dados ficam fora do checkout e sobrevivem a atualizações.

O instalador interpreta manifestos declarativos e não executa JavaScript ou scripts recebidos do Git. O núcleo do The One System monta rotas, menu e telas usando a sidebar, topbar, marca ativa, componentes compartilhados e Liquid Glass.

## Contrato de consulta

Um manifesto pode declarar operações de leitura GET, cada uma vinculada a uma conexão, a uma ação exigida, entradas tipadas e um caminho de resposta. Páginas **list** e **detail** vinculam operações de coleção e ficha. Entradas aceitas, campos e caminhos são validados no servidor antes da instalação. Não há operações de escrita no contrato atual.

O navegador chama apenas **/api/plugins/:id/operations/:operation**. O backend valida, em cada consulta:

- token de sessão assinado e não expirado;
- plugin instalado e ativo;
- marca ativa incluída na sessão e habilitada para o plugin;
- permissão individual da ação, ou a regra de líder quando o manifesto marca o plugin como negócio;
- parâmetros declarados e conexão configurada, permitida e disponível.

O cliente não escolhe a marca por parâmetro. O servidor encaminha à API do plugin o bearer validado, pessoa, marca, ação e escopo. Redirecionamentos são recusados, respostas ficam limitadas a 1 MB e o retorno precisa corresponder ao tipo declarado. A trilha append-only de consultas e preferências fica em **.horizon-data/plugin-audit.jsonl**, sem gravar o conteúdo retornado.

### Sessão e permissões

Em produção, o provedor de autenticação integrado ao The One System deve expor **window.horizonAuth.getPluginAccessToken()** para manter compatibilidade com plugins existentes. Esse método entrega o JWT de sessão emitido por um serviço confiável no servidor; o navegador nunca recebe a chave de assinatura. O backend valida HS256 com **HORIZON_SESSION_SECRET**, audiência **horizon-plugin-query** e expiração. Claims obrigatórias:

~~~json
{
  "aud": "horizon-plugin-query",
  "sub": "id-da-conta",
  "brandId": "azime",
  "brands": ["azime"],
  "leader": false,
  "admin": false,
  "iat": 1795000000,
  "exp": 1795003600
}
~~~

**sub**, marcas, condição de líder e papel administrativo precisam vir da sessão validada pelo host, nunca de campos editáveis no navegador. O token de origem de cada Supabase continua separado e é obtido por **getAccessToken()**. Para administração, o servidor aceita uma sessão com claim **admin** ou o header **x-horizon-admin-token** configurado fora do navegador.

No desenvolvimento local, **server/dev.mjs** habilita **/api/dev/session** somente para loopback e em **NODE_ENV=development**. Esse endpoint assina a persona local do apresentador; ele não existe em produção. Assim, Ana e Carla nos testes automatizados são perfis simulados, não contas corporativas autenticadas.

As permissões da rota, menu, busca e atalhos são filtradas no The One System. O backend é a autoridade final para dados e preferências: abrir a URL diretamente ou repetir a chamada após retirar uma permissão recebe 403.

**configuration** contém conexões globais administradas pela TI. **userConfiguration** contém preferências por pessoa e ambiente: os endpoints **/api/plugins/user-settings/:id** exigem **editar** em toda leitura e gravação. Os acessos ficam separados de **ver**.

## Configuração do servidor

~~~powershell
npm install
npm run dev
~~~

**npm run dev** inicia API em **http://127.0.0.1:4174** e Vite em **http://127.0.0.1:5173**. **npm run build** compila a interface; **npm start** serve o build e a API. O armazenamento persistente fica em **.horizon-data/**, ou no volume definido por **HORIZON_DATA_DIR**.

Variáveis exclusivas do servidor:

- **HORIZON_SESSION_SECRET**: chave HMAC compartilhada entre o emissor server-side do token de sessão e o backend; obrigatória para consultas reais em produção.
- **HORIZON_GIT_ALLOWED_HOSTS**: hosts Git confiáveis, separados por vírgula; obrigatório em produção.
- **HORIZON_PLUGIN_CONNECTION_ALLOWED_HOSTS**: hosts de API permitidos às conexões dos plugins. Loopback é aceito apenas em desenvolvimento.
- **HORIZON_ADMIN_TOKEN**: credencial administrativa alternativa, se o host não emitir claim **admin**.
- **HORIZON_DATA_DIR**: diretório persistente para catálogo, tentativas, configurações, dados e auditoria.

Credenciais Git privadas devem estar disponíveis à conta de serviço do backend por credential helper ou chave SSH e known_hosts. Não exponha essas credenciais com prefixo **VITE_**.

## Plugin Demo oficial

O template está em **plugins/horizon-plugin-demo/**; o SDK local está em **packages/horizon-plugin-sdk/**. O Demo declara:

- consulta **ver** e edição **editar** como permissões distintas;
- lista pesquisável e ficha declaradas no manifesto;
- uma preferência pessoal protegida por **editar**;
- uma conexão própria com API de exemplo;
- registros explicitamente fictícios, isolados por marca e sem qualquer vínculo a chamados ou registros reais.

Para rodar o template dentro deste checkout do The One System:

~~~powershell
git clone <URL-DO-REPOSITORIO-DEMO> ./plugins/horizon-plugin-demo
Set-Location ./plugins/horizon-plugin-demo
npm install
npm run build
npm run start:example-api
~~~

O exemplo responde em **http://127.0.0.1:4300**. Instale o plugin pela interface Git do The One System, informe essa URL quando a validação pedir a conexão e repita a mesma tag. Para desenvolver, edite **src/plugin.ts**, incremente a versão e rode **npm run build**; o manifesto gerado deve entrar no commit.

Para publicar uma revisão, faça commit do código e manifesto, crie uma tag imutável (por exemplo, **v1.1.0**) e publique no Git da equipe. Depois instale essa tag pelo catálogo. O The One System registra o SHA efetivamente usado.

## Aceite executável e limites

Rode:

~~~powershell
npm run test:e2e:plugin-git
~~~

O teste inicia armazenamento novo, instala pelo Git uma cópia renomeada do Demo que o The One System ainda não conhece, simula conexão ausente/negada/indisponível e testa correção pela mesma revisão. Confere lista e ficha com bearer e contexto encaminhados, acesso por marca e pessoa, permissão **editar**, revogação imediata, auditoria, falha de atualização, atualização bem-sucedida e preservação de preferência, configuração global e dados.

O teste automatizado usa API local e personas de demonstração. Nesta revisão, também foi conferido no Chromium o fluxo visual da tag `v1.1.0` (`c3d7a2439f8a3137db3051fbfdedd8d0e84be907`): conexão ausente deixa a tentativa pendente, configurar a API permite repetir com o mesmo SHA, só AZIME é habilitada, Ana consulta lista e ficha, e Carla tem o menu oculto e a rota direta bloqueada sem dados. O repositório usado na interface é local e `git remote -v` não retorna remotes; a publicação no remoto da organização e a comparação com contas corporativas continuam pendentes. Viagens, Inventário e Reverso aguardam os repositórios de origem, projetos Supabase e contas autorizadas. Nenhum registro real foi consultado nesta máquina.
