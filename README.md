# Plataforma AZIME — protótipo de apresentação (0.2 · Liquid Glass)

Protótipo navegável em **React + TypeScript (Vite)**. Dados fictícios; login Microsoft, instalação de plugin, notificações, leitura de bilhete e exportações XLSX/PDF são **simulados** e persistidos no navegador (`localStorage`).

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
- **Líderes** (Bruno) têm acesso total de consulta a todas as marcas e **solicitam acessos** da equipe (`/admin/acessos/nova`). A **TI** (Elisa) revisa e **aplica** → vira **permissão individual** no colaborador, com histórico. TI também libera contas, bloqueia (preservando registros) e revoga permissões individuais.
- **Gerência** (Fábio) configura **exportações** por módulo (formatos, perfis, campos, histórico). O botão *Exportar* aparece só para os perfis escolhidos. CSV é gerado de verdade; XLSX/PDF são simulados.
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
| Líder | Bruno Teixeira | Aprovar REV-2026-0148, solicitar acesso |
| Compras | Carla Mendes | Compra externa (VG-0418) |
| Expedição | Diego Santos | Etiqueta e rastreio |
| TI | Elisa Moura | Entrega AZ-0107, aplicar ACS-0014, liberar conta, plugins |
| Gerência | Fábio Lima | Exportações |

O **painel do apresentador** (selo *Demonstração* no cabeçalho) troca perfil, ambiente, aparência, estados (carregando/erro/vazio/manutenção), transparência e movimento, e traz o roteiro com “Preparar e abrir”.

## Estrutura

```
src/
  brands/        arquivos oficiais das marcas (logo.svg, symbol.svg)
  styles/        tokens.css (marca × tema, materiais) · app.css (camadas, componentes, responsivo)
  platform/      tipos e contrato de plugin, dados demo, permissões (perfil + individual), Meu trabalho, hooks
  ui/            componentes compartilhados, marca e ambiente, exportação
  layout/        shell (sidebar, cabeçalho, troca de ambiente, apresentador)
  pages/         entrada Microsoft, Início, Meu trabalho, Preferências
  modules/       inventario · reverso · viagens · reservas · admin (cada um com manifesto)
```

Roteador em *hash* no desenvolvimento e em memória na prévia de arquivo único; na etapa funcional, `createBrowserRouter`.

## Próxima etapa (funcional)

Microsoft Entra ID (OIDC) → Supabase Auth; RLS por ambiente/registro no PostgreSQL com permissões de perfil + individuais; trilha de auditoria imutável; Storage protegido; contrato real de pacote de plugin. As funções `update`, `log` e `notify` de `store.tsx` são os pontos de integração com o backend.
