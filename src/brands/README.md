# Arquivos oficiais das marcas

Cada marca tem uma pasta: `azime/`, `alinare/`, `novitah/`.

- **Logotipo**: salve o arquivo oficial como `logo.svg` (versão horizontal) e, se houver, `symbol.svg` (símbolo/monograma).
  O app detecta os arquivos automaticamente (`src/ui/brand.tsx`). Enquanto não existirem, aparece a assinatura tipográfica provisória.
  Use `fill="currentColor"` no SVG para que o logo acompanhe os temas claro e escuro.
- **Cores e materiais**: ficam em `src/styles/tokens.css`, um bloco por marca × tema (`[data-brand][data-theme]`).
  Ajuste ali os códigos oficiais; estrutura, componentes, ícones e comportamentos são compartilhados.
