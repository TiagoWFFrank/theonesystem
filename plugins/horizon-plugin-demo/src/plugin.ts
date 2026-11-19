import { definePlugin, type PluginManifest } from '@azime/horizon-plugin-sdk';

export const plugin = definePlugin({
  format: 'horizon-plugin',
  manifestVersion: 1,
  id: 'horizon-plugin-demo',
  name: 'Plugin Demo',
  description: 'Exemplo oficial de extensão declarativa, permissões separadas e conexão própria.',
  version: '1.1.0',
  basePath: '/ext/horizon-plugin-demo',
  icon: 'Puzzle',
  compatibility: { horizon: '>=0.5.0 <0.6.0', sdk: '^0.5.0' },
  dependencies: [{ id: '@azime/horizon-plugin-sdk', range: '^0.5.0' }],
  actions: [
    { id: 'ver', label: 'Consultar o Plugin Demo' },
    { id: 'editar', label: 'Configurar o Plugin Demo' },
  ],
  operations: [
    {
      id: 'listar-registros',
      connection: 'demo-api',
      method: 'GET',
      path: '/records',
      requires: 'ver',
      inputs: [
        { name: 'q', location: 'query', type: 'string', maxLength: 80 },
        { name: 'limit', location: 'query', type: 'integer', default: 50, minimum: 1, maximum: 100 },
      ],
      response: { kind: 'collection', path: 'items' },
    },
    {
      id: 'consultar-registro',
      connection: 'demo-api',
      method: 'GET',
      path: '/records/:id',
      requires: 'ver',
      inputs: [{ name: 'id', location: 'path', type: 'string', required: true, maxLength: 80 }],
      response: { kind: 'record', path: 'record' },
    },
  ],
  menu: [
    { label: 'Registros de demonstração', path: '/ext/horizon-plugin-demo', requires: 'ver' },
    { label: 'Configuração', path: '/ext/horizon-plugin-demo/configuracao', requires: 'editar' },
  ],
  requirements: [
    'O núcleo fornece sessão, marca ativa, navegação e componentes visuais do Horizon.',
    'O servidor mantém a configuração e valida a conexão declarada antes de instalar.',
  ],
  configuration: {
    title: 'Conexão do Plugin Demo',
    description: 'A URL é armazenada no servidor Horizon. O instalador consulta somente o endpoint de saúde declarado.',
    fields: [
      { id: 'apiBaseUrl', label: 'URL base da API do Demo', type: 'url', required: true, placeholder: 'http://127.0.0.1:4300' },
    ],
  },
  userConfiguration: {
    title: 'Preferências do Plugin Demo',
    description: 'Preferências próprias da conta. A permissão editar é conferida no servidor a cada leitura ou alteração.',
    fields: [
      { id: 'observacao', label: 'Nota pessoal de configuração', type: 'text', placeholder: 'Anotação individual para a apresentação' },
    ],
  },
  connections: [
    { id: 'demo-api', label: 'API própria do Plugin Demo', settingKey: 'apiBaseUrl', healthPath: '/health' },
  ],
  pages: [
    {
      path: '/ext/horizon-plugin-demo',
      title: 'Registros do Plugin Demo',
      description: 'Consulta real ao serviço próprio do plugin, protegida pelo contexto do Horizon.',
      requires: 'ver',
      kind: 'list',
      operationId: 'listar-registros',
      search: { input: 'q', placeholder: 'Buscar por código, título ou responsável' },
      columns: [
        { label: 'Código', field: 'id' },
        { label: 'Registro', field: 'title' },
        { label: 'Situação', field: 'status' },
        { label: 'Responsável', field: 'owner' },
      ],
      detailPath: '/ext/horizon-plugin-demo/registros/:id',
      recordIdField: 'id',
    },
    {
      path: '/ext/horizon-plugin-demo/registros/:id',
      title: 'Ficha do registro',
      description: 'Detalhes carregados pela operação declarada do serviço do plugin.',
      requires: 'ver',
      kind: 'detail',
      operationId: 'consultar-registro',
      recordIdParam: 'id',
      fields: [
        { label: 'Código', field: 'id' },
        { label: 'Registro', field: 'title' },
        { label: 'Situação', field: 'status' },
        { label: 'Responsável', field: 'owner' },
        { label: 'Resumo', field: 'summary' },
        { label: 'Atualizado em', field: 'updatedAt' },
      ],
    },
    {
      path: '/ext/horizon-plugin-demo/configuracao',
      title: 'Configuração do Plugin Demo',
      description: 'Somente pessoas com a permissão editar veem e alteram esta configuração.',
      requires: 'editar',
      configuration: true,
    },
  ],
} satisfies PluginManifest);
