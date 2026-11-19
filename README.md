# The One System · versão 0.5 em preparação para a diretoria

O nome de produto nas telas é **The One System**. Os identificadores técnicos legados dos plugins — incluindo `@azime/horizon-plugin-sdk`, `horizon-plugin.json`, `format: horizon-plugin`, `compatibility.horizon`, `window.horizonAuth`, `HORIZON_*` e `.horizon-data/` — permanecem aceitos nesta migração. Instalações, permissões, preferências e dados persistentes continuam disponíveis após a atualização.

> **Base aprovada da 0.4** (o visual foi mantido):
> - Operações revalidadas a cada tentativa, com o contexto do momento.
> - Cancelamento seguro quando pessoa, ambiente ou registro mudam durante um envio, com rascunhos preservados.
> - Avisos de disponibilidade fiéis ao comportamento, com tentativa automática agendada, pausa e retorno visual.
> - Integrações identificadas como simulada, configurada ou validada, com o adaptador em uso. Destinos reais só a partir de endereços configurados ou informados pela origem.
> - Contrato de plugin completo; Chamados é o primeiro módulo sem dependências no núcleo.
> - Exportações com conteúdo exato registrado, revalidação no download e resultado explícito: arquivo gerado, simulado, falha ou bloqueado.
>
> **Evolução local da 0.5**:
> - Início e rotas demonstrativas permanecem com dados fictícios identificados; o menu de Viagens, Inventário e Reverso abre rotas de consulta real somente leitura.
> - As consultas usam três conexões Supabase separadas e não recorrem a seeds quando a origem está ausente.
> - Repositórios, schemas, conta autorizada e sessão real ainda não estão disponíveis nesta máquina; percursos com dados reais estão **NÃO VALIDADOS**.
> - A instalação por ZIP continua demonstrativa; o aceite de pacote externo permanece pendente.
>
> Documentos:
> - Correções e verificações: **[CORRECOES-0.4.md](CORRECOES-0.4.md)**
> - Roteiro: **[ROTEIRO.md](ROTEIRO.md)** (14 cenários, também no painel do apresentador)
> - Integrações: **[INTEGRACOES.md](INTEGRACOES.md)**
> - Roteiro da diretoria: **[APRESENTACAO-DIRETORIA-0.5.md](APRESENTACAO-DIRETORIA-0.5.md)**

---


Aplicação em **React + TypeScript (Vite)**. O Início e as rotas demonstrativas seguem com dados fictícios; as rotas reais dos três módulos consultam apenas fontes Supabase configuradas e identificadas. Login Microsoft, notificações e instalação por pacote ainda são simulados. Sem fonte ou sessão autorizada, a consulta exibe indisponibilidade/acesso não validado e não usa dados demonstrativos.

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # dist/
npm run build:preview  # um único index.html em dist-preview/ (prévia publicada)
```

## Composição visual — três camadas

| Camada | Onde | Material |
|---|---|---|
| 1 · Ambiente | Fundo fixo (`<Ambient />`) | Quatro focos de luz desfocados com as cores da marca ativa, deriva lenta, grão sutil. Visível nos respiros entre as peças, inclusive com muito conteúdo. |
| 2 · Vidro | Sidebar, cabeçalho, busca, seletor de ambiente, menus, notificações, diálogos, avisos | `.glass` (translúcido, navegação) e `.glass-strong` (mais denso, leitura de menus/diálogos): desfoque + saturação, brilho superior, borda iluminada, sombra coerente. |
| 3 · Conteúdo | Cards, tabelas, formulários | Superfícies quase opacas (`--surface`) para leitura estável em qualquer posição de rolagem. |

- O cabeçalho guarda o vidro num pseudo-elemento para não virar *backdrop root*: assim os menus abertos dentro dele desfocam a página de verdade.
- **Redução de transparência**: preferência do sistema (`prefers-reduced-transparency`) ou do usuário (Preferências / painel do apresentador) → todos os vidros ficam opacos.
- **Redução de movimento**: `prefers-reduced-motion` ou preferência do usuário.
- Movimento com intenção: abertura (menus, diálogos, submenus), mudança de contexto (luz da nova marca + conteúdo entra), seleção (item da navegação), conclusão (marca de sucesso, linha/evento destacados).

Tokens em `src/styles/tokens.css` (um bloco por marca × tema). Contraste conferido nas 6 combinações, compondo as camadas translúcidas sobre o ambiente (texto ≥ 4,5:1; secundário ≥ 3:1).

## Identidades

- **AZIME**: preto, branco vibrante, grafite, vidro neutro.
- **Alinare**: azul profundo `#242741`, off-white `#F0EBE4`, vidro levemente azulado.
- **Novitah**: nude, terracota, areia; vidro quente.

Arquivos oficiais: coloque `logo.svg` e `symbol.svg` em `src/brands/<marca>/` — são carregados automaticamente no lugar das assinaturas tipográficas provisórias (veja `src/brands/README.md`).

## Regras da demonstração

