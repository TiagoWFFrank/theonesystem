import type { BrandId } from './types';

export interface ExternalPackagePage {
  path: string;
  title: string;
  description?: string;
  requires?: string | string[];
  mode?: 'demo' | 'real';
  kind?: 'content' | 'list' | 'detail' | 'react';
  component?: string;
  operationId?: string;
  columns?: { label: string; field: string }[];
  search?: { input: string; placeholder?: string };
  detailPath?: string;
  recordIdField?: string;
  recordIdParam?: string;
  fields?: { label: string; field: string }[];
  configuration?: boolean;
  sections?: { title: string; body: string }[];
}

export interface ExternalPluginOperationInput {
  name: string;
  location: 'path' | 'query' | 'body';
  type: 'string' | 'integer';
  required?: boolean;
  default?: string | number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}

export interface ExternalPluginOperation {
  id: string;
  connection: string;
  method: 'GET' | 'POST';
  path: string;
  requires: string;
  inputs: ExternalPluginOperationInput[];
  response: { kind: 'collection' | 'record'; path: string };
}

export interface ExternalPluginConfigurationField {
  id: string;
  label: string;
  type: 'text' | 'url';
  required?: boolean;
  placeholder?: string;
}

export interface ExternalPluginUserConfiguration {
  title: string;
  description?: string;
  fields: ExternalPluginConfigurationField[];
}

export interface ExternalPluginConnection {
  id: string;
  label: string;
  settingKey: string;
  healthPath: string;
}

export interface ExternalPluginPackage {
  format: 'horizon-plugin';
  manifestVersion: 1;
  id: string;
  name: string;
  description: string;
  version: string;
  basePath: string;
  icon: 'Puzzle' | 'Package' | 'Boxes' | 'FileSearch';
  business: boolean;
  actions: { id: string; label: string }[];
  operations: ExternalPluginOperation[];
  menu: { label: string; path: string; requires?: string | string[] }[];
  requirements: string[];
  pages: ExternalPackagePage[];
  compatibility?: { horizon?: string; sdk?: string };
  dependencies?: { id: string; range: string }[];
  configuration?: { title: string; description?: string; fields: ExternalPluginConfigurationField[] };
  userConfiguration?: ExternalPluginUserConfiguration;
  connections?: ExternalPluginConnection[];
}

const STORAGE_KEY = 'horizon:external-packages:v1';
const GIT_STORAGE_KEY = 'horizon:git-installed-plugins:v1';
const RESERVED_IDS = new Set(['admin', 'inventario', 'viagens', 'reverso', 'reservas', 'chamados']);

export interface GitPluginInstall {
  repository: string;
  revisionType: 'tag' | 'commit';
  revision: string;
  commit: string;
  version: string;
  installedAt: string;
  checkout: string;
  enabledBrands?: BrandId[];
  active?: boolean;
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('Manifesto inválido: ' + field + '.');
  return value.trim();
}

function displayText(value: unknown, field: string, max: number): string {
  return text(value, field, max).replace(/\bHorizon\b/g, 'The One System');
}

function actions(value: unknown): { id: string; label: string }[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new Error('Manifesto inválido: actions.');
  const result = value.map((entry) => {
    const row = object(entry);
    if (!row) throw new Error('Manifesto inválido: action.');
    const id = text(row.id, 'action.id', 48);
    if (!/^[a-z][a-z0-9_]*$/.test(id)) throw new Error('Manifesto inválido: formato de action.id.');
    return { id, label: displayText(row.label, 'action.label', 80) };
  });
  if (new Set(result.map((item) => item.id)).size !== result.length) throw new Error('Manifesto inválido: action.id repetido.');
  return result;
}

function requirement(value: unknown, knownActions: Set<string>): string | string[] | undefined {
  if (value == null) return undefined;
  const values = Array.isArray(value) ? value : [value];
  if (values.length < 1 || values.some((item) => typeof item !== 'string' || !knownActions.has(item))) {
    throw new Error('Manifesto inválido: permissão exige uma ação declarada.');
  }
  return Array.isArray(value) ? values as string[] : values[0] as string;
}

