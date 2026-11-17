// Validação 0.4: falha e recuperação, mudança de contexto durante operação, retirada de permissão,
// situação alterada e configuração de exportação alterada após aprovação.
const { chromium } = require('playwright');
const BASE = 'http://localhost:5173/#';
const OUT = process.env.OUT || require('path').join(__dirname, 'capturas');
require('fs').mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, ok: !!cond, extra }); console.log(`${cond ? '✔' : '✘'} ${name}${extra ? ' · ' + extra : ''}`); };
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', acceptDownloads: true });
  const d = await ctx.newPage();
  d.on('pageerror', (e) => errors.push(e.message));
  d.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const sess = (patch) => d.evaluate((patch) => {
    const s = JSON.parse(localStorage.getItem('azime-demo-session-v4') || '{}');
    localStorage.setItem('azime-demo-session-v4', JSON.stringify({ ...s, sim: 'normal', ...patch }));
  }, patch);
  const go = async (path, patch) => { if (patch) await sess(patch); await d.goto(BASE + path); await d.reload(); await d.waitForTimeout(900); };
  const data = () => d.evaluate(() => JSON.parse(localStorage.getItem('azime-demo-data-v4')));
  const live = (patch) => d.evaluate((p) => window.__azimeDemo.setSession(p), patch);
  const mutate = (fnSrc) => d.evaluate((src) => window.__azimeDemo.update(new Function('d', src)), fnSrc);
  const shot = (n) => d.screenshot({ path: `${OUT}/${n}.png` });
  const toast = async (re) => { const l = d.locator('.toast', { hasText: re }).first(); await l.waitFor({ timeout: 6000 }); return norm(await l.innerText()); };
  const comments = async (rec, text) => (await data()).comments.filter((c) => c.recordId === rec && c.text === text).length;
  const tf = async (id) => (await data()).ext.chamados.tarefas.find((t) => t.id === id);
  // recarrega com a sessão atual e abre o painel pelo atalho ?painel=<origem>:<registro> (reativo na própria tela)
  const openPanel = async (rec = 't1') => { await go('/inicio'); await d.evaluate((r) => { location.hash = `#/inicio?painel=chamados:${r}`; }, rec); await d.waitForSelector('.drawer.wide'); };

  await d.goto(BASE + '/entrar'); await d.evaluate(() => localStorage.clear());
  await sess({ userId: 'u1', companyId: 'azime', theme: 'light', outages: {} });

  // ================= A. Falha e recuperação =================
  await sess({ outages: { chamados: true } });
  await openPanel('t1');
  const noteA = norm(await d.innerText('.source-note[data-source="chamados"]'));
  ok('A1. Aviso de Chamados descreve cache, envio sob confirmação e tentativa automática', /Conteúdo em cache de/.test(noteA) && /nada é alterado/.test(noteA) && /não são reenviadas automaticamente/.test(noteA) && /Nova tentativa automática em \d+ s/.test(noteA), noteA);
  const TXT = 'Capa revisada com a marca nova.';
  await d.fill('#wp-text', TXT); await d.click('.drawer button:has-text("Comentar")');
  ok('A2. Envio pendente com indicação e opção de cancelar', await d.isVisible('.drawer [data-op="sending"] button:has-text("Cancelar envio")'));
  await d.waitForSelector('.drawer [data-op="failed"][data-code="indisponivel"]');
  await shot('40-falha-operacao');
  ok('A3. Falha clara, nada alterado, texto mantido', (await d.inputValue('#wp-text')) === TXT && (await comments('t1', TXT)) === 0);
  await d.click('.drawer [data-op="failed"] button:has-text("Tentar novamente")');
  await d.waitForSelector('.drawer [data-op="failed"]:has-text("tentativa 2")');
  ok('A4. Nova tentativa com o sistema ainda fora: falha numerada (tentativa 2)', true);
  await live({ outages: {} }); await d.waitForTimeout(400);
  ok('A5. Sistema restabelecido: a plataforma ainda não sabe (aviso permanece até nova tentativa)', await d.isVisible('.source-note[data-source="chamados"]:has-text("indisponível")'));
  await d.fill('#wp-text', TXT + ' (versão final)');
  await d.click('.drawer [data-op="failed"] button:has-text("Tentar novamente")');
  const tA = await toast(/Comentário registrado em TF-311/);
  ok('A6. Tentar novamente usa o texto atual e conclui', (await comments('t1', TXT + ' (versão final)')) === 1 && (await comments('t1', TXT)) === 0, tA);
  ok('A7. Sucesso reconecta a origem: aviso de retorno e texto limpo', await d.isVisible('.source-note.ok[data-source="chamados"]') && (await d.inputValue('#wp-text')) === '');
  await shot('41-recuperacao');
  await d.keyboard.press('Escape');

  // tentativas automáticas da intranet: agendamento, pausa, retomada e retorno visual
  await go('/inicio', { outages: { sharepoint: true } });
  const n1 = norm(await d.innerText('#intranet .source-note'));
  await d.click('#intranet .source-note button:has-text("Pausar automáticas")'); await d.waitForTimeout(200);
  const n2 = norm(await d.innerText('#intranet .source-note'));
  await d.waitForTimeout(1500);
  ok('A8. Pausar cancela o agendamento', /Nova tentativa automática em/.test(n1) && /pausadas/.test(n2) && /pausadas/.test(norm(await d.innerText('#intranet .source-note'))), `${n1} → ${n2}`);
  await shot('42-intranet-pausada');
  await d.click('#intranet .source-note button:has-text("Retomar automáticas")'); await d.waitForTimeout(200);
  const syncBefore = (await data()).sync.sharepoint;
  await live({ outages: {} });
  await d.waitForSelector('#intranet .source-note.ok', { timeout: 20000 });
  const syncAfter = (await data()).sync.sharepoint;
  ok('A9. Tentativa automática agendada reconecta e atualiza o conteúdo', syncAfter > syncBefore, norm(await d.innerText('#intranet .source-note')));
  await shot('43-intranet-reconectada');
  await d.waitForTimeout(8500);
  ok('A10. Retorno visual some depois de alguns segundos', (await d.$$('#intranet .source-note')).length === 0);

  // ================= B. Mudança de contexto durante operação =================
  const TB = 'Rascunho: enviar a capa para aprovação.';
  await openPanel('t1');
  await d.fill('#wp-text', TB); await d.click('.drawer button:has-text("Comentar")');
  await live({ companyId: 'alinare' });
  const tB1 = await toast(/não foi enviado: o ambiente foi trocado/);
  await d.waitForTimeout(1200);
  ok('B1. Troca de ambiente cancela o envio pendente; painel fecha', (await comments('t1', TB)) === 0 && !(await d.isVisible('.drawer.wide')), tB1);
  await live({ companyId: 'azime' }); await d.waitForTimeout(300);
  await openPanel('t1');
  ok('B2. Rascunho volta ao reabrir no ambiente original', (await d.inputValue('#wp-text')) === TB);
  await d.click('.drawer button:has-text("Comentar")');
  await live({ userId: 'u2' });
  const tB3 = await toast(/não foi enviado: a pessoa conectada mudou/);
  await d.waitForTimeout(1200);
  ok('B3. Troca de usuário cancela o envio pendente', (await comments('t1', TB)) === 0, tB3);
  await openPanel('t1');
  ok('B4. Rascunho de Ana não aparece para Bruno', (await d.inputValue('#wp-text').catch(() => '')) === '');
  await d.keyboard.press('Escape');
  await live({ userId: 'u1' }); await d.waitForTimeout(300);
  await openPanel('t1');
  await d.click('.drawer button:has-text("Comentar")'); await d.keyboard.press('Escape');
  const tB5 = await toast(/não foi enviado: o painel foi fechado/);
  await d.waitForTimeout(1200);
  ok('B5. Fechar o painel durante o envio cancela sem alterar', (await comments('t1', TB)) === 0, tB5);
  // registro trocado na mesma tela (detalhe do chamado)
  await go('/chamados/c4');
  const TC = 'Comentário que não deve ir para outro chamado.';
  await d.fill('textarea[aria-label="Novo comentário"]', TC); await d.click('.composer button:has-text("Comentar")');
  await d.evaluate(() => { location.hash = '#/chamados/c1'; });
  const tB6 = await toast(/não foi enviado: (outro registro foi aberto|você saiu da tela)/);
  await d.waitForTimeout(1200);
  const D6 = await data();
  ok('B6. Troca de registro durante o envio: nada vai para nenhum dos dois', !D6.comments.some((c) => c.text === TC), tB6);
  await d.evaluate(() => { location.hash = '#/chamados/c4'; }); await d.waitForTimeout(500);
  ok('B7. Rascunho preservado no registro original', (await d.inputValue('textarea[aria-label="Novo comentário"]')) === TC);
  await shot('44-rascunho-preservado');

  // ================= C. Retirada de permissão e situação alterada =================
  await openPanel('t1');
  await d.click('.drawer .trans button:has-text("Voltar para A fazer")');
  await mutate("const g = d.users.find(u => u.id === 'u1').grants.azime.chamados; g.actions = g.actions.filter(a => a !== 'atender');");
  await d.waitForSelector('.drawer [data-op="failed"]');
  const codeC1 = await d.getAttribute('.drawer [data-op="failed"]', 'data-code');
  ok('C1. Permissão retirada durante o envio: operação recusada pelo acesso atual', codeC1 === 'permissao' && (await tf('t1')).status === 'em_andamento', norm(await d.innerText('.drawer [data-op="failed"]')));
  ok('C2. Painel já reflete o acesso atual (sem transições) e não oferece reenvio', (await d.$$('.drawer .trans button')).length === 0 && !(await d.isVisible('.drawer [data-op="failed"] button:has-text("Tentar novamente")')));
  await shot('45-permissao-retirada');
  // restaura; falha por indisponibilidade; retira permissão; nova tentativa → revalida
  await mutate("const g = d.users.find(u => u.id === 'u1').grants.azime.chamados; if (!g.actions.includes('atender')) g.actions.push('atender');");
  await sess({ outages: { chamados: true } }); await openPanel('t1');
  const TR = 'Enviando para revisão com a capa.';
  await d.fill('#wp-text', TR);
  await d.click('.drawer .trans button:has-text("Enviar para revisão")');
  await d.waitForSelector('.drawer [data-op="failed"][data-code="indisponivel"]');
  await mutate("const g = d.users.find(u => u.id === 'u1').grants.azime.chamados; g.actions = g.actions.filter(a => a !== 'atender');");
  await live({ outages: {} });
  await d.click('.drawer [data-op="failed"] button:has-text("Tentar novamente")');
  await d.waitForSelector('.drawer [data-op="failed"][data-code="permissao"]');
  ok('C3. Nova tentativa após retirada de permissão é recusada (revalidação na tentativa)', (await tf('t1')).status === 'em_andamento' && (await d.inputValue('#wp-text')) === TR);
  // situação alterada por outra pessoa durante o envio
  await mutate("const g = d.users.find(u => u.id === 'u1').grants.azime.chamados; if (!g.actions.includes('atender')) g.actions.push('atender');");
  await d.waitForTimeout(200);
  await d.click('.drawer [data-op="failed"] button:has-text("Entendi")').catch(() => {});
  await d.click('.drawer .trans button:has-text("Enviar para revisão")');
  await mutate("const t = d.ext.chamados.tarefas.find(x => x.id === 't1'); t.status = 'a_fazer';");
  await d.waitForSelector('.drawer [data-op="failed"]');
  const msgC4 = norm(await d.innerText('.drawer [data-op="failed"]'));
  const transC4 = await d.$$eval('.drawer .trans button', (b) => b.map((x) => x.textContent.trim()));
  ok('C4. Situação alterada durante o envio: recusa explicada e ações atualizadas', (await d.getAttribute('.drawer [data-op="failed"]', 'data-code')) === 'situacao' && /A fazer/.test(msgC4) && transC4.join('|') === 'Iniciar tarefa', `${msgC4} · ${transC4.join('|')}`);
  ok('C5. Texto mantido após recusa', (await d.inputValue('#wp-text')) === TR);
  await shot('46-situacao-alterada');
  await d.keyboard.press('Escape');
  // retirada total do acesso ao módulo: nada a enviar
  await mutate("delete d.users.find(u => u.id === 'u1').grants.azime.chamados;"); await d.waitForTimeout(300);
  await go('/chamados/tarefas/t1');
  const m6 = norm(await d.innerText('main')).slice(0, 140);
  ok('C6. Sem acesso ao módulo: registro não é exibido', /não tem acesso|Não encontramos/i.test(m6) && !/Preparar material/.test(m6), m6);
  await d.evaluate(() => localStorage.removeItem('azime-demo-data-v4')); // dados iniciais

  // ================= D. Exportações por aprovação =================
  await go('/reverso/solicitacoes', { userId: 'u4', companyId: 'alinare', outages: {} });
  await d.click('button:has-text("Solicitar exportação")'); await d.fill('#exp-just', 'Conferência semanal de devoluções.');
  await d.click('.dialog-foot button:has-text("Enviar solicitação")'); await toast(/enviada à Gerência/);
  let D = await data();
  const req = D.exportRequests[D.exportRequests.length - 1];
  ok('D1. Pedido registra conteúdo exato (ambiente, registros, campos, formato, hash)', req.content.companyId === 'alinare' && req.content.recordIds.length > 0 && req.content.fields.map((f) => f.key).join(',') === 'numero,motivo,cliente,situacao,abertura' && req.content.formato === 'CSV' && /^[0-9a-f]{8}$/.test(req.hash), `${req.numero} · ${req.content.recordIds.length} registros · #${req.hash}`);
  // regra alterada ANTES da decisão: aprovação bloqueada
  await mutate("const c = d.exportConfig.reverso; c.fields = c.fields.filter(f => f !== 'cliente'); c.versao = (c.versao||1)+1;");
  await go(`/exportacoes/${req.id}`, { userId: 'u6', companyId: 'alinare' });
  ok('D2. Gerência não aprova conteúdo que a regra atual não permite', await d.isDisabled('.page-actions button:has-text("Aprovar exportação")') && /Cliente foi retirado/.test(await d.innerText('main')));
  await shot('47-decisao-bloqueada');
  await mutate("const c = d.exportConfig.reverso; if (!c.fields.includes('cliente')) c.fields.splice(2, 0, 'cliente'); c.versao = (c.versao||1)+1;");
  await d.waitForTimeout(200);
  await d.click('.page-actions button:has-text("Aprovar exportação")'); await d.click('.dialog-foot button:has-text("Aprovar exportação")'); await d.waitForTimeout(400);
  D = await data();
  const ap = D.exportRequests.find((x) => x.id === req.id);
  ok('D3. Aprovação registra o conteúdo autorizado (mesmo hash)', ap.status === 'aprovada' && ap.aprovado.hash === req.hash);
  // serviço de arquivos fora → falha de geração
  await go(`/exportacoes/${req.id}`, { userId: 'u4', companyId: 'alinare', outages: { arquivos: true } });
  let [dl] = await Promise.all([d.waitForEvent('download', { timeout: 2500 }).catch(() => null), d.click('.page-actions button:has-text("Baixar arquivo")')]);
  await d.waitForTimeout(400); D = await data();
  let x = D.exportRequests.find((y) => y.id === req.id);
  ok('D4. Falha de geração distinta: nenhum arquivo, situação mantida, nova tentativa', !dl && x.status === 'aprovada' && x.tentativas.at(-1).result === 'falha' && await d.isVisible('.page-actions button:has-text("Tentar novamente")'), x.tentativas.at(-1).detail);
  await shot('48-export-falha');
  // regra alterada DEPOIS da aprovação → download bloqueado
  await sess({ outages: {} }); await d.reload(); await d.waitForTimeout(800);
  await d.click('.demo-pill'); await d.waitForTimeout(300);
  await d.uncheck('[data-demo-event="rev-cliente"] input'); await d.keyboard.press('Escape'); await d.waitForTimeout(300);
  const chk = norm(await d.innerText('[data-checks]'));
  ok('D5. Verificação mostra a regra alterada após a aprovação', /Regra de exportação\. A regra mudou depois da aprovação: o campo Cliente foi retirado/.test(chk), chk);
  await shot('49-export-regra-alterada');
  [dl] = await Promise.all([d.waitForEvent('download', { timeout: 2500 }).catch(() => null), d.click('.page-actions button:has-text("Tentar novamente")')]);
  await d.waitForTimeout(400); D = await data(); x = D.exportRequests.find((y) => y.id === req.id);
  ok('D6. Download bloqueado e registrado (auditoria)', !dl && x.tentativas.at(-1).result === 'bloqueado' && D.events.some((e) => e.recordId === req.id && /bloqueado/i.test(e.action)), x.tentativas.at(-1).detail);
  // campo devolvido → download confere com o autorizado
  await d.click('.demo-pill'); await d.waitForTimeout(300); await d.check('[data-demo-event="rev-cliente"] input'); await d.keyboard.press('Escape'); await d.waitForTimeout(300);
  [dl] = await Promise.all([d.waitForEvent('download', { timeout: 5000 }).catch(() => null), d.click('.page-actions button:has-text("Baixar arquivo")')]);
  await d.waitForTimeout(400); D = await data(); x = D.exportRequests.find((y) => y.id === req.id);
  let csv = '';
  if (dl) csv = require('fs').readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '');
  const header = csv.split('\n')[0];
  ok('D7. Arquivo gerado corresponde ao autorizado (registros, campos e hash)', x.status === 'gerada' && x.tentativas.at(-1).hash === req.hash && csv.split('\n').length === req.content.recordIds.length + 1 && header === '"Número";"Motivo";"Cliente";"Situação";"Abertura";"Histórico"', `${dl?.suggestedFilename()} · ${header}`);
  await shot('50-export-gerada');
  // acesso retirado → bloqueado
  await mutate("delete d.users.find(u => u.id === 'u4').grants.alinare.reverso;");
  await d.waitForTimeout(300);
  [dl] = await Promise.all([d.waitForEvent('download', { timeout: 2500 }).catch(() => null), d.click('.page-actions button:has-text("Baixar de novo")')]);
  await d.waitForTimeout(400); D = await data(); x = D.exportRequests.find((y) => y.id === req.id);
  ok('D8. Acesso ao módulo retirado: download bloqueado', !dl && x.tentativas.at(-1).result === 'bloqueado' && /acesso/i.test(x.tentativas.at(-1).detail), x.tentativas.at(-1).detail);
  // outro ambiente
  await go(`/exportacoes/${req.id}`, { userId: 'u4', companyId: 'azime' });
  ok('D9. Fora do ambiente da solicitação: verificação aponta e oferece troca', /troque de ambiente/.test(await d.innerText('[data-checks]')) && await d.isVisible('button:has-text("Ir para Alinare")'));
  // alteração de regra pela Gerência avisa aprovações afetadas
  await d.evaluate(() => localStorage.removeItem('azime-demo-data-v4'));
  await go('/admin/exportacoes', { userId: 'u6', companyId: 'alinare' });
  await d.click('.seg button:has-text("Reverso")'); await d.waitForTimeout(200);
  await d.locator('label.check', { hasText: /^Cliente$/ }).locator('input').uncheck(); await d.waitForTimeout(200);
  ok('D10. Gerência é avisada das aprovações que a nova regra bloqueia', /EXP-0006/.test(await d.innerText('.banner-warn')), norm(await d.innerText('.banner-warn')));
  await shot('51-regra-aviso-aprovacoes');
  await d.click('button:has-text("Salvar regra")'); await d.waitForTimeout(300);
  D = await data();
  ok('D11. Nova versão da regra registrada', D.exportConfig.reverso.versao === 2 && D.events.some((e) => /v2/.test(e.action) && e.kind === 'exportacao'));
  // simulada (XLSX)
  await go('/inventario/equipamentos', { userId: 'u5', companyId: 'azime' });
  await d.click('.page-actions button:has-text("Exportar")'); await d.click('.dialog .seg button:has-text("XLSX")');
  [dl] = await Promise.all([d.waitForEvent('download', { timeout: 2500 }).catch(() => null), d.click('.dialog-foot button:has-text("Conferir")')]);
  const tX = await toast(/Exportação simulada/);
  ok('D12. XLSX: exportação simulada (conteúdo conferido, nenhum arquivo)', !dl && /nenhum arquivo/.test(tX), tX);

  // ================= E. Integrações =================
  await go('/inicio', { userId: 'u1', companyId: 'azime' });
  await d.click('.demo-pill'); await d.waitForTimeout(300);
  const states = await d.$$eval('[data-integ-row] [data-state]', (els) => els.map((e) => `${e.getAttribute('data-integration')}:${e.getAttribute('data-state')}`));
  ok('E1. Sem endereços: todas identificadas como simuladas, com adaptador em uso', states.length === 6 && states.every((s) => s.endsWith(':simulado')), states.join(' '));
  ok('E2. Painel diferencia sistema fora do ar e o que a plataforma sabe', /Fora do ar/.test(await d.innerText('.drawer')) && /a plataforma só percebe ao consultar/.test(await d.innerText('.drawer')));
  await shot('52-apresentador-integracoes');
  await d.keyboard.press('Escape');

  ok('Sem erros de console', errors.length === 0, errors.slice(0, 5).join(' || '));
  const fails = results.filter((r) => !r.ok);
  console.log(`\nRESULTADO: ${results.length - fails.length}/${results.length} verificações OK`);
  require('fs').writeFileSync(`${OUT}/robust.json`, JSON.stringify(results, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
