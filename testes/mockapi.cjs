// Backend de integração FALSO para validar o fluxo "validar conexão" (responde ok só para sharepoint).
require('http').createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Content-Type', 'application/json');
  const m = req.url.match(/\/integracoes\/(\w+)\/status/);
  if (!m) { res.statusCode = 404; return res.end('{}'); }
  res.end(JSON.stringify(m[1] === 'sharepoint' ? { ok: true, detalhe: 'Graph respondeu 200 para o site' } : { ok: false, detalhe: 'Token recusado pelo tenant' }));
}).listen(5199);