- **Entrada**: “Entrar com Microsoft” (simulado) → escolha da conta → verificação de liberação pela TI → **seleção do ambiente** entre os autorizados (com número de tarefas por ambiente). Conta não liberada: João Victor Alves.
- **Líderes** da configuração inicial (Bruno) têm acesso total às operações dos módulos de negócio de todas as marcas e **solicitam acessos** da equipe. A **TI** (Elisa) aplica.
- **Concessões individuais**: para os demais, o acesso efetivo é exatamente a concessão por ambiente × módulo × ação × escopo. Cargos são modelos (“Modelos de acesso”) e não somam permissões; a TI concede e retira ações na ficha do colaborador.
- **Gerência** (Fábio) configura **exportações** por módulo: autorização **permanente** (ex.: Inventário para TI) ou **por solicitação** (ex.: Reverso para Expedição, com decisão da Gerência). CSV real; XLSX/PDF simulados.
- **Preservação**: nada é excluído — bloqueio, desativação de plugin e cancelamento de reserva mantêm os registros; exportações ficam registradas.
- **Catálogo**: o detalhe do plugin mostra como ele entra em **menus, permissões e funcionalidades**; a instalação de *Reservas de salas* demonstra isso.
- **Meu trabalho**: as tarefas e contagens do Início usam as mesmas regras dos filtros das listas de destino (`src/platform/pendencias.ts`), então o número clicado é o número de linhas que abre.
- **Troca de ambiente**: mantém a tela quando ela existe no outro ambiente (lista com filtros, Início, administração); numa ficha, volta à lista equivalente; se o módulo não existe no ambiente, vai ao Início e explica.

## Fluxo de referência (Inventário)

Lista (patrimônio com ícone de tipo, responsável + local, situação, ação *Entregar*; busca e filtros numa área única com contagens por situação) → ficha (identificação, situação e ação principal no topo; fatos-chave; dados por relevância; histórico e documentos) → **Registrar entrega** (equipamento, colaborador, entrega + resumo da operação fixo) → confirmação atualiza ficha, lista (linha destacada) e histórico → o colaborador recebe a tarefa **Conferir entrega** e confirma o recebimento.

## Perfis de apresentação

| Perfil | Pessoa | Para mostrar |
|---|---|---|
| Colaborador | Ana Ribeiro | Início, conferir entrega, passagem VG-0412 |
| Líder | Bruno Teixeira | Revisar TF-311/TF-309 em Chamados, aprovar REV-2026-0148, solicitar acesso |
| Compras | Carla Mendes | Compra externa (VG-0418) |
| Expedição | Diego Santos | Etiqueta e rastreio; solicitar exportação de Reverso |
| TI | Elisa Moura | Chamados de TI, entrega AZ-0107, concessões individuais, auditoria, plugins |
| Gerência | Fábio Lima | Regras e decisões de exportação |

O **painel do apresentador** (selo *Demonstração* no cabeçalho) troca perfil, ambiente, aparência, estados (carregando/erro/vazio/manutenção), transparência e movimento, e traz o roteiro com “Preparar e abrir”.

## Instalação de plugins pelo Git (0.5.0)

O catálogo administrativo oferece **Instalar pelo Git**. O backend fixa a tag/SHA escolhida, valida manifesto, compatibilidade, dependências e conexões e registra o commit instalado. Pendências não ativam o plugin; a TI pode corrigir a configuração e repetir a mesma revisão.

O servidor local usa `npm run dev` para iniciar API e Vite juntos. O estado persistente de plugins continua em `.horizon-data/` (ou no volume `HORIZON_DATA_DIR`) para preservar instalações existentes. Veja [PLUGINS-GIT.md](PLUGINS-GIT.md) para configuração Git privada, SDK, template Demo e aceite reproduzível.

## Estrutura

```
src/
  brands/        arquivos oficiais das marcas (logo.svg, symbol.svg)
  styles/        tokens.css (marca × tema, materiais) · app.css (camadas, componentes, responsivo)
  platform/      tipos e contrato de plugin, dados demo (seed, seed03), permissões individuais, work.ts (coleta das contribuições), sources.ts (adaptadores SharePoint/Feedback/Teams), integrations.ts
  ui/            componentes compartilhados, marca e ambiente, exportação
  layout/        shell (sidebar, cabeçalho, troca de ambiente, apresentador)
  pages/         entrada Microsoft, Início, Meu trabalho, Preferências
  modules/       chamados · inventario · reverso · viagens · reservas · admin (manifesto + contrib.ts com as contribuições ao painel)
```

Roteador em *hash* no desenvolvimento e em memória na prévia de arquivo único; na etapa funcional, `createBrowserRouter`.

## Próxima etapa (funcional)

Microsoft Entra ID (OIDC) → Supabase Auth; RLS por ambiente/registro no PostgreSQL com permissões de perfil + individuais; trilha de auditoria imutável; Storage protegido; contrato real de pacote de plugin. As funções `update`, `log` e `notify` de `store.tsx` são os pontos de integração com o backend.
