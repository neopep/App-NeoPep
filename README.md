# NeoPeptídeos
Sua evolução, em suas mãos.

Aplicativo atual e único deste projeto: HTML/CSS/JavaScript, PWA, SDK oficial Supabase e funções PostgreSQL/Edge. A publicação principal abre NeoPeptídeos na raiz. `/neo/` entrega os mesmos arquivos por compatibilidade com links, autenticação e instalações existentes. O acesso da hospedagem permanece restrito para validação.

- [Lançamento web e preparação das lojas](docs/LANCAMENTO-WEB-E-LOJAS.md)
- [Configurar e-mails de produção](docs/EMAIL-PRODUCAO.md)
- [Estado atual e consolidação](docs/CONSOLIDACAO.md)
- [Uso e preservação dos dados](docs/USO-E-PREVIA.md)
- [Configuração de autenticação e dados](docs/ETAPA-2-ATIVACAO.md)
- [Hospedagem futura na Vercel](docs/VERCEL.md)

Os demais relatórios documentam etapas anteriores; afirmações sobre uma versão antiga preservada na raiz não representam a publicação atual. O histórico Git permite recuperar versões anteriores sem mantê-las no pacote publicado.

```sh
npm ci
npm run build
npm run check
npm test
node scripts/stage-preview.cjs
```

`dist/` é a fonte estática atual; `artifacts/hosting-preview/` é o pacote de hospedagem completo, incluindo a compatibilidade `/neo/`. A preparação limpa somente esse diretório gerado, impedindo que arquivos antigos sejam publicados novamente. Não altera dados de usuários. `npm run preview:package` gera uma prévia HTML portátil, sem service worker, destinada à revisão.

A URL e a chave Supabase publishable no navegador são públicas por definição. Nunca inserir `service_role`, credenciais administrativas ou segredos de pagamento no frontend. Mudanças externas e integrações pendentes devem ser validadas antes de liberar o acesso ao público.
