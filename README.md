# NeoPep
Sua evolução, em suas mãos.

**Ponto de partida vigente (26/11/2026):** [Marco oficial de continuidade](docs/MARCO-20261126.md) · [Inventário Supabase](docs/MIGRACOES-MARCO-20261126.md). Consulte os SHAs publicados e branches de continuidade antes de iniciar alterações. Produção e Teste estão publicados em domínios próprios; a homologação funcional integral permanece pendente.

Aplicativo atual e único deste projeto: HTML/CSS/JavaScript, PWA, SDK oficial Supabase e funções PostgreSQL/Edge. A publicação principal abre NeoPep na raiz. `/neo/` entrega os mesmos arquivos por compatibilidade com links, autenticação e instalações existentes. As configurações de acesso vigentes foram preservadas; consulte o marco para distinguir publicação incremental de homologação pública integral.

- [Lançamento web e preparação das lojas](docs/LANCAMENTO-WEB-E-LOJAS.md)
- [Configurar e-mails de produção](docs/EMAIL-PRODUCAO.md)
- [Estado atual e consolidação](docs/CONSOLIDACAO.md)
- [Uso e preservação dos dados](docs/USO-E-PREVIA.md)
- [Configuração de autenticação e dados](docs/ETAPA-2-ATIVACAO.md)
- [Histórico de configuração da Vercel](docs/VERCEL.md)

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
