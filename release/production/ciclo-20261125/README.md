# Candidata do ciclo 25/11/2026

A candidata parte de `fc0ae22` e integra a revisão homologada `13d6346`. Usa o build oficial e mantém os arquivos Edge oficiais, o contrato de checkout e a prévia de notificações privadas. O código Windows, sua cadeia de confiança e seus testes permanecem na revisão oficial enquanto o port das mudanças de homologação é verificado.

## Banco

- Cadastros: `signup_notice_reads`, `signup_notice_rollout` e `neo_admin_signups` já existem. O lote histórico 01 é um artefato de ensaio anterior e fica fora deste ciclo. O preflight atual verifica presença, mantendo a proteção contra colisões no renderizador anterior.
- Os três arquivos versionados de personalização, prévias de atendimento e ordenação da Biblioteca são independentes da conciliação de pedidos.
- A fundação de custos vem do commit `dac605d4a2a5bf9a587cf09aea4041bdb1e01c14` da PR #50. O editor e o dashboard usam as fontes homologadas. A conciliação 010.06 cria gatilhos síncronos em produtos, pedidos e pagamentos. A homologação do catálogo e de criação de objetos, por si só, não comprova que esses gatilhos preservam as gravações financeiras oficiais. A gestão em massa depende dessa conciliação.
- A Central e o despacho rico ainda dependem da política oficial de emissão de JWT, destinos, autorização e distribuição Windows. Os arquivos SQL de Teste não são elegíveis para execução direta em Produção.

## Gate incremental

A PR #63 usa `release/incremental-readiness.json` para validar migrações, contratos financeiros, localização, campanhas, Connect e smoke autenticado. `release/web-readiness.json` continua servindo ao lançamento público e à mudança de audiência ou condições de cadastro. Este ciclo não altera essas condições nem muda a flag `cloudValidated`. Backup informado pelo proprietário e teste de restauração são evidências distintas.

A conciliação 010.06 e a gestão em massa foram instaladas juntas no ledger oficial `20261125145240`. SHA-256 do SQL executado: `cad075e415bb3fba23dc513a9d9b29427aecc23046f8905bd68c2c707376a215`. O ensaio recriou 39 funções do catálogo oficial em PostgreSQL isolado, testou o ciclo financeiro e comparou seus fingerprints após a aplicação.

A localização oficial usa `api/location-observe.js`, restrito à origem oficial e ao target Production. A configuração exige `NEO_PROD_GEO_ENABLED=1`, `NEO_PROD_SUPABASE_PUBLISHABLE_KEY` e `NEO_PROD_GEO_SERVER_SUPABASE_KEY` no servidor e `productionGeoEnabled: true` na configuração pública somente após comprovar consentimento e funcionamento. As chaves devem ficar no projeto oficial Vercel. Nenhuma coordenada do dispositivo é enviada. A RPC exige registro de consentimento existente e aplica intervalo mínimo entre observações.

A base de rascunhos e versões do editor foi instalada sob o ledger oficial `20261125145355`, SHA-256 `2d3ef567ac648b9b6ab61315f8def011c6d84db397bb1a7753a82d25b8e4f8a5`. O salvamento sob identidade administrativa foi ensaiado em transação revertida. O postflight verificou zero versões persistidas e execução anônima negada. O lote não inclui fila, mídia rica ou Central.
