const { chromium } = require('playwright');
const BASE = 'http://localhost:5173/#';
const OUT = process.env.OUT || require('path').join(__dirname, 'capturas');
require('fs').mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, ok: !!cond, extra }); console.log(`${cond ? '✔' : '✘'} ${name}${extra ? ' · ' + extra : ''}`); };
(async () => {
  const b = await chromium.launch();
  const errors = [];
  for (const [w, h, brand, theme] of [[390, 844, 'azime', 'light'], [360, 780, 'alinare', 'dark']]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, locale: 'pt-BR' })).newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    const set = (s) => p.evaluate((s) => localStorage.setItem('azime-demo-session-v4', JSON.stringify(s)), s);
    await p.goto(BASE + '/entrar'); await p.evaluate(() => localStorage.clear());
    const company = brand === 'azime' ? 'azime' : 'alinare';
    const rec = brand === 'azime' ? 't1' : 't5';
    await set({ userId: 'u1', companyId: company, theme, outages: { chamados: true, sharepoint: true } });
    await p.goto(BASE + '/inicio'); await p.reload(); await p.waitForTimeout(900);
    const ov = async () => p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    ok(`${w}px · Início com avisos de Chamados e intranet sem rolagem horizontal`, !(await ov()) && (await p.$$('.source-note')).length >= 2);
    await p.screenshot({ path: `${OUT}/70-m${w}-avisos.png` });
    await p.goto(BASE + `/inicio?painel=chamados:${rec}`); await p.waitForSelector('.drawer.wide');
    await p.fill('#wp-text', 'Teste no celular com o sistema fora.'); await p.click('.drawer button:has-text("Comentar")');
    await p.waitForSelector('.drawer [data-op="failed"]');
    await p.locator('.drawer [data-op="failed"]').scrollIntoViewIfNeeded();
    ok(`${w}px · Falha no painel legível e sem rolagem horizontal`, !(await ov()) && await p.isVisible('.drawer [data-op="failed"] button:has-text("Tentar novamente")'));
    await p.screenshot({ path: `${OUT}/71-m${w}-painel-falha.png` });
    await set({ userId: 'u4', companyId: 'alinare', theme, outages: {} });
    await p.goto(BASE + '/exportacoes/x1'); await p.reload(); await p.waitForTimeout(900);
    ok(`${w}px · Exportação com verificação e tentativas sem rolagem horizontal`, !(await ov()) && await p.isVisible('[data-checks]'));
    await p.screenshot({ path: `${OUT}/72-m${w}-exportacao.png`, fullPage: true });
  }
  ok('Sem erros de console', errors.length === 0, errors.join(' | '));
  console.log(`RESULTADO: ${results.filter((r) => r.ok).length}/${results.length}`);
  require('fs').writeFileSync(`${OUT}/mobile.json`, JSON.stringify(results, null, 1));
  await b.close();
})();
