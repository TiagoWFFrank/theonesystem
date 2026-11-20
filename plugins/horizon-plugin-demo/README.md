# Plugin Demo oficial do The One System

Template de plugin para The One System 0.5.0. Além das páginas declarativas, a revisão em desenvolvimento inclui uma página React autocontida em `ui/demo.mjs`, carregada no shell após autorização. Esse código executa na mesma origem do host e requer confiança na revisão Git.

## Copiar para uma instância local

Clone este repositório como **plugins/horizon-plugin-demo** dentro do checkout do The One System. O SDK local usa a dependência **file:../../packages/horizon-plugin-sdk**.

~~~powershell
git clone <URL-DO-REPOSITORIO-DEMO> ./plugins/horizon-plugin-demo
Set-Location ./plugins/horizon-plugin-demo
npm install
npm run build
npm run start:example-api
~~~

O serviço de exemplo escuta em **http://127.0.0.1:4300**. Na instalação Git do The One System, informe essa URL quando solicitado. Os registros servidos são fictícios e filtrados pela marca que o backend The One System validou; não apontam para pendências ou dados reais.

O status é gravado pela API do Demo em `records.json` no diretório indicado por `DEMO_DATA_DIR` (por padrão, uma pasta temporária do sistema). Esse diretório deve ficar fora do checkout Git e ser preservado em atualizações; a gravação também sobrevive ao reinício da API enquanto o diretório existir. `npm run test:api` verifica esse comportamento em um diretório isolado. A API de exemplo confia nos cabeçalhos enviados pelo host e deve permanecer acessível somente ao backend confiável; ela não é uma API autenticada pronta para exposição na rede.

No checkout The One System, rode **npm run dev** em outro terminal. Use **Administração → Catálogo de plugins → Instalar pelo Git**, informe a URL Git e uma tag ou SHA completo. Corrija a conexão ausente usando a mesma tentativa. Depois habilite a marca desejada e conceda permissões por pessoa.

## Contrato do template

- **ver** abre lista pesquisável e ficha de um registro fictício.
- **editar** abre preferências e permite alterar o status de um registro fictício pela página React. O backend confere a ação antes da gravação.
- **configuration** guarda a URL global da conexão, configurada pela TI durante a instalação.
- **userConfiguration** guarda preferências individuais em armazenamento separado por conta.
- **operations** declara lista, ficha e alteração de status, entradas aceitas, conexão e caminhos da resposta.
- **connections** declara o endpoint de saúde que o instalador valida.
- **Página React** declara rota, permissão e módulo `ui/demo.mjs`; recebe React, marca, pessoa, navegação e a função de operação do host. A lista da página consulta a API de exemplo pelo backend do The One System.

O servidor The One System valida a sessão assinada, a marca ativa, a habilitação do plugin, a permissão e os parâmetros antes de encaminhar a chamada. Nenhuma permissão é confiada ao cliente. A API de exemplo recebe a identidade e o contexto de marca aprovados pelo The One System.

## Desenvolver e publicar

Edite **src/plugin.ts** e **src/demo-ui.ts**, incremente o campo **version** e rode **npm run build** para regenerar **horizon-plugin.json** e **ui/demo.mjs**. Confira o diff, faça commit do código e dos artefatos e crie uma nova tag imutável:

~~~powershell
git add .
git commit -m "Plugin Demo 1.4.0"
git tag v1.4.0
git push origin main
git push origin v1.4.0
~~~

No The One System, instale a nova tag pelo mesmo catálogo Git. O detalhe do plugin mostra o commit resolvido. Uma atualização só substitui a versão em uso depois que manifesto, dependências e conexões passam; preferências, configuração e dados persistentes são mantidos.

Repositórios privados usam a conexão Git configurada no servidor The One System. Nunca inclua tokens em URL, manifesto ou arquivos versionados.

## Aceite local

No checkout The One System, **npm run test:e2e:plugin-git** inicia uma instância sem o Demo, instala uma cópia renomeada por uma tag local, testa estados da conexão, lista e ficha, grants por pessoa e marca, edição separada, revogação, auditoria, atualização e preservação de dados. O teste usa personas e registros de exemplo; não representa uma conta corporativa ou fonte real.

Consulte **../../PLUGINS-GIT.md** para o contrato do servidor, sessão, permissões e dependências de produção.