function parseUserConfiguration(value: unknown): ExternalPluginUserConfiguration | undefined {
  if (value == null) return undefined;
  const configuration = object(value);
  if (!configuration) throw new Error('Manifest userConfiguration is invalid.');
  const rawFields = configuration.fields ?? [];
  if (!Array.isArray(rawFields) || rawFields.length > 30) throw new Error('Manifest userConfiguration fields are invalid.');
  const fields = rawFields.map((rawField) => {
    const field = object(rawField);
    if (!field || !['text', 'url'].includes(String(field.type))) throw new Error('Manifest userConfiguration field is invalid.');
    return {
      id: text(field.id, 'userConfiguration.field.id', 64),
      label: displayText(field.label, 'userConfiguration.field.label', 100),
      type: field.type as 'text' | 'url',
      required: field.required === true,
      placeholder: field.placeholder == null ? undefined : displayText(field.placeholder, 'userConfiguration.field.placeholder', 200),
    };
  });
  if (new Set(fields.map((field) => field.id)).size !== fields.length) throw new Error('Duplicate userConfiguration field id.');
  return {
    title: configuration.title == null ? 'Configuração pessoal' : displayText(configuration.title, 'userConfiguration.title', 100),
    description: configuration.description == null ? undefined : displayText(configuration.description, 'userConfiguration.description', 300),
    fields,
  };
}

