# Pacote de prova externa

Este plugin de demonstração fica fora de src/ e declara seu id, versão, página, menu, ícone, ações e permissões em horizon-plugin.json para o The One System.

Para gerar o arquivo aceito pelo catálogo, compacte apenas horizon-plugin.json na raiz do ZIP e selecione o arquivo em Administração → Catálogo de plugins → Adicionar pacote ZIP.

O instalador da prova local valida o manifesto, grava-o no localStorage deste navegador e recarrega o The One System para registrar as rotas. Depois, abra o plugin no catálogo e habilite o perfil e o ambiente. O pacote é declarativo; não contém nem executa JavaScript.

Essa prova não valida assinatura criptográfica nem substitui instalação central em servidor.
