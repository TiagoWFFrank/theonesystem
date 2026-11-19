import http from 'node:http';

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

function json(response, code, value) {
  response.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);
  if (request.method === 'GET' && url.pathname === '/health') {
    return json(response, 200, { ok: true, service: 'horizon-plugin-demo' });
  }
  if (request.method !== 'GET') return json(response, 405, { error: 'method_not_allowed' });

  const actorId = request.headers['x-horizon-actor-id'];
  const brandId = request.headers['x-horizon-brand-id'];
  const permission = request.headers['x-horizon-permission'];
  const scope = request.headers['x-horizon-scope'];
  if (typeof actorId !== 'string' || !['azime', 'alinare', 'novitah'].includes(String(brandId)) || permission !== 'ver' || !['proprios', 'equipe', 'empresa'].includes(String(scope))) {
    return json(response, 401, { error: 'validated_horizon_context_required' });
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