export function parseExternalPackage(value: unknown): ExternalPluginPackage {
  const input = object(value);
  if (!input || input.format !== 'horizon-plugin' || input.manifestVersion !== 1) throw new Error('Pacote incompatível: formato de plugin legado v1 não reconhecido.');
  const id = text(input.id, 'id', 48);
  if (!/^[a-z][a-z0-9-]{2,47}$/.test(id) || RESERVED_IDS.has(id)) throw new Error('Manifesto inválido: id reservado ou fora do formato.');
  const basePath = text(input.basePath, 'basePath', 120);
  if (basePath !== '/ext/' + id) throw new Error('Manifesto inválido: basePath deve ser /ext/' + id + '.');
  const declaredActions = actions(input.actions);
  const knownActions = new Set(declaredActions.map((item) => item.id));
  const icon = input.icon;
  if (!['Puzzle', 'Package', 'Boxes', 'FileSearch'].includes(String(icon))) throw new Error('Manifesto inválido: ícone não permitido.');
  if (!Array.isArray(input.pages) || input.pages.length < 1 || input.pages.length > 20) throw new Error('Manifesto inválido: pages.');
  const pages = input.pages.map((entry) => {
    const page = object(entry);
    if (!page) throw new Error('Manifesto inválido: page.');
    const path = text(page.path, 'page.path', 160);
    if (path !== basePath && !path.startsWith(basePath + '/')) throw new Error('Manifesto inválido: rota fora do basePath.');
    if (page.mode != null && page.mode !== 'demo' && page.mode !== 'real') throw new Error('Manifesto inválido: page.mode.');
    if (page.sections != null && (!Array.isArray(page.sections) || page.sections.length > 12)) throw new Error('Manifesto inválido: page.sections.');
    const kind = page.kind == null ? 'content' : page.kind;
    if (!['content', 'list', 'detail', 'react'].includes(String(kind))) throw new Error('Manifest page kind is invalid.');
    const component = page.component == null ? undefined : text(page.component, 'page.component', 120);
    if (kind === 'react' && (!component || !/^ui\/[A-Za-z0-9_-]+\.mjs$/.test(component) || !page.requires)) throw new Error('React page component or permission is invalid.');
    if (kind !== 'react' && component) throw new Error('Only React pages can declare a component.');
    const pageFields = (raw: unknown, label: string, max: number) => {
      if (!Array.isArray(raw) || raw.length < 1 || raw.length > max) throw new Error(`Manifest ${label} is invalid.`);
      return raw.map((item) => {
        const field = object(item);
        if (!field) throw new Error(`Manifest ${label} is invalid.`);
        const name = text(field.field, `${label}.field`, 100);
        if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(name)) throw new Error(`Manifest ${label}.field is invalid.`);
        return { label: displayText(field.label, `${label}.label`, 100), field: name };
      });
    };
    let search: ExternalPackagePage['search'];
    if (page.search != null) {
      const searchInput = object(page.search);
      if (!searchInput) throw new Error('Manifest page search is invalid.');
      search = { input: text(searchInput.input, 'page.search.input', 48), placeholder: searchInput.placeholder == null ? undefined : displayText(searchInput.placeholder, 'page.search.placeholder', 120) };
    }
    return {
      path,
      title: displayText(page.title, 'page.title', 100),
      description: page.description == null ? undefined : displayText(page.description, 'page.description', 300),
      requires: requirement(page.requires, knownActions),
      mode: page.mode as 'demo' | 'real' | undefined,
      kind: kind as ExternalPackagePage['kind'],
      component,
      operationId: page.operationId == null ? undefined : text(page.operationId, 'page.operationId', 48),
      columns: page.columns == null ? undefined : pageFields(page.columns, 'page.columns', 12),
      search,
      detailPath: page.detailPath == null ? undefined : text(page.detailPath, 'page.detailPath', 160),
      recordIdField: page.recordIdField == null ? undefined : text(page.recordIdField, 'page.recordIdField', 100),
      recordIdParam: page.recordIdParam == null ? undefined : text(page.recordIdParam, 'page.recordIdParam', 48),
      fields: page.fields == null ? undefined : pageFields(page.fields, 'page.fields', 30),
      configuration: page.configuration === true,
      sections: (page.sections ?? []).map((rawSection) => {
        const section = object(rawSection);
        if (!section) throw new Error('Manifesto inválido: page.section.');
        return { title: displayText(section.title, 'section.title', 100), body: displayText(section.body, 'section.body', 1200) };
      }),
    };
  });
  if (new Set(pages.map((page) => page.path)).size !== pages.length) throw new Error('Manifesto inválido: rota repetida.');
  if (!Array.isArray(input.menu) || input.menu.length < 1 || input.menu.length > 20) throw new Error('Manifesto inválido: menu.');
  const menu = input.menu.map((entry) => {
    const item = object(entry);
    if (!item) throw new Error('Manifesto inválido: menu item.');
    const path = text(item.path, 'menu.path', 160);
    if (!pages.some((page) => page.path === path)) throw new Error('Manifesto inválido: item de menu sem página declarada.');
    return { label: displayText(item.label, 'menu.label', 80), path, requires: requirement(item.requires, knownActions) };
  });
  const requirements = input.requirements == null ? [] : input.requirements;
  const configurationValue = object(input.configuration);
  if (input.configuration != null && !configurationValue) throw new Error('Manifest configuration is invalid.');
  const fieldsValue = configurationValue?.fields ?? [];
  if (!Array.isArray(fieldsValue) || fieldsValue.length > 30) throw new Error('Manifest configuration fields are invalid.');
  const fields = fieldsValue.map((rawField) => {
    const field = object(rawField);
    if (!field || !['text', 'url'].includes(String(field.type))) throw new Error('Manifest configuration field is invalid.');
    return {
      id: text(field.id, 'configuration.field.id', 64),
      label: displayText(field.label, 'configuration.field.label', 100),
      type: field.type as 'text' | 'url',
      required: field.required === true,
      placeholder: field.placeholder == null ? undefined : displayText(field.placeholder, 'configuration.field.placeholder', 200),
    };
  });
  if (new Set(fields.map((field) => field.id)).size !== fields.length) throw new Error('Duplicate configuration field id.');
  const connectionsValue = input.connections ?? [];
  if (!Array.isArray(connectionsValue) || connectionsValue.length > 20) throw new Error('Manifest connections are invalid.');
  const connections = connectionsValue.map((rawConnection) => {
    const connection = object(rawConnection);
    if (!connection || !fields.some((field) => field.id === connection.settingKey)) throw new Error('Connection settingKey must match a declared field.');
    const healthPath = text(connection.healthPath ?? '/health', 'connection.healthPath', 200);
    if (!healthPath.startsWith('/') || healthPath.startsWith('//')) throw new Error('Connection healthPath is invalid.');
    return {
      id: text(connection.id, 'connection.id', 48),
      label: displayText(connection.label, 'connection.label', 100),
      settingKey: text(connection.settingKey, 'connection.settingKey', 64),
      healthPath,
    };
  });
  if (new Set(connections.map((connection) => connection.id)).size !== connections.length) throw new Error('Manifest connection id is duplicated.');
  const operationRows = input.operations ?? [];
  if (!Array.isArray(operationRows) || operationRows.length > 50) throw new Error('Manifest operations are invalid.');
  const connectionIds = new Set(connections.map((connection) => connection.id));
  const operations: ExternalPluginOperation[] = operationRows.map((rawOperation) => {
    const operation = object(rawOperation);
    if (!operation || !['GET', 'POST'].includes(String(operation.method))) throw new Error('Only declared GET and POST operations are supported.');
    const operationId = text(operation.id, 'operation.id', 48);
    if (!/^[a-z][a-z0-9-]*$/.test(operationId)) throw new Error('Manifest operation id is invalid.');
    const connection = text(operation.connection, 'operation.connection', 48);
    if (!connectionIds.has(connection)) throw new Error('Operation refers to an undeclared connection.');
    const operationPath = text(operation.path, 'operation.path', 200);
    if (!operationPath.startsWith('/') || operationPath.startsWith('//') || operationPath.includes('..') || /[\\%?#]/.test(operationPath) || !/^\/[A-Za-z0-9/_:-]+$/.test(operationPath)) throw new Error('Manifest operation path is invalid.');
    const inputRows = operation.inputs ?? [];
    if (!Array.isArray(inputRows) || inputRows.length > 20) throw new Error('Manifest operation inputs are invalid.');
    const inputs = inputRows.map((rawInput) => {
      const field = object(rawInput);
      if (!field) throw new Error('Manifest operation input is invalid.');
      const name = text(field.name, 'operation.input.name', 48);
      if (!/^[a-z][A-Za-z0-9_]*$/.test(name) || !['path', 'query', 'body'].includes(String(field.location)) || (field.location === 'body' && operation.method !== 'POST') || !['string', 'integer'].includes(String(field.type))) throw new Error('Manifest operation input definition is invalid.');
      const parsed: ExternalPluginOperationInput = { name, location: field.location as 'path' | 'query' | 'body', type: field.type as 'string' | 'integer', required: field.required === true };
      if (parsed.type === 'string') {
        const maxLength = field.maxLength == null ? 80 : Number(field.maxLength);
        if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 512 || parsed.location === 'path' && maxLength > 80) throw new Error('Manifest operation string limit is invalid.');
        parsed.maxLength = maxLength;
        if (field.default != null) {
          if (typeof field.default !== 'string' || field.default.length > maxLength) throw new Error('Manifest operation default is invalid.');
          parsed.default = field.default;
        }
      } else {
        const minimum = field.minimum == null ? 0 : Number(field.minimum);
        const maximum = field.maximum == null ? 1000 : Number(field.maximum);
        if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || minimum < 0 || maximum < minimum || maximum > 10000) throw new Error('Manifest operation integer range is invalid.');
        parsed.minimum = minimum;
        parsed.maximum = maximum;
        if (field.default != null) {
          if (!Number.isSafeInteger(field.default) || Number(field.default) < minimum || Number(field.default) > maximum) throw new Error('Manifest operation default is invalid.');
          parsed.default = Number(field.default);
        }
      }
      return parsed;
    });
    if (new Set(inputs.map((item) => item.name)).size !== inputs.length) throw new Error('Manifest operation input name is duplicated.');
    const placeholders = Array.from(operationPath.matchAll(/:([A-Za-z][A-Za-z0-9_]*)/g), (match) => match[1]);
    const pathInputs = inputs.filter((item) => item.location === 'path').map((item) => item.name);
    if (new Set(placeholders).size !== placeholders.length || placeholders.length !== pathInputs.length || placeholders.some((name) => !pathInputs.includes(name))) throw new Error('Manifest path parameters must match path inputs.');
    const requires = requirement(operation.requires, knownActions);
    if (typeof requires !== 'string') throw new Error('Every operation must require one declared action.');
    const response = object(operation.response);
    if (!response || !['collection', 'record'].includes(String(response.kind))) throw new Error('Manifest operation response is invalid.');
    const responsePath = text(response.path, 'operation.response.path', 100);
    if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(responsePath)) throw new Error('Manifest operation response path is invalid.');
    return { id: operationId, connection, method: operation.method as 'GET' | 'POST', path: operationPath, requires, inputs, response: { kind: response.kind as 'collection' | 'record', path: responsePath } };
  });
  if (new Set(operations.map((operation) => operation.id)).size !== operations.length) throw new Error('Manifest operation id is duplicated.');
  const operationById = new Map(operations.map((operation) => [operation.id, operation]));
  const pageByPath = new Map(pages.map((page) => [page.path, page]));
  for (const page of pages) {
    if (page.kind === 'content' || page.kind === 'react') {
      if (page.operationId) throw new Error('Content pages cannot bind a data operation.');
      continue;
    }
    const operation = operationById.get(page.operationId ?? '');
    if (!operation || ![page.requires].flat().includes(operation.requires)) throw new Error('Page operation must require its declared action.');
    if (operation.method !== 'GET') throw new Error('Declarative list and detail pages require GET operations.');
    if (page.kind === 'list') {
      if (operation.response.kind !== 'collection' || !page.columns?.length || !page.recordIdField) throw new Error('List pages need a collection operation, columns, and a record id field.');
      const detailPage = pageByPath.get(page.detailPath ?? '');
      if (!detailPage || detailPage.kind !== 'detail') throw new Error('List page detailPath must point to a declared detail page.');
      if (page.search && !operation.inputs.some((item) => item.name === page.search!.input && item.location === 'query' && item.type === 'string')) throw new Error('List search must target a declared query string input.');
    } else if (operation.response.kind !== 'record' || !page.fields?.length || !page.recordIdParam || !operation.inputs.some((item) => item.name === page.recordIdParam && item.location === 'path')) {
      throw new Error('Detail pages need a record operation, fields, and a declared path id input.');
    }
  }
  const dependenciesValue = input.dependencies ?? [];
  if (!Array.isArray(dependenciesValue) || dependenciesValue.length > 20) throw new Error('Manifest dependencies are invalid.');
  const dependencies = dependenciesValue.map((rawDependency) => {
    const dependency = object(rawDependency);
    if (!dependency) throw new Error('Manifest dependency is invalid.');
    return { id: text(dependency.id, 'dependency.id', 100), range: text(dependency.range, 'dependency.range', 64) };
  });
  const compatibilityValue = object(input.compatibility);
  if (input.compatibility != null && !compatibilityValue) throw new Error('Manifest compatibility is invalid.');
  if (!Array.isArray(requirements) || requirements.length > 20) throw new Error('Manifesto inválido: requirements.');
  return {
    format: 'horizon-plugin',
    manifestVersion: 1,
    id,
    name: displayText(input.name, 'name', 80),
    description: displayText(input.description, 'description', 240),
    version: text(input.version, 'version', 32),
    basePath,
    icon: icon as ExternalPluginPackage['icon'],
    business: input.business === true,
    actions: declaredActions,
    operations,
    menu,
    requirements: requirements.map((item) => displayText(item, 'requirement', 160)),
    pages,
    compatibility: compatibilityValue ? {
      horizon: compatibilityValue.horizon == null ? undefined : text(compatibilityValue.horizon, 'compatibility.horizon', 100),
      sdk: compatibilityValue.sdk == null ? undefined : text(compatibilityValue.sdk, 'compatibility.sdk', 100),
    } : undefined,
    dependencies,
    configuration: {
      title: configurationValue?.title == null ? 'Configuration' : displayText(configurationValue.title, 'configuration.title', 100),
      description: configurationValue?.description == null ? undefined : displayText(configurationValue.description, 'configuration.description', 300),
      fields,
    },
    userConfiguration: parseUserConfiguration(input.userConfiguration),
    connections,
  };
}

