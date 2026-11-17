# Testes automatizados (Playwright)

```bash
npm run dev                       # http://localhost:5173 (em outro terminal)
node testes/flow4.cjs             # regressão dos 10 cenários do roteiro (48 verificações)
node testes/robust4.cjs           # falha/recuperação, contexto, permissão, situação, exportações (38)
node testes/mobile4.cjs           # estados novos em 390 e 360 px (7)

# integrações configuradas e validadas (servidor com variáveis + backend falso)
node testes/mockapi.cjs &
VITE_SHAREPOINT_SITE=https://azime.sharepoint.com/sites/intranet VITE_TEAMS_TENANT=tenant-demo-123 \
VITE_INTEGRATION_API=http://localhost:5199 npx vite --port 5174 &
node testes/integ4.cjs            # (7)
```

Capturas em `testes/capturas/` (ou na pasta indicada em `OUT`). Requer `playwright` instalado.
