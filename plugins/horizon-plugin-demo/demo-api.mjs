import http from 'node:http';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const host = process.env.DEMO_API_HOST || '127.0.0.1';
const port = Number(process.env.DEMO_API_PORT || 4300);

const records = [
  {
    id: 'DEMO-1001', brandId: 'azime', title: 'Notebook para conferência de integração', status: 'Em análise',
    owner: 'Equipe de demonstração', summary: 'Registro fictício servido pela API própria do Plugin Demo.', updatedAt: '2026-11-18',
  },
  {
    id: 'DEMO-1002', brandId: 'azime', title: 'Validação do fluxo de consulta', status: 'Concluído',
    owner: 'Equipe de demonstração', summary: 'Exemplo de consulta autorizada com contexto de marca.', updatedAt: '2026-11-17',
  },
  {
    id: 'DEMO-2001', brandId: 'alinare', title: 'Verificação de isolamento entre marcas', status: 'Em andamento',
    owner: 'Equipe de demonstração', summary: 'Registro fictício disponível apenas no contexto Alinare.', updatedAt: '2026-11-16',
  },
];

// The demo owns its data independently of the host and its Git checkout.
const dataDir = path.resolve(process.env.DEMO_DATA_DIR || path.join(tmpdir(), 'the-one-system-plugin-demo'));
const stateFile = path.join(dataDir, 'records.json');
await fs.mkdir(dataDir, { recursive: true });
let saved = {};
try {
  saved = JSON.parse(await fs.readFile(stateFile, 'utf8'));
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Dados do Demo inválidos.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
for (const record of records) {
  const value = saved[`${record.brandId}:${record.id}`];
  if (value && ['Em análise', 'Concluído'].includes(value.status) && typeof value.updatedAt === 'string') {
    record.status = value.status;
    record.updatedAt = value.updatedAt;
  }
}
let writes = Promise.resolve();
function updateRecord(record, status) {
  const task = writes.then(async () => {
    const value = { status, updatedAt: new Date().toISOString().slice(0, 10) };
    const next = { ...saved, [`${record.brandId}:${record.id}`]: value };
    const staging = `${stateFile}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(staging, JSON.stringify(next), { flag: 'wx' });
      await fs.rename(staging, stateFile);
    } catch (error) {
      await fs.rm(staging, { force: true }).catch(() => {});
      throw error;
    }
    saved = next;
    Object.assign(record, value);
    const { brandId: _brandId, ...visible } = record;
    return visible;
  });
  writes = task.catch(() => {});
  return task;
}

function json(response, code, value) {
  response.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);
  if (request.method === 'GET' && url.pathname === '/health') {
    return json(response, 200, { ok: true, service: 'horizon-plugin-demo' });
  }
  if (!['GET', 'POST'].includes(request.method)) return json(response, 405, { error: 'method_not_allowed' });

  const actorId = request.headers['x-horizon-actor-id'];
  const brandId = request.headers['x-horizon-brand-id'];
  const permission = request.headers['x-horizon-permission'];
  const scope = request.headers['x-horizon-scope'];
  if (typeof actorId !== 'string' || !['azime', 'alinare', 'novitah'].includes(String(brandId)) || permission !== (request.method === 'POST' ? 'editar' : 'ver') || !['proprios', 'equipe', 'empresa'].includes(String(scope))) {
    return json(response, 401, { error: 'validated_horizon_context_required' });
  }

  if (request.method === 'POST') {
    const match = url.pathname.match(/^\/records\/([A-Za-z0-9_-]{1,80})\/status$/);
    if (!match) return json(response, 404, { error: 'not_found' });
    const record = records.find((item) => item.id === match[1] && item.brandId === brandId);
    if (!record) return json(response, 404, { error: 'record_not_found' });
    let body = '';
    for await (const chunk of request) { body += chunk; if (body.length > 4096) return json(response, 413, { error: 'body_too_large' }); }
    let payload;
    try { payload = JSON.parse(body); } catch { return json(response, 400, { error: 'invalid_json' }); }
    if (!payload || Object.keys(payload).length !== 1 || !['Em análise', 'Concluído'].includes(payload.status)) return json(response, 400, { error: 'invalid_status' });
    try { return json(response, 200, { record: await updateRecord(record, payload.status) }); }
    catch { return json(response, 503, { error: 'demo_storage_unavailable' }); }
  }

  if (url.pathname === '/records') {
    const term = (url.searchParams.get('q') || '').trim().toLocaleLowerCase('pt-BR');
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50)));
    const items = records
      .filter((record) => record.brandId === brandId)
      .filter((record) => !term || `${record.id} ${record.title} ${record.status} ${record.owner}`.toLocaleLowerCase('pt-BR').includes(term))
      .slice(0, limit)
      .map(({ brandId: _brandId, ...record }) => record);
    return json(response, 200, { items });
  }

  const match = url.pathname.match(/^\/records\/([A-Za-z0-9_-]{1,80})$/);
  if (match) {
    const record = records.find((item) => item.id === match[1] && item.brandId === brandId);
    if (!record) return json(response, 404, { error: 'record_not_found' });
    const { brandId: _brandId, ...visible } = record;
    return json(response, 200, {
      record: {
        ...visible,
        movements: [
          { at: record.updatedAt, label: 'Registro consultado pela API de demonstração' },
          { at: '2026-11-15', label: 'Dados de exemplo preparados pelo serviço do plugin' },
        ],
      },
    });
  }
  return json(response, 404, { error: 'not_found' });
});

server.listen(port, host, () => process.stdout.write(`Plugin Demo API ouvindo em http://${host}:${port}\n`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