export function readExternalPackages(): ExternalPluginPackage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(parseExternalPackage);
  } catch {
    return [];
  }
}

export function externalPackageById(id: string): ExternalPluginPackage | undefined {
  return [...readExternalPackages(), ...readGitInstalledPackages().map((entry) => entry.manifest)].find((item) => item.id === id);
}

export function readGitInstalledPackages(): { manifest: ExternalPluginPackage; install: GitPluginInstall }[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(GIT_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      const item = object(entry);
      if (!item) return [];
      try {
        const manifest = parseExternalPackage(item.manifest);
        const install = object(item.install);
        if (!install || typeof install.commit !== 'string' || typeof install.repository !== 'string') return [];
        return [{ manifest, install: install as unknown as GitPluginInstall }];
      } catch { return []; }
    });
  } catch { return []; }
}

export function cacheGitInstalledPackages(value: unknown): void {
  if (typeof window === 'undefined') return;
  const entries = Array.isArray(value) ? value : [];
  const safe = entries.flatMap((entry) => {
    const item = object(entry);
    if (!item) return [];
    try {
      const manifest = parseExternalPackage(item.manifest);
      const install = object(item.install);
      if (!install || typeof install.commit !== 'string' || typeof install.repository !== 'string') return [];
      return [{ manifest, install }];
    } catch { return []; }
  });
  window.localStorage.setItem(GIT_STORAGE_KEY, JSON.stringify(safe));
}

