import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile as execFileCallback } from 'node:child_process';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';

const execFile = promisify(execFileCallback);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DATA_DIR = path.resolve(process.env.HORIZON_DATA_DIR || path.join(ROOT, '.horizon-data'));
const PLUGINS_DIR = path.join(DATA_DIR, 'plugins');
const ATTEMPTS_DIR = path.join(DATA_DIR, 'git-attempts');
const SETTINGS_DIR = path.join(DATA_DIR, 'plugin-settings');
const USER_SETTINGS_DIR = path.join(DATA_DIR, 'plugin-user-settings');
const REGISTRY_FILE = path.join(DATA_DIR, 'plugins.json');
const PLUGIN_AUDIT_FILE = path.join(DATA_DIR, 'plugin-audit.jsonl');
const ATTEMPTS_FILE = path.join(DATA_DIR, 'git-attempts.json');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4174);
const MAX_BODY = 1_000_000;
const MAX_OPERATION_RESPONSE = 1_000_000;
const SESSION_SECRET = process.env.HORIZON_SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : randomBytes(32).toString('base64url'));
const BRAND_IDS = new Set(['azime', 'alinare', 'novitah']);
const RESERVED_IDS = new Set(['admin', 'inventario', 'viagens', 'reverso', 'reservas', 'chamados']);
const SERVER_VERSION = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8')).version;

await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(PLUGINS_DIR, { recursive: true });
await fs.mkdir(ATTEMPTS_DIR, { recursive: true });
await fs.mkdir(SETTINGS_DIR, { recursive: true });
await fs.mkdir(USER_SETTINGS_DIR, { recursive: true });

const registry = await readJson(REGISTRY_FILE, { plugins: {} });
const attempts = await readJson(ATTEMPTS_FILE, {});

function isObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function text(value, label, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Manifesto inválido: ${label}.`);
  return value.trim();
}
function writeJsonAtomic(file, value) {
  return fs.mkdir(path.dirname(file), { recursive: true })
    .then(() => fs.writeFile(`${file}.${process.pid}.tmp`, JSON.stringify(value, null, 2), 'utf8'))
    .then(() => fs.rename(`${file}.${process.pid}.tmp`, file));
}
async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}
function status(status, detail, extra = {}) { return { status, detail, ...extra }; }
function pluginAccess(entry) {
  const access = isObject(entry?.access) ? entry.access : {};
  const enabledBrands = Array.isArray(access.enabledBrands) ? access.enabledBrands.filter((brand) => BRAND_IDS.has(brand)) : [];
  const grants = isObject(access.grants) ? access.grants : {};
  return { active: access.active !== false, enabledBrands, grants };
}
function pluginActionGranted(entry, session, action) {
  if (!entry || !session) return false;
  const access = pluginAccess(entry);
  if (!access.active || !access.enabledBrands.includes(session.brandId) || !session.brands.includes(session.brandId)) return false;
  if (entry.manifest.business === true && session.leader === true) return true;
  return access.grants[session.sub]?.[session.brandId]?.actions?.includes(action) === true;
}
async function readUserSettings(pluginId, userId) {
  const userKey = createHash('sha256').update(userId).digest('hex');
  return readJson(path.join(USER_SETTINGS_DIR, pluginId, userKey + '.json'), {});
}
function encodeBase64Url(value) { return Buffer.from(value).toString('base64url'); }
function createSessionToken(claims) {
  if (!SESSION_SECRET) throw new Error('HORIZON_SESSION_SECRET is not configured.');
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encodeBase64Url(JSON.stringify(claims));
  const signature = createHmac('sha256', SESSION_SECRET).update(header + '.' + payload).digest('base64url');
  return header + '.' + payload + '.' + signature;
}
function verifySessionToken(token) {
  if (!SESSION_SECRET || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const [headerPart, payloadPart, signaturePart] = parts;
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    if (header.alg !== 'HS256' || claims.aud !== 'horizon-plugin-query' || typeof claims.sub !== 'string' || !claims.sub || typeof claims.exp !== 'number' || claims.exp <= Date.now() / 1000) return null;
    if (claims.nbf != null && (typeof claims.nbf !== 'number' || claims.nbf > Date.now() / 1000)) return null;
    if (!BRAND_IDS.has(claims.brandId) || !Array.isArray(claims.brands) || !claims.brands.every((brand) => BRAND_IDS.has(brand)) || !claims.brands.includes(claims.brandId)) return null;
    const expected = createHmac('sha256', SESSION_SECRET).update(headerPart + '.' + payloadPart).digest();
    const supplied = Buffer.from(signaturePart, 'base64url');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    return claims;
  } catch { return null; }
}
function requestSession(req) {
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !/^Bearer\s+/i.test(authorization)) return null;
  return verifySessionToken(authorization.replace(/^Bearer\s+/i, '').trim());
}
function sessionTokenForRequest(req) {
  const authorization = req.headers.authorization;
  return typeof authorization === 'string' ? authorization.replace(/^Bearer\s+/i, '').trim() : '';
}
function allowedConnectionBase(value) {
  let base;
  try { base = new URL(value); } catch { return { error: 'missing_config', message: 'Configure uma URL HTTP/HTTPS válida para esta conexão.' }; }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    return { error: 'denied', message: 'A URL da conexão precisa usar HTTP/HTTPS sem credenciais, query ou fragmento.' };
  }
  const hosts = (process.env.HORIZON_PLUGIN_CONNECTION_ALLOWED_HOSTS || '').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean);
  const local = ['localhost', '127.0.0.1', '::1'].includes(base.hostname);
  if ((process.env.NODE_ENV === 'production' && local) || (!local && !hosts.includes(base.hostname.toLowerCase()))) {
    return { error: 'denied', message: 'O host da conexão não está autorizado pelo servidor do The One System.' };
  }
  return { base };
}
async function readLimitedJson(response) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_OPERATION_RESPONSE) throw new Error('A resposta do plugin excede o limite de 1 MB.');
  const reader = response.body?.getReader();
  if (!reader) return {};
  const chunks = [];
  let total = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    total += part.value.byteLength;
    if (total > MAX_OPERATION_RESPONSE) {
      await reader.cancel();
      throw new Error('A resposta do plugin excede o limite de 1 MB.');
    }
    chunks.push(Buffer.from(part.value));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function valueAtPath(value, route) {
  return route.split('.').reduce((current, key) => isObject(current) ? current[key] : undefined, value);
}
function validateOperationInputs(operation, url) {
  const declared = new Map(operation.inputs.map((input) => [input.name, input]));
  for (const key of url.searchParams.keys()) if (!declared.has(key)) throw Object.assign(new Error('Parâmetro não declarado: ' + key + '.'), { statusCode: 400 });
  const values = {};
  for (const input of operation.inputs) {
    const all = url.searchParams.getAll(input.name);
    if (all.length > 1) throw Object.assign(new Error('Parâmetro repetido: ' + input.name + '.'), { statusCode: 400 });
    const raw = all[0] ?? input.default;
    if (raw == null || raw === '') {
      if (input.required) throw Object.assign(new Error('Parâmetro obrigatório: ' + input.name + '.'), { statusCode: 400 });
      continue;
    }
    if (input.type === 'integer') {
      const value = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isSafeInteger(value) || value < (input.minimum ?? 0) || value > (input.maximum ?? 1000)) throw Object.assign(new Error('Parâmetro inteiro inválido: ' + input.name + '.'), { statusCode: 400 });
      values[input.name] = value;
    } else {
      const value = String(raw);
      if (value.length > (input.maxLength ?? 80) || /[\u0000-\u001f\u007f]/.test(value)) throw Object.assign(new Error('Parâmetro de texto inválido: ' + input.name + '.'), { statusCode: 400 });
      values[input.name] = value;
    }
  }
  return values;
}
async function executePluginOperation(req, res, pluginId, operationId, url) {
  const auditedResponse = async (code, body, session) => {
    const event = {
      id: randomUUID(),
      at: new Date().toISOString(),
      actorId: session?.sub || null,
      brandId: session?.brandId || null,
      pluginId,
      operationId,
      status: code,
      outcome: body.code || 'unknown',
    };
    try { await fs.appendFile(PLUGIN_AUDIT_FILE, JSON.stringify(event) + '\n', 'utf8'); }
    catch { return respond(res, 503, { code: 'audit_unavailable', error: 'Auditoria indisponível; a consulta não foi executada.' }); }
    return respond(res, code, body);
  };
  const session = requestSession(req);
  if (!session) return auditedResponse(401, { code: 'no_session', error: 'Sessão do The One System inválida ou ausente.' }, null);
  const entry = registry.plugins[pluginId];
  if (!entry) return auditedResponse(404, { code: 'not_installed', error: 'Plugin não instalado.' }, session);
  const manifest = entry.manifest;
  const operation = manifest.operations?.find((item) => item.id === operationId);
  if (!operation) return auditedResponse(404, { code: 'operation_not_found', error: 'Operação declarada não encontrada.' }, session);
  const access = pluginAccess(entry);
  if (!access.active || !access.enabledBrands.includes(session.brandId) || !session.brands.includes(session.brandId)) {
    return auditedResponse(403, { code: 'brand_disabled', error: 'Plugin desativado para o ambiente ativo.' }, session);
  }
  const individual = access.grants[session.sub]?.[session.brandId];
  const leaderAllowed = manifest.business === true && session.leader === true;
  if (!leaderAllowed && !individual?.actions?.includes(operation.requires)) return auditedResponse(403, { code: 'permission_denied', error: 'A conta não tem a permissão necessária para esta consulta.' }, session);
  const grantScope = leaderAllowed ? 'empresa' : individual.scope;
  const connection = manifest.connections.find((item) => item.id === operation.connection);
  const settings = await readSettings(pluginId);
  const baseValue = settings[connection.settingKey];
  if (typeof baseValue !== 'string' || !baseValue.trim()) return auditedResponse(424, { code: 'missing_config', error: 'Configure a conexão ' + connection.label + '.' }, session);
  const resolved = allowedConnectionBase(baseValue);
  if (resolved.error) return auditedResponse(resolved.error === 'missing_config' ? 424 : 403, { code: resolved.error, error: resolved.message }, session);
  let inputs;
  try { inputs = validateOperationInputs(operation, url); } catch (error) { return auditedResponse(error.statusCode || 400, { code: 'invalid_input', error: error.message }, session); }
  const pathPart = operation.path.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (_match, name) => encodeURIComponent(String(inputs[name])));
  const target = new URL(resolved.base.pathname.replace(/\/$/, '') + pathPart, resolved.base.origin);
  for (const input of operation.inputs) if (input.location === 'query' && inputs[input.name] != null) target.searchParams.set(input.name, String(inputs[input.name]));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const upstream = await fetch(target, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'error',
      headers: {
        accept: 'application/json',
        authorization: 'Bearer ' + sessionTokenForRequest(req),
        'x-horizon-actor-id': session.sub,
        'x-horizon-brand-id': session.brandId,
        'x-horizon-permission': operation.requires,
        'x-horizon-scope': grantScope,
        'x-horizon-plugin-id': pluginId,
        'x-horizon-operation-id': operation.id,
      },
    });
    if (upstream.status === 401 || upstream.status === 403) return auditedResponse(403, { code: 'source_denied', error: 'A fonte negou acesso à conta ou ao ambiente ativo.' }, session);
    if (upstream.status === 404) return auditedResponse(404, { code: 'record_not_found', error: 'O registro não foi encontrado na fonte.' }, session);
    if (!upstream.ok) return auditedResponse(503, { code: 'unavailable', error: 'A fonte respondeu HTTP ' + upstream.status + '.' }, session);
    let payload;
    try { payload = await readLimitedJson(upstream); } catch (error) { return auditedResponse(502, { code: 'invalid_response', error: error.message || 'Resposta JSON da fonte inválida.' }, session); }
    const data = valueAtPath(payload, operation.response.path);
    if (operation.response.kind === 'collection' ? !Array.isArray(data) || data.some((item) => !isObject(item)) : !isObject(data)) {
      return auditedResponse(502, { code: 'invalid_response', error: 'A resposta da fonte não corresponde ao contrato do manifesto.' }, session);
    }
    return auditedResponse(200, { data, kind: operation.response.kind, commit: entry.install.commit }, session);
  } catch {
    return auditedResponse(503, { code: 'unavailable', error: 'A fonte não respondeu ou está indisponível.' }, session);
  } finally { clearTimeout(timer); }
}
function validRoute(value, basePath) {
  return value === basePath || (value.startsWith(`${basePath}/`) && !value.includes('//') && !value.includes('..') && !/[\\%?#]/.test(value));
}
function classifyGitError(error) {
  const message = `${error.stderr || ''} ${error.message || ''}`.toLowerCase();
  if (/authentication failed|could not read username|permission denied|access denied|403|repository not found|not authorized|publickey/.test(message)) return 'denied';
  return 'unavailable';
}
function loopback(address = '') {
  const normalized = address.replace(/^::ffff:/, '');
  return normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost';
}
function adminAllowed(req) {
  const remote = req.socket.remoteAddress || '';
  if (process.env.NODE_ENV !== 'production' && loopback(remote)) return true;
  const expected = process.env.HORIZON_ADMIN_TOKEN;
  if (!expected) return false;
  const supplied = req.headers['x-horizon-admin-token'] || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const token = typeof supplied === 'string' ? Buffer.from(supplied) : Buffer.alloc(0);
  const expectedBytes = Buffer.from(expected);
  if (token.length === expectedBytes.length && timingSafeEqual(token, expectedBytes)) return true;
  return requestSession(req)?.admin === true;
}
function validateRepositoryUrl(value) {
  const source = text(value, 'repositoryUrl', 2048);
  if (/\s/.test(source) || source.startsWith('-')) throw new Error('Informe uma URL Git válida.');
  const localAllowed = process.env.HORIZON_ALLOW_LOCAL_GIT === '1' && process.env.NODE_ENV !== 'production';
  if (localAllowed && (path.isAbsolute(source) || /^[A-Za-z]:[\\/]/.test(source))) return source;
  if (source.startsWith('git@')) {
    if (!/^git@[A-Za-z0-9.-]+:[A-Za-z0-9_./-]+(?:\.git)?$/.test(source)) throw new Error('URL SSH inválida.');
    verifyHost(source.slice(4).split(':')[0]);
    return source;
  }
  let parsed;
  try { parsed = new URL(source); } catch { throw new Error('Use uma URL HTTPS ou SSH configurada no servidor.'); }
  const allowedSshUser = parsed.protocol === 'ssh:' && parsed.username === 'git' && !parsed.password;
  if (!['https:', 'ssh:'].includes(parsed.protocol) || (parsed.username && !allowedSshUser) || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Use HTTPS/SSH sem credenciais embutidas, parâmetros ou fragmentos.');
  }
  verifyHost(parsed.hostname);
  return source;
}
function verifyHost(host) {
  const allowed = (process.env.HORIZON_GIT_ALLOWED_HOSTS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (process.env.NODE_ENV === 'production' && !allowed.length) throw new Error('Configure HORIZON_GIT_ALLOWED_HOSTS no servidor.');
  if (allowed.length && !allowed.includes(host.toLowerCase())) throw new Error('A hospedagem Git não está na lista permitida pelo servidor.');
}
function validateRevision(type, value) {
  const revision = text(value, 'revision', 160);
  if (type === 'commit') {
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(revision)) throw new Error('Informe o SHA completo do commit.');
  } else if (type === 'tag') {
    if (revision.startsWith('-') || revision.includes('..') || !/^[A-Za-z0-9][A-Za-z0-9._/+~-]*$/.test(revision)) throw new Error('Tag inválida.');
  } else throw new Error('Selecione uma tag ou um commit.');
  return revision;
}
async function git(args, cwd, timeout = 120_000) {
  const result = await execFile('git', args, {
    cwd,
    timeout,
    maxBuffer: 4_000_000,
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
  });
  return result.stdout.trim();
}
async function listTags(repositoryUrl) {
  const source = validateRepositoryUrl(repositoryUrl);
  const stdout = await git(['ls-remote', '--tags', '--refs', source]);
  return stdout.split(/\r?\n/).filter(Boolean).map((line) => {
    const [commit, ref] = line.split(/\s+/);
    return { name: ref.replace(/^refs\/tags\//, ''), commit };
  }).sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }));
}

function parseManifest(value) {
  if (!isObject(value) || value.format !== 'horizon-plugin' || value.manifestVersion !== 1) throw new Error('Compatibilidade: esperado manifesto horizon-plugin v1.');
  const id = text(value.id, 'id', 48);
  if (!/^[a-z][a-z0-9-]{2,47}$/.test(id) || RESERVED_IDS.has(id)) throw new Error('Manifesto inválido: id reservado ou fora do formato.');
  const basePath = text(value.basePath, 'basePath', 120);
  if (basePath !== `/ext/${id}`) throw new Error(`basePath precisa ser /ext/${id}.`);
  if (!Array.isArray(value.actions) || value.actions.length < 1 || value.actions.length > 20) throw new Error('Manifesto inválido: actions.');
  const actions = value.actions.map((entry) => {
    if (!isObject(entry)) throw new Error('Manifesto inválido: action.');
    const actionId = text(entry.id, 'action.id', 48);
    if (!/^[a-z][a-z0-9_]*$/.test(actionId)) throw new Error('Manifesto inválido: formato de action.id.');
    return { id: actionId, label: text(entry.label, 'action.label', 80) };
  });
  if (new Set(actions.map((x) => x.id)).size !== actions.length) throw new Error('Manifesto inválido: action.id repetido.');
  const knownActions = new Set(actions.map((x) => x.id));
  const requirement = (raw) => {
    if (raw == null) return undefined;
    const items = Array.isArray(raw) ? raw : [raw];
    if (!items.length || items.some((item) => typeof item !== 'string' || !knownActions.has(item))) throw new Error('Manifesto inválido: rota/menu exige ação não declarada.');
    return Array.isArray(raw) ? items : items[0];
  };
  if (!Array.isArray(value.pages) || !value.pages.length || value.pages.length > 20) throw new Error('Manifesto inválido: pages.');
  const pages = value.pages.map((entry) => {
    if (!isObject(entry)) throw new Error('Manifesto inválido: page.');
    const pagePath = text(entry.path, 'page.path', 160);
    if (pagePath !== basePath && !pagePath.startsWith(`${basePath}/`)) throw new Error('Manifesto inválido: rota fora do basePath.');
    if (entry.mode != null && !['demo', 'real'].includes(entry.mode)) throw new Error('Manifesto inválido: page.mode.');
    if (entry.sections != null && (!Array.isArray(entry.sections) || entry.sections.length > 12)) throw new Error('Manifesto inválido: page.sections.');
    const sections = (entry.sections || []).map((section) => {
      if (!isObject(section)) throw new Error('Manifesto inválido: section.');
      return { title: text(section.title, 'section.title', 100), body: text(section.body, 'section.body', 1200) };
    });
    if (!validRoute(pagePath, basePath)) throw new Error('Manifest page route is invalid.');
    const pageKind = entry.kind == null ? 'content' : entry.kind;
    if (!['content', 'list', 'detail'].includes(pageKind)) throw new Error('Manifest page kind is invalid.');
    const pageFields = (raw, label, max) => {
      if (!Array.isArray(raw) || raw.length < 1 || raw.length > max) throw new Error(`Manifest ${label} is invalid.`);
      return raw.map((field) => {
        if (!isObject(field)) throw new Error(`Manifest ${label} is invalid.`);
        const name = text(field.field, `${label}.field`, 100);
        if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(name)) throw new Error(`Manifest ${label}.field is invalid.`);
        return { label: text(field.label, `${label}.label`, 100), field: name };
      });
    };
    let search;
    if (entry.search != null) {
      if (!isObject(entry.search)) throw new Error('Manifest page search is invalid.');
      search = { input: text(entry.search.input, 'page.search.input', 48), placeholder: entry.search.placeholder == null ? undefined : text(entry.search.placeholder, 'page.search.placeholder', 120) };
    }
    const detailPath = entry.detailPath == null ? undefined : text(entry.detailPath, 'page.detailPath', 160);
    if (detailPath && !validRoute(detailPath.replace(/:[A-Za-z][A-Za-z0-9_]*/g, 'x'), basePath)) throw new Error('Manifest page detailPath is invalid.');
    return {
      path: pagePath,
      title: text(entry.title, 'page.title', 100),
      description: entry.description == null ? undefined : text(entry.description, 'page.description', 300),
      requires: requirement(entry.requires),
      mode: entry.mode || 'demo',
      kind: pageKind,
      operationId: entry.operationId == null ? undefined : text(entry.operationId, 'page.operationId', 48),
      columns: entry.columns == null ? undefined : pageFields(entry.columns, 'page.columns', 12),
      search,
      detailPath,
      recordIdField: entry.recordIdField == null ? undefined : text(entry.recordIdField, 'page.recordIdField', 100),
      recordIdParam: entry.recordIdParam == null ? undefined : text(entry.recordIdParam, 'page.recordIdParam', 48),
      fields: entry.fields == null ? undefined : pageFields(entry.fields, 'page.fields', 30),
      configuration: entry.configuration === true,
      sections,
    };
  });
  if (new Set(pages.map((x) => x.path)).size !== pages.length) throw new Error('Manifesto inválido: rota repetida.');
  if (!Array.isArray(value.menu) || !value.menu.length || value.menu.length > 20) throw new Error('Manifesto inválido: menu.');
  const menu = value.menu.map((entry) => {
    if (!isObject(entry)) throw new Error('Manifesto inválido: menu item.');
    const menuPath = text(entry.path, 'menu.path', 160);
    if (!pages.some((page) => page.path === menuPath)) throw new Error('Manifesto inválido: menu aponta para página inexistente.');
    return { label: text(entry.label, 'menu.label', 80), path: menuPath, requires: requirement(entry.requires) };
  });
  const settingsFields = value.configuration?.fields ?? [];
  if (value.configuration != null && !isObject(value.configuration)) throw new Error('Manifesto inválido: configuration precisa ser objeto.');
  if (!Array.isArray(settingsFields) || settingsFields.length > 30) throw new Error('Manifesto inválido: configuration.fields.');
  const fields = settingsFields.map((field) => {
    if (!isObject(field) || !['text', 'url'].includes(field.type)) throw new Error('Manifesto inválido: campo de configuração.');
    return { id: text(field.id, 'configuration.field.id', 64), label: text(field.label, 'configuration.field.label', 100), type: field.type, required: field.required === true, placeholder: field.placeholder == null ? undefined : text(field.placeholder, 'configuration.field.placeholder', 200) };
  });
  if (new Set(fields.map((x) => x.id)).size !== fields.length) throw new Error('Manifesto inválido: campo de configuração repetido.');
  const userConfigurationValue = value.userConfiguration ?? null;
  if (userConfigurationValue != null && !isObject(userConfigurationValue)) throw new Error('Manifest userConfiguration is invalid.');
  const userSettingsFields = userConfigurationValue?.fields ?? [];
  if (!Array.isArray(userSettingsFields) || userSettingsFields.length > 30) throw new Error('Manifest userConfiguration fields are invalid.');
  const userFields = userSettingsFields.map((field) => {
    if (!isObject(field) || !['text', 'url'].includes(field.type)) throw new Error('Manifest userConfiguration field is invalid.');
    return { id: text(field.id, 'userConfiguration.field.id', 64), label: text(field.label, 'userConfiguration.field.label', 100), type: field.type, required: field.required === true, placeholder: field.placeholder == null ? undefined : text(field.placeholder, 'userConfiguration.field.placeholder', 200) };
  });
  if (new Set(userFields.map((field) => field.id)).size !== userFields.length) throw new Error('Manifest userConfiguration field id is duplicated.');
  const connections = value.connections ?? [];
  if (!Array.isArray(connections) || connections.length > 20) throw new Error('Manifesto inválido: connections.');
  const parsedConnections = connections.map((entry) => {
    if (!isObject(entry) || !fields.some((field) => field.id === entry.settingKey)) throw new Error('Manifesto inválido: connection.settingKey precisa apontar para uma configuração declarada.');
    const healthPath = text(entry.healthPath || '/health', 'connection.healthPath', 200);
    if (!healthPath.startsWith('/') || healthPath.startsWith('//')) throw new Error('Manifesto inválido: healthPath precisa ser um caminho relativo.');
    return { id: text(entry.id, 'connection.id', 48), label: text(entry.label, 'connection.label', 100), settingKey: entry.settingKey, healthPath };
  });
  if (new Set(parsedConnections.map((connection) => connection.id)).size !== parsedConnections.length) throw new Error('Manifest connection id is duplicated.');

  const operationRows = value.operations ?? [];
  if (!Array.isArray(operationRows) || operationRows.length > 50) throw new Error('Manifest operations are invalid.');
  const connectionIds = new Set(parsedConnections.map((connection) => connection.id));
  const operations = operationRows.map((entry) => {
    if (!isObject(entry)) throw new Error('Manifest operation is invalid.');
    const operationId = text(entry.id, 'operation.id', 48);
    if (!/^[a-z][a-z0-9-]*$/.test(operationId)) throw new Error('Manifest operation id is invalid.');
    const connection = text(entry.connection, 'operation.connection', 48);
    if (!connectionIds.has(connection)) throw new Error(`Operation ${operationId} refers to an undeclared connection.`);
    if (entry.method !== 'GET') throw new Error('Only read-only GET operations are supported.');
    const operationPath = text(entry.path, 'operation.path', 200);
    if (!operationPath.startsWith('/') || operationPath.startsWith('//') || operationPath.includes('..') || /[\\%?#]/.test(operationPath) || !/^\/[A-Za-z0-9/_:-]+$/.test(operationPath)) throw new Error('Manifest operation path is invalid.');
    const rawInputs = entry.inputs ?? [];
    if (!Array.isArray(rawInputs) || rawInputs.length > 20) throw new Error('Manifest operation inputs are invalid.');
    const inputs = rawInputs.map((input) => {
      if (!isObject(input)) throw new Error('Manifest operation input is invalid.');
      const name = text(input.name, 'operation.input.name', 48);
      if (!/^[a-z][A-Za-z0-9_]*$/.test(name) || !['path', 'query'].includes(input.location) || !['string', 'integer'].includes(input.type)) throw new Error('Manifest operation input definition is invalid.');
      const parsed = { name, location: input.location, type: input.type, required: input.required === true };
      if (input.type === 'string') {
        const maxLength = input.maxLength == null ? 80 : Number(input.maxLength);
        if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 512 || input.location === 'path' && maxLength > 80) throw new Error('Manifest operation string limit is invalid.');
        parsed.maxLength = maxLength;
        if (input.default != null) {
          if (typeof input.default !== 'string' || input.default.length > maxLength) throw new Error('Manifest operation default is invalid.');
          parsed.default = input.default;
        }
      } else {
        const minimum = input.minimum == null ? 0 : Number(input.minimum);
        const maximum = input.maximum == null ? 1000 : Number(input.maximum);
        if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || minimum < 0 || maximum < minimum || maximum > 10_000) throw new Error('Manifest operation integer range is invalid.');
        parsed.minimum = minimum;
        parsed.maximum = maximum;
        if (input.default != null) {
          if (!Number.isSafeInteger(input.default) || input.default < minimum || input.default > maximum) throw new Error('Manifest operation default is invalid.');
          parsed.default = input.default;
        }
      }
      return parsed;
    });
    if (new Set(inputs.map((input) => input.name)).size !== inputs.length) throw new Error('Manifest operation input name is duplicated.');
    const placeholders = Array.from(operationPath.matchAll(/:([A-Za-z][A-Za-z0-9_]*)/g), (match) => match[1]);
    const pathInputs = inputs.filter((input) => input.location === 'path').map((input) => input.name);
    if (new Set(placeholders).size !== placeholders.length || placeholders.length !== pathInputs.length || placeholders.some((name) => !pathInputs.includes(name))) throw new Error('Manifest path parameters must match path inputs.');
    const action = requirement(entry.requires);
    if (typeof action !== 'string') throw new Error('An operation must require one declared action.');
    const response = entry.response;
    if (!isObject(response) || !['collection', 'record'].includes(response.kind)) throw new Error('Manifest operation response is invalid.');
    const responsePath = text(response.path, 'operation.response.path', 100);
    if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(responsePath)) throw new Error('Manifest operation response path is invalid.');
    return { id: operationId, connection, method: 'GET', path: operationPath, requires: action, inputs, response: { kind: response.kind, path: responsePath } };
  });
  if (new Set(operations.map((operation) => operation.id)).size !== operations.length) throw new Error('Manifest operation id is duplicated.');
  const operationById = new Map(operations.map((operation) => [operation.id, operation]));
  const pageByPath = new Map(pages.map((page) => [page.path, page]));
  for (const page of pages) {
    if (page.kind === 'content') {
      if (page.operationId) throw new Error('Content pages cannot bind a data operation.');
      continue;
    }
    const operation = operationById.get(page.operationId);
    if (!operation || !([page.requires].flat().includes(operation.requires))) throw new Error(`Page ${page.path} must require its operation action.`);
    if (page.kind === 'list') {
      if (operation.response.kind !== 'collection' || !page.columns?.length || !page.recordIdField) throw new Error('List pages need a collection operation, columns, and a record id field.');
      const detailPage = pageByPath.get(page.detailPath);
      if (!detailPage || detailPage.kind !== 'detail') throw new Error('List page detailPath must point to a declared detail page.');
      if (page.search && !operation.inputs.some((input) => input.name === page.search.input && input.location === 'query' && input.type === 'string')) throw new Error('List search must target a declared query string input.');
    } else {
      if (operation.response.kind !== 'record' || !page.fields?.length || !page.recordIdParam || !operation.inputs.some((input) => input.name === page.recordIdParam && input.location === 'path')) throw new Error('Detail pages need a record operation, fields, and a declared path id input.');
    }
  }
  const requirements = value.requirements ?? [];
  const dependencies = value.dependencies ?? [];
  if (!Array.isArray(requirements) || requirements.length > 20 || !Array.isArray(dependencies) || dependencies.length > 20) throw new Error('Manifesto inválido: requirements/dependencies.');
  const compatibility = value.compatibility ?? {};
  if (!isObject(compatibility)) throw new Error('Manifesto inválido: compatibility.');
  return {
    format: 'horizon-plugin', manifestVersion: 1, id,
    name: text(value.name, 'name', 80), description: text(value.description, 'description', 240), version: text(value.version, 'version', 32), basePath,
    icon: ['Puzzle', 'Package', 'Boxes', 'FileSearch'].includes(value.icon) ? value.icon : 'Puzzle',
    business: value.business === true, actions, operations, menu, pages,
    requirements: requirements.map((x) => text(x, 'requirement', 160)),
    compatibility: { horizon: compatibility.horizon || '>=0.5.0 <0.6.0', sdk: compatibility.sdk || '^0.5.0' },
    dependencies: dependencies.map((x) => {
      if (!isObject(x)) throw new Error('Manifesto inválido: dependency.');
      return { id: text(x.id, 'dependency.id', 100), range: text(x.range, 'dependency.range', 64) };
    }),
    configuration: { title: value.configuration?.title ? text(value.configuration.title, 'configuration.title', 100) : 'Configuração', description: value.configuration?.description ? text(value.configuration.description, 'configuration.description', 300) : undefined, fields },
    userConfiguration: userConfigurationValue ? { title: userConfigurationValue.title ? text(userConfigurationValue.title, 'userConfiguration.title', 100) : 'Configuração pessoal', description: userConfigurationValue.description ? text(userConfigurationValue.description, 'userConfiguration.description', 300) : undefined, fields: userFields } : undefined,
    connections: parsedConnections,
  };
}

function parseVersion(version) { return String(version || '0.0.0').match(/^(\d+)\.(\d+)\.(\d+)/)?.slice(1).map(Number) || [0, 0, 0]; }
function compareVersion(left, right) {
  const a = parseVersion(left); const b = parseVersion(right);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
}
function satisfies(version, range) {
  const source = String(range || '*').trim();
  if (source === '*' || source === 'latest') return true;
  if (source.startsWith('^')) {
    const floor = source.slice(1);
    const [major, minor] = parseVersion(floor);
    return compareVersion(version, floor) >= 0 && parseVersion(version)[0] === major && (major !== 0 || parseVersion(version)[1] === minor);
  }
  const terms = source.split(/\s+/);
  return terms.every((term) => {
    const match = term.match(/^(>=|>|<=|<|=)?(\d+\.\d+\.\d+)$/);
    if (!match) return false;
    const compared = compareVersion(version, match[2]);
    return ({ '>=': compared >= 0, '>': compared > 0, '<=': compared <= 0, '<': compared < 0, '=': compared === 0, undefined: compared === 0 })[match[1] || 'undefined'];
  });
}
function compatibilityChecks(manifest) {
  const horizonOk = satisfies(SERVER_VERSION, manifest.compatibility.horizon);
  const sdkDependency = manifest.dependencies.filter((dependency) => dependency.id === '@azime/horizon-plugin-sdk');
  const sdkRange = manifest.compatibility.sdk;
  const sdkOk = satisfies('0.5.0', sdkRange) && sdkDependency.every((dependency) => satisfies('0.5.0', dependency.range));
  const dependencies = manifest.dependencies.map((dependency) => {
    if (dependency.id === '@azime/horizon-plugin-sdk') return status(satisfies('0.5.0', dependency.range) ? 'ok' : 'incompatible', `SDK 0.5.0 do The One System; requerido ${dependency.range}.`, { name: dependency.id });
    const installed = registry.plugins[dependency.id]?.manifest?.version;
    return status(installed && satisfies(installed, dependency.range) ? 'ok' : 'incompatible', installed ? `Encontrada v${installed}; requerido ${dependency.range}.` : `Dependência ${dependency.id} não instalada.`, { name: dependency.id });
  });
  const checks = {
    compatibility: status(horizonOk && sdkOk ? 'ok' : 'incompatible', horizonOk && sdkOk ? `Manifesto compatível com The One System ${SERVER_VERSION} e SDK 0.5.0.` : `Requer compatibilidade ${manifest.compatibility.horizon} e SDK ${manifest.compatibility.sdk}.`),
    dependencies,
  };
  return checks;
}

async function readSettings(id) { return readJson(path.join(SETTINGS_DIR, `${id}.json`), {}); }
async function readSafeSettings(pluginId, attemptId) {
  const installedManifest = registry.plugins[pluginId]?.manifest;
  const stagedManifest = attemptId ? await readAttemptManifest(attempts[attemptId]) : null;
  const manifest = installedManifest || stagedManifest;
  if (!manifest || manifest.id !== pluginId) return {};
  const allowed = new Set((manifest.configuration?.fields || []).map((field) => field.id));
  const settings = await readSettings(pluginId);
  return Object.fromEntries(Object.entries(settings).filter(([key, value]) => allowed.has(key) && typeof value === 'string'));
}
async function testConnection(connection, manifest) {
  const settings = await readSettings(manifest.id);
  const value = settings[connection.settingKey];
  if (typeof value !== 'string' || !value.trim()) return status('missing_config', `Configure ${connection.settingKey} para validar esta conexão.`, { id: connection.id, label: connection.label, settingKey: connection.settingKey });
  let base;
  try { base = new URL(value); } catch { return status('missing_config', 'Informe uma URL HTTP/HTTPS válida.', { id: connection.id, label: connection.label, settingKey: connection.settingKey }); }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) return status('denied', 'A URL precisa usar HTTP/HTTPS sem credenciais embutidas.', { id: connection.id, label: connection.label, settingKey: connection.settingKey });
  const hosts = (process.env.HORIZON_PLUGIN_CONNECTION_ALLOWED_HOSTS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  const local = ['localhost', '127.0.0.1', '::1'].includes(base.hostname);
  if ((process.env.NODE_ENV === 'production' && local) || (!local && !hosts.includes(base.hostname.toLowerCase()))) {
    return status('denied', 'O host não está na lista permitida pelo servidor.', { id: connection.id, label: connection.label, settingKey: connection.settingKey });
  }
  base.pathname = `${base.pathname.replace(/\/$/, '')}${connection.healthPath}`;
  base.search = '';
  base.hash = '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(base, { signal: controller.signal, redirect: 'error', headers: { accept: 'application/json' } });
    if (response.status === 401 || response.status === 403) return status('denied', `O serviço negou acesso (${response.status}).`, { id: connection.id, label: connection.label, settingKey: connection.settingKey });
    if (!response.ok) return status('unavailable', `O serviço respondeu HTTP ${response.status}.`, { id: connection.id, label: connection.label, settingKey: connection.settingKey });
    return status('ok', `Conexão respondendo em ${base.origin}.`, { id: connection.id, label: connection.label, settingKey: connection.settingKey });
  } catch (error) {
    const denied = false;
    return status(denied ? 'denied' : 'unavailable', denied ? 'O host não pôde ser resolvido pela política do servidor.' : 'O serviço não respondeu ou está indisponível.', { id: connection.id, label: connection.label, settingKey: connection.settingKey });
  } finally { clearTimeout(timer); }
}

async function inspectRepository(repositoryUrl) {
  try {
    const tags = await listTags(repositoryUrl);
    return { check: status('ok', 'O servidor acessou o repositório Git.'), tags };
  } catch (error) {
    const category = /hospedagem|URL|HTTPS|SSH|credenciais|lista permitida/i.test(error.message || '') ? 'denied' : classifyGitError(error);
    return { check: status(category, category === 'denied' ? 'Acesso ao repositório negado ou URL não autorizada.' : 'O serviço Git está indisponível.', { detail: error.message?.slice(0, 240) }) };
  }
}

async function attemptValidation(body) {
  const repositoryUrl = validateRepositoryUrl(body.repositoryUrl);
  const revisionType = body.revisionType;
  const revision = validateRevision(revisionType, body.revision);
  const attemptId = typeof body.attemptId === 'string' && /^[a-f0-9-]{36}$/i.test(body.attemptId) ? body.attemptId : randomUUID();
  let attempt = attempts[attemptId];
  if (attempt && (attempt.repositoryUrl !== repositoryUrl || attempt.revisionType !== revisionType || attempt.revision !== revision)) {
    const error = new Error('Esta tentativa já está vinculada a outra URL/revisão. Inicie uma nova tentativa.');
    error.statusCode = 409; throw error;
  }
  const repository = await inspectRepository(repositoryUrl);
  if (repository.check.status !== 'ok') return { attemptId, status: 'pending', checks: { repository: repository.check, revision: status('unavailable', 'A revisão depende do acesso ao repositório.'), compatibility: status('unavailable', 'Manifesto ainda não foi lido.'), dependencies: [], connections: [] } };

  if (!attempt) {
    const stagingDir = path.join(ATTEMPTS_DIR, attemptId);
    try {
      await git(['clone', '--quiet', '--no-checkout', repositoryUrl, stagingDir], ROOT, 180_000);
      await git(['fetch', '--quiet', '--tags', 'origin'], stagingDir, 180_000);
      attempt = { attemptId, repositoryUrl, revisionType, revision, stagingDir, createdAt: new Date().toISOString() };
      attempts[attemptId] = attempt;
    } catch (error) {
      const category = classifyGitError(error);
      return { attemptId, status: 'pending', checks: { repository: status(category, category === 'denied' ? 'Acesso ao conteúdo do repositório negado.' : 'Não foi possível buscar o repositório no servidor.', { detail: String(error.stderr || error.message).slice(0, 240) }), revision: status('unavailable', 'Revisão ainda não resolvida.'), compatibility: status('unavailable', 'Manifesto ainda não foi lido.'), dependencies: [], connections: [] } };
    }
  }
  await writeJsonAtomic(ATTEMPTS_FILE, attempts);

  let commit = attempt.commit;
  if (!commit) {
    try {
      if (revisionType === 'commit') {
        try { await git(['fetch', '--quiet', 'origin', revision], attempt.stagingDir, 120_000); } catch { /* unreachable commits are rejected below */ }
      }
      const expression = revisionType === 'tag' ? `refs/tags/${revision}^{commit}` : `${revision}^{commit}`;
      commit = await git(['rev-parse', '--verify', '--end-of-options', expression], attempt.stagingDir);
      attempt.commit = commit;
      await writeJsonAtomic(ATTEMPTS_FILE, attempts);
    } catch {
      return { attemptId, status: 'pending', checks: { repository: repository.check, revision: status('not_found', `A revisão ${revision} não existe no repositório acessível.`, { selected: revision, type: revisionType }), compatibility: status('unavailable', 'Manifesto ainda não foi lido.'), dependencies: [], connections: [] } };
    }
  }

  let manifest;
  try {
    const raw = await git(['show', `${commit}:horizon-plugin.json`], attempt.stagingDir);
    if (raw.length > 256_000) throw new Error('Manifesto excede 256 KB.');
    manifest = parseManifest(JSON.parse(raw));
  } catch (error) {
    return { attemptId, status: 'pending', checks: { repository: repository.check, revision: status('ok', 'Revisão resolvida para um commit exato.', { selected: revision, type: revisionType, commit }), compatibility: status('incompatible', error.message || 'Manifesto ausente ou inválido.'), dependencies: [], connections: [] } };
  }

  const prior = registry.plugins[manifest.id];
  if (prior && prior.install?.repository !== repositoryUrl) {
    return { attemptId, status: 'pending', manifest, checks: { repository: repository.check, revision: status('ok', 'Revisão resolvida.', { selected: revision, type: revisionType, commit }), compatibility: status('incompatible', 'O id já está instalado a partir de outro repositório.'), dependencies: [], connections: [] } };
  }
  const compatibility = compatibilityChecks(manifest);
  const connections = await Promise.all(manifest.connections.map((connection) => testConnection(connection, manifest)));
  const checks = {
    repository: repository.check,
    revision: status('ok', 'Revisão resolvida para commit imutável.', { selected: revision, type: revisionType, commit }),
    compatibility: compatibility.compatibility,
    dependencies: compatibility.dependencies,
    connections,
  };
  const passed = [checks.repository, checks.revision, checks.compatibility, ...checks.dependencies, ...checks.connections].every((check) => check.status === 'ok');
  if (!passed) return { attemptId, status: 'pending', manifest, checks };

  await git(['checkout', '--quiet', '--detach', commit], attempt.stagingDir);
  const pluginRoot = path.join(PLUGINS_DIR, manifest.id);
  const target = path.join(pluginRoot, commit);
  await fs.mkdir(pluginRoot, { recursive: true });
  try { await fs.access(target); } catch { await fs.cp(attempt.stagingDir, target, { recursive: true }); }
  await fs.mkdir(path.join(DATA_DIR, 'plugin-data', manifest.id), { recursive: true });
  const installedAt = new Date().toISOString();
  registry.plugins[manifest.id] = {
    manifest,
    install: {
      repository: repositoryUrl,
      revisionType,
      revision,
      commit,
      version: manifest.version,
      installedAt,
      checkout: path.relative(DATA_DIR, target).split(path.sep).join('/'),
      enabledBrands: prior ? pluginAccess(prior).enabledBrands : [],
      active: prior ? pluginAccess(prior).active : true,
    },
    access: prior ? pluginAccess(prior) : { active: true, enabledBrands: [], grants: {} },
  };
  await writeJsonAtomic(REGISTRY_FILE, registry);
  return { attemptId, status: 'installed', manifest, install: registry.plugins[manifest.id].install, checks };
}

async function parseBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > MAX_BODY) { const error = new Error('Corpo da solicitação excede o limite.'); error.statusCode = 413; throw error; }
  }
  return body ? JSON.parse(body) : {};
}
function respond(res, code, value) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(value));
}
function adminOnly(req, res) {
  if (adminAllowed(req)) return true;
  respond(res, 403, { error: 'Acesso administrativo negado pelo servidor.' });
  return false;
}
async function saveConfig(pluginId, body) {
  const manifest = body.attemptId ? attempts[body.attemptId]?.manifest : registry.plugins[pluginId]?.manifest;
  const stagedManifest = body.attemptId ? await readAttemptManifest(attempts[body.attemptId]) : null;
  const definition = manifest || stagedManifest;
  if (!definition || definition.id !== pluginId) { const error = new Error('Plugin ou tentativa não encontrado.'); error.statusCode = 404; throw error; }
  if (!isObject(body.settings)) throw new Error('Envie settings como objeto.');
  const allowed = new Set((definition.configuration?.fields || []).map((field) => field.id));
  const settings = {};
  for (const [key, value] of Object.entries(body.settings)) {
    if (!allowed.has(key) || typeof value !== 'string' || value.length > 2048) throw new Error(`Configuração inválida: ${key}.`);
    settings[key] = value.trim();
  }
  const current = await readSettings(pluginId);
  await writeJsonAtomic(path.join(SETTINGS_DIR, `${pluginId}.json`), { ...current, ...settings, updatedAt: new Date().toISOString() });
  return { ok: true, settings: Object.fromEntries(Object.entries({ ...current, ...settings }).filter(([key]) => allowed.has(key))) };
}
async function saveUserSettings(pluginId, userId, manifest, body) {
  if (!isObject(body.settings)) throw new Error('Envie settings como objeto.');
  const allowed = new Map((manifest.userConfiguration?.fields || []).map((field) => [field.id, field]));
  const settings = {};
  for (const [key, value] of Object.entries(body.settings)) {
    const field = allowed.get(key);
    if (!field || typeof value !== 'string' || value.length > 2048) throw new Error('Preferência inválida: ' + key + '.');
    if (field.required && !value.trim()) throw new Error('Preencha o campo obrigatório: ' + field.label + '.');
    if (field.type === 'url' && value.trim()) {
      let parsed;
      try { parsed = new URL(value.trim()); } catch { throw new Error('URL inválida: ' + field.label + '.'); }
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('A URL precisa usar HTTP/HTTPS sem credenciais.');
    }
    settings[key] = value.trim();
  }
  const current = await readUserSettings(pluginId, userId);
  const next = { ...current, ...settings };
  const userKey = createHash('sha256').update(userId).digest('hex');
  await writeJsonAtomic(path.join(USER_SETTINGS_DIR, pluginId, userKey + '.json'), next);
  await fs.appendFile(PLUGIN_AUDIT_FILE, JSON.stringify({
    id: randomUUID(), at: new Date().toISOString(), actorId: userId,
    brandId: null, pluginId, operationId: 'user-settings', status: 200, outcome: 'settings_updated',
  }) + '\n', 'utf8');
  return { ok: true, settings: next };
}
async function readAttemptManifest(attempt) {
  if (!attempt?.stagingDir || !attempt?.commit) return null;
  try { return parseManifest(JSON.parse(await git(['show', `${attempt.commit}:horizon-plugin.json`], attempt.stagingDir))); } catch { return null; }
}
async function serveStatic(req, res, url) {
  const dist = path.join(ROOT, 'dist');
  let requested = decodeURIComponent(url.pathname);
  if (requested === '/') requested = '/index.html';
  let file = path.resolve(dist, `.${requested}`);
  if (!file.startsWith(`${dist}${path.sep}`) && file !== path.join(dist, 'index.html')) { res.writeHead(403); return res.end(); }
  try { await fs.access(file); } catch { file = path.join(dist, 'index.html'); }
  try {
    const contents = await fs.readFile(file);
    const ext = path.extname(file);
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
    res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'x-content-type-options': 'nosniff' });
    res.end(contents);
  } catch { res.writeHead(404); res.end('The One System ainda não foi compilado.'); }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return respond(res, 200, { ok: true, version: SERVER_VERSION });
    if (req.method === 'POST' && url.pathname === '/api/dev/session') {
      if (process.env.NODE_ENV === 'production' || process.env.HORIZON_DEV_SESSIONS !== '1' || !loopback(req.socket.remoteAddress || '')) {
        return respond(res, 404, { code: 'not_found', error: 'Sessões de demonstração indisponíveis.' });
      }
      const body = await parseBody(req);
      const userId = typeof body.userId === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(body.userId) ? body.userId : '';
      const brandId = BRAND_IDS.has(body.brandId) ? body.brandId : '';
      const brands = Array.isArray(body.brands) ? [...new Set(body.brands.filter((brand) => BRAND_IDS.has(brand)))] : [];
      if (!userId || !brandId || !brands.includes(brandId)) return respond(res, 400, { code: 'invalid_session', error: 'Informe usuário e ambiente de demonstração válidos.' });
      const now = Math.floor(Date.now() / 1000);
      const token = createSessionToken({
        aud: 'horizon-plugin-query',
        sub: userId,
        brandId,
        brands,
        leader: body.leader === true,
        admin: body.admin === true,
        iat: now,
        exp: now + 3600,
      });
      return respond(res, 200, { accessToken: token, expiresAt: now + 3600 });
    }
    if (req.method === 'GET' && url.pathname === '/api/plugins') {
      const plugins = Object.values(registry.plugins).map((entry) => {
        const access = pluginAccess(entry);
        return { manifest: entry.manifest, install: { ...entry.install, enabledBrands: access.enabledBrands, active: access.active } };
      });
      return respond(res, 200, { plugins });
    }
    if (req.method === 'POST' && url.pathname === '/api/plugins/git/revisions') {
      if (!adminOnly(req, res)) return;
      const body = await parseBody(req);
      try {
        const repository = await inspectRepository(body.repositoryUrl);
        if (repository.check.status !== 'ok') return respond(res, 200, { repository: repository.check, tags: [] });
        return respond(res, 200, { repository: repository.check, tags: repository.tags });
      } catch (error) { return respond(res, 400, { error: error.message }); }
    }
    if (req.method === 'POST' && url.pathname === '/api/plugins/git/install/validate') {
      if (!adminOnly(req, res)) return;
      const result = await attemptValidation(await parseBody(req));
      return respond(res, 200, result);
    }
    const configMatch = url.pathname.match(/^\/api\/plugins\/config\/([a-z][a-z0-9-]{2,47})$/);
    if (configMatch && req.method === 'GET') {
      if (!adminOnly(req, res)) return;
      const settings = await readSafeSettings(configMatch[1], url.searchParams.get('attemptId') || undefined);
      return respond(res, 200, { settings });
    }
    if (configMatch && req.method === 'POST') {
      if (!adminOnly(req, res)) return;
      const result = await saveConfig(configMatch[1], await parseBody(req));
      return respond(res, 200, result);
    }
    const userSettingsMatch = url.pathname.match(/^\/api\/plugins\/user-settings\/([a-z][a-z0-9-]{2,47})$/);
    if (userSettingsMatch && ['GET', 'POST'].includes(req.method || '')) {
      const pluginId = userSettingsMatch[1];
      const entry = registry.plugins[pluginId];
      const session = requestSession(req);
      if (!session) return respond(res, 401, { code: 'no_session', error: 'Sessão do The One System inválida ou ausente.' });
      if (!entry) return respond(res, 404, { error: 'Plugin não instalado.' });
      if (!entry.manifest.userConfiguration) return respond(res, 404, { error: 'O plugin não declarou preferências pessoais.' });
      if (!pluginActionGranted(entry, session, 'editar')) return respond(res, 403, { code: 'permission_denied', error: 'A conta não tem permissão editar neste plugin e ambiente.' });
      if (req.method === 'GET') return respond(res, 200, { settings: await readUserSettings(pluginId, session.sub) });
      try { return respond(res, 200, await saveUserSettings(pluginId, session.sub, entry.manifest, await parseBody(req))); }
      catch (error) { return respond(res, Number(error.statusCode) || 400, { error: error.message || 'Não foi possível salvar as preferências pessoais.' }); }
    }
    const accessMatch = url.pathname.match(/^\/api\/plugins\/([a-z][a-z0-9-]{2,47})\/access$/);
    if (accessMatch && req.method === 'POST') {
      if (!adminOnly(req, res)) return;
      const entry = registry.plugins[accessMatch[1]];
      if (!entry) return respond(res, 404, { error: 'Plugin não instalado.' });
      const body = await parseBody(req);
      if (!Array.isArray(body.enabledBrands) || body.enabledBrands.some((brand) => !BRAND_IDS.has(brand))) return respond(res, 400, { error: 'enabledBrands deve conter marcas válidas.' });
      const access = pluginAccess(entry);
      access.enabledBrands = [...new Set(body.enabledBrands)];
      entry.access = access;
      entry.install = { ...entry.install, enabledBrands: access.enabledBrands, active: access.active };
      await writeJsonAtomic(REGISTRY_FILE, registry);
      return respond(res, 200, { ok: true, enabledBrands: access.enabledBrands });
    }
    const activationMatch = url.pathname.match(/^\/api\/plugins\/([a-z][a-z0-9-]{2,47})\/activation$/);
    if (activationMatch && req.method === 'POST') {
      if (!adminOnly(req, res)) return;
      const entry = registry.plugins[activationMatch[1]];
      if (!entry) return respond(res, 404, { error: 'Plugin não instalado.' });
      const body = await parseBody(req);
      if (typeof body.active !== 'boolean') return respond(res, 400, { error: 'active deve ser booleano.' });
      const access = pluginAccess(entry);
      access.active = body.active;
      entry.access = access;
      entry.install = { ...entry.install, enabledBrands: access.enabledBrands, active: access.active };
      await writeJsonAtomic(REGISTRY_FILE, registry);
      return respond(res, 200, { ok: true, active: access.active });
    }
    const grantsMatch = url.pathname.match(/^\/api\/plugins\/([a-z][a-z0-9-]{2,47})\/access\/grants$/);
    if (grantsMatch && req.method === 'POST') {
      if (!adminOnly(req, res)) return;
      const entry = registry.plugins[grantsMatch[1]];
      if (!entry) return respond(res, 404, { error: 'Plugin não instalado.' });
      const body = await parseBody(req);
      const userId = typeof body.userId === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(body.userId) ? body.userId : '';
      if (!userId || !isObject(body.grantsByBrand)) return respond(res, 400, { error: 'Informe userId e grantsByBrand.' });
      const access = pluginAccess(entry);
      const next = {};
      for (const brand of BRAND_IDS) {
        const grant = body.grantsByBrand[brand];
        if (grant == null) continue;
        if (!isObject(grant) || !Array.isArray(grant.actions) || grant.actions.some((action) => !entry.manifest.actions.some((item) => item.id === action)) || !['proprios', 'equipe', 'empresa'].includes(grant.scope)) {
          return respond(res, 400, { error: 'Concessão inválida para a marca ' + brand + '.' });
        }
        const actions = [...new Set(grant.actions)];
        if (actions.length) next[brand] = { actions, scope: grant.scope };
      }
      access.grants[userId] = next;
      entry.access = access;
      await writeJsonAtomic(REGISTRY_FILE, registry);
      return respond(res, 200, { ok: true });
    }
    const operationMatch = url.pathname.match(/^\/api\/plugins\/([a-z][a-z0-9-]{2,47})\/operations\/([a-z][a-z0-9-]*)$/);
    if (operationMatch && req.method === 'GET') return executePluginOperation(req, res, operationMatch[1], operationMatch[2], url);
    if (req.url?.startsWith('/api/')) return respond(res, 404, { error: 'Rota de API inexistente.' });
    if (process.env.NODE_ENV === 'production' || url.port === String(PORT)) return serveStatic(req, res, url);
    respond(res, 404, { error: 'Rota inexistente.' });
  } catch (error) {
    respond(res, Number(error.statusCode) || 400, { error: error.message || 'Falha no servidor.' });
  }
});

server.listen(PORT, HOST, () => {
  if (process.env.NODE_ENV !== 'test') process.stdout.write(`API do The One System ouvindo em http://${HOST}:${PORT}\n`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
