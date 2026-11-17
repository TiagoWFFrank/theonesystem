const { chromium } = require('playwright');
const BASE = 'http://localhost:5173/#';
const OUT = process.env.OUT || require('path').join(__dirname, 'capturas');
require('fs').mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, ok: !!cond, extra }); console.log(`${cond ? '✔' : '✘'} ${name}${extra ? ' · ' + extra : ''}`); };

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const mk = async (w, h, dsf = 1) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', acceptDownloads: true });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(`[${w}] ${e.message}`));
    p.on('console', (m) => m.type() === 'error' && errors.push(`[${w}] ${m.text()}`));
    return p;
  };
  const waitHash = (p, re) => p.waitForFunction((src) => new RegExp(src).test(location.hash), re.source, { timeout: 8000 });
  const sess = (p, patch) => p.evaluate((patch) => {
    const s = JSON.parse(localStorage.getItem('azime-demo-session-v4') || '{}');
    localStorage.setItem('azime-demo-session-v4', JSON.stringify({ ...s, sim: 'normal', ...patch }));
  }, patch);
  const go = async (p, path, patch) => { if (patch) await sess(p, patch); await p.goto(BASE + path); await p.reload(); await p.waitForTimeout(900); };
  const data = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('azime-demo-data-v4')));
  const shot = (p, n, full = false) => p.screenshot({ path: `${OUT}/${n}.png`, fullPage: full });
  const toastText = async (p, re) => { if (re) { await p.locator('.toast', { hasText: re }).first().waitFor({ timeout: 5000 }); return p.locator('.toast', { hasText: re }).first().innerText(); } await p.waitForSelector('.toast', { timeout: 4000 }); return p.innerText('.toast >> nth=-1'); };

  const d = await mk(1440, 1000);
  // ---------- 1 ----------
  await d.goto(BASE + '/entrar'); await d.evaluate(() => localStorage.clear()); await d.reload(); await d.waitForTimeout(500);
  await d.click('button.ms-btn'); await d.click('button.account:has-text("Ana Ribeiro")'); await d.waitForSelector('text=Escolha o ambiente');
  await d.click('button.env-card:has-text("AZIME")'); await d.click('button:has-text("Entrar em AZIME")'); await waitHash(d, /inicio/); await d.waitForTimeout(1000);
  await shot(d, '01-inicio-ana');
  const chips = await d.$$eval('.wfilters .frow:first-child .seg-filter button', (b) => b.map((x) => x.textContent));
  ok('1. Meu trabalho com origens Chamados/Feedback/Viagens', chips.some((c) => c.startsWith('Chamados')) && chips.some((c) => c.startsWith('Feedback')), chips.join(' | '));
  ok('1. Intranet com comunicados', (await d.$$('.posts .post')).length >= 2);
  ok('1. Teams com mensagens', (await d.$$('.mlist .mrow')).length >= 2);
  ok('1. Notificações no painel', (await d.$$('.nlist .nrow')).length >= 3);
  ok('1. Distinção responsável × acompanhando', (await d.$$('.witem.rel-responsavel')).length > 0 && (await d.$$('.witem.rel-solicitante')).length > 0);
  // contagens = listas (página Meu trabalho completa)
  await d.goto(BASE + '/pendencias'); await d.waitForTimeout(700);
  for (const label of ['Chamados', 'Feedback', 'Viagens']) {
    const btn = d.locator('.wfilters .frow:first-child .seg-filter button', { hasText: label });
    const n = +(await btn.locator('.n').innerText()); await btn.click(); await d.waitForTimeout(150);
    const rows = (await d.$$('.witem')).length; ok(`1. Filtro origem ${label}: contagem ${n} = itens ${rows}`, n === rows);
    await btn.click();
  }
  const sitBtn = d.locator('.wfilters .frow:nth-child(2) .seg-filter button', { hasText: 'Precisa de você' });
  const nSit = +(await sitBtn.locator('.n').innerText()); await sitBtn.click(); await d.waitForTimeout(150);
  ok(`1. Filtro situação “Precisa de você” ${nSit} = itens`, nSit === (await d.$$('.witem')).length); await sitBtn.click();
  const links = await d.$$eval('.work-foot a', (as) => as.map((a) => ({ href: a.getAttribute('href'), n: +(a.querySelector('b')?.textContent ?? -1) })).filter((l) => l.n >= 0 && !l.href.includes('inicio')));
  for (const l of links) {
    await d.goto(BASE + l.href.replace(/^#/, '')); await d.waitForTimeout(800);
    const n = (await d.$$('.tbl tbody tr')).length || (await d.$$('.card-body > .att')).length;
    ok(`1. Fila ${l.href} ${l.n} = lista ${n}`, l.n === n);
  }

  // ---------- 2 & 3 ----------
  await go(d, '/inicio');
  await d.locator('.witem', { hasText: 'TF-311' }).locator('button').click(); await d.waitForSelector('.drawer.wide'); await d.waitForTimeout(300);
  await shot(d, '02-painel-tf311');
  const before = (await d.$$('.drawer .cmt')).length;
  await d.fill('#wp-text', 'Números do trimestre incluídos; falta só a capa com a marca.');
  await d.click('.drawer button:has-text("Comentar")'); const t2 = await toastText(d);
  await d.waitForTimeout(300);
  ok('2. Comentário registrado pelo painel', (await d.$$('.drawer .cmt')).length === before + 1, t2);
  await shot(d, '03-painel-comentado');
  const trans = await d.$$eval('.drawer .trans button', (b) => b.map((x) => x.textContent.trim()));
  ok('3. Só transições válidas (em andamento)', trans.join('|') === 'Enviar para revisão|Voltar para A fazer', trans.join(' | '));
  await d.click('.drawer .trans button:has-text("Enviar para revisão")'); const t3 = await toastText(d, /revisão de/); await d.waitForTimeout(300);
  ok('3. Tarefa avançada', /revisão/.test(t3), t3);
  ok('3. Painel atualizado: Em revisão, sem transições', (await d.innerText('.drawer .badge >> nth=0')).includes('Em revisão') && (await d.$$('.drawer .trans button')).length === 0);
  await d.click('.drawer a:has-text("Abrir no módulo")'); await waitHash(d, /chamados\/tarefas\/t1/); await d.waitForTimeout(500);
  await d.click('.tab:has-text("Histórico")'); await d.waitForTimeout(200);
  const hist = await d.innerText('.timeline');
  ok('3. Histórico do módulo tem comentário e avanço', /Comentário/.test(hist) && /Enviada para revisão/.test(hist));
  await shot(d, '04-modulo-historico');
  await go(d, '/chamados/tarefas?visao=minhas');
  ok('3. Lista do módulo reflete Em revisão', (await d.locator('tr', { hasText: 'TF-311' }).innerText()).includes('Em revisão'));
  let D = await data(d);
  ok('3. Notificação + e-mail para o revisor (Bruno)', D.notifications.some((n) => n.userId === 'u2' && n.recordId === 't1') && D.emails.some((e) => e.toUserId === 'u2' && e.recordId === 't1'));

  // ---------- 4 ----------
  await go(d, '/inicio', { userId: 'u2', companyId: 'azime' });
  await shot(d, '05-inicio-bruno-aprovacao');
  const rv = d.locator('.witem', { hasText: 'TF-311' });
  ok('4. Aprovação aparece para o líder com “Decidir no módulo”', (await rv.locator('button').innerText()).includes('Decidir'));
  await rv.locator('button').click(); await waitHash(d, /chamados\/tarefas\/t1/); await d.waitForTimeout(500);
  await shot(d, '06-decisao-no-modulo');
  await d.click('button:has-text("Aprovar e concluir")'); const t4 = await toastText(d); await d.waitForTimeout(400);
  ok('4. Decisão tomada no módulo', /concluída/.test(t4), t4);
  D = await data(d);
  ok('4. Auditoria registra a decisão', D.events.some((e) => e.recordId === 't1' && e.kind === 'decisao'));

  // ---------- 5 ----------
  await go(d, '/inicio', { userId: 'u1', companyId: 'azime' });
  const unreadBefore = +(await d.innerText('button[aria-label^="Notificações"] .count').catch(() => '0'));
  await d.click('.post:has-text("Festa de fim de ano")'); await waitHash(d, /intranet\/p1/); await d.waitForTimeout(500);
  await shot(d, '07-comunicado-festa');
  ok('5. Comunicado com origem e alcance', (await d.innerText('article')).includes('SharePoint') && (await d.innerText('article')).includes('Todo o grupo'));
  const unreadAfter = +(await d.innerText('button[aria-label^="Notificações"] .count').catch(() => '0'));
  ok(`5. Leitura sincronizada com o sino (${unreadBefore} → ${unreadAfter})`, unreadAfter === unreadBefore - 1);

  // ---------- 6 ----------
  await go(d, '/inicio');
  await d.click('.mrow:has-text("Bruno Teixeira")'); await d.waitForTimeout(400);
  await shot(d, '08-teams-conversa');
  ok('6. Conversa do Teams aberta', (await d.$$('.drawer .thread .cmt')).length >= 2);
  ok('6. Sem destino real: botão desabilitado e motivo informado', await d.isDisabled('.drawer button:has-text("Abrir no Teams")') && /Registro demonstrativo/.test(await d.innerText('.drawer')));
  await d.keyboard.press('Escape');

  // ---------- 7 ----------
  await d.click('.env-btn'); await d.click('.popover .menu-item:has-text("Alinare")'); await d.waitForTimeout(1200);
  await shot(d, '09-inicio-ana-alinare');
  const txt7 = await d.innerText('main');
  ok('7. Alinare: tarefa TF-207, procedimento de reverso e canal Showroom', /TF-207/.test(txt7) && /logística reversa/i.test(txt7) && /Showroom/.test(txt7));
  ok('7. Alinare: comunicado exclusivo da AZIME não aparece', !/Inventário anual/.test(txt7));
  await d.click('.env-btn'); await d.click('.popover .menu-item:has-text("Novitah")'); await d.waitForTimeout(1200);
  const txt7b = await d.innerText('main');
  ok('7. Novitah: Chamados não habilitado pela TI, coleção Terracota visível', !/CH-\d/.test(txt7b) && /Terracota/.test(txt7b));
  await shot(d, '10-inicio-ana-novitah');

  // ---------- 8 ----------
  await go(d, '/inicio', { userId: 'u1', companyId: 'azime', outages: { sharepoint: true } });
  await shot(d, '11-intranet-indisponivel');
  ok('8. Aviso só na área da intranet', (await d.$$('#intranet .source-note')).length === 1 && (await d.$$('.source-note')).length === 1);
  const n8 = await d.innerText('#intranet .source-note');
  ok('8. Aviso descreve cache e tentativa automática agendada', /Conteúdo em cache de/.test(n8) && /Nova tentativa automática em\s+\d+ s/.test(n8), n8.replace(/\n/g, ' '));
  await d.click('#intranet .source-note button:has-text("Tentar agora")'); await d.waitForTimeout(1300);
  const n8b = await d.innerText('#intranet .source-note');
  ok('8. “Tentar agora” com retorno claro (continua fora, 1 tentativa sem resposta)', /1 tentativa sem resposta/.test(n8b), n8b.replace(/\n/g, ' '));
  await d.locator('.witem', { hasText: 'CH-2041' }).locator('button').click(); await d.waitForSelector('.drawer.wide');
  await d.fill('#wp-text', 'Cadastro atualizado com o novo comprador.'); await d.click('.drawer button:has-text("Comentar")'); const t8b = await toastText(d, /Comentário registrado em CH-2041/);
  ok('8. Chamados continuam utilizáveis com a intranet fora', /Comentário registrado/.test(t8b));
  await d.keyboard.press('Escape');
  // falha de operação: chamados fora
  await go(d, '/inicio', { outages: { chamados: true } });
  await d.locator('.witem', { hasText: 'CH-2041' }).locator('button').click(); await d.waitForSelector('.drawer.wide');
  await d.fill('#wp-text', 'Teste com o sistema fora.'); await d.click('.drawer button:has-text("Comentar")'); await d.waitForSelector('.drawer .banner-danger');
  await shot(d, '12-operacao-malsucedida');
  ok('8. Operação malsucedida: erro, texto mantido, tentar novamente', (await d.inputValue('#wp-text')) === 'Teste com o sistema fora.' && await d.isVisible('.drawer .banner-danger button:has-text("Tentar novamente")'));
  await sess(d, { outages: {} }); await d.keyboard.press('Escape');

  // ---------- 9 ----------
  await go(d, '/admin/colaboradores/u1', { userId: 'u5', companyId: 'alinare', outages: {} });
  await shot(d, '13-concessoes-ana');
  await d.check('input[aria-label="Alinare · Reverso · Aprovar ou devolver"]');
  await d.uncheck('input[aria-label="Alinare · Reverso · Abrir solicitação"]'); await d.waitForTimeout(200);
  await shot(d, '14-concessoes-diff');
  await d.click('button:has-text("Revisar e aplicar")'); await d.click('.dialog-foot button:has-text("Aplicar alterações")'); await d.waitForTimeout(500);
  D = await data(d);
  const g = D.users.find((u) => u.id === 'u1').grants.alinare.reverso;
  ok('9. Concessão (aprovar) e retirada (abrir) efetivas', g.actions.includes('aprovar') && !g.actions.includes('abrir'), g.actions.join(','));
  ok('9. Auditoria + e-mail da alteração', D.events.filter((e) => e.kind === 'acesso' && e.recordId === 'u1').length >= 2 && D.emails.some((e) => e.toUserId === 'u1' && /acessos/.test(e.subject)));
  await go(d, '/reverso/solicitacoes', { userId: 'u1', companyId: 'alinare' });
  ok('9. Ana não vê mais “Abrir solicitação”', !(await d.isVisible('a:has-text("Abrir solicitação")')));
  await go(d, '/admin/auditoria?tipo=acesso', { userId: 'u5', companyId: 'alinare' }); await shot(d, '15-auditoria-acessos');

  // ---------- 10 ----------
  await go(d, '/inventario/equipamentos', { userId: 'u5', companyId: 'azime' });
  await d.click('.page-actions button:has-text("Exportar")'); await d.waitForTimeout(300); await shot(d, '16-export-permanente');
  await d.click('.dialog-foot button:has-text("Gerar arquivo")'); const t10 = await toastText(d);
  ok('10. Exportação permanente (TI · Inventário)', /gerado/.test(t10), t10);
  await go(d, '/reverso/solicitacoes', { userId: 'u4', companyId: 'alinare' });
  ok('10. Expedição vê “Solicitar exportação” (não exporta direto)', await d.isVisible('button:has-text("Solicitar exportação")') && !(await d.isVisible('.page-actions button:text-is("Exportar")')));
  await d.click('button:has-text("Solicitar exportação")'); await d.fill('#exp-just', 'Fechamento mensal da expedição de novembro.'); await shot(d, '17-export-solicitacao');
  await d.click('.dialog-foot button:has-text("Enviar solicitação")'); const t10b = await toastText(d);
  ok('10. Solicitação enviada à Gerência', /EXP-/.test(t10b), t10b);
  await go(d, '/inicio', { userId: 'u6', companyId: 'alinare' });
  const exp = d.locator('.witem', { hasText: 'Decidir exportação' });
  ok('10. Gerência recebe a decisão em Meu trabalho', (await exp.count()) === 1);
  await exp.locator('button').click(); await waitHash(d, /exportacoes\//); await d.waitForTimeout(400); await shot(d, '18-export-decisao');
  await d.click('.page-actions button:has-text("Aprovar exportação")'); await d.click('.dialog-foot button:has-text("Aprovar exportação")'); await d.waitForTimeout(500);
  await go(d, '/inicio', { userId: 'u4', companyId: 'alinare' });
  await d.locator('.witem', { hasText: 'baixar arquivo' }).locator('button').click(); await waitHash(d, /exportacoes\//); await d.waitForTimeout(400);
  const [dl] = await Promise.all([d.waitForEvent('download', { timeout: 5000 }).catch(() => null), d.click('.page-actions button:has-text("Baixar arquivo")')]); await d.waitForTimeout(500);
  ok('10. Arquivo gerado após aprovação (download real do CSV)', (await d.innerText('.page-sub')).includes('Arquivo gerado') && !!dl, dl ? dl.suggestedFilename() : 'sem download');
  await shot(d, '19-export-gerada');
  D = await data(d);
  ok('10. Auditoria de exportações', D.events.filter((e) => e.kind === 'exportacao').length >= 3);
  ok('8. E-mails vinculados a eventos (destinatário/assunto/registro)', D.emails.every((e) => e.to && e.subject && e.link), `${D.emails.length} e-mails`);

  // ---------- presenter + e-mails ----------
  await go(d, '/inicio', { userId: 'u1', companyId: 'azime' });
  await d.click('button.demo-pill'); await d.waitForTimeout(300); await shot(d, '20-apresentador');
  await d.click('button:has-text("Caixa de saída")'); await d.waitForTimeout(300); await d.click('.email-row >> nth=0'); await d.waitForTimeout(300);
  await shot(d, '21-email-simulado');
  await d.keyboard.press('Escape'); await d.keyboard.press('Escape');

  // ---------- marcas × temas ----------
  for (const b of ['azime', 'alinare', 'novitah']) for (const t of ['light', 'dark']) {
    await go(d, '/inicio', { userId: 'u1', companyId: b, theme: t, outages: {} });
    await shot(d, `30-inicio-${b}-${t}`);
  }
  await go(d, '/chamados/c2', { userId: 'u1', companyId: 'azime', theme: 'light' }); await shot(d, '31-chamado-detalhe');
  await go(d, '/chamados?visao=atribuidos', { userId: 'u5', companyId: 'azime', theme: 'dark' }); await shot(d, '32-chamados-lista-ti');

  // ---------- celular ----------
  const m = await mk(390, 844, 2);
  await m.goto(BASE + '/entrar');
  await m.evaluate(() => localStorage.setItem('azime-demo-session-v4', JSON.stringify({ userId: 'u1', companyId: 'azime', theme: 'light' })));
  await m.goto(BASE + '/inicio'); await m.reload(); await m.waitForTimeout(900);
  await shot(m, '50-m-inicio', true);
  await m.locator('.witem', { hasText: 'TF-314' }).locator('button').click(); await m.waitForTimeout(500); await shot(m, '51-m-painel');
  await m.keyboard.press('Escape');
  await m.goto(BASE + '/intranet/p1'); await m.waitForTimeout(600); await shot(m, '52-m-comunicado');
  await m.goto(BASE + '/chamados/tarefas/t3'); await m.waitForTimeout(600); await shot(m, '53-m-tarefa');
  const ov = [];
  for (const path of ['/inicio', '/pendencias', '/chamados', '/chamados/c4', '/intranet', '/admin/colaboradores/u1', '/exportacoes/x1']) {
    await m.goto(BASE + path); await m.waitForTimeout(500);
    if (await m.evaluate(() => document.documentElement.scrollWidth > innerWidth)) ov.push(path);
  }
  ok('Celular sem rolagem horizontal', ov.length === 0, ov.join(','));
  const m2 = await mk(360, 780, 2);
  await m2.goto(BASE + '/entrar');
  await m2.evaluate(() => localStorage.setItem('azime-demo-session-v4', JSON.stringify({ userId: 'u2', companyId: 'alinare', theme: 'dark' })));
  await m2.goto(BASE + '/inicio'); await m2.reload(); await m2.waitForTimeout(900); await shot(m2, '54-m360-bruno-alinare-escuro');
  ok('360 px sem rolagem horizontal', !(await m2.evaluate(() => document.documentElement.scrollWidth > innerWidth)));

  ok('Sem erros de console', errors.length === 0, errors.slice(0, 5).join(' || '));
  const fails = results.filter((r) => !r.ok);
  console.log(`\nRESULTADO: ${results.length - fails.length}/${results.length} verificações OK`);
  require('fs').writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