export function gitInstallById(id: string): GitPluginInstall | undefined {
  return readGitInstalledPackages().find((entry) => entry.manifest.id === id)?.install;
}

export async function pluginRequestHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  let token: string | null = null;
  try { token = await (window.horizonAuth?.getPluginAccessToken?.() ?? window.horizonAuth?.getAccessToken?.()) ?? null; } catch { token = null; }
  return { ...extra, ...(token ? { authorization: 'Bearer ' + token } : {}) };
}

export function updateGitPluginInstallAccess(id: string, patch: Partial<Pick<GitPluginInstall, 'enabledBrands' | 'active'>>): void {
  if (typeof window === 'undefined') return;
  const installed = readGitInstalledPackages();
  const next = installed.map((entry) => entry.manifest.id === id ? { ...entry, install: { ...entry.install, ...patch } } : entry);
  window.localStorage.setItem(GIT_STORAGE_KEY, JSON.stringify(next));
}

export function saveExternalPackage(value: ExternalPluginPackage): void {
  const manifest = parseExternalPackage(value);
  const installed = readExternalPackages();
  if (installed.some((item) => item.id === manifest.id)) throw new Error('Já existe um pacote importado com esse id.');
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...installed, manifest]));
}

export async function readExternalPackageZip(file: File): Promise<ExternalPluginPackage> {
  if (!file.name.toLowerCase().endsWith('.zip') || file.size < 22 || file.size > 512_000) {
    throw new Error('Selecione um ZIP de até 500 KB.');
  }
  try {
    const { strFromU8, unzipSync } = await import('fflate');
    const content = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter: (entry) => entry.name === 'horizon-plugin.json' && entry.originalSize <= 256_000,
    });
    const manifest = content['horizon-plugin.json'];
    if (!manifest) throw new Error('O ZIP deve conter horizon-plugin.json na raiz.');
    return parseExternalPackage(JSON.parse(strFromU8(manifest)));
  } catch (error) {
    if (error instanceof Error && /Manifesto|Pacote|ZIP|horizon-plugin/.test(error.message)) throw error;
    throw new Error('Não foi possível ler o ZIP ou o JSON do manifesto.');
  }
}
